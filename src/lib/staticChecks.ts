// The validator's code checks run in the browser before the publication fee: the same rule book the
// collections-curation-server applies after payment, on the same files and metadata, so a creator never
// pays for a collection the automatic review is going to reject on a static rule.
import { validate as runValidator, fixes, type Finding, type Input } from '@dcl-regenesislabs/wearable-validator'
import { buildItemEntityMetadata, getEntityContent, type EntityContent } from '~/lib/catalystEntity'
import { type Collection } from '~/lib/collections'
import { type FindingSeverity, type ValidationFinding } from '~/lib/events'
import { ItemType, type Item } from '~/lib/items'

export type StaticFinding = ValidationFinding & { check: string }

export type ItemStaticChecks = {
  itemId: string
  findings: StaticFinding[]
  errors: number
  warnings: number
}

export type StaticChecksResult = {
  items: ItemStaticChecks[]
  errors: number
  warnings: number
  durationMs: number
}

export type StaticChecksProgress = { done: number; total: number; itemId: string }

type Deps = {
  fetchContent: (hash: string) => Promise<Blob>
  validate?: typeof runValidator
  onProgress?: (progress: StaticChecksProgress) => void
  signal?: AbortSignal
}

/**
 * The identity `createCollection` will give each item: token ids follow the items' creation order, and the
 * URN is the collection's plus that id. Validating with it means the metadata check sees the same document
 * the server will deploy.
 */
export function withPublishedIdentity(collection: Collection, items: Item[]): Item[] {
  const ordered = [...items].sort((a, b) => a.createdAt - b.createdAt)
  return items.map(item => {
    if (item.tokenId && item.urn) return item
    const tokenId = String(ordered.indexOf(item))
    return { ...item, tokenId, urn: `${collection.urn}:${tokenId}` }
  })
}

function toBuilderManifest(item: Item): Record<string, unknown> {
  const { category, representations, hides, replaces, tags, loop, requiredPermissions, springBones } = item.data
  const base = { name: item.name, description: item.description, rarity: item.rarity }
  if (item.type === ItemType.EMOTE) return { ...base, emote: { category, representations, tags, loop } }
  return { ...base, data: { category, representations, hides, replaces, tags, requiredPermissions, springBones } }
}

/** The validator input for one item: its files by path, the entity metadata and the content list. */
export function buildStaticCheckInput(
  collection: Collection,
  item: Item,
  blobs: Map<string, Uint8Array>,
  content: EntityContent
): Input {
  const files = new Map(blobs)
  // A collection saved before it got a contract address has no URN to build entity metadata from; the
  // Builder manifest carries the same fields and the validator reads it from the files instead.
  if (!collection.contractAddress) {
    const manifest = item.type === ItemType.EMOTE ? 'emote.json' : 'wearable.json'
    files.set(manifest, new TextEncoder().encode(JSON.stringify(toBuilderManifest(item))))
    return { files }
  }
  return {
    files,
    metadata: buildItemEntityMetadata(collection, item, content),
    content: Object.entries(content).map(([file, hash]) => ({ file, hash }))
  }
}

export function toStaticFinding(finding: Finding): StaticFinding {
  return {
    check: finding.check,
    rule: finding.rule,
    severity: finding.severity,
    message: finding.message,
    where: finding.where,
    measured: finding.measured,
    limit: finding.limit,
    fix: fixes[finding.check],
    docs: finding.docs
  }
}

function count(findings: { severity: FindingSeverity }[], severity: FindingSeverity): number {
  return findings.filter(finding => finding.severity === severity).length
}

async function downloadContent(
  content: EntityContent,
  fetchContent: Deps['fetchContent']
): Promise<Map<string, Uint8Array>> {
  const entries = await Promise.all(
    Object.entries(content).map(async ([path, hash]) => {
      const blob = await fetchContent(hash)
      return [path, new Uint8Array(await blob.arrayBuffer())] as const
    })
  )
  return new Map(entries)
}

/** Runs the code checks on every item, one after another; the smart-wearable preview video is never downloaded. */
export async function runStaticChecks(
  collection: Collection,
  items: Item[],
  { fetchContent, validate = runValidator, onProgress, signal }: Deps
): Promise<StaticChecksResult> {
  const started = Date.now()
  const results: ItemStaticChecks[] = []
  const identified = withPublishedIdentity(collection, items)
  for (const [index, item] of identified.entries()) {
    signal?.throwIfAborted()
    const content = getEntityContent(item)
    const files = await downloadContent(content, fetchContent)
    const result = await validate(buildStaticCheckInput(collection, item, files, content), {
      signal,
      // With a listener the validator yields between checks, so the wizard keeps painting.
      onProgress: () => undefined
    })
    const findings = result.findings.map(toStaticFinding)
    results.push({ itemId: item.id, findings, errors: count(findings, 'error'), warnings: count(findings, 'warning') })
    onProgress?.({ done: index + 1, total: identified.length, itemId: item.id })
  }
  return {
    items: results,
    errors: results.reduce((sum, item) => sum + item.errors, 0),
    warnings: results.reduce((sum, item) => sum + item.warnings, 0),
    durationMs: Date.now() - started
  }
}

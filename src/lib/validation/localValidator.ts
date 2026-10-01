// The in-browser backend: the shared Decentraland rule book (@dcl-regenesislabs/wearable-validator),
// restricted to the model and emote groups the editor can act on.
import { validate, type Finding, type Result } from '@dcl-regenesislabs/wearable-validator'
import { getContentsStorageUrl } from '../builder'
import { isImageFile } from '../itemFiles'
import { ItemType } from '../items'
import {
  ValidationSeverity,
  type ItemValidator,
  type ValidateOptions,
  type ValidationContext,
  type ValidationEntry,
  type ValidationIssue,
  type ValidationResult,
  type ValidationSource
} from './types'

async function loadMainFile(
  source: ValidationSource,
  ctx: ValidationContext,
  signal?: AbortSignal
): Promise<{ mainFile: string; bytes?: Uint8Array }> {
  if (source.kind === 'blob') {
    if (isImageFile(source.mainFile)) return { mainFile: source.mainFile }
    return { mainFile: source.mainFile, bytes: new Uint8Array(await source.contents[source.mainFile].arrayBuffer()) }
  }
  const { item } = source
  const representation =
    item.data.representations.find(candidate => ctx.bodyShape && candidate.bodyShapes.includes(ctx.bodyShape)) ??
    item.data.representations[0]
  if (!representation) throw new Error(`Item "${item.id}" has no representation to validate`)
  if (isImageFile(representation.mainFile)) return { mainFile: representation.mainFile }
  const response = await fetch(getContentsStorageUrl(item.contents[representation.mainFile]), { signal })
  if (!response.ok) throw new Error(`Could not load "${representation.mainFile}" (${response.status})`)
  return { mainFile: representation.mainFile, bytes: new Uint8Array(await response.arrayBuffer()) }
}

/** The slice of entity metadata the model/emote checks read: type, category and the hides that pool triangle budgets. */
function toMetadata(ctx: ValidationContext) {
  return ctx.type === ItemType.EMOTE
    ? { emoteDataADR74: {} }
    : { data: { category: ctx.category, hides: ctx.hides ?? [] } }
}

function toIssue(finding: Finding): ValidationIssue {
  return {
    code: finding.check,
    severity: finding.severity === 'error' ? ValidationSeverity.ERROR : ValidationSeverity.WARNING,
    message: finding.message,
    where: finding.where
  }
}

export function toIssues(result: Result): ValidationIssue[] {
  // A category-dependent check without a category is not a problem with the model; the Add Items modal
  // re-derives the triangle budget itself once a category is picked.
  const issues = result.findings.filter(finding => finding.data?.reason !== 'category-unknown').map(toIssue)
  // A model the validator could not parse (a damaged GLB, a .gltf) skips every check: never show that as a pass.
  const skipped = result.checks.find(check => check.status === 'skipped' && check.skipReason)
  if (skipped && issues.length === 0) {
    issues.push({ code: 'file-format', severity: ValidationSeverity.ERROR, message: skipped.skipReason })
  }
  return issues
}

async function validateOne(
  source: ValidationSource,
  ctx: ValidationContext,
  opts: ValidateOptions = {}
): Promise<ValidationResult> {
  opts.signal?.throwIfAborted()
  const { mainFile, bytes } = await loadMainFile(source, ctx, opts.signal)
  // Texture-only wearables have no geometry to inspect.
  if (!bytes) return { issues: [] }
  const result = await validate(
    { files: new Map([[mainFile, bytes]]), metadata: toMetadata(ctx) },
    { groups: ['model', 'emote'], category: ctx.category, signal: opts.signal }
  )
  return { issues: toIssues(result) }
}

export const localValidator: ItemValidator = {
  validate: validateOne,
  async validateMany(entries: ValidationEntry[], opts?: ValidateOptions) {
    const results: ValidationResult[] = []
    for (const entry of entries) results.push(await validateOne(entry.source, entry.ctx, opts))
    return results
  }
}

export function hasErrors(result: ValidationResult): boolean {
  return result.issues.some(issue => issue.severity === ValidationSeverity.ERROR)
}

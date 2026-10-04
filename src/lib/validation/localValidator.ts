// The in-browser backend: the shared Decentraland rule book (@dcl-regenesislabs/wearable-validator),
// restricted to the model and emote groups plus the thumbnail rule, the parts the editor can act on.
import { type Finding, type Result } from '@dcl-regenesislabs/wearable-validator'
import { BodyShape } from '@dcl/schemas'
import { fetchContent } from '../builder'
import { THUMBNAIL_PATH, isImageFile } from '../itemFiles'
import { ItemType } from '../items'
import {
  ValidationSeverity,
  type ItemValidator,
  type ThumbnailSource,
  type ValidateOptions,
  type ValidationContext,
  type ValidationIssue,
  type ValidationResult,
  type ValidationSource
} from './types'

// The audio check (E-08) flags any of these; other content files (thumbnail, preview video) are never read.
const AUDIO_LIKE = /\.(mp3|ogg|wav|aac|m4a|flac|opus|wma)$/i

type Loaded = { mainFile: string; bodyShapes: string[]; files: Map<string, Uint8Array> }

async function loadStored(path: string, hash: string | undefined, signal?: AbortSignal): Promise<Uint8Array> {
  if (!hash) throw new Error(`"${path}" has no stored content to validate`)
  return new Uint8Array(await (await fetchContent(hash, signal)).arrayBuffer())
}

/** The main model plus any audio, or null for texture-only wearables (no geometry to inspect). */
async function load(source: ValidationSource, ctx: ValidationContext, signal?: AbortSignal): Promise<Loaded | null> {
  if (source.kind === 'blob') {
    if (isImageFile(source.mainFile)) return null
    const paths = Object.keys(source.contents).filter(path => path === source.mainFile || AUDIO_LIKE.test(path))
    const entries = await Promise.all(
      paths.map(async path => [path, new Uint8Array(await source.contents[path].arrayBuffer())] as const)
    )
    return { mainFile: source.mainFile, bodyShapes: [BodyShape.MALE, BodyShape.FEMALE], files: new Map(entries) }
  }
  const { item } = source
  const representation =
    item.data.representations.find(candidate => ctx.bodyShape && candidate.bodyShapes.includes(ctx.bodyShape)) ??
    item.data.representations[0]
  if (!representation) throw new Error(`Item "${item.id}" has no representation to validate`)
  if (isImageFile(representation.mainFile)) return null
  // Only this representation's files: a unisex item stores each one under both body-shape folders.
  const paths = [
    representation.mainFile,
    ...representation.contents.filter(path => path !== representation.mainFile && AUDIO_LIKE.test(path))
  ]
  const entries = await Promise.all(
    paths.map(async path => [path, await loadStored(path, item.contents[path], signal)] as const)
  )
  return { mainFile: representation.mainFile, bodyShapes: representation.bodyShapes, files: new Map(entries) }
}

/**
 * The slice of entity metadata the model/emote checks read. The explicit representation names the model, so
 * the validator never has to guess it from the file extension.
 */
function toMetadata(ctx: ValidationContext, { mainFile, bodyShapes, files }: Loaded) {
  const representations = [{ bodyShapes, mainFile, contents: [...files.keys()] }]
  return ctx.type === ItemType.EMOTE
    ? { emoteDataADR74: { representations } }
    : { data: { category: ctx.category, hides: ctx.hides ?? [], representations } }
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
  // Without a category its limits are unknown, which is not a problem with the model.
  const issues = result.findings.filter(finding => finding.data?.reason !== 'category-unknown').map(toIssue)
  // A crashed check asserts nothing, so it always shows. An unparseable model (a damaged GLB, a .gltf)
  // skips every check: shown only when nothing else was found, so the run never reads as a pass.
  const errored = result.checks.filter(check => check.status === 'errored' && check.skipReason)
  const skipped = result.checks.find(check => check.status === 'skipped' && check.skipReason)
  const incomplete = errored.length > 0 ? errored : issues.length === 0 && skipped ? [skipped] : []
  for (const check of incomplete) {
    issues.push({ code: 'file-format', severity: ValidationSeverity.ERROR, message: check.skipReason ?? '' })
  }
  return issues
}

async function validateOne(
  source: ValidationSource,
  ctx: ValidationContext,
  opts: ValidateOptions = {}
): Promise<ValidationResult> {
  opts.signal?.throwIfAborted()
  const loaded = await load(source, ctx, opts.signal)
  if (!loaded) return { issues: [] }
  // Loaded on first use: the rule book's parsers and decoders stay out of the route chunks.
  const { validate } = await import('@dcl-regenesislabs/wearable-validator')
  const result = await validate(
    { files: loaded.files, metadata: toMetadata(ctx, loaded) },
    { groups: ['model', 'emote'], category: ctx.category, signal: opts.signal }
  )
  return { issues: toIssues(result) }
}

// The app always writes square 1024px thumbnails (legacy builder parity), so the 256px size hint is never actionable.
const SQUARE_SIZE_HINT = /^(\d+)×\1$/

async function validateThumbnail(source: ThumbnailSource, opts: ValidateOptions = {}): Promise<ValidationResult> {
  opts.signal?.throwIfAborted()
  const bytes =
    source.kind === 'blob'
      ? new Uint8Array(await source.blob.arrayBuffer())
      : await loadStored(source.item.thumbnail, source.item.contents[source.item.thumbnail], opts.signal)
  const { validate, manifest } = await import('@dcl-regenesislabs/wearable-validator')
  const { thumbnailRecommendedSize } = manifest.fileSize
  const result = await validate(
    { files: new Map([[THUMBNAIL_PATH, bytes]]) },
    { checks: ['thumbnail'], signal: opts.signal }
  )
  const findings = result.findings.filter(
    finding =>
      !(
        finding.limit === `${thumbnailRecommendedSize}×${thumbnailRecommendedSize}` &&
        SQUARE_SIZE_HINT.test(String(finding.measured))
      )
  )
  return { issues: toIssues({ ...result, findings }) }
}

export const localValidator: ItemValidator = {
  validate: validateOne,
  validateThumbnail
}

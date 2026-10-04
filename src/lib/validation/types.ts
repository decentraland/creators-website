import { type BodyShape } from '@dcl/schemas'
import { type Item, type ItemType } from '../items'

export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning'
}

/** One problem found in an item, with the rule book's creator-facing English message. */
export type ValidationIssue = {
  code: string
  severity: ValidationSeverity
  message: string
  /** The rule book's name for the check, e.g. "Triangle count". */
  title?: string
  /** File, mesh or bone the issue points at. */
  where?: string
}

/** What to validate: in-memory files (imports, live preview) or a saved item (storage URLs). */
export type ValidationSource =
  { kind: 'blob'; contents: Record<string, Blob>; mainFile: string } | { kind: 'item'; item: Item }

/** A thumbnail to check: an in-memory PNG (imports, unsaved edits) or a saved item's stored one. */
export type ThumbnailSource = { kind: 'blob'; blob: Blob } | { kind: 'item'; item: Item }

export type ValidationContext = {
  type: ItemType
  category?: string
  hides?: string[]
  /** Which representation of an `item` source to load; defaults to the first one. */
  bodyShape?: BodyShape
}

export type ValidationResult = { issues: ValidationIssue[] }

export type ValidateOptions = { signal?: AbortSignal }

export interface ItemValidator {
  validate(source: ValidationSource, ctx: ValidationContext, opts?: ValidateOptions): Promise<ValidationResult>
  /** The thumbnail rule alone: format, size and background transparency. */
  validateThumbnail(source: ThumbnailSource, opts?: ValidateOptions): Promise<ValidationResult>
}

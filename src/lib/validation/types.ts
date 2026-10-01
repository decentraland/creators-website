import { type BodyShape } from '@dcl/schemas'
import { type Item, type ItemType } from '../items'

export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning'
}

/**
 * One problem found in an item. Validator findings carry a ready creator-facing `message`; issues the
 * app derives itself (the triangle recheck, the thumbnail check) carry an i18n `messageKey` instead.
 */
export type ValidationIssue = {
  code: string
  severity: ValidationSeverity
  message?: string
  /** File, mesh or bone the issue points at. */
  where?: string
  messageKey?: string
  messageParams?: Record<string, string | number>
}

/** What to validate: in-memory files (imports, live preview) or a saved item (storage URLs). */
export type ValidationSource =
  { kind: 'blob'; contents: Record<string, Blob>; mainFile: string } | { kind: 'item'; item: Item }

export type ValidationContext = {
  type: ItemType
  category?: string
  hides?: string[]
  /** Which representation of an `item` source to load; defaults to the first one. */
  bodyShape?: BodyShape
}

export type ValidationResult = { issues: ValidationIssue[] }

export type ValidationEntry = { source: ValidationSource; ctx: ValidationContext }

export type ValidateOptions = { signal?: AbortSignal }

export interface ItemValidator {
  validate(source: ValidationSource, ctx: ValidationContext, opts?: ValidateOptions): Promise<ValidationResult>
  validateMany(entries: ValidationEntry[], opts?: ValidateOptions): Promise<ValidationResult[]>
}

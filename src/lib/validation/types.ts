import { type BodyShape } from '@dcl/schemas'
import { type ValidationIssue } from '../glbValidation'
import { type Item, type ItemType } from '../items'

export type { ValidationIssue }

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

/** Issue codes and severities are stable across backends; copy is resolved by the UI from `messageKey`. */
export type ValidationResult = { issues: ValidationIssue[] }

export type ValidationEntry = { source: ValidationSource; ctx: ValidationContext }

export type ValidateOptions = { signal?: AbortSignal }

export interface ItemValidator {
  validate(source: ValidationSource, ctx: ValidationContext, opts?: ValidateOptions): Promise<ValidationResult>
  validateMany(entries: ValidationEntry[], opts?: ValidateOptions): Promise<ValidationResult[]>
}

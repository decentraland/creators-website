// Single entry point for item validation (see README.md). The backend is swappable: today the local
// GLTF validator, tomorrow a remote service behind the same interface.
import { localValidator } from './localValidator'
import { type ItemValidator } from './types'

export type {
  ItemValidator,
  ValidateOptions,
  ValidationContext,
  ValidationEntry,
  ValidationIssue,
  ValidationResult,
  ValidationSource
} from './types'
export { hasErrors } from './localValidator'
export { ValidationSeverity } from '../glbValidation'

let validator: ItemValidator = localValidator

export function getValidator(): ItemValidator {
  return validator
}

/** Swap point for another backend (a remote service, a test double). */
export function setValidator(next: ItemValidator): void {
  validator = next
}

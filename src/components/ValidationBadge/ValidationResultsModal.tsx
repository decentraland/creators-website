import { Modal } from '~/components/Modal'
import { useTranslation } from '~/intl'
import { type ValidationIssue } from '~/lib/validation'
import { ItemValidationCard, type ValidationSubject } from './ItemValidationCard'

type Props = {
  subject?: ValidationSubject
  issues: ValidationIssue[]
  onRerun?: () => Promise<unknown>
  onClose: () => void
  testId?: string
}

/** One item's validation results in a dialog. */
export function ValidationResultsModal({ subject, issues, onRerun, onClose, testId = 'validation-results' }: Props) {
  const { t } = useTranslation()
  return (
    <Modal title={t('item_editor.validation.modal_title')} onClose={onClose} compact testId={`${testId}-modal`}>
      <ItemValidationCard subject={subject} issues={issues} onRerun={onRerun} testId={testId} />
    </Modal>
  )
}

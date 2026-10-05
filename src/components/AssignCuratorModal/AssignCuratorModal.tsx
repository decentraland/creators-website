import { useMemo, useState } from 'react'
import { useTranslation } from '~/intl'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { Select } from '~/components/Select'
import { useAssignCurator, useCuratorOptions } from '~/hooks/useCuration'
import { type Collection } from '~/lib/collections'
import { type CollectionCuration } from '~/lib/curation'
import { useNotifications } from '~/lib/notifications'
import * as S from './AssignCuratorModal.styles'

const UNASSIGN = 'unassign'

type Props = {
  collection: Collection
  curation: CollectionCuration | null
  address: string
  /** `self` confirms taking the collection; `edit` picks any curator or none. */
  mode: 'self' | 'edit'
  onClose: () => void
  /** Taking the collection over right before deciding on it: continues into the decision instead of closing. */
  onAssigned?: () => void
}

export function AssignCuratorModal({ collection, curation, address, mode, onClose, onAssigned }: Props) {
  const { t } = useTranslation()
  const showToast = useNotifications(state => state.showToast)
  const assign = useAssignCurator(address)
  const self = address.toLowerCase()
  const [choice, setChoice] = useState<string>(curation?.assignee ?? self)

  const unassign = useMemo(() => ({ value: UNASSIGN, label: t('assign_curator_modal.unassign') }), [t])
  const options = useCuratorOptions(address, unassign)

  const assignee = mode === 'self' ? self : choice === UNASSIGN ? null : choice
  const unchanged = mode === 'edit' && assignee === (curation?.assignee ?? null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (unchanged) return onClose()
    assign.mutate(
      { collection, curation, assignee },
      {
        onSuccess: () => {
          const name = options.find(option => option.value === assignee)?.label ?? ''
          showToast(
            assignee
              ? t('assign_curator_modal.assigned', { collection: collection.name, name })
              : t('assign_curator_modal.unassigned', { collection: collection.name }),
            { type: 'success' }
          )
          if (onAssigned) onAssigned()
          else onClose()
        }
      }
    )
  }

  const current = curation?.assignee && curation.assignee !== self ? curation.assignee : null
  const currentName = current ? (options.find(option => option.value === current)?.label ?? current) : ''

  return (
    <Modal
      title={t(`assign_curator_modal.title_${mode}`, { collection: collection.name })}
      onClose={onClose}
      closeDisabled={assign.isPending}
      testId="assign-curator-modal"
    >
      <S.Form onSubmit={submit}>
        {mode === 'self' ? (
          <S.Text data-testid="assign-curator-body">
            {current
              ? t('assign_curator_modal.take_over_body', { assignee: currentName })
              : t('assign_curator_modal.self_body')}
          </S.Text>
        ) : (
          <Select
            value={choice}
            options={options}
            onChange={setChoice}
            ariaLabel={t('assign_curator_modal.curator')}
            testId="assign-curator-select"
          />
        )}
        {assign.isError && <S.Error data-testid="assign-curator-error">{t('assign_curator_modal.error')}</S.Error>}
        <S.Actions>
          <Button type="button" variant="secondary" disabled={assign.isPending} onClick={onClose}>
            {t('assign_curator_modal.cancel')}
          </Button>
          <Button type="submit" loading={assign.isPending} data-testid="assign-curator-submit">
            {t(onAssigned ? 'assign_curator_modal.submit_continue' : `assign_curator_modal.submit_${mode}`)}
          </Button>
        </S.Actions>
      </S.Form>
    </Modal>
  )
}

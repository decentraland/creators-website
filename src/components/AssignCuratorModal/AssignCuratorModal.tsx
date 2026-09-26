import { useMemo, useState } from 'react'
import { useTranslation } from '~/intl'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { Select, type SelectOption } from '~/components/Select'
import { shortAddress } from '~/components/ProfileBadge'
import { useAssignCurator, useCommittee } from '~/hooks/useCuration'
import { useProfiles } from '~/hooks/useProfile'
import { type Collection } from '~/lib/collections'
import { orderCurators, type CollectionCuration } from '~/lib/curation'
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
}

export function AssignCuratorModal({ collection, curation, address, mode, onClose }: Props) {
  const { t } = useTranslation()
  const showToast = useNotifications(state => state.showToast)
  const { members } = useCommittee(address)
  const assign = useAssignCurator(address)
  const self = address.toLowerCase()
  const [choice, setChoice] = useState<string>(curation?.assignee ?? self)

  const curators = useMemo(() => orderCurators(members, address), [members, address])
  const profiles = useProfiles(curators)
  const options = useMemo<SelectOption<string>[]>(
    () => [
      { value: UNASSIGN, label: t('assign_curator_modal.unassign') },
      ...curators.map((curator, index) => {
        const name = profiles[index]?.name || shortAddress(curator)
        return {
          value: curator,
          label: curator === self ? t('assign_curator_modal.you', { name }) : name,
          dividerBefore: index === 0
        }
      })
    ],
    [curators, profiles, self, t]
  )

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
          onClose()
        }
      }
    )
  }

  return (
    <Modal
      title={t(`assign_curator_modal.title_${mode}`, { collection: collection.name })}
      onClose={onClose}
      closeDisabled={assign.isPending}
      compact
      testId="assign-curator-modal"
    >
      <S.Form onSubmit={submit}>
        {mode === 'self' ? (
          <S.Text>{t('assign_curator_modal.self_body')}</S.Text>
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
            {t(`assign_curator_modal.submit_${mode}`)}
          </Button>
        </S.Actions>
      </S.Form>
    </Modal>
  )
}

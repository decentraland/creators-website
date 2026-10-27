import { useState } from 'react'
import { useTranslation } from '~/intl'
import { type RelinkStep } from '~/lib/relinkCollection'
import { type LinkedContract } from '~/lib/thirdParty'
import { Button } from '~/components/Button'
import { EMPTY_LINKED_CONTRACT, LinkedContractFields } from '~/components/LinkedContractFields'
import { Modal } from '~/components/Modal'
import * as N from '~/components/CollectionNameInput/CollectionNameInput.styles'
import * as S from '../EditUrnModal/EditUrnModal.styles'

type Props = {
  /** Which part of the change is running, for the submit label; null while idle. */
  step: RelinkStep | null
  error: string | null
  onSubmit: (contract: LinkedContract) => void
  onClose: () => void
}

/**
 * Re-points a linked collection to another NFT contract (a redeploy after a hack, a migration), network included.
 * Submitting the contract the collection already names is allowed: it finishes a change that stopped halfway.
 */
export function EditContractModal({ step, error, onSubmit, onClose }: Props) {
  const { t } = useTranslation()
  const [contract, setContract] = useState(EMPTY_LINKED_CONTRACT)
  const [edited, setEdited] = useState(false)
  const { network, address, check } = contract
  const isPending = step !== null
  const canSubmit = !!network && check === 'ok' && !isPending

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit || !network) return
    setEdited(false)
    onSubmit({ network, address: address.toLowerCase() })
  }

  const shownError = !edited && error ? error : null

  return (
    <Modal
      title={t('edit_contract_modal.title')}
      onClose={onClose}
      closeDisabled={isPending}
      testId="edit-contract-modal"
    >
      <S.Form onSubmit={handleSubmit}>
        <S.Intro>
          <S.Heading>{t('edit_contract_modal.heading')}</S.Heading>
          <S.Subtitle>{t('edit_contract_modal.subtitle')}</S.Subtitle>
        </S.Intro>
        <LinkedContractFields
          value={contract}
          onChange={next => {
            setContract(next)
            if (next.network !== network || next.address !== address) setEdited(true)
          }}
        />
        {shownError && <N.ErrorText data-testid="edit-contract-error">{shownError}</N.ErrorText>}
        {step && <S.Preview data-testid="edit-contract-step">{t(`edit_contract_modal.step.${step}`)}</S.Preview>}
        <S.Actions>
          <Button
            type="button"
            variant="secondary"
            data-testid="edit-contract-cancel"
            disabled={isPending}
            onClick={onClose}
          >
            {t('collection_name_modal.cancel')}
          </Button>
          <Button type="submit" data-testid="edit-contract-submit" loading={isPending} disabled={!canSubmit}>
            {t('edit_contract_modal.submit')}
          </Button>
        </S.Actions>
      </S.Form>
    </Modal>
  )
}

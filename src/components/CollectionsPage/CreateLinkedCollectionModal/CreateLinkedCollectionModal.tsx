import { useState } from 'react'
import { config } from '~/config'
import { useTranslation } from '~/intl'
import { openExternal } from '~/lib/navigation'
import { isContractInUseError } from '~/lib/linkedContract'
import {
  LINKED_COLLECTION_NAME_MAX_LENGTH,
  LINKED_WEARABLES_DOCS_PATH,
  validateLinkedCollectionName,
  type LinkedContract
} from '~/lib/thirdParty'
import { Button } from '~/components/Button'
import { CollectionNameInput } from '~/components/CollectionNameInput'
import { EMPTY_LINKED_CONTRACT, LinkedContractFields } from '~/components/LinkedContractFields'
import { Modal } from '~/components/Modal'
import * as N from '~/components/CollectionNameInput/CollectionNameInput.styles'
import * as S from './CreateLinkedCollectionModal.styles'

type Props = {
  isPending: boolean
  /** The failed save, mapped to friendly copy here. */
  error: unknown
  onSubmit: (name: string, contract: LinkedContract) => void
  onClose: () => void
}

/** The New Linked Collection dialog: a name, the NFT contract's network and address, checked on chain as typed. */
export function CreateLinkedCollectionModal({ isPending, error, onSubmit, onClose }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [contract, setContract] = useState(EMPTY_LINKED_CONTRACT)
  const { network, address, check } = contract
  const [nameError, setNameError] = useState<string | null>(null)
  const [editedSinceSubmit, setEditedSinceSubmit] = useState(false)

  const learnMoreUrl = `${config.get('DOCS_URL')}${LINKED_WEARABLES_DOCS_PATH}`

  const trimmed = name.trim()
  const canSubmit = !!trimmed && !!network && check === 'ok' && !isPending

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit || !network) return
    if (validateLinkedCollectionName(trimmed)) {
      setNameError(t('collection_name_modal.error_invalid_character'))
      return
    }
    setNameError(null)
    setEditedSinceSubmit(false)
    onSubmit(trimmed, { network, address })
  }

  const serverError =
    error && !editedSinceSubmit
      ? isContractInUseError(error)
        ? t('create_linked_collection_modal.error_contract_in_use')
        : t('create_linked_collection_modal.error_generic')
      : null
  return (
    <Modal
      title={t('create_linked_collection_modal.title')}
      onClose={onClose}
      closeDisabled={isPending}
      testId="create-linked-collection-modal"
    >
      <S.Form onSubmit={handleSubmit}>
        <S.Intro>
          <S.Heading>{t('create_linked_collection_modal.heading')}</S.Heading>
          <S.Subtitle>
            {t('create_linked_collection_modal.subtitle')}{' '}
            <S.LearnMore
              href={learnMoreUrl}
              data-testid="linked-learn-more"
              onClick={event => {
                event.preventDefault()
                openExternal(learnMoreUrl)
              }}
            >
              {t('create_linked_collection_modal.learn_more')}
            </S.LearnMore>
          </S.Subtitle>
        </S.Intro>
        <S.Fields>
          <CollectionNameInput
            value={name}
            error={nameError}
            placeholder={t('create_linked_collection_modal.name_placeholder')}
            maxLength={LINKED_COLLECTION_NAME_MAX_LENGTH}
            hideHint
            autoFocus
            testId="linked-collection-name"
            onChange={value => {
              setName(value)
              setNameError(null)
              setEditedSinceSubmit(true)
            }}
          />
          <LinkedContractFields
            value={contract}
            onChange={next => {
              setContract(next)
              if (next.network !== network || next.address !== address) setEditedSinceSubmit(true)
            }}
          />
          {serverError && <N.ErrorText data-testid="linked-collection-error">{serverError}</N.ErrorText>}
        </S.Fields>
        <S.Actions>
          <Button
            type="button"
            variant="secondary"
            data-testid="linked-collection-cancel"
            disabled={isPending}
            onClick={onClose}
          >
            {t('collection_name_modal.cancel')}
          </Button>
          <Button type="submit" data-testid="linked-collection-submit" loading={isPending} disabled={!canSubmit}>
            {t('create_linked_collection_modal.submit')}
          </Button>
        </S.Actions>
      </S.Form>
    </Modal>
  )
}

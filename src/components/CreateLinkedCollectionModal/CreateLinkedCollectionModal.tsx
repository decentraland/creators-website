import { useEffect, useRef, useState } from 'react'
import { ChevronRight as ChevronRightIcon, InfoOutlined as InfoOutlinedIcon } from '@mui/icons-material'
import { type ContractNetwork } from '@dcl/schemas'
import { config } from '~/config'
import { useTranslation } from '~/intl'
import { BuilderServerError } from '~/lib/builder'
import {
  checkLinkedContract,
  isAddressBeingTyped,
  isContractAddress,
  type LinkedContractCheck
} from '~/lib/linkedContract'
import {
  LINKED_COLLECTION_NAME_MAX_LENGTH,
  LINKED_CONTRACT_IN_USE_ERROR,
  getLinkedContractNetworks,
  validateLinkedCollectionName,
  type LinkedContract
} from '~/lib/thirdParty'
import { Button } from '~/components/Button'
import { CollectionNameInput } from '~/components/CollectionNameInput'
import { Modal } from '~/components/Modal'
import { Select } from '~/components/Select'
import * as N from '~/components/CollectionNameInput/CollectionNameInput.styles'
import * as S from './CreateLinkedCollectionModal.styles'

const CONTRACT_CHECK_DEBOUNCE_MS = 1000
const LEARN_MORE_PATH = '/creator/wearables/linked-wearables/'

type Props = {
  isPending: boolean
  /** The failed save, mapped to friendly copy here. */
  error: unknown
  onSubmit: (name: string, contract: LinkedContract) => void
  onClose: () => void
}

/** Whether the failed save was builder-server refusing a contract another collection already links. */
export function isContractInUseError(error: unknown): boolean {
  if (!(error instanceof BuilderServerError)) return false
  const text = `${error.message} ${typeof error.data === 'string' ? error.data : JSON.stringify(error.data ?? '')}`
  return text.includes(LINKED_CONTRACT_IN_USE_ERROR)
}

/** The New Linked Collection dialog: a name, the NFT contract's network and address, checked on chain as typed. */
export function CreateLinkedCollectionModal({ isPending, error, onSubmit, onClose }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [network, setNetwork] = useState<ContractNetwork | null>(null)
  const [address, setAddress] = useState('')
  const [check, setCheck] = useState<LinkedContractCheck | 'checking' | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [editedSinceSubmit, setEditedSinceSubmit] = useState(false)
  const checkTimer = useRef<ReturnType<typeof setTimeout>>()
  const checkRun = useRef(0)

  const isProduction = config.get('ENVIRONMENT') === 'production'
  const networks = getLinkedContractNetworks(isProduction)
  const networkOptions = networks.map(value => ({ value, label: t(`linked_collection.networks.${value}`) }))

  // A full address on a picked network is checked on chain after a pause in typing, like the legacy modal.
  useEffect(() => {
    clearTimeout(checkTimer.current)
    const run = ++checkRun.current
    if (!network || !isContractAddress(address)) {
      setCheck(null)
      return
    }
    setCheck('checking')
    checkTimer.current = setTimeout(() => {
      void checkLinkedContract(network, address).then(result => {
        if (run === checkRun.current) setCheck(result)
      })
    }, CONTRACT_CHECK_DEBOUNCE_MS)
    return () => clearTimeout(checkTimer.current)
  }, [network, address])

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
  const contractError =
    check === 'not_nft'
      ? t('create_linked_collection_modal.error_not_nft')
      : check === 'error'
        ? t('create_linked_collection_modal.error_contract_check')
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
              href={`${config.get('DOCS_URL')}${LEARN_MORE_PATH}`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="linked-learn-more"
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
          <N.Field>
            <N.Label as="div">
              {t('create_linked_collection_modal.network')}
              <Select
                value={network}
                options={networkOptions}
                placeholder={t('create_linked_collection_modal.network_placeholder')}
                ariaLabel={t('create_linked_collection_modal.network')}
                testId="linked-network"
                onChange={value => {
                  setNetwork(value)
                  setEditedSinceSubmit(true)
                }}
              />
            </N.Label>
          </N.Field>
          <N.Field>
            <N.Label>
              {t('create_linked_collection_modal.contract')}
              <N.Box data-invalid={contractError ? true : undefined}>
                <input
                  value={address}
                  placeholder="0x…"
                  spellCheck={false}
                  autoComplete="off"
                  data-testid="linked-contract-address-input"
                  onChange={event => {
                    const value = event.target.value.trim()
                    if (!isAddressBeingTyped(value)) return
                    setAddress(value)
                    setEditedSinceSubmit(true)
                  }}
                />
                {check === 'checking' && <S.Spinner data-testid="linked-contract-checking" aria-hidden />}
              </N.Box>
            </N.Label>
            {contractError ? (
              <N.ErrorText data-testid="linked-contract-error">{contractError}</N.ErrorText>
            ) : (
              <N.HintText data-testid="linked-contract-hint">
                <InfoOutlinedIcon fontSize="inherit" aria-hidden />
                {t('create_linked_collection_modal.contract_hint')}
              </N.HintText>
            )}
          </N.Field>
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
            <ChevronRightIcon fontSize="small" />
          </Button>
        </S.Actions>
      </S.Form>
    </Modal>
  )
}

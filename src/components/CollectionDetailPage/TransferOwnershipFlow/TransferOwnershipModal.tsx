import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  WarningAmberOutlined as WarningIcon
} from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { type Collection } from '~/lib/collections'
import { getNewOwnerError } from '~/lib/collectionOwnership'
import { type Friend } from '~/lib/friends'
import { getMaticChainId } from '~/lib/publishCollection'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { StepIndicator } from '~/components/StepIndicator'
import { BeneficiaryInput } from '../SellItemFlow/BeneficiaryInput'
import * as Sell from '../SellItemFlow/SellItemModal.styles'
import { RecipientLine } from '../SendItemsFlow/SendItemsModal'
import * as S from './TransferOwnershipModal.styles'

export type TransferStep = 'details' | 'confirm'

type Props = {
  collection: Collection
  step: TransferStep
  /** The chosen new owner (lowercased), or '' while none is chosen. */
  newOwner: string
  /** What was typed to confirm; must match the collection's name. */
  confirmation: string
  friends: Friend[] | undefined
  isLoadingFriends: boolean
  /** A submit is in flight (custodial wallet, no prompt to wait for): the button spins. */
  busy: boolean
  canContinue: boolean
  onStep: (step: TransferStep) => void
  onNewOwnerChange: (address: string) => void
  onConfirmationChange: (value: string) => void
  onSubmit: () => void
  onClose: () => void
}

/**
 * Two steps, like sending items: pick the new owner and type the collection's name, then read the chosen
 * wallet once more and TRANSFER OWNERSHIP.
 */
export function TransferOwnershipModal({
  collection,
  step,
  newOwner,
  confirmation,
  friends,
  isLoadingFriends,
  busy,
  canContinue,
  onStep,
  onNewOwnerChange,
  onConfirmationChange,
  onSubmit,
  onClose
}: Props) {
  const { t } = useTranslation()

  function rejection(address: string): string | null {
    const error = getNewOwnerError(collection, address, getMaticChainId())
    return error ? t(`transfer_ownership_modal.${error}`) : null
  }

  return (
    <Modal
      title={t('transfer_ownership_modal.title')}
      onClose={onClose}
      closeDisabled={busy}
      compact
      testId="transfer-ownership-modal"
    >
      <Sell.Divider />
      <S.Steps>
        <StepIndicator
          current={step === 'details' ? 1 : 2}
          total={2}
          labels={[t('transfer_ownership_modal.step_details'), t('transfer_ownership_modal.step_confirm')]}
          testId="transfer-steps"
        />
      </S.Steps>
      <S.Body key={step} data-busy={busy || undefined} aria-busy={busy || undefined} {...(busy ? { inert: '' } : {})}>
        {step === 'details' ? (
          <>
            <S.Description data-testid="transfer-ownership-description">
              {t('transfer_ownership_modal.description', { name: collection.name })}
            </S.Description>
            <S.Field>
              <S.Label>{t('transfer_ownership_modal.new_owner')}</S.Label>
              <BeneficiaryInput
                value={newOwner}
                onChange={onNewOwnerChange}
                friends={friends}
                isLoadingFriends={isLoadingFriends}
                placeholder={t('transfer_ownership_modal.placeholder')}
                duplicateError={rejection}
                clearLabel={t('transfer_ownership_modal.clear')}
                testId="new-owner"
              />
            </S.Field>
            <S.Field>
              <S.Label>{t('transfer_ownership_modal.confirm_label', { name: collection.name })}</S.Label>
              <S.Box>
                <input
                  value={confirmation}
                  placeholder={collection.name}
                  autoComplete="off"
                  spellCheck={false}
                  data-testid="transfer-confirmation-input"
                  onChange={event => onConfirmationChange(event.target.value)}
                />
              </S.Box>
            </S.Field>
          </>
        ) : (
          <>
            <S.Intro>{t('transfer_ownership_modal.confirm_intro', { name: collection.name })}</S.Intro>
            <S.Field>
              <S.Label>{t('transfer_ownership_modal.new_owner')}</S.Label>
              <RecipientLine address={newOwner} friends={friends} testId="transfer-confirm-owner" />
            </S.Field>
            <S.Note data-variant="warning" data-testid="transfer-ownership-warning">
              <WarningIcon aria-hidden />
              <p>{t('transfer_ownership_modal.warning')}</p>
            </S.Note>
          </>
        )}
      </S.Body>

      <Sell.Footer>
        {step === 'details' ? (
          <Button type="button" variant="secondary" data-testid="transfer-cancel" onClick={onClose}>
            {t('sell_item_modal.cancel')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            data-testid="transfer-back"
            onClick={() => onStep('details')}
          >
            <ChevronLeftIcon fontSize="small" />
            {t('send_items_modal.back')}
          </Button>
        )}
        {step === 'details' ? (
          <Button
            type="button"
            variant="primary"
            disabled={!canContinue}
            data-testid="transfer-continue"
            onClick={() => onStep('confirm')}
          >
            {t('send_items_modal.continue')}
            <ChevronRightIcon fontSize="small" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            disabled={busy}
            loading={busy}
            data-testid="transfer-submit"
            onClick={onSubmit}
          >
            {t('transfer_ownership_modal.submit')}
          </Button>
        )}
      </Sell.Footer>
    </Modal>
  )
}

import { Check as CheckIcon } from '@mui/icons-material'
import successArt from '~/assets/sale-success.png'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { useTranslation } from '~/intl'
import * as S from './SaleSuccessModal.styles'

type Props = {
  onDone: () => void
}

export function SaleSuccessModal({ onDone }: Props) {
  const { t } = useTranslation()
  return (
    <Modal title={t('sell_item_modal.success.title')} onClose={onDone} hideTitle testId="sale-success-modal">
      <S.Wrap>
        <S.Art src={successArt} alt="" />
        <S.Heading data-testid="sale-success-title">{t('sell_item_modal.success.title')}</S.Heading>
        <S.Text data-testid="sale-success-description">{t('sell_item_modal.success.description')}</S.Text>
        <Button type="button" data-testid="sale-success-done" onClick={onDone}>
          {t('sell_item_modal.success.done')}
          <CheckIcon fontSize="small" />
        </Button>
      </S.Wrap>
    </Modal>
  )
}

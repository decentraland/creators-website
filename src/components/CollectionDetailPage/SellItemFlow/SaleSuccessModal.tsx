import { Check as CheckIcon } from '@mui/icons-material'
import successArt from '~/assets/sale-success.png'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { useTranslation } from '~/intl'
import * as S from './SaleSuccessModal.styles'

type Props = {
  title: string
  description: string
  onDone: () => void
}

/** The celebratory close of a sale action: illustration, heading, one line, DONE. */
export function SaleSuccessModal({ title, description, onDone }: Props) {
  const { t } = useTranslation()
  return (
    <Modal title={title} onClose={onDone} hideTitle testId="sale-success-modal">
      <S.Wrap>
        <S.Art src={successArt} alt="" />
        <S.Heading data-testid="sale-success-title">{title}</S.Heading>
        <S.Text data-testid="sale-success-description">{description}</S.Text>
        <Button type="button" data-testid="sale-success-done" onClick={onDone}>
          {t('sell_item_modal.success.done')}
          <CheckIcon fontSize="small" />
        </Button>
      </S.Wrap>
    </Modal>
  )
}

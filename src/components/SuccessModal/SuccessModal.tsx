import { Check as CheckIcon } from '@mui/icons-material'
import successArt from '~/assets/sale-success.png'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { useTranslation } from '~/intl'
import * as S from './SuccessModal.styles'

type Props = {
  title: string
  description: string
  art?: string
  onDone: () => void
}

/** The celebratory close of an action: illustration, heading, one line, DONE. */
export function SuccessModal({ title, description, art = successArt, onDone }: Props) {
  const { t } = useTranslation()
  return (
    <Modal title={title} onClose={onDone} hideTitle testId="success-modal-modal">
      <S.Wrap>
        <S.Art src={art} alt="" />
        <S.Heading data-testid="success-modal-title">{title}</S.Heading>
        <S.Text data-testid="success-modal-description">{description}</S.Text>
        <Button type="button" data-testid="success-modal-done" onClick={onDone}>
          {t('success_modal.done')}
          <CheckIcon fontSize="small" />
        </Button>
      </S.Wrap>
    </Modal>
  )
}

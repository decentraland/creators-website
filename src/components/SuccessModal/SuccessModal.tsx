import type { ReactNode } from 'react'
import { Check as CheckIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material'
import successArt from '~/assets/sale-success.png'
import { Button } from '~/components/Button'
import { Modal } from '~/components/Modal'
import { useTranslation } from '~/intl'
import * as S from './SuccessModal.styles'

type Props = {
  title: string
  description: ReactNode
  art?: string
  /** A way on from the success, shown before DONE. */
  action?: { label: string; onClick: () => void; testId: string; external?: boolean }
  onDone: () => void
  testId?: string
}

/** The celebratory close of an action: illustration, heading, one line, DONE. */
export function SuccessModal({
  title,
  description,
  art = successArt,
  action,
  onDone,
  testId = 'success-modal'
}: Props) {
  const { t } = useTranslation()
  return (
    <Modal title={title} onClose={onDone} hideTitle testId={`${testId}-modal`}>
      <S.Wrap>
        <S.Art src={art} alt="" />
        <S.Heading data-testid={`${testId}-title`}>{title}</S.Heading>
        <S.Text data-testid={`${testId}-description`}>{description}</S.Text>
        <S.Actions>
          {action && (
            <Button type="button" variant="secondary" data-testid={action.testId} onClick={action.onClick}>
              {action.label}
              {action.external && <OpenInNewIcon fontSize="small" aria-hidden />}
            </Button>
          )}
          <Button type="button" data-testid={`${testId}-done`} onClick={onDone}>
            {t('success_modal.done')}
            <CheckIcon fontSize="small" />
          </Button>
        </S.Actions>
      </S.Wrap>
    </Modal>
  )
}

import { useEffect } from 'react'
import { CheckCircleOutline as CheckIcon, Close as CloseIcon } from '@mui/icons-material'
import { useNotifications, type Toast } from '~/lib/notifications'
import { useTranslation } from '~/intl'
import * as S from './Toasts.styles'

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useNotifications(state => state.dismissToast)
  const { t } = useTranslation()

  useEffect(() => {
    const timeout = window.setTimeout(() => dismissToast(toast.id), toast.durationMs)
    return () => window.clearTimeout(timeout)
  }, [toast.id, toast.durationMs, dismissToast])

  return (
    <S.ToastCard role="status" data-testid="toast">
      <CheckIcon fontSize="small" />
      {toast.message}
      <S.DismissButton type="button" aria-label={t('modal.close')} onClick={() => dismissToast(toast.id)}>
        <CloseIcon fontSize="small" />
      </S.DismissButton>
    </S.ToastCard>
  )
}

/** Global toast outlet, fed by the lib/notifications store. Mounted once in App. */
export function Toasts() {
  const toasts = useNotifications(state => state.toasts)
  if (toasts.length === 0) return null
  return (
    <S.Stack data-testid="toasts">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </S.Stack>
  )
}

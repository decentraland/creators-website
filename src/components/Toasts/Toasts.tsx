import { useEffect } from 'react'
import {
  CheckCircleRounded as SuccessIcon,
  Close as CloseIcon,
  ErrorRounded as ErrorIcon,
  InfoRounded as InfoIcon,
  WarningRounded as WarnIcon
} from '@mui/icons-material'
import { useNotifications, type Toast, type ToastType } from '~/lib/notifications'
import { useTranslation } from '~/intl'
import * as S from './Toasts.styles'

const ICONS: Record<NonNullable<ToastType>, typeof SuccessIcon> = {
  success: SuccessIcon,
  error: ErrorIcon,
  warn: WarnIcon,
  info: InfoIcon
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useNotifications(state => state.dismissToast)
  const { t } = useTranslation()
  const Icon = toast.type && ICONS[toast.type]

  useEffect(() => {
    const timeout = window.setTimeout(() => dismissToast(toast.id), toast.durationMs)
    return () => window.clearTimeout(timeout)
  }, [toast.id, toast.durationMs, dismissToast])

  return (
    <S.ToastCard
      role={toast.type === 'error' ? 'alert' : 'status'}
      data-testid="toast"
      data-type={toast.type ?? undefined}
    >
      {Icon && (
        <S.TypeIcon data-type={toast.type} data-testid="toast-icon">
          <Icon fontSize="small" />
        </S.TypeIcon>
      )}
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

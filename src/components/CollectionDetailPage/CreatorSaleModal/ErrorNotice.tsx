import * as S from './ErrorNotice.styles'
import { SaleIcon } from './SaleIcon'

/** An inline error, or nothing without a message; announced when it appears. */
export function ErrorNotice({
  message,
  className,
  testId
}: {
  message?: string | null
  className?: string
  testId?: string
}) {
  if (!message) return null
  return (
    <S.Notice className={className} data-testid={testId} role="alert">
      <SaleIcon name="alert" size={18} />
      <S.Message>{message}</S.Message>
    </S.Notice>
  )
}

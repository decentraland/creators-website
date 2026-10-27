import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import { SaleIcon } from './SaleIcon'

// The Shop's inline error banner (its global `.error-notice`), as a local styled block.
const Notice = styled.p`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(221, 51, 51, 0.25);
  border-radius: 8px;
  background: rgba(221, 51, 51, 0.08);
  color: ${theme.colors.err};
  font-size: 14px;
  line-height: 1.4;
  text-align: left;

  & > svg {
    flex: none;
    width: 18px;
    height: 18px;
  }
`

const Message = styled.span`
  color: ${theme.colors.text2};
`

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
    <Notice className={className} data-testid={testId} role="alert">
      <SaleIcon name="alert" size={18} />
      <Message>{message}</Message>
    </Notice>
  )
}

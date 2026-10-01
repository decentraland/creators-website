import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

export { Spinner } from '~/styles/shared'

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const Status = styled.p`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 0;
  padding: 10px 12px;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.overlayLight};
  font-size: 14px;
  line-height: 1.43;
  color: ${theme.colors.softWhite};

  &[data-state='passed'] {
    color: ${theme.colors.green};
  }
  &[data-state='warnings'],
  &[data-state='failed'] {
    background: ${theme.colors.warningOverlay};
    color: ${theme.colors.warningText};
  }
  &[data-state='errors'] {
    background: rgba(204, 29, 44, 0.2); /* redRejected @ 20% */
    color: ${theme.colors.white};
  }

  & svg {
    flex: none;
  }
`

export const Toggle = styled.button`
  align-self: flex-start;
  min-height: 32px;
  padding: 0;
  border: 0;
  background: none;
  color: ${theme.colors.infoLighter};
  font: inherit;
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
`

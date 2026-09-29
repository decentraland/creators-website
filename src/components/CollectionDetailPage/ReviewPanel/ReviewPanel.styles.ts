import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

export const Notice = styled.p`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 12px 16px;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.warningOverlay};
  color: ${theme.colors.warningText};
  font-size: 14px;
  line-height: 1.43;

  &[data-tone='info'] {
    background: rgba(23, 100, 192, 0.25); /* info @ 25% */
    color: ${theme.colors.infoLighter};
  }

  & svg {
    flex: none;
  }
`

export const Panel = styled.section`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px;
  border-radius: ${theme.radius.card};
  border: 1px solid rgba(255, 4, 4, 0.4); /* redBright @ 40% */
  background: rgba(204, 29, 44, 0.12); /* redRejected @ 12% */
  color: ${theme.colors.softWhite};

  ${mobile} {
    padding: 16px;
  }
`

export const Head = styled.header`
  display: flex;
  align-items: flex-start;
  gap: 12px;

  & > svg {
    flex: none;
    margin-top: 2px;
    color: ${theme.colors.redBright};
  }
`

export const Title = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  color: ${theme.colors.white};
`

export const Description = styled.p`
  margin: 4px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: ${theme.colors.gray4};
`

export const Label = styled.h4`
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: ${theme.colors.gray4};
`

export const Reasons = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Reason = styled.li`
  padding: 4px 10px;
  border-radius: ${theme.radius.pill};
  background: ${theme.colors.glass};
  font-size: 13px;
  font-weight: 500;
`

export const Message = styled.p`
  margin: 0;
  padding: 12px 16px;
  border-radius: ${theme.radius.btnSm};
  background: ${theme.colors.overlayLight};
  font-size: 15px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`

export const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;

  ${mobile} {
    & > button {
      flex: 1 1 100%;
      min-height: 44px;
    }
  }
`

export const Attempts = styled.span`
  font-size: 13px;
  color: ${theme.colors.gray4};

  &[data-exhausted] {
    color: ${theme.colors.warningText};
  }
`

export const Hint = styled.p`
  margin: 0;
  font-size: 13px;
  color: ${theme.colors.gray4};
`

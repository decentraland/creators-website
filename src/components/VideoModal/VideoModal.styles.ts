import styled from '@emotion/styled'
import { theme } from '~/styles/theme'

const mobile = theme.media.maxWidth('mobile')

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 560px;
  max-width: 100%;
`

export const Description = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: ${theme.colors.softWhite};
`

export const Player = styled.video`
  display: block;
  width: 100%;
  max-height: 60vh;
  border-radius: ${theme.radius.cardLg};
  background: ${theme.colors.text};
`

export const Loading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
`

export const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  > * {
    min-width: 0;
  }

  ${mobile} {
    flex-wrap: wrap;

    > * {
      flex: 1;
    }
  }
`

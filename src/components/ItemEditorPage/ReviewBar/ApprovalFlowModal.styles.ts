import styled from '@emotion/styled'
import { theme } from '~/styles/theme'
import * as Shared from '~/components/CollectionDetailPage/PublishCollectionModal/PublishCollectionModal.styles'

export {
  Heading,
  Text,
  TableBody,
  Thumb,
  MosaicFrame
} from '~/components/CollectionDetailPage/PublishCollectionModal/PublishCollectionModal.styles'

const mobile = theme.media.maxWidth('mobile')

// Each step is as tall as its table: a one-row Enable step shouldn't keep the publish modal's fixed height.
export const Main = styled(Shared.Main)`
  min-height: 0;

  &[data-single] {
    margin-top: 0;
  }
`

// A lone step's title is the modal title, so its body starts right under it.
export const Step = styled(Shared.Step)`
  [data-single] > & {
    padding-top: 0;
  }
`

export const Table = styled(Shared.Table)`
  flex: none;
`

// Body type, category and hash give way on small screens; the item and its rarity or size stay.
const columns = `
  &[data-table='rescue'] {
    grid-template-columns: minmax(0, 2fr) minmax(90px, 1fr) minmax(110px, 1fr) minmax(130px, 1fr) minmax(120px, 1fr);
  }
  &[data-table='deploy'],
  &[data-table='approve'] {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  ${mobile} {
    &[data-table='rescue'] {
      grid-template-columns: minmax(0, 1fr) auto;
    }
    & > [data-optional] {
      display: none;
    }
  }
`

export const Header = styled(Shared.TableHeader)`
  padding: 12px 24px 12px 12px;
  ${columns}

  &[data-table='deploy'] > span:last-of-type,
  &[data-table='approve'] > span:last-of-type {
    text-align: right;
  }
`

export const Row = styled.div`
  display: grid;
  align-items: center;
  gap: 12px;
  padding: 12px 24px 12px 12px;
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.overlay};
  font-size: 14px;
  color: ${theme.colors.softWhite};
  ${columns}

  & > *:not(:first-child) {
    justify-self: center;
    text-align: center;
  }
  &[data-table='deploy'] > *:last-child,
  &[data-table='approve'] > *:last-child {
    justify-self: end;
  }
`

export const NameCell = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;

  & > span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

export const Footer = styled(Shared.Footer)`
  margin-top: 16px;

  ${mobile} {
    & > button {
      flex: 1;
      min-width: 0;
    }
  }
`

export const Detail = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  text-align: left;
`

export const DetailHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
  color: ${theme.colors.gray4};
`

export const DetailText = styled.pre`
  max-height: 7.5em;
  margin: 0;
  padding: 12px;
  overflow: auto;
  border-radius: ${theme.radius.btn};
  background: ${theme.colors.overlayStrong};
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: ${theme.colors.softWhite};
`

export const CopyButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: -10px -10px -10px 0;
  border: 0;
  border-radius: ${theme.radius.pill};
  background: none;
  color: ${theme.colors.softWhite};
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;

  &:hover,
  &:focus-visible {
    background: ${theme.colors.glassFaint};
  }
  &[data-copied] {
    color: ${theme.colors.successBorder};
    animation: copied-pop 0.3s ease;
  }

  @keyframes copied-pop {
    50% {
      transform: scale(1.25);
    }
  }
`

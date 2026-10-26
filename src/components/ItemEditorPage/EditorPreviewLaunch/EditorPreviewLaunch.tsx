import { track } from '~/lib/analytics'
import * as S from './EditorPreviewLaunch.styles'

type Props = {
  collectionId: string
  itemCount: number
  /** A curator reviewing the collection; their launches are tracked apart from the creators'. */
  reviewing: boolean
}

/** Preview in World from the editor's preview bar, for creators editing and curators reviewing alike. */
export function EditorPreviewLaunch({ collectionId, itemCount, reviewing }: Props) {
  return (
    <S.Launch
      collectionId={collectionId}
      disabled={itemCount === 0}
      data-testid="editor-preview"
      onLaunch={launched =>
        reviewing
          ? track('Review Preview In World', { collectionId, itemCount, launched })
          : track('Preview In World', { collectionId, itemCount, launched, trigger: 'editor' })
      }
    />
  )
}

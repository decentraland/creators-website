// @vitest-environment node
import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Emotion files still waiting for their CSS Modules conversion. A conversion deletes its entry; nothing new joins.
const REMAINING = [
  'src/components/AvatarPreview/AvatarPreview.styles.ts',
  'src/components/CollectionDetailPage/AddItemsModal/AddItemsModal.styles.ts',
  'src/components/ItemDraftModal/ItemDraftModal.styles.ts',
  'src/components/ItemEditorPage/AvatarCustomizer/AvatarCustomizer.styles.ts',
  'src/components/ItemEditorPage/ChangeFileModal/ChangeFileModal.styles.ts',
  'src/components/ItemEditorPage/EditorPreviewLaunch/EditorPreviewLaunch.styles.ts',
  'src/components/ItemEditorPage/HidesEditor/HidesEditor.styles.ts',
  'src/components/ItemEditorPage/ItemEditorPage.styles.ts',
  'src/components/ItemEditorPage/ItemsSidebar/ItemsSidebar.styles.ts',
  'src/components/ItemEditorPage/PlaybackBar/PlaybackBar.styles.ts',
  'src/components/ItemEditorPage/ReviewBar/ForumVerdictModal.styles.ts',
  'src/components/ItemEditorPage/ReviewBar/ReviewBar.styles.ts',
  'src/components/ItemEditorPage/SceneBoundariesToggle/SceneBoundariesToggle.styles.ts',
  'src/components/ItemEditorPage/SpringBonesEditor/BoneTreePicker/BoneTreePicker.styles.ts',
  'src/components/ItemEditorPage/SpringBonesEditor/SpringBonesEditor.styles.ts',
  'src/components/LivePreviewPage/LivePreviewPage.styles.ts',
  'src/components/MappingEditor/MappingEditor.styles.ts',
  'src/components/ThumbnailModal/ThumbnailModal.styles.ts',
  'src/components/Tooltip/Tooltip.styles.ts',
  'src/components/TopNav/TopNav.styles.ts',
  'src/components/ValidationBadge/ItemValidationCard.styles.ts',
  'src/components/ValidationBadge/ValidationBadge.styles.ts',
  'src/components/ValidationBadge/ValidationResultsModal.styles.ts',
  'src/components/VideoModal/VideoDropzone.styles.ts',
  'src/components/VideoModal/VideoModal.styles.ts'
]

const files = (readdirSync('src', { recursive: true }) as string[]).map(path => `src/${path.replace(/\\/g, '/')}`)

describe('CSS Modules migration', () => {
  it('adds no new Emotion styles file', () => {
    expect(files.length).toBeGreaterThan(0)
    const added = files.filter(path => path.endsWith('.styles.ts') && !REMAINING.includes(path))
    expect(added, 'New styles go in a Component.module.css').toEqual([])
  })

  it('lists only styles files that still exist', () => {
    const gone = REMAINING.filter(path => !files.includes(path))
    expect(gone, 'Delete the entries of converted files').toEqual([])
  })

  it('never leaves a converted component with its old styles file', () => {
    const both = files.filter(
      path => path.endsWith('.module.css') && files.includes(path.replace(/\.module\.css$/, '.styles.ts'))
    )
    expect(both, 'Delete the .styles.ts the module replaces').toEqual([])
  })
})

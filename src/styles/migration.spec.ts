// @vitest-environment node
import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Emotion files still waiting for their CSS Modules conversion. A conversion deletes its entry; nothing new joins.
const REMAINING = [
  'src/components/AvatarPreview/AvatarPreview.styles.ts',
  'src/components/CollectionDetailPage/AddItemsModal/AddItemsModal.styles.ts',
  'src/components/CollectionDetailPage/CollectionDetailPage.styles.ts',
  'src/components/CollectionDetailPage/CreatorSaleModal/CreatorSaleModal.styles.ts',
  'src/components/CollectionDetailPage/CreatorSaleModal/ErrorNotice.styles.ts',
  'src/components/CollectionDetailPage/CreatorSaleModal/RangePicker.styles.ts',
  'src/components/CollectionDetailPage/CreatorSaleModal/SaleCountdown.styles.ts',
  'src/components/CollectionDetailPage/CreatorSaleModal/SaleIcon.styles.ts',
  'src/components/CollectionDetailPage/CreatorSaleModal/datePicker.styles.ts',
  'src/components/CollectionDetailPage/DiscountFlow/DiscountFlow.styles.ts',
  'src/components/CollectionDetailPage/ItemActionsMenu/MoveItemModal.styles.ts',
  'src/components/CollectionDetailPage/ItemListRow/ItemListRow.styles.ts',
  'src/components/CollectionDetailPage/ItemSaleStatus/ItemSaleStatus.styles.ts',
  'src/components/CollectionDetailPage/ItemSyncPill/ItemSyncPill.styles.ts',
  'src/components/CollectionDetailPage/LinkedCollectionView/EditUrnModal/EditUrnModal.styles.ts',
  'src/components/CollectionDetailPage/LinkedCollectionView/LinkedCollectionView.styles.ts',
  'src/components/CollectionDetailPage/LinkedCollectionView/PublishLinkedItemsModal/LinkedPublishRow.styles.ts',
  'src/components/CollectionDetailPage/ManageRolesFlow/ManageRolesModal.styles.ts',
  'src/components/CollectionDetailPage/PublishCollectionModal/BuyCreditsModal/BuyCreditsModal.styles.ts',
  'src/components/CollectionDetailPage/PublishCollectionModal/PaymentMethodCard.styles.ts',
  'src/components/CollectionDetailPage/PublishCollectionModal/PublishCollectionModal.styles.ts',
  'src/components/CollectionDetailPage/PublishCollectionModal/PublishItemRow.styles.ts',
  'src/components/CollectionDetailPage/PublishCollectionModal/PublishSuccessModal.styles.ts',
  'src/components/CollectionDetailPage/PublishCollectionModal/ValidationIssuesView.styles.ts',
  'src/components/CollectionDetailPage/SaleTag/SaleTag.styles.ts',
  'src/components/CollectionDetailPage/SellItemFlow/SellItemModal.styles.ts',
  'src/components/CollectionDetailPage/SendItemsFlow/SendItemsModal.styles.ts',
  'src/components/CollectionDetailPage/TransferOwnershipFlow/TransferOwnershipModal.styles.ts',
  'src/components/CollectionsPage/CollectionCard/CollectionCard.styles.ts',
  'src/components/CollectionsPage/CollectionListRow/CollectionListRow.styles.ts',
  'src/components/CollectionsPage/CollectionsPage.styles.ts',
  'src/components/CurationPage/CurationPage.styles.ts',
  'src/components/CurationPage/CurationRow/CurationRow.styles.ts',
  'src/components/CurationPage/ReviewTypePill/ReviewTypePill.styles.ts',
  'src/components/ItemDraftModal/ItemDraftModal.styles.ts',
  'src/components/ItemEditorPage/AvatarCustomizer/AvatarCustomizer.styles.ts',
  'src/components/ItemEditorPage/ChangeFileModal/ChangeFileModal.styles.ts',
  'src/components/ItemEditorPage/EditorPreviewLaunch/EditorPreviewLaunch.styles.ts',
  'src/components/ItemEditorPage/HidesEditor/HidesEditor.styles.ts',
  'src/components/ItemEditorPage/ItemEditorPage.styles.ts',
  'src/components/ItemEditorPage/ItemsSidebar/ItemsSidebar.styles.ts',
  'src/components/ItemEditorPage/PlaybackBar/PlaybackBar.styles.ts',
  'src/components/ItemEditorPage/ReviewBar/ApprovalFlowModal.styles.ts',
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

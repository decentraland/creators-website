# Item Validation Parity (legacy Builder → creators-website)

Inventory of every client-side validation the legacy builder applies to wearable/emote items, and its status here. Purpose: the acceptance criteria for every migrated flow, listed once instead of being rediscovered from scattered builder code, and the checklist for whatever is still to come (social emotes, per-item minter allowances, …).

Builder references are `file:line` in `decentraland/builder` at `2c1f7586` (master, 2026-09). Line numbers drift; the file and symbol are the durable pointer. Server-side rules come from `builder-server`, which is unchanged and enforces them regardless of client.

Status legend:

- **ported** — implemented here (with the location).
- **delegated** — not implemented here because the shared wearable-validator rule book covers it.
- **gap** — applies to a flow that exists here today but is missing. Fix independently of any feature migration.
- **deferred: _feature_** — belongs to a feature not yet migrated. Port it with that feature.
- **dropped on purpose** — the flow exists here and behaves differently by decision (see `DECISIONS.md`).
- **n/a** — intentionally not carried over.

Rule of thumb: nothing is ported before the flow that calls it exists. Unwired validation has no test and rots silently. Model and emote checks are not ported at all: they come from the shared wearable-validator rule book (§1), so a rule change lands there, never here.

## 1. GLB validation suite (legacy `builder/src/lib/glbValidation`)

**delegated**, not ported. Model and emote checks run through `@dcl-regenesislabs/wearable-validator` (`src/lib/validation`, `ruleBook.ts`: the `model` and `emote` groups, plus the `thumbnail` check), the same rule book curation uses, so the editor reports exactly what curation will. Its English messages and check titles are shown as-is (see "Item validation" in `DECISIONS.md`). The table below is the **legacy** inventory (last builder change `c0af0fae`) to compare the rule book against: a legacy rule the rule book lacks is a rule-book issue, not an app gap. Findings are warnings at import and never block a save; the publish gate is the `block-publish-on-validation-errors` flag.

| Rule | Constant(s) | Builder ref |
| --- | --- | --- |
| Triangles per category (Tris Combiner adds hidden slots' budgets) | mask/eyewear/earring/tiara/top_head/facial_hair 500 · hands_wear 1000 · hat/helmet/hair/upper/lower/feet 1500 · skin 5000 · unknown 1500 | `constants.ts` `TRIANGLE_LIMITS`, `getEffectiveTriangleLimit` |
| Bounding box | 2.42 × 2.42 × 1.4 m | `validateDimensions` |
| Materials / textures | 2 (skin 5); `AvatarSkin_MAT` excluded; base-color map only | `validateMaterials`, `validateTextures` |
| Bone influences per vertex | 4 | `validateBoneInfluences` |
| Leaf bones (`_end`, `_neutral`) | — | `validateNoLeafBones` |
| Non-deform bones | — | `validateNoNonDeformBones` |
| Skeleton naming (62 canonical bones, 16 core required, casing hint) | `AVATAR_BONE_NAMES`, `AVATAR_CORE_BONE_NAMES` | `validateArmatureBoneNames` |
| Unrigged (zero-weight) vertices | — | `validateNoUnriggedVertices` |
| Cameras / lights / animations in a wearable | — | `validateNoDisallowedObjects` |
| `_mouth` / `_eyebrows` / `_eyes` material names outside facial categories | `FORBIDDEN_MATERIAL_PATTERNS` | `validateMaterialNaming` |
| Spring bone count (reads undocumented `gltf.parser.json`; skips with a console warning if absent) | 12 | `validateSpringBones` |
| Emote fps | 30 ± 5 | `validateEmoteFrameRate` |
| Emote frames | 300 | `validateEmoteMaxFrames` |
| Emote clips | 1, 2 with props | `validateEmoteAnimationClipCount` |
| Every bone needs position + rotation + scale keyframes | — | `validateEmoteDeformBoneKeyframes` |
| Prop budgets | 3000 tris · 2 materials · 2 textures · 62 bones | `validateProp*` |
| Armature names (`Armature`, `Armature_Prop`, `Armature_Other`) | — | `validateArmatureNaming` |
| Clip suffixes `_Avatar` / `_Prop` when props present | — | `validateAnimationNaming` |
| Audio must be `.mp3` / `.ogg` (`.wav`/`.aac` warned) | `VALID_AUDIO_EXTENSIONS` | `validateAudioFormat` |
| Category suggestion from skin weights (suggestion only, never fails import) | `DOMINANT_REGION_THRESHOLD` 0.6 | `suggestWearableCategory` |

Wiring: every distinct main file is checked once, in a module worker with inline fallback, and re-validated whenever the type, category, hides or emote loop changes (`itemValidationContext`). A check that crashes or cannot run is a warning. `emote_displacement` is a dead translation key in the builder (no validator emits it) and is intentionally absent here.

## 2. Import: extensions, zip structure, representations

| Rule | Status | Here | Builder ref |
| --- | --- | --- | --- |
| Accepted: `.zip` `.gltf` `.glb` `.png`; anything else → wrong extension | ported | `lib/itemFiles.ts` `ITEM_EXTENSIONS` | `modules/item/types.ts:179` `ITEM_EXTENSIONS`; `ImportStep.tsx:327,433` |
| Zip must contain a model path (`.glb`/`.gltf`, or a `.png` that is not `thumbnail.png` / `*_mask.png` / `*_expressions.png`) | ported | `isModelPath`, `missing_model_file` | `modules/item/utils.ts:581` `isModelPath`; `ImportStep.tsx:140` |
| `wearable.json` / `emote.json` parsed; malformed → error; every `representations[].contents` file must exist | ported | `toWearableManifest`, `manifest_file_missing` | `@dcl/builder-client` `files.js` `loadWearableConfig` / `FileNotFoundError` |
| Manifests, dotfiles, dirs, 0-byte entries excluded from contents | ported | `loadZip` | `ImportStep.tsx:133` |
| Single wrapping folder stripped recursively, never `male/`/`female/`, only without manifest | ported | `stripWrappingFolder` | `modules/item/utils.ts:675` |
| Body shape from `male/` / `female/` top-level folders | ported | `getBodyShapeTypeFromContents` | `modules/item/utils.ts:120` |
| Image wearables without shape folders → BOTH | ported | `loadZip` | `ImportStep.tsx:387` |
| Emotes always BOTH, body shape locked | ported | `processDraft.ts` `bodyShapeLocked` | `ImportStep.tsx:426` |
| Orphaned `_mask` / `_expressions` / `_expressions_mask` PNG (case-insensitive) | ported | `findOrphanedAuxiliaryFiles` | `modules/item/utils.ts:615-660`; `ImportStep.tsx:150` |
| Missing external GLTF buffers/textures → specific error | ported | `lib/models.ts` `loadGltf` `missing_external_resources` | `lib/getModelData.ts:87`; `ImportStep.tsx:214` |
| Zip with both `male/` and `female/` while adding a **single representation** → `InvalidModelFilesRepresentation` | **dropped on purpose** (2026-10-22): the change-file modal takes the chosen shape's folder and ignores the other (`lib/itemFactory` `sortContentZipBothBodyShape`; see "Replace model" in `DECISIONS.md`) | `itemModelImport.spec.ts` | `ImportStep.tsx:389` |
| Changing an item's file to a different type (wearable↔emote) → `InvalidModelFileType` | ported: `lib/itemModelImport.ts` `loadModelForItem` (`invalid_model_file_type`) | `itemModelImport.spec.ts` | `ImportStep.tsx:413` |
| Add-representation dropzone restricted to `MODEL_EXTENSIONS` / `IMAGE_EXTENSIONS` by category | ported with a different approach: the change-file modal accepts every `ITEM_EXTENSIONS` file and refuses a model next to a kept texture representation (or vice versa) after the pick (`representation_category_mismatch`) | `lib/itemModelImport.ts` `getModelUpdateError` | `types.ts:180-181`; `ImportStep.tsx:501` |
| `scene.json` zips (smart wearables): `scene.main` must exist, `wearable.json` required, permission checks (`UnknownRequiredPermissions`, `DuplicatedRequiredPermissions`, `MissingRequiredProperties`, `AllowedMediaHostnameIsEmptyOrInvalid`) | ported with one relaxation: `wearable.json` is optional (see "Smart wearables" in `DECISIONS.md`). `lib/itemFiles.ts` `toSceneManifest` / `loadScene` (`manifest_file_missing`, `scene_main_not_code`, `scene_manifest_missing` for scene code without a `scene.json`, `scene_manifest_nested`, `scene_code_mismatch`, `unknown_required_permissions`, `duplicated_required_permissions`, `allowed_media_hostnames_empty`, `invalid_manifest`) | `itemFiles.spec.ts` | builder-client `files.js` `loadSceneConfig`; `ImportStep.tsx:227` |
| Emotes / smart wearables forbidden in third-party collections | ported: `linked_emote` / `linked_smart_wearable` at import and in the change-file modal | `processDraft.ts`, `lib/itemModelImport.ts` | `ImportStep.tsx:419` |
| Bulk zip must contain `wearable.json`; item URN must match collection URN; mapping required for linked collections | ported with one relaxation: in Edit in bulk each zip's `wearable.json` must name an item of the collection (`bulk_edit_no_match`), a URN of another collection is refused (`linked_urn_mismatch`), and a zip without a `mapping` gets All NFTs instead of `missing_mapping` (see "Linked collections" in `DECISIONS.md`) | `lib/linkedManifest.ts` | `CreateAndEditMultipleItemsModal.tsx:162,249` |

## 3. File sizes

Constants (`lib/itemFiles.ts`, same values as `@dcl/builder-client` `files/constants.js`): thumbnail 1 MB · wearable 3 MB · skin 8 MB · emote 3 MB · smart wearable 3 MB · video 250 MB.

| Rule | Status | Here | Builder ref |
| --- | --- | --- | --- |
| Zip with manifest: content sum (excl. `thumbnail.png`) vs skin/wearable/emote cap | ported | `loadZip` | builder-client `files.js` `FileTooBigError` |
| Zip `thumbnail.png` > 1 MB | ported | `loadZip` `thumbnail_too_big` | builder-client `files.js` |
| Bare `.glb`/`.gltf`: import-time cap (8 MB, most permissive), exact cap re-checked at details step once type/category known | ported (stricter than builder, which uses 8 MB only when `SKIN` is selectable) | `loadItemFile`; `lib/itemFactory.ts` `getSizeError` | `ImportStep.tsx:189` |
| Draft recheck before save: model + thumbnail vs type/category cap → save disabled | ported | `isDraftComplete` → `getSizeError` | `CreateSingleItemModal.tsx:148`; `utils.ts:1021` |
| Generated / uploaded thumbnail > 1 MB rejected before save | ported | `ThumbnailModal.tsx` `ThumbnailTooBigError` on capture / upload; `lib/itemFactory.ts` `assertUploadSize` again at save time | `sagas.ts:512` `ThumbnailFileTooBigError`; `CreateSingleItemModal.tsx:131` (checks 5 MB but message says 1 MB, a builder bug: use 1 MB) |
| Thumbnail PNG palette-quantized to 256 colors before upload to stay under 1 MB | ported | `media.ts` `compressPngBlob` (upng-js, size floor: the original is kept when quantizing does not shrink it), applied to the thumbnail and `image.png` in `itemFactory.ts` `withCatalystImage` | `sagas.ts:492` `THUMBNAIL_PALETTE_COLORS` |
| Save-time recompute of final model size deduplicated by hash against existing contents (`calculateModelFinalSize`) | ported in add-items (`uploadItems.ts` `checkOperationSize` fetches the kept stored files); **gap** in the editor's change-file path, where `lib/itemModelImport.ts` sizes the new blobs only (`getSizeError` without `storedSizes`) | `uploadItems.ts` | `modules/item/export.ts:73` |
| Smart wearable 3 MB cap | ported: smart wearables fall through to `MAX_WEARABLE_FILE_SIZE` in `getSizeError` (skin's 8 MB still wins); the video is excluded from the cap | `itemFactory.spec.ts` | builder-client; `ImportStep.tsx:238` |
| Video > 250 MB | ported: `validateVideoFile` (VideoModal) and the zip import (`video_too_big`); mp4 only (`video_wrong_format`); undecodable file (`invalid_video`) | `itemFiles.ts`, `media.ts` `loadVideoMetadata` | `UploadVideoStep.tsx:44`; `sagas.ts`; server `Item.router.ts` `MAX_VIDEO_SIZE` |

## 4. Emote import rules (outside the GLB suite)

| Rule | Status | Here | Builder ref |
| --- | --- | --- | --- |
| Duration > 10 s → rejected | ported, **stricter**: applies to zipped emotes too (builder checks bare files only) | `lib/models.ts` `MAX_EMOTE_DURATION` | `utils.ts:71`; `ImportStep.tsx:182` |
| Emote GLB containing the avatar mesh (`basemesh` / `avatar_mesh`) → rejected | ported (fails at import for zips as well; builder's zip path throws later untried) | `getEmoteMetrics` `emote_with_mesh` | `getModelData.ts:303` |
| Avatar and prop clip durations must match unless `Armature_Other` present | ported; `Armature_Other` is rejected instead (`emote_social_unsupported`, interim until social emotes are supported) | `emote_animations_out_of_sync` | `getModelData.ts:315` |
| Metrics: sequences, duration, frames, fps, props, additionalArmatures (display only) | ported | `AnimationMetrics` | `getModelData.ts:326` |
| Play mode (simple/loop) required before save unless social emote | ported (required for all emotes; social emotes deferred) | `isDraftComplete` | `EmoteDetails.tsx:97`; `CreateSingleItemModal.tsx:122` |
| Social emotes: `startAnimation` / outcomes autocompleted from clip names; ≤ 3 outcomes in editor (`MAX_OUTCOMES`), outcome title ≤ 24 chars; server caps outcomes at 10 | rejected at import (interim; support tracked on the taskboard) | `getEmoteMetrics` `emote_social_unsupported` | `CreateSingleItemModal.tsx:283`; `RightPanel.tsx:76,986,1061`; server `Item.model.ts` `MAX_OUTCOMES_LENGTH` |

## 5. Metadata

| Rule | Status | Here | Builder ref |
| --- | --- | --- | --- |
| Name ≤ 32 chars, non-empty, no `:` | ported | `isValidItemName`, `ITEM_NAME_MAX_LENGTH` | `types.ts:175`; `utils.ts:711` `isValidText`; `sagas.ts:453`; server `Item.schema.ts` pattern `^[^:]*$` |
| Required before save: name, thumbnail, metrics, category, rarity, body shape (wearables) / play mode (emotes) | ported | `isDraftComplete` | `CreateSingleItemModal.tsx:117` |
| Category list: models → all `WearableCategory` minus `body_shape`; PNG-only → eyes/eyebrows/mouth | ported | `getCategoryOptions` | `utils.ts:524` |
| `removesDefaultHiding = [hands]` auto-set for `upper_body` and for items that **hide** `upper_body` | ported | `lib/itemFactory.ts` `buildItem`, `addRepresentationToItem`; the editor recomputes it on save with `lib/itemDraft.ts` `computeRemovesDefaultHiding` | `CreateSingleItemModal.tsx:263,366` |
| Description ≤ 64 chars, no `:`; utility ≤ 64 chars | ported in the item editor (not at import, where the fields don't exist) | `lib/itemDraft.ts` `ITEM_DESCRIPTION_MAX_LENGTH`, `ITEM_UTILITY_MAX_LENGTH`, `isValidItemDescription`; `PropertiesPanel` | `types.ts:176`; `RightPanel.tsx:855`; server `Item.schema.ts` |
| Hides editor: skin removes head/hands/hair/facial_hair/mouth/eyebrows/eyes/upper/lower/feet and `skin`; `body_shape` hidden unless already set; legacy `replaces` merged into `hides` on load | ported | `components/ItemEditorPage/HidesEditor`; `lib/wearableCategories.ts` `getHideableBodyPartCategories` / `getHideableWearableCategories`; the `replaces` → `hides` merge in `lib/itemDraft.ts` | `utils.ts:509-561`; `RightPanel.tsx:108,660` |
| Tags ≤ 20 (server only; builder has no client cap in item flows) | n/a, as in the builder: the editor's `TagsInput` sets no cap and the server enforces it | — | server `Item.model.ts` `MAX_TAGS_LENGTH` |
| Third-party: rarity forced UNIQUE, price 0 / zero beneficiary, `mappings` required and valid when a linked contract exists, ≤ 1 mapping property | ported: the add-items form hides rarity for linked collections and shows the mapping field (required with a linked contract, default All NFTs); manifest mappings are validated with `@dcl/schemas` | `AddItemsModal/DraftForm.tsx`; `lib/linkedManifest.ts`; `lib/mappings.ts` | `CommonFields.tsx:126`; `CreateSingleItemModal.tsx:140,330`; server `Item.schema.ts` |

## 6. Thumbnails

| Rule | Status | Here | Builder ref |
| --- | --- | --- | --- |
| Uploaded picture must be a real PNG (magic bytes, not extension) | ported | `ThumbnailModal.tsx`, `lib/media.ts` `getImageType` | `CreateSingleItemModal.tsx:511`; `media/utils.ts:150` |
| Stored at 1024 × 1024, canvas left unfilled to keep alpha | ported | `THUMBNAIL_SIZE` | `CreateSingleItemModal.tsx:518`; `utils.ts:425` `resizeImage` |
| Non-transparent background warning | delegated to the rule book (S-06: ≥ 1 % pixels with alpha < 8, not legacy's border ring) | `lib/validation` `validateThumbnail` | `media/utils.ts:172` |
| Image wearables: canvas-padded thumbnail from the texture | ported | `convertImageIntoWearableThumbnail` | `getModelData.ts:421` |
| Auto thumbnail regenerated with a category-specific pose when category changes; posed render for upper_body / skin (three.js here, Babylon in legacy) | ported | `lib/thumbnailPose.ts`; `lib/renderPosedThumbnail.ts`; `DraftProcessor` | `lib/thumbnailOptions.ts`; `CommonFields.tsx:37`; `getThumbnailRenderOptions` |
| Size cap (1 MB) and quantization | ported (§3) | `compressPngBlob`; `ThumbnailTooBigError`; `assertUploadSize` | — |

## 7. Spring bones (beyond the count warning)

| Rule | Status | Builder ref |
| --- | --- | --- |
| Editor hard-caps adding beyond 12 and clamps params: stiffness 0–4, gravityPower 0–2, drag 0–1, gravityDir −10..10 | ported: `components/ItemEditorPage/SpringBonesEditor` with `MAX_SPRING_BONES` and `SPRING_BONE_RANGES` from `lib/springBones` | `SpringBonesSection.tsx:384,479` |
| Defaults seeded greedily on upload/update up to 12 subtree bones | ported: `lib/springBones` `getDefaultSpringBoneRoots` (the editor through `getInitialSpringBoneParams`, the Blender live preview on upload) | `lib/springBones.ts:67` `seedSpringBonesForUpload` |

## 8. Item editor re-validation

| Rule | Status | Builder ref |
| --- | --- | --- |
| Full `validateWearableGLTF` re-run when category **or hides** change on an existing item, with traffic-light indicator and issues modal | ported: `ItemEditorPage` re-runs the rule book through `itemValidationContext` when the type, category, hides or loop change, shows `ValidationBadge` and opens the item's details modal (§1 Wiring) | `ItemEditorPage/CenterPanel.tsx:93-163,366` |
| Bulk modal runs the suite per file and rejects only on `ERROR` issues (never happens) | n/a (no blocking behavior to preserve) | `CreateAndEditMultipleItemsModal.tsx:214-232` |

## 9. Error surfacing

| Rule | Status | Here | Builder ref |
| --- | --- | --- | --- |
| Import failures shown inline per file with specific copy, never raw | ported | `ItemFileError` → `add_items_modal.file_error.*` | `ImportStep.tsx:280` (builder appends raw `error.message` for unknown errors: do not copy) |
| Save failures: `collection_locked` / published | ported (`lib/uploadItems.ts` `UploadFailureReason`) | `sagas.ts:477` |
| Save failures: item-too-big family (`ItemWearableTooBigError` etc.) as a distinct message | partial: the size cap is enforced before save (§3), so a server-side size rejection falls into `generic`; add a distinct reason if it shows up in Sentry | `errors.tsx:26`; `sagas.ts:512` |
| Catalyst "deployment is too big" matcher `isItemSizeError` | n/a (defined in builder, zero call sites) | `utils.ts:717` |
| `GLBValidationError` | n/a (dead path: nothing emits `ERROR`) | `errors.tsx:169` |

## Things the builder never validates client-side

Recorded so nobody "restores" them by mistake or assumes they exist: texture resolution / power of two, UV layout, tags content, name uniqueness, price/beneficiary values, `outlineCompatible`, `blockVrmExport`, VRM compatibility, emote root displacement (explicitly skipped in `emoteValidators.ts`), duplicate items, category/hides consistency (e.g. a skin hiding nothing), any comparison of stored `metrics` against limits. The ADR content validations run only at Catalyst deploy time. `getModelData` in the builder swallows load errors and returns zero metrics; this app surfaces them instead (`invalid_model_file`).

## 2026-09-15 parity sweep (branch fix/add-items)

All closed on the branch:

1. `image.png` catalyst image generated by `buildItem` / `withThumbnail` (`media.ts` `generateCatalystImage`: thumbnail over the rarity radial gradient, 512px, legacy `generateImage`), and rebuilt from the stored thumbnail when only the rarity changes (`withCatalystImageForRarity`, used by the editor save and the publish wizard's item step). Excluded from size caps and kept at the root like the thumbnail.
2. Image-wearable auto thumbnails are re-padded when the category changes (`processDraft.ts` `imageThumbnailPatch` / `isImageThumbnailStale`, effect in `AddItemsModal`); a zip-provided thumbnail is left alone.
3. "Suggested from your model" hint under the category select while the guessed category is kept.
4. `wearable.json` `description`, `tags`, `data.blockVrmExport` and `emote.json` `description` / `tags` flow into the payload.
5. `analyzeModel` receives the manifest category and hides.
6. Adding a representation onto an existing item re-checks the merged size (`uploadItems.ts` `checkOperationSize` fetches the kept stored files; legacy `calculateModelFinalSize`).
7. `wearable.json` / `emote.json` validated with the builder-client schemas via `@dcl/schemas` `generateLazyValidator` (`itemFiles.ts`). One relaxation: a representation's `overrideHides` / `overrideReplaces` are optional.
8. Orphaned `_mask` / `_expressions` check also runs on the `wearable.json` path.
9. 1MB thumbnail cap on captured / uploaded thumbnails (`ThumbnailTooBigError`) and again at save time.
10. Save-time re-validation before every PUT (`itemFactory.ts` `assertUploadSize`); failures surface as the `too_big` upload reason (retryable).
11. A manifest representation without a recognizable body shape fails with `invalid_manifest`.

12. Facial-expressions badge on the draft thumbnail (smile glyph + tooltip) when the contents include an `_expressions.png` texture (`itemFiles.ts` `hasFacialExpressions`, legacy `FacialExpressionsBadge`).

Not a gap: the legacy `isComplete` price + beneficiary gate. Items here get the "not for sale" price/beneficiary at upload (see "Publish collection" in `DECISIONS.md`), so only the smart-wearable video half applies.

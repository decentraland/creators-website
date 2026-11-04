# Item Validation Parity (legacy builder → wemotes-builder)

Inventory of every client-side validation the legacy builder applies to wearable/emote items, and its status here. Purpose: when a feature that is out of scope today (smart wearables, item editor, third-party collections, …) gets migrated, its validation rules are listed below as acceptance criteria instead of being rediscovered from scattered builder code.

Builder references are `file:line` in `decentraland/builder` at `2c1f7586` (master, 2026-09). Line numbers drift; the file and symbol are the durable pointer. Server-side rules come from `builder-server`, which is unchanged and enforces them regardless of client.

Status legend:

- **ported** — implemented here (with the location).
- **gap** — applies to a flow that exists here today but is missing. Fix independently of any feature migration.
- **deferred: _feature_** — belongs to a feature not yet migrated. Port it with that feature.
- **n/a** — intentionally not carried over.

Rule of thumb: nothing is ported before the flow that calls it exists. Unwired validation has no test and rots silently. Re-diff `src/lib/glbValidation` against builder master at every migration until the legacy builder is retired; fixes land there first.

## 1. GLB validation suite (`src/lib/glbValidation`)

**ported** verbatim from `builder/src/lib/glbValidation` (last builder change `c0af0fae`). Only i18n keys (`item_validation.*`), typings and formatting differ. All validators emit **warnings**, never errors, in both apps: `isValid` is always `true`, nothing blocks a save, curation decides.

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

Wiring parity: one GLTF load; emote iff `animations.length > 0`; `checkTriangleCount` re-runs on category change **without hides** (same as builder's create modal). `emote_displacement` is a dead translation key in the builder (no validator emits it) and is intentionally absent here.

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
| Add-representation dropzone restricted to `MODEL_EXTENSIONS` / `IMAGE_EXTENSIONS` by category | deferred: add representation | — | `types.ts:180-181`; `ImportStep.tsx:501` |
| `scene.json` zips (smart wearables): `scene.main` must exist, `wearable.json` required, permission checks (`UnknownRequiredPermissions`, `DuplicatedRequiredPermissions`, `MissingRequiredProperties`, `AllowedMediaHostnameIsEmptyOrInvalid`) | ported: `lib/itemFiles.ts` `toSceneManifest` (`smart_wearable_missing_manifest`, `manifest_file_missing`, `unknown_required_permissions`, `duplicated_required_permissions`, `allowed_media_hostnames_empty`, `invalid_manifest`) | `itemFiles.spec.ts` | builder-client `files.js` `loadSceneConfig`; `ImportStep.tsx:227` |
| Emotes / smart wearables forbidden in third-party collections | deferred: third-party collections | — | `ImportStep.tsx:419` |
| Bulk zip must contain `wearable.json`; item URN must match collection URN; mapping required for linked collections | deferred: bulk edit (`CreateAndEditMultipleItemsModal`) | — | `CreateAndEditMultipleItemsModal.tsx:162,249` |

## 3. File sizes

Constants (`lib/itemFiles.ts`, same values as `@dcl/builder-client` `files/constants.js`): thumbnail 1 MB · wearable 3 MB · skin 8 MB · emote 3 MB · smart wearable 3 MB · video 250 MB.

| Rule | Status | Here | Builder ref |
| --- | --- | --- | --- |
| Zip with manifest: content sum (excl. `thumbnail.png`) vs skin/wearable/emote cap | ported | `loadZip` | builder-client `files.js` `FileTooBigError` |
| Zip `thumbnail.png` > 1 MB | ported | `loadZip` `thumbnail_too_big` | builder-client `files.js` |
| Bare `.glb`/`.gltf`: import-time cap (8 MB, most permissive), exact cap re-checked at details step once type/category known | ported (stricter than builder, which uses 8 MB only when `SKIN` is selectable) | `loadItemFile`; `lib/itemFactory.ts` `getSizeError` | `ImportStep.tsx:189` |
| Draft recheck before save: model + thumbnail vs type/category cap → save disabled | ported | `isDraftComplete` → `getSizeError` | `CreateSingleItemModal.tsx:148`; `utils.ts:1021` |
| Generated / uploaded thumbnail > 1 MB rejected before save | **gap** | — (only zip-provided thumbnails are checked) | `sagas.ts:512` `ThumbnailFileTooBigError`; `CreateSingleItemModal.tsx:131` (checks 5 MB but message says 1 MB, a builder bug: use 1 MB) |
| Thumbnail PNG palette-quantized to 256 colors before upload to stay under 1 MB | ported | `media.ts` `compressPngBlob` (upng-js, size floor: the original is kept when quantizing does not shrink it), applied to the thumbnail and `image.png` in `itemFactory.ts` `withCatalystImage` | `sagas.ts:492` `THUMBNAIL_PALETTE_COLORS` |
| Save-time recompute of final model size deduplicated by hash against existing contents (`calculateModelFinalSize`) | deferred: edit existing item | — | `modules/item/export.ts:73` |
| Smart wearable 3 MB cap | ported: `MAX_SMART_WEARABLE_FILE_SIZE` in `itemFiles.ts` + `getSizeError` | `itemFiles.spec.ts`, `itemFactory.spec.ts` | builder-client; `ImportStep.tsx:238` |
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
| `removesDefaultHiding = [hands]` auto-set for `upper_body` | ported for the category only; the builder also sets it for items that **hide** `upper_body`, add that when hides become editable | `lib/itemFactory.ts` | `CreateSingleItemModal.tsx:263,366` |
| Description ≤ 64 chars, no `:`; utility ≤ 64 chars | deferred: description / utility fields (server-enforced meanwhile) | — | `types.ts:176`; `RightPanel.tsx:855`; server `Item.schema.ts` |
| Hides editor: skin removes head/hands/hair/facial_hair/mouth/eyebrows/eyes/upper/lower/feet and `skin`; `body_shape` hidden unless already set; legacy `replaces` merged into `hides` on load | deferred: item editor (hides) | — | `utils.ts:509-561`; `RightPanel.tsx:108,660` |
| Tags ≤ 20 (server only; builder has no client cap in item flows) | deferred: tags field (server-enforced) | — | server `Item.model.ts` `MAX_TAGS_LENGTH` |
| Third-party: rarity forced UNIQUE, price 0 / zero beneficiary, `mappings` required and valid when a linked contract exists, ≤ 1 mapping property | deferred: third-party collections | — | `CommonFields.tsx:126`; `CreateSingleItemModal.tsx:140,330`; server `Item.schema.ts` |

## 6. Thumbnails

| Rule | Status | Here | Builder ref |
| --- | --- | --- | --- |
| Uploaded picture must be a real PNG (magic bytes, not extension) | ported | `ThumbnailModal.tsx`, `lib/media.ts` `getImageType` | `CreateSingleItemModal.tsx:511`; `media/utils.ts:150` |
| Stored at 1024 × 1024, canvas left unfilled to keep alpha | ported | `THUMBNAIL_SIZE` | `CreateSingleItemModal.tsx:518`; `utils.ts:425` `resizeImage` |
| Non-transparent background warning | delegated to the rule book (S-06: ≥ 1 % pixels with alpha < 8, not legacy's border ring) | `lib/validation` `validateThumbnail` | `media/utils.ts:172` |
| Image wearables: canvas-padded thumbnail from the texture | ported | `convertImageIntoWearableThumbnail` | `getModelData.ts:421` |
| Auto thumbnail regenerated with a category-specific pose when category changes; posed render for upper_body / skin (three.js here, Babylon in legacy) | ported | `lib/thumbnailPose.ts`; `lib/renderPosedThumbnail.ts`; `DraftProcessor` | `lib/thumbnailOptions.ts`; `CommonFields.tsx:37`; `getThumbnailRenderOptions` |
| Size cap (1 MB) and quantization | quantization ported (§3); the 1 MB cap on generated thumbnails is still a gap | `compressPngBlob` | — |

## 7. Spring bones (beyond the count warning)

| Rule | Status | Builder ref |
| --- | --- | --- |
| Editor hard-caps adding beyond 12 and clamps params: stiffness 0–4, gravityPower 0–2, drag 0–1, gravityDir −10..10 (constants already in `glbValidation/constants.ts`) | deferred: spring-bone editor | `SpringBonesSection.tsx:384,479` |
| Defaults seeded greedily on upload/update up to 12 subtree bones | deferred: spring-bone config seeding | `lib/springBones.ts:67` `seedSpringBonesForUpload` |

## 8. Item editor re-validation

| Rule | Status | Builder ref |
| --- | --- | --- |
| Full `validateWearableGLTF` re-run when category **or hides** change on an existing item, with traffic-light indicator and issues modal | deferred: item editor | `ItemEditorPage/CenterPanel.tsx:93-163,366` |
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

# Item validation

One interface for checking a wearable or emote against Decentraland's requirements, shared by the item editor, the add-items modal, the publish modal and the Blender live preview.

```ts
import { getValidator } from '~/lib/validation'

const { issues } = await getValidator().validate(
  { kind: 'item', item }, // or { kind: 'blob', contents, mainFile }
  { type: item.type, category: item.data.category, hides: item.data.hides },
  { signal }
)
```

- **Sources**: `blob` (in-memory files: imports, live preview) or `item` (a saved item; its contents are loaded from public storage with the full path→URL mapping so a `.gltf`'s textures resolve).
- **Context**: item type plus the category and hides the category-dependent checks (triangle budget, material/texture caps, material naming) depend on. Re-validate whenever they change.
- **Result**: a list of `ValidationIssue`. `code` is the validator's check name (`triangle-count`, `skeleton`, …). Every issue carries the English `message` written by the rule book.
- **Backends**: `localValidator` runs the `model` and `emote` groups (and, through `validateThumbnail`, the `thumbnail` rule) of [`@dcl-regenesislabs/wearable-validator`](https://github.com/decentraland/wearable-validator), the same rule book curation uses. Rule changes go to that repo, not here. `setValidator()` swaps in another implementation (a remote service, a test double) without touching callers.
- **React**: `hooks/useModelValidation(source, ctx)` caches by content hashes (items) or a caller id (blobs) and aborts a run the moment its inputs change; `hooks/useThumbnailValidation(source)` does the same for a thumbnail (an in-memory PNG or a saved item's).

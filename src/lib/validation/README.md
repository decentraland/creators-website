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
- **Result**: a list of `ValidationIssue` (`code`, `severity`, `messageKey`, `messageParams`). Codes and severities are stable across backends; the UI resolves copy from `item_validation.*`.
- **Backends**: `localValidator` wraps `lib/glbValidation` through Three.js. `setValidator()` swaps in another implementation (a remote service, a test double) without touching callers.
- **React**: `hooks/useModelValidation(source, ctx)` caches by content hashes (items) or a caller id (blobs) and aborts a run the moment its inputs change.

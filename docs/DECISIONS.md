# Decisions

Product and technical decisions behind the shipped features that the code cannot explain on its own: where this app deliberately differs from the legacy Builder, what was cut on purpose, and back-end or chain facts the client depends on. Read the section for the flow you are touching before changing it; a "bug" listed here as a decision is not a bug.

Rules for this file:

- One bullet per decision, with the why when it is not obvious. No layout or copy descriptions: the code and the Figma frames are the reference for those.
- Add the entry in the same PR that implements or reverses the decision, dated when it matters.
- A reversed decision is rewritten in place, not appended as a contradiction.

## Cross-cutting

- **builder-server is unchanged by default.** Every flow uses endpoints that already exist. The exceptions are listed in their section (transfer ownership, forum post body, linked drafts) and each had its own builder-server PR.
- **Paginated builder-server lists need both `page` and `limit`.** Without both, `/collections` and `/collections/:id/items` answer a bare array instead of the paginated envelope. Numeric columns such as `item_count` arrive as strings and are cast in `lib/collections`.
- **Subgraph lag is patched in the query cache, not awaited.** builder-server reads minters, managers, `total_supply` and ownership from the collections subgraph, which lags a mined transaction by minutes. After a successful on-chain write the client patches the cached collection (and remembers roles and "sales enabled" for the session) instead of refetching, so the UI never shows the pre-transaction state.
- **Transactions go through `lib/auth#sendContractTransaction`.** Direct from the wallet when it is already on the contract's chain, otherwise a gasless meta-transaction (`lib/chain/metaTransaction`) through the relayer at `TRANSACTIONS_API_URL`. Web3 wallets get a "Confirm in your wallet" state with Cancel until signed; social logins (Magic) sign without a prompt, so their dialogs stay put with a spinning button. A dismissed wallet prompt is never an error: the dialog returns to the form.
- **Raw errors never reach the user.** Failures map to friendly copy, go to Sentry with a `flow` tag, and retries are offered only when a retry can succeed (a locked or already-published collection gets no TRY AGAIN). Curators are the one exception: the approval flow shows them the raw error with a Copy button for support.
- **Mobile is a viewer.** Below the `noActions` breakpoint (900px) collection management actions are hidden, and below 768px the editor is preview-only. Curation actions are desktop-only too.
- **Event names reuse the legacy Builder's verbatim** where an event for the same intent exists, props included, so a warehouse query written for the old Builder also counts this app. See `TRACKING_SPEC.md`.
- **e2e tests never touch a real environment.** They run against an in-memory builder-server and mocked services, wallet and chain, so a spec can neither depend on nor change shared data. Flows that predate the harness keep their component specs until their e2e spec lands; a missing one is a known gap, not a decision.
- **Pre-monorepo refactor.** The app is being prepared to move into the dcl-one monorepo, whose web apps use CSS Modules and have no Emotion, MUI or decentraland-ui2. Until the move, no new Emotion, MUI (icons excepted for now) or decentraland-ui2 usage is added, static or lazy-loaded: ESLint rejects it outside the files that already depend on it, and styled defs live only in `*.styles.ts`. The targets are CSS Modules for styling, viem for chain code, and components that never call a back-end transport directly (hooks and `lib/` do). For builder-server this is done: its client is one folder with a single transport, and components never call it directly (ESLint enforces it). Chain code is done too: viem only, with ESLint rejecting `ethers` and `decentraland-transactions`; the contract data lives in `lib/chain/contracts`, pinned to the values of `decentraland-transactions@3.3.0`. viem stays on 2.55 until `decentraland-connect` ships a wallet stack built on a newer one.

## Collections list and status model

- **One status rule set** (agreed in creators-website #88, mirrors builder-server #814). The source of truth is builder-server's `Collection.getStatusStatement`; `lib/collections#getCollectionDisplayStatus` mirrors it so a pill always matches the chip it is listed under. First match wins: linked → Linked; not on chain → Draft (a locked draft with a publish in flight reads Publishing); latest review request `rejected` → Rejected, which wins over approval and disable alike; approved on chain → Under review if the latest request is `pending`, else Published; not approved on chain and (latest request `approved`, or no request and approved before) → Paused (curators keep the legacy "Disabled" wording); anything else, a previously reviewed collection with a `pending` request included → Under review.
- **`reviewedAt` alone never proves an approval.** The rescue step of a first approval stamps it too. `hasBeenApproved` is "approved now, or `reviewedAt` differs from `createdAt`" (the contract stamps `reviewedAt` with `createdAt` on creation), so a collection under review again still counts as approved before.
- **Rejected pushed changes on an approved collection read Rejected**, while buyers keep getting the approved version. A collection disabled after its changes were rejected also reads Rejected, and its creator can request review again.
- **Standard collections only in the main list by default.** Linked (third-party) collections sit behind their own chip, always shown, and carry no status.
- **Dropped from legacy:** the orphan-items tab, the sort dropdown and the notifications bell.
- **Role badge.** Collections listed because the signer is an on-chain manager or minter, not the owner, carry a Collaborator or Sender pill. Owners get none.

## Collection detail

- **Published collections are public.** Any signed-in address can open a published collection read-only (as in the legacy Builder, so the Foundation can look at what is being created). Readers see no edit, publish, sales, roles or curation action, no item status column and no status pill (builder-server rejects their curation request). Drafts show the not-found panel to anyone without a role.
- **Rename only while unpublished.** Renaming regenerates the `initialize` calldata over every item, so it is hidden once `isPublished` and while the one-day publish lock holds.
- **Preview in World** opens the desktop explorer with a `decentraland://` deep link straight into the per-environment preview world with the backpack open, skipping the legacy location chooser; the web explorer no longer exists. If the tab keeps focus for ~750ms no client handled the link and the download page opens.
- **Items are filtered and paged client-side** because builder-server cannot filter items by type.
- **Item status column** shows only on collections approved on chain (`isApproved`, not `hasBeenApproved`) and only while some row says more than Published. Tags are ignored when comparing a builder item with its Catalyst entity: the marketplace and the Shop read tags from the builder, so a tag edit is live without a review and never reads Modified; only the approval's deploy plan compares strictly.
- **Dropped from the legacy menus:** "Add existing item" (no orphan items here), "See details" (no item detail page) and the item-level "See in Decentraland" (broken in legacy).

## Create collection

- **The create request is byte-compatible with the legacy Builder:** client-generated UUID, zero-address placeholder URN, and the ABI-encoded `ERC721CollectionV2.initialize` calldata from which builder-server derives the CREATE2 salt and contract address (it rejects a save without it). `symbol` is `DCL-` plus the name with lowercase vowels and whitespace stripped, uppercased, as `getCollectionSymbol` did.
- **Name rules are the legacy ones:** non-empty, at most 32 characters, no `:` (names feed URN construction). Uniqueness is server-side and global; builder-server's literal "Name already in use" is mapped to friendly copy.

## Add items

- **One multi-item modal replaces the legacy single-item import.** Nothing touches the server until the batch is finished (or "Save changes" on leave); failures reopen the modal with only the items that failed.
- **GLB validation issues are warnings, never blockers, at import.** Blocking happens at publish time behind the `block-publish-on-validation-errors` flag.
- **Rarity defaults to Epic.** Price and beneficiary are set to "not for sale" at upload, so the legacy "items must be complete" publish check always passes here.
- **`removesDefaultHiding: [hands]`** is written for upper-body items (and anything hiding the upper body), as legacy did; the editor recomputes it on save.
- **Thumbnails are always 1024×1024.** Categories with a thumbnail pose (`upper_body`, `skin`) are rendered offscreen with three.js, falling back to the preview screenshot. Zip-provided or user-picked thumbnails are never regenerated.
- **Zip budgets:** at most 500 entries, a shared inflate budget of about 259MB that aborts mid-entry, and per-type size caps (wearable 3MB, skin 8MB, emote 3MB, thumbnail 1MB). A single wrapping folder is stripped recursively, never `male/` or `female/`.
- **Social emotes (an `Armature_Other` armature) are rejected at import** (PR #116): unreleased and unsupported platform-wide. Support is a low-priority follow-up; never point the copy at the legacy Builder as a workaround.
- **Legacy `replaces` is folded into `hides`** on load, and `overrideHides` / `overrideReplaces` on every representation mirror `hides` / `replaces` (zip manifests included).
- **Cut on purpose (v1):** the "Allow to promote in events?" toggle (no schema field yet), description and utility fields at import (the editor has them), spring-bone seeding from zips.

## Smart wearables

- **A zip is smart when it carries `scene.json`** at the root, inside a single project folder, or duplicated under `male/` and `female/` the way a downloaded item ships it, so a download round-trips (2026-11-03, PR #182). `wearable.json` is optional; legacy required it when the scene was at the root and otherwise dropped the scene silently.
- **One code per item.** Two `scene.main` copies that differ are rejected (`scene_code_mismatch`). The normalized `scene.json` and the JS ship under both `male/` and `female/` like every other file.
- **The preview video is required to save a smart draft** (2026-09-14), matching legacy's `required: true`. A single `.mp4` in the zip pre-fills it (legacy never read one; an addition); more than one fails the file; a plain zip drops any `.mp4` silently. The 250MB video is excluded from the 3MB model cap. No duration cap: legacy defined the copy but never enforced one.
- **Video uploads go to `POST /items/:id/videos`**, and `item.video` is set only until the item is approved: afterwards a new upload replaces `contents['video.mp4']` alone so the item reads as changed and goes through review (builder-server copies the hash on approval).
- **Linked collections take no smart zip** (`linked_smart_wearable`), as legacy refused them.

## Item editor

- **The URL is the only source of selection state** (`?collection=&item=&reviewing=true&unity=false`), as in legacy. A missing or unknown `item` selects the first wearable, else the first item, without rewriting the URL. `reviewing=true` is honoured only for committee members and ignored for everyone else, so links stay shareable. `?unity=false` is resolved in `src/config`, the one place that reads query params.
- **The preview iframe never reloads for a prop change.** ui2's `WearablePreview` bakes props into the iframe URL (a reload costs ~10s on Unity), so `AvatarPreview` mounts it once with a frozen snapshot of the avatar attributes and pushes everything else, items included, through `lib/previewBridge` as full UPDATE messages, re-sent after every boot.
- **Renderer choice follows the Shop's heuristic without its mobile short-circuit** (Unity on phones too), decided once per page load: `?unity=false` → Babylon; flag off or unknown → Babylon; data saver, a measured link under 10 Mbps, under 4GB memory or a high-DPR low-core device → Babylon; else Unity. The link is measured by downloading an incompressible 512KiB probe and timing only its second half; the Shop's passive resource-timing sampler never had a sample cross-origin and vetoed Unity on fast links.
- **The editor styling follows creator-hub's inspector** (surfaces, paddings, panel format, `theme.editor` tokens), not the legacy Builder. Panel sizes and the sidebar mode persist in `localStorage`.
- **Selection and dressing are separate.** Selecting a wearable dresses it; the eye toggle dresses or undresses without changing selection; at most one emote is dressed. Items with no representation for the current body shape stay selectable but not dressable.
- **Name and description are limited to 32 and 64 characters with no `:`** because both are fields of the on-chain metadata string; an invalid one blocks Save inline. Rarity is locked once published.
- **Camera range (Babylon only; Unity drives its own camera):** `zoom` scaled by 3 with `wheelZoom = 5`, `wheelStart = 50`, which keeps the legacy starting radius (`radius / 1.75`) while the wheel zooms 3× in, like Unity's FOV range, and about 1.7× out. The JUMP emote keeps its wider framing (legacy quirk).
- **The campaign tag hint** comes from Contentful through Decentraland's CMS proxy behind the `builder-campaign` flag, exactly as legacy read it. No campaign, flag off or CMS down shows nothing and never errors.
- **Review mode is read-only for curators too** (2026-09-25, user feedback). A curator must not approve by previewing the model without reading each item's metadata, so the properties panel is always shown, never collapsible, fully disabled.
- **Out (v1):** orphan items and social-emote editing (start animation, outcomes).

## Replace model and add representation

- **"Replace model" and "Add {shape} model" open one modal that saves on confirm** (2026-10-22, 2026-11-02), as the legacy modal did; creators are used to it. It saves the file change alone, built from the saved item; every other unsaved panel edit stays pending in the form, except a category the modal had to pick and a render it stored.
- **Replacing one shape of a unisex item keeps the other** (differs from legacy, which narrowed the item to the picked shape). A zip with both `male/` and `female/` folders on a single-shape pick is not rejected: it is narrowed to that folder's files once, right after the pick. One representation serving both shapes is never produced: neither this editor nor legacy stores one.
- **A wearable↔emote type switch is rejected** (`invalid_model_file_type`), and so is a social GLB.
- **Spring-bone params survive a model change per body shape, by bone name** (PR #152), unsaved tuning included; legacy carried only the saved ones. A new model inherits the params of the model that served its first shape; two models collapsing to one unisex take the first shape's. A new model with no spring bones drops them.
- **The "Update the thumbnail" checkbox is ticked by default** and the copy never says "render" (2026-11-02).

## Spring bones

- **Params are keyed by representation model hash** under `item.data.springBones.models[hash]`; two-GLB items get a body-shape tab pair that also switches the preview shape.
- **Params are pushed to the renderer on every preview load and emote play**, not only on edits: a reloaded scene has no chains.

## Item validation

- **The wearable-validator rule book is the only validator** and its English messages and check titles are shown as-is, so the editor says exactly what curation says. Only the copy the app adds around them goes through `t()`.
- **Every distinct model of an item is checked** (both body shapes; a shared unisex file once), with issues tagged by the shape they were found in and never merged.
- **A check that crashes or cannot run is a warning, never an error**, and never blocks publishing. The rule book runs in a module worker (same-origin blob shim importing the CDN chunk) with inline fallback; a run over 60s is taken as hung and the worker is replaced.
- **Results for saved items are cached in IndexedDB** (`idb-keyval`), keyed by content hashes plus type, category, hides, loop and body shapes, and cleared whenever the cache revision or validator version changes. Failed runs are never persisted. The editor, the collection page, the publish modal and the curators' badge share it.
- **Validation is desktop-only.** Nothing runs at or below 900px on the collection page or at 768px in the editor; widening the window starts it.
- **The publish gate is a flag** (`block-publish-on-validation-errors`, builder): on, a finished result with errors disables PUBLISH and Publish changes; off, the creator sees the issues and may continue anyway. Warnings never block.
- **Curators get a collection validation badge** only while the collection is To review or Under review, over the items with pending changes (PR #119). It never blocks an action.

## Publish collection

- **Deliberate differences from the legacy wizard:** no separate "review content policy" step (its four acknowledgments are spread across the three steps, worded as in legacy); the contact email moves to step 1; the newsletter opt-in is dropped; the collection name and the items' name and rarity are editable in place; no Wert credit-card path (buying credits with Stripe is a seam, `PaymentMethod`).
- **At most 50 items per publish** (`MAX_PUBLISH_ITEMS`): the legacy curation tooling handles collections in chunks of 50 and refuses larger ones.
- **The email is recorded through `POST /collections/:id/tos` before any payment**, retried three times except on a 4xx; a failure aborts with `tos_failed` and reopens step 1. builder-server forwards it to the warehouse as the legal record of the acceptance.
- **Fees come from `GET /rarities`**: every rarity costs the same, credits are USD cents / 10 rounded up (credits-server's rounding), and the MANA-per-credit rate on the card is derived from those two prices. Before prompting the wallet the quoted MANA total is cross-checked on chain against `RaritiesWithOracle.getRarityByName` with a 5% tolerance for oracle drift (`lib/feeVerification`); a mismatch refreshes the quote instead of prompting.
- **MANA approvals are exact, never unlimited.** The allowance must not outlive the publish, so every MANA publish asks for `approve(fee)` when the allowance is short, social logins included. Credits pay through `CreditsManager.useCredits` with `maxUncreditedValue = 0`, so no MANA leaves the wallet.
- **Legacy `Qm…` content hashes are re-hashed and re-saved at publish time**, as the legacy saga did, since the Catalyst cannot deploy them.
- **The post-publish sync is detached and recoverable.** The app waits for the receipt and calls `POST /collections/:id/publish`, retrying on 401 for up to an hour while the subgraph catches up. Because that dies with the tab, the detail page re-runs the same sync whenever the server reports the collection published while an item still lacks a token id (what legacy did on every fetch).
- **The success copy promises no review time** and no notification system yet.

## Sell item, edit price, remove from sale

- **One flow merges legacy's two steps:** "Enable sales" (adding `OffChainMarketplaceV2` to the collection's minters) is the first step of the first sale, not a separate authorization modal.
- **Only the owner sells.** The off-chain marketplace executes a primary order only when signed by the collection's creator (`NotCreator`), and enabling sales edits the contract's minters, which is creator-only too. Selling is enabled once the collection `hasBeenApproved`.
- **The 1 MANA minimum blocks instead of warning** (`MIN_SALE_MANA_WEI`): below it the buyer would pay the meta-transaction gas. The ceiling is 1e12 credits or MANA, inside marketplace-server's catalog guard.
- **Credits are the default currency**, pegged at 1 credit = $0.10; a credits price is signed as a USD-pegged MANA order (`assetType 2`). The MANA USD estimate comes from the Chainlink aggregator the marketplace settles with (`manaUsdAggregator()`), cached 5 minutes, hidden when the round is stale.
- **A giveaway is encoded the legacy way** (ERC20 MANA, amount 0, zero-address beneficiary). The Shop catalog hides zero-price listings, so giveaways are not visible there; chosen knowingly to match legacy.
- **No expiration means 2100-01-01** (`NO_EXPIRATION`); an expiration date ends at the end of the chosen local day.
- **Remove from sale resolves the order's contract through the local registry (`lib/chain/contracts`)**, never trusting the address marketplace-server returns: an unknown address, a non-marketplace contract or another chain aborts the cancellation. A legacy CollectionStore price with no order is cleared on the collection contract with `editItemsData` instead.
- **Edit price is cancel-then-resign.** Orders are immutable, so the old order is cancelled on chain and a new one signed with the old beneficiary and expiration. marketplace-server may answer 409 while its indexer still holds the cancelled order; only the POST is retried (up to eight attempts: seven retries 3→8s apart), never the signature. A failure after the cancellation lands keeps its terms, so TRY AGAIN signs the new order directly.
- **Minting for free from the Builder is out of scope.**

## Send items

- **"Mint" is never said in the UI**; the flow is called Send items and recipients are grouped into transfers (every recipient of a transfer gets the same bundle) instead of one address row per item.
- **Who can send:** the collection `hasBeenApproved` (decided over legacy's `isApproved`-right-now) and the signer is the owner or an on-chain minter. Collaborators never see it: `issueTokens` reverts for them.
- **The cap is 100 copies per transaction** (`MAX_ITEMS_PER_SEND`, PR #139). Bor caps a transaction at 2^25 gas and `issueTokens` costs ~157k gas per copy to never-held recipients (measured on Amoy, 2026-10), so 100 copies sit under half the cap; the legacy 50 was an unmeasured 2021 guess.
- **Pasting a list of addresses adds them all** (PR #144): every `0x` + 40-hex token in the clipboard is a candidate, validated like a typed one, deduped, cut at the remaining room with a toast.
- **Dropped from legacy:** "apply to all items", the add-item dropdown (every sendable item is listed), the Activity redirect.

## Collection roles

- **On-chain minters are "Senders" and managers are "Collaborators"** everywhere in creator-facing copy.
- **The Shop's minter contracts are hidden from the Senders list** (OffChainMarketplace V1/V2/V3 and the legacy CollectionStore): removing one would silently take the collection off sale. They are kept untouched on save and refused if pasted.
- **One transaction with only the diff**, awaited in-dialog with success and error feedback; legacy redirected to Activity.
- **Cut:** per-item minter and manager allowances, ENS resolution (friends cover the common case).

## Transfer ownership

- **New feature** (PR #96, 2026-10-27): neither the legacy Builder nor this app offered `ERC721CollectionV2.transferCreatorship`; creators did it on Polygonscan.
- **Two-step confirmation with the collection name typed**, since the transfer is irreversible from the previous owner's side. The owner's own address, the zero address, the Shop's contracts and the collection's own contract are refused. No discard prompt on close: two fields are nothing to lose.
- **Reads never write.** builder-server's permission checks compare against the database `eth_address`, which the chain never updates. The companion builder-server change (#828) stores the subgraph creator on two write paths: the explicit `POST /collections/:id/owner/sync` the client polls after a transfer, and every write to a published collection. A transfer the client never reported (tab closed, done on Polygonscan) takes effect on the next write by either owner.
- **The wait for the receipt gives up after five minutes** (a sped-up or replaced transaction gets a new hash the client never sees) and the sync poll after ten; the transfer is done either way.

## Curation

- **No feature flag.** The committee check (`GET /committee`, failing closed) is the only gate for the nav tab, `/curation` and `?reviewing=true`.
- **Third-party curation was out of scope at first** (2026-09-25) and shipped later with linked collections (PR #142); see that section.
- **`under_review` is folded into `to_review`** in the client's state table: a pending request is to review whether or not a curator has it, and the assignee cell says who. The list opens on To review and "Unassigned + me" (2026-10-22), defaults kept out of the URL.
- **Rejecting a never-reviewed collection creates the request first** (`POST`) and then patches it `rejected`, so the creator sees a Rejected state. Legacy's reject did nothing there (a dead end).
- **After approving on chain the pending request is also patched `approved`.** Legacy skipped this, which is why curators there had to approve twice.
- **The approval flow is one stepper with only the steps a run needs:** prepare (token ids), rescue (always on a first approval since `createCollection` records no content hashes, afterwards only items whose ADR-32 hash differs from the on-chain one, in chunks of 50), upload (entities signed with the curator's identity, no wallet prompt), enable (waits for the receipt and for builder-server to read `is_approved`, up to 2 minutes), done. Every step is idempotent; TRY AGAIN recomputes what is left.
- **Catalyst entity metadata key order is part of the content hash** (`lib/catalystEntity`). Parity with the chain was checked against 25 live mainnet items. Do not reorder keys.
- **A blank subgraph response is handled as "nothing on chain yet"** (PRs #157/#159): the approval plan is built from the reviewed items and prepare fails open, since the subgraph has answered 200 with empty data.
- **Deploy missing entities skips edited-but-unsynced items on purpose.** Their new hash is not rescued on chain, so the Catalyst would reject them and abort the missing ones, and deploying them would ship unreviewed changes. Legacy deployed both together.
- **Enable (a disabled collection with no pending request) only flips `setApproved(true)`**: no rescue, no upload, the review request untouched, since approving one would promote unsent smart-wearable videos.
- **Creators can request review again after a rejection** (owners and collaborators); legacy had no way out of that state. Publish changes and Request review again run the same validation pre-step as publishing.
- **Publishing opens the first review request** (2026-11-05, reverses the earlier rule): publishing means sending the collection for review, so the publish flow opens the request once the publication is synced, also when a later visit, within a month of publishing, finishes a publish the tab left halfway. It is opened from the front end, like the request the approval flow already opens before approving or rejecting; builder-server treats a creator's first request as the publication's, not as submitted changes. A collection that already has a request keeps it, and collections published before this, or from the legacy Builder, still read as To review without one.

## Forum post

- **The Discourse topic was dropped (2026-09-25) and reinstated (2026-10-06)** as the interim feedback channel: rejection reasons and review threads do not ship yet, and without the forum creators had no way to learn why a collection was rejected. The in-app replacement (rejection reasons, threads, assignment history, notifications) is future work that needs builder-server storage.
- **builder-server builds the post** (`POST /collections/:id/post` takes no body, since builder-server #812) and answers 409 with the existing link, which the client reuses. No reply count, no unread badge, no `FORUM_URL` config: links come from `forumLink` through the safe-external-URL guard.
- **Creation runs detached after the publish sync** and is recoverable: an owner or collaborator opening a synced, unapproved collection without a link triggers it once per tab, between 1.5 hours and 30 days after publishing started, under a per-collection Web Lock. builder-server's check is not atomic, so two browsers can still race.
- **Retries are capped** (three with backoff), unlike legacy's endless ones. The assignee reply is fire-and-forget: a failure goes to Sentry and the assignment still succeeds.
- **Standard collections only.** Third-party topics are created by builder-server itself.

## Linked collections

- **Ported from the legacy Builder's live flow only** (flags `linked-wearables-v2` and `linked-wearables-payments` on); pre-V2 branches are not ported. L1 collections, emotes and smart wearables in linked collections, and the item-level "See in Decentraland" are out.
- **Started read-only** (Linked chip, owner-only, an "Edit in Builder" link) and became a full migration in one PR with no flag (PR #142, with builder-server #823 for drafts), so the legacy Builder can be retired for this surface.
- **Editing is for the third party's managers, never the collection roles.** A published linked collection (one with a submitted item) opens read-only to any signer (PR #172); item curations and slots stay manager-only because builder-server serves them to managers only.
- **A zip whose `wearable.json` has no `mapping` gets All NFTs**, shown before upload. Legacy refused such zips with `missing_mapping`.
- **The contract check probes ERC-721 and ERC-1155 interface ids** through ERC-165; legacy probed the ERC-165 id itself, which was a bug.
- **Review threshold:** every item under 50, else max(50, 1%) capped at 300; Approve is blocked until it is reached. Approve on chain only when the Merkle root changed.

## Overview (creator home) and pre-launch gate

- **The overview moved here from the sites repo** and is served by path at `decentraland.org/create`; `/overview` survives as a redirect. The router `basename` is `/create` whenever the page URL starts with it and `/` otherwise, so one build serves local dev, Vercel previews and the CDN.
- **Its events go to sites' Segment source**, not this app's, with the `Section Viewed` and `Click` names kept, so sites' dashboards keep working. Everything else in the app reports to the Builder source.
- **Every environment reads the `.org` hot-scenes feed**: the data is public and the dev realm provider returns an empty list, which would blank the section on previews.
- **Poster first, no video on phones** (PR #117): the landscape poster paints first and the video mounts after load and idle on desktop only; phones, reduced motion and Save-Data keep the poster.
- **Feed failures are reported only for non-2xx responses**, once, through react-query's cache-level reporter; a request that never got a response (offline, ad blocker, timeout) is not, as sites swallowed every feed failure.
- **Lighthouse targets on `.org`:** performance ≥ 0.85 mobile and desktop, CLS < 0.1, SEO ≥ 0.92. `.zone` is served `noindex` and Vercel previews sit behind auth, so neither can be scored; compare `main` and the branch served locally.
- **The pre-launch gate fails open.** `builder-creators-prelaunch` on means curtained: only the flag's address-list variant gets the full app, everyone else gets the overview alone and every other route redirects to `/`. Off, absent or unreachable means launched, so a flag outage on launch day never curtains the site. Which deployments are gated is decided only in the flag dashboard; there is no hostname check. It is a curtain, not a lock: the bundle is static and builder-server is public.
- **The overview never waits for the gate**: it renders at once without the sub-nav, which slides in when the flag answers (an accepted shift). Other routes show the spinner until the flag and the wallet restore have answered.

## Blender live preview

- **The bridge URL is trusted only for local origins** (`localhost`, `127.0.0.1`, `[::1]`); anything else falls back to `http://localhost:8080`. The page is behind the `blender-live-preview` flag and reachable only from the add-on's deep link (parity with legacy).
- **Long-poll with a fallback:** a bridge that ignores `since` is detected from the elapsed time and polled on an interval. Identical bytes and metadata are not redrawn (a save or exporter side effect).
- **Every push gets a new definition id** (`live-preview-<version>`, with a loop suffix for emotes) because both renderers key their caches by id.
- **Signed-out creators can preview**; signing in is asked only when adding to a collection, which reuses the add-items modal with category, hides, spring bones or play mode pre-filled.
- **Out (v1):** third-party collections, a nav entry point, saving outside the add-items flow, remote bridges, scene and prop previews.

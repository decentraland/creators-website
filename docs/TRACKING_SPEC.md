# Tracking spec — creators-website

Event names and props are governed by this document: keep code and spec in sync in the same change. Implementation: `src/lib/analytics.ts` (Segment) and `src/lib/monitoring.ts` (Sentry). Components never touch `window.analytics` directly.

## 1. Where the data goes

- **Same Segment source as the legacy builder.** `SEGMENT_API_KEY` per environment is copied from the legacy builder's config, so the old UI and the new one land in the same tables and the migration can be read as one funnel rather than two disconnected ones.
- **analytics.js is served from a first party proxy** (`SEGMENT_ANALYTICS_URL`, also copied from the legacy builder). Ad blockers drop `cdn.segment.com`. The loader also sets `analytics._cdn` to the proxy origin, because analytics.js fetches its _settings_ in a second request that would otherwise still go to — and be blocked at — Segment's CDN. A non-https or malformed value falls back to Segment's CDN; an empty `SEGMENT_API_KEY` disables tracking entirely (events log to the console in dev).
- **The overview page reports to sites' Segment source** (`SITES_SEGMENT_API_KEY`), not this one; see "Overview" below. Every other event stays here.
- **Bots send nothing.** `isbot(navigator.userAgent)` is evaluated once at startup; a crawler gets no script, no events, no page views.
- **Sentry** shares the legacy builder's project; `release: creators-website@<version>` is what separates the two apps there. Disabled on localhost and without a DSN. The release name is baked in by `vite.config.ts` (`__SENTRY_RELEASE__`), which is also what the **source maps** are uploaded under: the upload runs only when the deploy workflow passes `SENTRY_AUTH_TOKEN`, and the `.map` files are deleted right after, so they never reach the CDN. Without maps every stack trace stays minified. **Session Replay** is on with the legacy builder's sample rates (1% of sessions, 1% of sessions with an error) since both apps draw on the same project's quota; text is masked and media blocked, so a recording shows layout and clicks, never what the creator typed or uploaded. Only the sampled 2% of visits download the replay recorder (its own chunk, once the page is idle), with the SDK's rates scaled inside that share so the overall rates stay the same.

## 2. Telling this app apart from the legacy builder

Every event carries **`source: 'creators-website'`**. The legacy builder sends no `source` on these events, so in the warehouse:

- `source = 'creators-website'` → this app,
- `source IS NULL` → the legacy builder.

`source` is a **reserved prop name**: it is applied after the caller's props and cannot be overridden. (Unrelated legacy events, e.g. the announcement bar's, use a `source` of their own — always filter by event name as well.)

On top of the prop, `initAnalytics` registers a Segment **source middleware** that sets `context.app = { name: 'creators-website', version }` on every call the page makes — `page` and `identify` included, where an event prop can't reach. In the warehouse that is the canonical `context_app_name` / `context_app_version` pair, which no caller prop can collide with. The `source` and `version` props stay: they are what the legacy builder's existing queries can filter on.

`identify` deliberately sends **no** `source` trait: traits are user-level and sticky, so it would permanently tag anyone who ever opened this app, whichever app they use afterwards.

### Common props on every event

| prop           | meaning                                                                             |
| -------------- | ----------------------------------------------------------------------------------- |
| `source`       | always `creators-website`                                                           |
| `version`      | the deployed app version (the legacy builder stamps its own on every payload too)   |
| `address`      | the connected wallet, or `null` when signed out (a pseudonymous public id, allowed) |
| `is_signed_in` | whether a session was restored                                                      |
| `session_id`   | one uuid per page load, so the steps of a visit stitch together                     |
| `app_env`      | `development` / `staging` / `production`                                            |

## 3. Event names

Where the legacy builder has an event for the same user intent, **its name and its prop names are reused verbatim** (`itemId`, `collectionId`, `txHash`, `usedCredits`, `creditsAmount`, and the SCREAMING_SNAKE props of the item-editor events) even where the surrounding style is snake_case — the whole point is that a warehouse query written for the old builder also counts the new one. Props with no legacy counterpart are snake_case.

Failure events use `errorCode(error)`: the domain error's own `reason` (`locked`, `insufficient_credits`, `not_draft`, …), `rejected` for a dismissed wallet prompt, else `unknown`. **Never a raw error message** — it can carry ids or wallet copy, and free text does not aggregate.

### Identity

| event | when | props |
| --- | --- | --- |
| `Login` | the creator starts sign-in (the app then leaves for `/auth`) | — |
| `Connect Wallet` | a session was restored — on return from `/auth` and on every later page load, the same way the legacy builder (via decentraland-dapps) fires it | `address`, `chainId`, `providerType`, `walletName` (the wallet names itself over WalletConnect, so it is truncated to 64 chars) |
| `Logout` | disconnect; also `analytics.reset()` so the next account isn't attributed to this one | — |
| `Change Network` | the creator picks another chain in the profile panel's network selector (the legacy builder's event, via decentraland-dapps); fired on the pick, before the wallet answers | `from_chain_id`, `to_chain_id` |

`identify(address, { ethAddress, chainId, provider_type })` fires with `Connect Wallet`. `ethAddress` and `chainId` are the legacy builder's traits, kept so an audience built on them also covers this app.

Switching accounts in an injected wallet reloads the page, and `analytics.reset()` runs first so the two accounts don't end up sharing one anonymous visitor.

### Pre-launch gate

| event | when | props |
| --- | --- | --- |
| `Prelaunch gate` | the `creators-prelaunch` gate answered while armed: once per wallet per page load (a sign-out after a counted visit is not a new visitor and is not sent) | `outcome` (`open` = wallet on the allowlist, `hidden` = overview only). `address` / `is_signed_in` come from the common props |

Not sent when the flag is off: after launch every visitor is `open` and the event would only be noise. A curtained visitor is redirected to the overview from any other route, so their only page view is the overview's.

### Page views

A Segment `page` call per pathname change, named from a fixed map in `lib/pageViews.ts`: `collections`, `collection_detail`, `item_editor`, `curation`, `live_preview`, `other`. The legacy builder sends the url only, so the url comparison still works and the name is an extra. The overview (`/`) is named `/create`, sites' name for it, and goes to sites' source (see "Overview"). Redirect-only paths (`/overview`) send nothing: the page they land on sends its own view, so an old link counts once.

### Collections

| event | when | props |
| --- | --- | --- |
| `Save collection` | a collection is created or renamed | `collectionId`, `item_count` |
| `Save collection error` | that save failed | `collectionId`, `error` |
| `Delete collection` | a draft collection is deleted | `collectionId` |
| `Delete collection error` |  | `collectionId`, `error` |
| `Preview In World` | a **Preview in World** launch settles (desktop only) | `collectionId`, `itemCount`, `launched` (the desktop explorer opened; `false` = sent to the download page), `trigger` (`detail` = the collection page's ⋯ menu, `editor` = item editor preview bar; not `source`, which the app sets on every event) |
| `Publish details confirmed` | step 1 of the publish wizard was confirmed and left (after a rename saved) | `collectionId`, `nameChanged`, `emailSource` (`profile` = kept the profile email, `edited` = changed it, `typed` = no profile email) |
| `Publish collection` | the publish transaction was sent and the collection locked | `collectionId`, `txHash`, `isFiat` (always `false` — no fiat publish here), `usedCredits`, `creditsAmount`, `item_count`, `isRetry` (the collection was still locked by an earlier publish) |
| `Publish collection error` |  | `collectionId`, `isFiat`, `usedCredits`, `isRetry`, `error` |
| `Publish collection reverted` | the publish transaction was mined but reverted (and no earlier attempt had deployed the collection); nothing was charged and the creator can publish again | `collectionId`, `txHash`, `usedCredits` |
| `Open buy credits` | the credits top-up opened from the publish payment step because the balance falls short | `collectionId`, `shortfall` |
| `Start credits checkout` | the creator leaves for Stripe's hosted checkout (the wizard state is saved to resume on return) | `collectionId`, `orderId`, `packId`, `quantity`, `credits`, `usd`, `shortfall`, `resumeSaved` |
| `Credits checkout canceled` | back from Stripe with the checkout cancelled; the order is cancelled server-side | `collectionId`, `orderId` |
| `Credits checkout settled` | back from Stripe, once the order's outcome is known (nothing while confirming) | `orderId`, `status` (a settled order status: `credited` / `failed` / `abandoned`; `initiated` when nobody paid by the poll's deadline; `pending` when the order was paid but still processing at the deadline, or the read failed), `credits` (granted, else `null`) |
| `Filter linked collections` | the Linked chip on My collections is selected | `count` |
| `View linked collection` | a linked (third-party) collection's detail loads | `collectionId`, `item_count`, `network` |
| `Copy linked contract address` | the linked contract address is copied on the detail | `collectionId`, `network` |
| `Create TP Collection` | a linked collection is created (legacy name and props) | `collectionId`, `thirdPartyId`, `linkedContractAddress`, `linkedContractNetwork`, `collectionName` |
| `Change TP Collection URN` / `Change TP Item URN` | a linked collection's or item's URN suffix is saved (legacy names) | `oldURN`, `newURN` |
| `Edit Item Mapping` | a linked item's token mapping is saved from its detail row | `itemId`, `mappingType` |
| `Select all linked items` | Select all {total} items picks every page of a linked collection | `collectionId`, `filter`, `count` |
| `Publish TP Items started` | the linked publish wizard opens | `collectionId`, `thirdPartyId`, `items`, `pushed` |
| `Sign TP cheque` | the creator signs the slots cheque (wizard step 2) | `collectionId`, `thirdPartyId`, `qty` |
| `Publish TP Items` | the whole linked publish finished | `collectionId`, `thirdPartyId`, `items`, `pushed`, `txHash` |
| `Publish TP Items error` | a step failed | `collectionId`, `step` (`check` … `push`, `unknown` for a throw outside the flow), `error` |
| `Push TP Changes` / `… error` | already-approved linked items are sent for review again | `collectionId`, `items`, `failed` / `error` |
| `Edit TP Collection Contract` | a linked collection was moved to another registered contract and its items re-linked | `collectionId`, `from`, `to`, `items` (how many were re-linked) |
| `Open collection by contract` | a signed-in creator lands on `/collections?contract=<address>` (marketplace's link to a collection it only knows by contract) and it resolves | `outcome` (`found` / `not_found` / `invalid` (not an address, nothing read) / `error` (read failed, also reported by the query cache)), `collectionId` (when found) |

Linked funnel: Linked chip → `Create TP Collection` → `Add items` → `Publish TP Items started` → `Sign TP cheque` → `Publish TP Items` → curator `Approve TP Collection`.

### Items

| event | when | props |
| --- | --- | --- |
| `Add items` | an upload that creates items finished in the add-items modal. One event per upload, **not** per item: the legacy builder's per-item `Save item` on creation reads here as `item_count` | `collectionId`, `item_count`, `failed_count`, `error` (only when some failed) |
| `Edit TP Items` | an update-only upload finished (every draft edits an existing linked item; legacy name, so bulk edits line up with the old builder's) | `collectionId`, `item_count`, `failed_count` |
| `Add items error` | the upload threw before producing a result, or was refused because drafts share a linked URN (`error: duplicate_urn`) | `collectionId`, `item_count`, `error` |
| `Save item` | a single item was saved from the editor | `itemId` |
| `Save item error` |  | `itemId`, `error` |
| `Delete item` |  | `itemId` |
| `Delete item error` |  | `itemId`, `error` |
| `Move item` | an item was moved to another draft collection | `itemId`, `collectionId` (the destination) |
| `Move item error` |  | `itemId`, `error` |
| `Reset changes` | an approved item was reset to its published version | `itemId` |
| `Reset changes error` |  | `itemId`, `error` |

### Item editor

Legacy prop names, so the events line up with the old editor's.

| event | when | props |
| --- | --- | --- |
| `Preview Renderer Picked` | once per page load, when the first preview decides its renderer (not with `?unity=false`) | `renderer` (`unity` / `babylon`), `reason` (`flag-off` / `save-data` / `slow-connection` / `low-device-memory` / `gpu-capability` / `connection-ok` / `optimistic-default`), `measured_mbps` (the link probe, one decimal; `0` on timeout, `null` when it could not run) |
| `Preview Item` | an item is selected into the preview (not on re-selecting the same one) | `ITEM_ID` (on-chain token id, `null` while unpublished), `ITEM_TYPE`, `ITEM_NAME`, `ITEM_IS_THIRD_PARTY` (`true` in a linked collection) |
| `Play Emote` | an emote is picked in the playback bar — one event per wearable on the avatar, as in the legacy editor. Where legacy emits nothing at all on a bare avatar, this app emits one event with null wearable props | `EMOTE_PLAYED_BASE` (a default animation rather than a collection emote), `EMOTE_PLAYED_ITEM_ID`, `EMOTE_PLAYED_NAME`, `PREVIEWED_WEARABLE_ITEM_ID`, `PREVIEWED_WEARABLE_NAME` |
| `Change item file` | the change-file modal saved a new model for the item (after the `Save item` of that PUT) | `itemId`, `bodyShape` (`both` / `male` / `female`), `mode` (`replace_all` / `replace_shape` / `add_representation`), `fileKind` (`glb` / `gltf` / `zip` / `png`), `thumbnailRegenerated` |
| `Change item file error` | the picked file was rejected or the import threw | `itemId`, `error` (the `ItemFileError` key, or `errorCode` for a throw) |

### Item validation

| event | when | props |
| --- | --- | --- |
| `Publish Validation Started` | the publish modal opens (not when resuming from a credits purchase) or the push-changes modal opens | `collectionId`, `flow` (`publish` \| `push_changes`), `itemCount` |
| `Publish Validation Result` | the pre-step's checks finished and the modal moved on | `collectionId`, `flow`, `errors`, `warnings`, `itemsWithIssues`, `blocking` (flag on and errors), `durationMs` (from opening) |
| `Publish Validation Resolved` | the creator left the issues view | `collectionId`, `flow`, `action` (`continue` \| `back`; the × counts as `back`), `errors`, `warnings` |
| `Item Validation Details Opened` | an item's validation details modal opens | `itemId`, `status`, `trigger` (`row` \| `editor`) |
| `Item Validation Rerun` | a re-run finished | `itemId`, `trigger` (`details` \| `publish` \| `push_changes`; not `source`, which the app sets on every event), `previousStatus`, `newStatus` |

### Blender live preview

Funnel: page open → bridge connected → model streamed → tuned → added to a collection. `Live preview model` fires per applied export, so `since_last_ms` gives the edit cadence; a re-export with the same bytes is not an event.

| event | when | props |
| --- | --- | --- |
| page view `live_preview` | the route mounts (flag on) | — |
| `Live preview connect` | the bridge answered `/state` for the first time in this connection | `long_poll` (the add-on honoured `?since=`) |
| `Live preview connect error` | a poll failed; once per failure kind, not per retry | `error` (`unreachable` / `permission_denied` / `bridge_response` / `invalid_state` / `model_fetch`) |
| `Live preview model` | a new GLB was applied to the avatar | `item_type`, `category`, `since_last_ms` (absent on the first) |
| `Live preview tune` | first change of a control per streamed version | `control` (`category` / `hides` / `loop` / `spring_bones`), `item_type` |
| `Live preview add to collection` | **Add to collection** clicked | `item_type`, `push_count`, `signed_in` |
| `Add items` (above) | the upload finished | plus `origin` (`live_preview` / `collection`) |

### Sales

The legacy builder put an item on sale by setting a price and beneficiary on-chain; here it is an off-chain trade. The **event name is reused** because the user intent is the same — the props are ours.

| event | when | props |
| --- | --- | --- |
| `Enable sales` | the off-chain marketplace was made a minter of the collection | `collectionId` |
| `Enable sales error` |  | `collectionId`, `error` |
| `Set price and beneficiary` | an item was listed, or an existing listing re-priced | `collectionId`, `itemId`, `price_kind` (`credits` / `mana` / `free`), `is_giveaway`, `is_update` |
| `Set price and beneficiary failure` | (legacy's asymmetric name, kept) | the same props plus `error` |
| `Remove item listing` | an item was taken off sale | `collectionId`, `itemId` |
| `Remove item listing error` |  | `collectionId`, `itemId`, `error` |
| `Paste recipients` | a list of addresses was pasted into a transfer's recipient field | `collectionId`, `added`, `invalid` (wrong length or checksum), `repeated` (in the paste or the transfer already), `cut` (valid ones past the 100-recipient room) |
| `Mint items` | items were sent to their recipients | `collectionId`, `item_count`, `copies`, `recipient_count` |
| `Mint items error` |  | `collectionId`, `error`, `item_count`, `copies`, `recipient_count` — the batch size is what tells a cap-sized send apart from a small one when failures move |

Sentry flow `send_items` (with `collectionId` and the batch size) for every send failure that is not a wallet rejection: a revert, a relayer refusal or an RPC error. Wallet rejections are events only.

### Collection discounts

A creator-run sale on a collection, signed here and applied by the Shop. The Shop's own discount funnel is a different set of events in the shop source (`shop_started_sale`, `shop_created_sale`, …); these are the Builder's.

| event | when | props |
| --- | --- | --- |
| `Open create collection discount` | the discount modal opens from the collection page | `collectionId`, `trigger` (`header` / `menu`) |
| `Review collection discount` | the terms step was confirmed and the review step shown | `collectionId`, `discountPct`, `durationDays`, `scheduled` (starts later, not now), `capped` (limited uses), `manaItems` (listed items priced in MANA, which the discount also covers) |
| `Create collection discount` | the signed discount was stored | `collectionId`, `discountId`, `discountPct`, `durationDays`, `capped`, `discountedCount` (items the sale covers) |
| `Create collection discount error` | signing or storing failed | the same props minus `discountId`, plus `error` |
| `End collection discount` | a running discount was ended early | `collectionId`, `discountId` |
| `End collection discount error` |  | `collectionId`, `discountId`, `error` |
| `Abandon collection discount` | the modal closed without creating the discount | `collectionId`, `lastStep` (`form` / `review` / `blocked` = an unconfirmed discount had to settle first) |

### Curation

Committee actions keep the legacy names (the on-chain disable was "Reject collection" there too).

| event | when | props |
| --- | --- | --- |
| `Curation filter changed` | a curation page filter or the sort changed | `filter` (`review_type` / `status` / `assignee` / `sort` / `tag`), `value` (the picked values comma-joined, `all` when cleared) |
| `Assign curator` / `Unassign curator` | the assignee was saved | `collectionId`, `assignee` |
| `Assign curator error` |  | `collectionId`, `error` |
| `Reject curation` | a review request was rejected | `collectionId`, `first_review` |
| `Reject curation error` |  | `collectionId`, `error` |
| `Reject collection` | a collection was disabled on chain | `collectionId`, `txHash` |
| `Reject collection error` |  | `collectionId`, `error` |
| `Approval flow started` / `Approval flow completed` | the approval dialog opened / finished | `collectionId`, `mode` (`approve` / `enable` / `deploy_missing`) |
| `Approval flow error` | a step failed | `collectionId`, `step` (`prepare` / `rescue` / `deploy` / `approve`), `error` |
| `Rescue items` | stale content hashes were rewritten on chain | `collectionId`, `item_count` |
| `Rescue items error` |  | `collectionId`, `error` |
| `Deploy entities` | every pending entity was deployed | `collectionId`, `item_count` |
| `Deploy entities failure` | some entities failed to deploy | `collectionId`, `item_count` |
| `Enable collection` / `Enable collection error` | Enable switched a disabled collection back on (or failed) | `collectionId`, `txHash` / `error` |
| `Approval error details copied` | the curator copied a failure's raw details for support | `collectionId` |
| `Approve collection` | the collection was approved (or enabled) on chain | `collectionId`, `txHash` |
| `Approve collection error` |  | `collectionId`, `error` |
| `Approve curation` | the pending review request was marked approved | `collectionId` |
| `Push curation` | a creator sent a collection back to the committee: an approved one's changes, or a rejected first review again | `collectionId`, `first_review` |
| `Push curation error` |  | `collectionId`, `error` |
| `Review Validation Result` | the review bar's checks of a collection's pending items first settle, once per collection opened (cached results included) | `collectionId`, `itemCount`, `errors`, `warnings`, `itemsWithIssues`, `durationMs` (from opening) |
| `Review Validation Opened` | the curator opened the collection's validation results | `collectionId`, `status` (`warnings` \| `errors`) |
| `Review Preview In World` | a **Preview in World** launch from the editor in review mode settles (desktop only) | `collectionId`, `itemCount`, `launched` (the desktop explorer opened; `false` = sent to the download page) |

Sentry flows: `curation_assign`, `curation_reject`, `curation_disable`, `curation_push`, `curation_approve` (with `step`). Wallet rejections are events only.

Linked collections (curator side):

| event | when | props |
| --- | --- | --- |
| `Approve TP Collection started` | the linked approval flow opens | `collectionId`, `thirdPartyId` |
| `Set TP Merkle root` | `reviewThirdPartyWithRoot` is mined and indexed | `collectionId`, `thirdPartyId`, `txHash` |
| `Approve TP Collection` / `… error` | every pending item was deployed and approved / a step failed | `collectionId`, `thirdPartyId`, `items`; on error `step` (`prepare` / `root` / `deploy`, or `changed` / `unsubmitted` when the items moved on since the review), `error` |
| `Reject TP Collection` / `… error` | the curator rejects the pending items | `collectionId`, `items` |
| `Enable third party` / `Disable third party` (+ ` error`) | `reviewThirdParties` is mined | `thirdPartyId`, `txHash` |

### Forum post

Legacy names where the legacy builder had the event. Give-ups and failed assignee replies also go to Sentry (`flow: 'forum_post'`).

| event | when | props |
| --- | --- | --- |
| `Create forum post` | the collection's topic was created, or found already created | `collectionId`, `trigger` (`publish` / `recovery`), `existing` |
| `Create forum post error` | creating it failed after the retries | `collectionId`, `trigger`, `error` |
| `Forum post opened` | the topic link was clicked | `collectionId`, `surface` (`detail` / `detail_menu` / `curation_list` / `review_verdict`) |
| `Assignee forum post error` | the assignment reply could not be posted | `collectionId`, `error` |

### Roles

The UI calls them senders and collaborators; the legacy event names (minters / collaborators) are kept.

| event                     | when                             | props                   |
| ------------------------- | -------------------------------- | ----------------------- |
| `Set minters`             | the senders list was saved       | `collectionId`, `count` |
| `Set minters error`       |                                  | `collectionId`, `error` |
| `Set collaborators`       | the collaborators list was saved | `collectionId`, `count` |
| `Set collaborators error` |                                  | `collectionId`, `error` |

### Ownership

| event | when | props |
| --- | --- | --- |
| `Transfer collection ownership` | `transferCreatorship` was mined: the collection belongs to `newOwner` | `collectionId`, `newOwner` |
| `Transfer collection ownership error` |  | `collectionId`, `error` |

Failures reach Sentry through the mutation reporter (`mutation_key: transfer-collection-ownership`); a dismissed wallet prompt is neither event nor error.

### Overview (creator home)

The page moved here from the **sites** repo (it used to be `decentraland.org/create`, served by sites). Its events keep sites' event names and sites' props so the existing warehouse table (`LANDING.SECTION_VIEWED`) and the Metabase cards keep receiving data. Implementation: `src/lib/overviewAnalytics.ts` (payloads), `src/lib/overviewSegment.ts` (sender), `src/lib/segmentHttp.ts` (transport).

**Where it goes.** `Section Viewed`, `Click` and the overview page view go to **sites' Segment source**, keyed by `SITES_SEGMENT_API_KEY` in `src/config/env/*.json` (public client-side write key, one per environment). The app's analytics.js snippet carries the builder key, so the overview loads a **second analytics.js instance** (`@segment/analytics-next`, a lazy chunk) with sites' key, as sites did: that is what loads the source's browser-only destinations (GA4, Google Tag Manager), which a server-side call never reaches. The first overview call starts it after load-idle; settings come from the proxy origin of `SEGMENT_ANALYTICS_URL` and delivery goes to `SEGMENT_API_HOST` with `keepalive`, so a click on a same-tab link to another app is not lost. It shares the `ajs_anonymous_id` / `ajs_user_id` storage with the builder instance, so both report the same visitor.

Calls made before it is ready queue and go through it once ready. If the page is hidden first (`pagehide`), or it fails to load, they go to Segment's HTTP Tracking API instead (`/v1/track`, `/v1/page` on `SEGMENT_API_HOST`), the transport sites' own `segmentBeacon` uses: the write key in a `text/plain` body, sent with `navigator.sendBeacon`, falling back to `fetch(..., { keepalive: true })`. That body carries analytics.js' identity (`anonymousId`, `userId` from `ajs_user_id`), `messageId`, `timestamp`, `sentAt` and a `context` with `direct: true`, `page`, `campaign` (from the URL's `utm_*` params the way analytics.js derives it), `userAgent`, `locale`, `timezone`, `library: creators-website-beacon` and `app: { name: 'creators-website', version }`. Calls through the instance get analytics.js' own context, plus the same `app`.

**No fallback.** `SITES_SEGMENT_API_KEY` is set in every environment; an empty key sends nothing (dev logs the call).

**Props.** On top of sites' props, every overview call carries this app's common props (`source`, `version`, `address`, `is_signed_in`, `session_id`, `app_env`, see above). Tracked calls also carry sites' delivery fields: `track_called_at` (the call) and `track_delivered_at` (the delivery) ms timestamps and `track_deferred`: `false` when the call went through analytics.js right away, `true` when it waited for it or went over the HTTP API, as in sites.

| event | when | props |
| --- | --- | --- |
| `Section Viewed` | the first time a section scrolls into view (10% visible), once per section per page load | `section_viewed` (`Creators Why` / `Creators Create` / `Creators Live Scenes` / `Creators Connect` / `Creators Learn` / `Creators Blog` / `Creators Faqs`), `mobile` (viewport ≤ 767.98px, sites' cut) |
| `Click` | any tracked control of the page: hero CTAs and scroll chevron, why cards, create-card tabs and links, scene cards, testimonials, Discord, tutorial cards and CTAs, blog cards, FAQ expands (not collapses) and the FAQs CTA | the URL's campaign params (`utm_org`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`; normalized like sites, read at click time, not persisted), then the element's whitelisted `data-*`: `place`, `title`, `card`, `tab`, `event`, `download_target`, `download_mode`, `os`, `arch`, `download_option` (below); a click with `download_target` also carries sites' `mac_arch` (`apple_silicon` / `intel` / `unknown`, read from the WebGL renderer at click time, Macs only: an Intel/AMD/NVIDIA GPU is `intel`, a named `Apple M…` chip is `apple_silicon`, and Safari's masked `Apple GPU` is `unknown`, where sites counted it as Apple Silicon) |
| page `/create` | the overview route renders | the common props and Segment's page fields |

`Click` values, always sites' English values whatever the visitor's language (translated copy is display only; the English message of the same i18n key is sent):

| control | props |
| --- | --- |
| hero CTA, desktop (Creator Hub download) | `place: Creators Hero`, `event: Download`, `download_target: creator_hub`, `download_mode`: `direct` (one-click installer) or why it fell back to the download page: `loading` (release not resolved yet), `unavailable` (GitHub error or rate limit), `unsupported` (no installer for the OS) |
| hero CTA, mobile (creator docs) | `place: Creators Hero` |
| hero "Also available on" build (desktop) | `place: Creators Hero`, `event: Download`, `download_target: creator_hub`, `download_mode: direct`, `os` (`Windows` / `macOS`), `arch` (`amd64` / `arm64`); it also sends `download_started` for that build |
| hero chevron | `place: Creators Hero`, `title: scroll-to-why` |
| navbar sign in (overview route only) | `place: Landing Navbar`, `event: click`, `action: sign_in` (no campaign props, like sites) |
| footer menu link (overview route only) | `place: Landing Footer Link`, `event: click`, `link`: the English label (sites sent the visitor's locale) |
| footer social icon (overview route only) | `place: Landing Footer Social`, `event: click`, `platform` (`Discord` / `GitHub` / `X` / `Instagram` / `YouTube` / `TikTok` / `LinkedIn`) |
| why card | `place: Creators Why`, `title`: the card title (`Join a Community of Creators` / `Create in an Open, Decentralized Ecosystem` / `Benefit from a Creator-Centric Economy`) |
| create tab | `place: Creators Create`, `card` (`design-unique-wearables` / `animate-expressive-emotes` / `craft-immersive-experiences`), `tab` (`Regular` / `Smart Wearables` / `More than Motion` / `Create Scenes` / `Basic` / `Advanced`) |
| create link | the tab's `place` / `card` / `tab`, `title`: the English link label (the three shop links are `Wearables in the Shop`, `Smart Wearables in the Shop`, `Emotes in the Shop`, renamed from sites' "in the Marketplace") |
| live scene card / see all | `place: Creators Live Scenes`, `title`: the scene name / `view-all` |
| testimonial / Discord | `place: Creators Connect`, `title`: the creator's name / `join-discord` |
| tutorial card / channel / submit | `place: Creators Learn`, `title`: the English tutorial title / `watch-more` / `submit-tutorial` |
| blog card / read the blog | `place: Creators Blog`, `title`: the post title (CMS, English) / `view-all` |
| FAQ expand / see more | `place: Creators Faqs`, `title`: the English question / `faqs-cta` |

The hero CTA downloads the Creator Hub in one click (`lib/creatorHubDownload`): it sends sites' `download_started` with sites' Creator Hub funnel props (`download_target: creator_hub`, `download_option` (`primary`: the hero's pick for the device; `alternative`: an "Also available on" build), `place: creators-hero`, `href`, `os` `Windows` / `macOS`, `arch` of the installer served (on a Mac, `amd64` when the WebGL renderer shows an Intel-era GPU and `arm64` otherwise; see `mac_arch` on `Click`), `auth_state`, `revisit: 0`, `anon_user_id`, `started_at`) to sites' source, then after 3s opens sites' `/download/creator-hub-success?os&arch&anon_user_id`, which sends `download_success` joined on `anon_user_id`. The release is fetched after load-idle; a GitHub rate limit (403/429) counts as no installer. Until it resolves, or where no installer fits the OS (Linux), the CTA links to sites' `/download/creator-hub` instead, which owns that page's funnel.

Not tracked: the carousel arrows and dots (navigation noise), image loads, the hero video.

### Other

| event | when | props |
| --- | --- | --- |
| `Not found page` | the 404 page rendered | — |
| `Error page` | the error boundary caught a render crash | — |
| `Open modal` / `Close modal` | any dialog mounted / unmounted. `name` is the dialog's test id — legacy sends its redux modal name, and nothing at all on open. StrictMode double-invokes effects, so a **dev** run shows an extra open/close pair; production builds don't | `name` |

## 4. Intercom

The support widget (`src/components/Intercom`) boots on every route with `INTERCOM_APP_ID` and is kept in sync with `Wallet` (lowercased address), `Wallet type` (provider) and `anon_id` — Segment's anonymous id — so a conversation can be matched to that visitor's events. Renders nothing without an app id.

## 5. Error reporting

`captureError(error, { flow, … })` always logs to the console and forwards to Sentry when configured. `flow`, `step`, `rpc_code` and `http_status` are promoted to Sentry **tags** (the rest of the context stays in `extra`, which Sentry does not index). Outgoing events are scrubbed — errors AND performance transactions, breadcrumb and span **data** as well as messages, since a fetch breadcrumb keeps its url under `data.url`: signatures, 32-byte hex values and secret-shaped strings are redacted, and keys matching `signature|private|identity|authchain|auth_chain|ephemeral|token|secret|password|cookie|authorization` are dropped. A wallet/RPC failure thrown as a plain object is converted to a named Error keeping its original stack, so those failures group properly.

The preview renderer decision is not an error: it is set as the `preview_renderer` and `preview_renderer_reason` tags (`setMonitoringTags`), so any later error from that session says which renderer it ran on. A failed link probe is the creator's network and is not reported.

Item validation reports a crashed rule-book worker once per page load with `flow: 'validation_worker'` (runs fall back inline), a model or thumbnail check that could not run with `flow: 'model_validation'` / `'thumbnail_validation'` (shown as a non-blocking warning), and a check that crashed inside the rule book with `flow: 'validation'`.

Linked collections report with `flow: 'linked_publish'` from `step: 'sign_cheque'` (a cheque signature that fails for a reason other than a wallet rejection) and from the payment on (`wait_tx`, `delete_virtual`, `publish`, `push`: the creator may have paid, so a failure there needs someone to look, a payment still unconfirmed after the wait included; `txHash` in extra). The `linked_publish` flow itself skips a rejected wallet prompt and a reverted transaction (nothing was charged), but a `pending_review` or `insufficient_slots` refusal at the `publish` step still reaches it, and the mutation reporter (below) still sends every non-wallet-rejection failure of the publish, reverted transactions and early-step refusals included, as `flow: 'mutation'`. The curator side reports with `flow: 'linked_curation_approve'` (`step`: `prepare` / `root` / `deploy`), `'linked_curation_reject'` and `'linked_curation_review'` (enable / disable a third party). A wallet rejection is never reported; a non-NFT contract or an invalid mapping is refused in the form before any request and is a Segment event only.

Every `flow` tag the app sends, with what it covers. A wallet rejection is never reported under any of them. The feature flows skip the refusals named in their section, but the mutation reporter (`flow: 'mutation'`) filters wallet rejections only, so a refusal the creator can fix (a locked collection on save, a linked publish's `pending_review` / `insufficient_slots`, a discount's `pending` / `unconfirmed`, a reverted transaction) still reaches Sentry under `mutation` whenever it fails a react-query mutation:

| flow | reported from |
| --- | --- |
| `publish` | the publish wizard's ToS record failing before payment (`step: 'tos'`); every other publish failure reaches Sentry through the mutation reporter (`flow: 'mutation'`, below) |
| `publish_review_request` | opening a published collection's first review request failing for any reason other than one already being open; the publish itself still succeeds |
| `credits-top-up` | reading a credits order's outcome after Stripe threw something other than a credits-server error or a network `TypeError` (those two only show `pending`; the event reports `pending` in every case) |
| `add_items` | the add-items modal: a model that could not be analysed (`step: 'validate'`) or re-validated after a category change (`step: 'revalidate'`) |
| `save-item` / `item_save` | saving an item: the mutation's reporter (`save-item`) and the editor's save path (`item_save`) |
| `item_file_change` | the change-file modal's import or save |
| `send_items` | a send that failed for a reason other than a wallet rejection (`collectionId`, the batch size) |
| `transfer_ownership` | the detached owner sync after a transfer gave up |
| `create_collection_discount` / `end_collection_discount` | signing or storing a collection discount, ending one early |
| `network-selector` | reading or switching the wallet's chain (`step: 'read-chain'` / `'switch-chain'`) |
| `curation_assign` / `curation_reject` / `curation_disable` / `curation_push` / `curation_approve` | the standard curation actions (§3 Curation; `curation_approve` carries `step`: the flow's own steps, plus `changed_check` when the pre-approval drift check fails and `entities` when the Catalyst entities could not be read) |
| `forum_post` | a forum topic creation that gave up, or a failed assignee reply |
| `linked_create` / `linked_collection_contract` / `linked_collection_urn` / `linked_item_urn` / `linked_mapping_save` / `linked_select_all` | linked collection management: creating one, moving it to another contract, editing a collection or item URN, saving a mapping, fetching every page for Select all |
| `linked_publish` / `linked_push` | the linked publish wizard (above) and pushing linked changes |
| `linked_curation_approve` / `linked_curation_reject` / `linked_curation_review` | the linked curation actions (above) |
| `live_preview` | the Blender live preview (below) |
| `validation_worker` / `model_validation` / `thumbnail_validation` / `validation` | item validation (above); `validation_worker` carries `step: 'timeout'` when a hung worker was replaced |
| `query` / `mutation` / `render` | the react-query cache reporters and the error boundary (below) |

The Blender live preview reports with `flow: 'live_preview'`: a bridge that answers but breaks the contract (`step: 'poll'` — an invalid `/state` payload, a failed `/model.glb` after a good state: add-on / page schema drift), a streamed GLB the spring bone parser or the preview cannot take (`parse_spring_bones`, `preview`), and a physics push the renderer rejects (`physics`, once per session). An unreachable bridge and a denied local-network permission are the creator's to fix, so they stay Segment events.

The overview's two third-party feeds (`hot-scenes`, `latest-blog-posts`) retry once and set `meta: { reportOnlyHttpErrors: true }`: anything but an error response (offline, CORS, ad blocker, timeout or abort) is the visitor's network and is not reported. A non-2xx response throws `HttpError` and is reported once by the query cache with `http_status` (a tag). Their secondary requests (blog categories, covers) degrade silently.

react-query swallows query and mutation failures (they become `error` state, never an unhandled rejection), so `src/lib/queryClient.ts` reports them from the cache level: every failed query as `flow: 'query'` with its `query_key`, every failed mutation as `flow: 'mutation'` with its `mutation_key` (when the hook sets one). A wallet rejection (EIP-1193 4001 / ACTION_REJECTED / "user rejected") is a choice, not a failure, and is never reported. Render crashes are reported by `ErrorBoundary` as `flow: 'render'`; everything uncaught is picked up by Sentry's global handlers.

## 6. Not tracked (deliberately)

- Scenes, LAND, ENS — they live in the legacy builder.
- Per-item events during a bulk upload (see `Add items`) and per-keystroke editor activity: noise.

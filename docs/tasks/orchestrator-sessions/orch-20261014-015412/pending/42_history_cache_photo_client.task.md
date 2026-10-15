# Task42: Implement paged history, private media reuse and photo viewing

## Agent setup and status

Persona coder, Takomi Sol High, Build. requiredCapabilities=[write-code]. Pending authored packet, no launch or execution ID assigned. Canonical root is `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`. Every shell command explicitly cd there or use absolute project paths. Use unslop and the existing charcoal/blue/light UI. No visual exploration, agent launches or new dependencies. Parent owns status, board/master plan, docs, commits and release decisions.

Read scoped instructions, docs/Coding_Guidelines.md, Project_Requirements, History_and_Media_Reliability_Scope, History_and_Media_Implementation_Plan, Account_Profile_API, Owner_Control_and_Local_Drafts, completed35/36,37/38 and41's actual finalized source/types/tests/handoff. Preserve the full future context/style handoffs and37's pending intent/receipt/name/prompt/draft feedback behavior.

## Objective and dependencies

Make older already-stored messages reachable without losing viewport/typing or acknowledging unseen newest content. Reuse Otherme's authenticated image bytes across navigation/restart and add a safe source-anchored full-screen photo viewer. Use41's contracts; no core/backend writes or second client policy. Ordinary video backend/cache variants may be consumed later by43 but no player/module is installed here.

Parent accepted40 and39 is complete.41's contracts/tests and subsequent46's
owner-approved Whisper STT/cost-protection backend change must be integrated and
accepted before this writer starts. Use their exact final source, not the old audio
constructor/schema. Only update existing visible ASR copy if needed, no new cost UI. Sole mobile writer.43 follows this task serially after a separate dependency decision.41/42 can complete without Video consent; the entire requested combined release cannot be accepted without43.

## Exclusive file ownership

Existing mobile files:

- `apps/mobile/lib/api.ts`, `app-state.tsx`, `history-cache.ts`, `conversation-scroll.ts`.
- `apps/mobile/app/conversation/[id].tsx`, `components/media-attachment.tsx`, `message-bubble.tsx`, `chat-list.tsx`, `chat-row.tsx`, `draft-card.tsx`.
- `apps/mobile/app/(tabs)/review.tsx` and `assistant.tsx` only for original-source View/group-aware read navigation, not new assistant features.
- `apps/mobile/lib/audio-lane.ts`, `components/voice-composer.tsx` only for synchronous recorder/viewer exclusion using current lifecycle guards. `media-lease.ts` may change only if needed to preserve existing submitted-upload ownership, not merge caches.
- Focused existing mobile tests; optional new `test/history-paging.test.cjs`, `test/media-cache.test.cjs`, `test/media-viewer.test.cjs`.

New bounded helpers/components:

- `apps/mobile/lib/media-cache.ts` for scoped cache manager, keys, budgets and leases.
- `apps/mobile/lib/media-cache-storage.ts` and `.web.ts` for native File/Directory and IndexedDB Blob storage respectively.
- `apps/mobile/components/media-viewer.tsx` for the existing-UI photo modal. A platform-specific `.web.tsx` is allowed only if actual web input/zoom behavior needs it.

No package/app config/lock/version/native/script/core/backend/docs/status changes. If finalized41 contracts cannot support the behavior, report to parent instead of editing shared exports. No source writes while41/43/44 or another mobile writer is active.

41 accepted source32fe269 and actual contract handoff is
 docs/features/History_and_Media_Backend_Handoff.md. Parent342 workspace tests and
all types passed, including known-arrival duplicate/unread regression.46 now runs
on that source, so await its final handoff too.41 is not an active writer anymore.

## Required history behavior

1. Request `/v1/session?capabilities=1&historyMedia=1` and consume optional historyPaging/privateMediaCache plus exported HistoryPage/HistoryGroup/MediaSource schemas. Old backends ignore the extra query and return old flags. Missing flags means honest legacy latest-window/photo-preview fallback, not optimistic video/viewer success. Preserve scoped immutable ApiClient revocation and test strict37 discovery compatibility.
2. Use snapshot historyGroups for canonical inbox grouping and lastMessageId lookup while keeping original Message.conversationId/IDs. Retired alias history may open read-only, with an explicit canonical navigation action. Never redirect a pending intent, local draft, uploaded source or mutation into canonical scope. Show original linked outbox/unknown/hold state rather than hiding it. Keep receipts per original component evidence and current effective policy display.
3. Extend HistoryCache, not a generic data layer. Pages are50 by default, max300 messages/six pages per group,20 groups,1,000 messages/8MiB serialized total. Deduplicate by real ID/41's verified projection. Coalesce by group/direction/cursor/around/binding epoch. Pin viewport page; evict far edge, never unbounded accumulation. Do not truncate original text to meet cache limits.
4. Add explicit Load older/Load newer and Latest. Before prepend/eviction/height change, save first visible real ID and screen offset, then restore after measured row layout. Incoming/reaction/receipt/version refresh retains an older reading window, typing, focus and draft edit state. Latest explicitly loads a fresh tail outside the old fence and follows only after actual scroll acknowledgment. Keep existing deliberate accepted-send jump, not incoming auto-jump.
5. On sourceEpoch change, reanchor around the current visible ID and discard stale cursors, not replace it with latest. Missing anchor uses closest surviving neighbor with explanation. Failed refresh keeps permitted cached text visibly stale, no new viewed ack. Cache reopen restores source anchor; old callbacks cannot scroll/publish into a new client/chat/profile.
6. Actual viewport intersections after600ms focused/foreground settled visibility drive viewed-messages for at most100 real inbound IDs. Cancel for drag, resize, errors, pending reposition, background or viewer overlay. Bottom of an old page is not newest visibility. Do not acknowledge all mounted/loaded rows or send a numeric group-wide watermark. No WhatsApp receipt API.
7. Draft View and tapping a quote source use around=actualSourceId when absent, bounded one anchored page, then measured real source/card location. Missing/conflicting/expired states are explicit; no fabricated message or indefinite paging. Page eviction leaves source IDs, local typing, feedback and submitted journal intact.

## Cached-first chat and existing draft opening

Owner explicitly added docs/features/Cached_Chat_and_Draft_Opening.md after40's
initial dispatch. It is now required42 scope. Existing HistoryCache/snapshot already
carry usable bodies; do not replace them with a new state framework or a persistent
full-history mirror. Paint known chat/history/draft content immediately, refresh
in background, and separate source/context loading from the known Draft body.
Review/deep navigation identifies the specific draft ID. No POST generation to
open/warm a cached draft and no all-chat prefetch.

A source/page response cannot blank cached content, duplicate or unmount an active
DraftCard/editor, erase edits or restore unwanted keyboard focus. Preserve stable
editor identity while anchoring genuine source rows. Missing source stays honestly
loading/unavailable; never synthesize it. Newer validated mutation data and local
edits must survive old/out-of-order reads. Phone/PC revision conflicts preserve
unsaved text and expose current state without retry. Cached body does not grant
send/approve/hold/source authority, and draft-only view never marks unseen history
read. Local read errors cannot replace domain/unknown mutation errors.

Add tests for known draft visibly painted before held history, cached warm reopen
without blanking during forced refresh, source arrival during editing, failed
context retaining body, two-client revision conflict, old read versus newer result
and scope switch. Check hidden/opacity ancestors, not text-node presence alone.
44 must include representative delayed-history screenshot and browser proof.

## Required media behavior

Use one MediaCache per accepted app binding beside HistoryCache. Key by normalized service base, server cacheNamespace, profile/account, physical chat/message/transport identity, sourceVersion and variant. Persist no token, raw URL/media key/message text. Native files live only below Paths.cache/otherme-media-v1 with hashed child names; browser uses IndexedDB Blob records with compound identity keys and server source digests, not a Web Crypto requirement on HTTP LAN. No gallery/original WhatsApp/private-phone storage access, external viewer or public route. Installed expo-file-system/expo-crypto/Image and browser built-ins suffice.

Use authenticated source metadata before reuse. A hit performs no binary fetch. Coalesce metadata within a current30-second positive lease; revalidate on mount/reopen/foreground, viewer open and every15 seconds while any thumbnail/viewer handle remains visible. Expiry is min server validUntil/source expiresAt with ClientClock and a monotonic local deadline. Current binding/profile and source checks surround every async read/write/publish. A source-version mismatch never renders an old URI. Current deletion/expiry/view-once/denial/conflict revokes all thumbnail/viewer handles immediately and queues purge.

Use41's content route with expected sourceVersion and a separate45-second binary-read deadline. Keep metadata/ordinary JSON reads at10 seconds. Validate profile/MIME/version/actual size, then commit complete bytes via temp-file move/index or IndexedDB transaction. No data URI/base64 history cache. Native File.move is async. No arbitrary path from descriptor/index, no deprecated root file-system API, no unmanaged expo-image persistent cache. Corruption/partial/OS eviction is a cache miss, not authorized partial data.

Budgets apply across all namespaces:100MiB/200 entries disk, seven days since byte use,4MiB image/preview and10MiB video, two concurrent binary requests/24 pending,24MiB transient bytes. Web at most four live Blob URLs/16MiB and one viewer/player. Reserve space, evict only unleased LRU and reject writes if pinned entries prevent the cap. Thumbnail/viewer have separate retain/release handles and invalidation subscriptions. Only measured visible thumbnail rows acquire live-handle slots; release offscreen and viewer-covered thumbnail handles. Mounted rows cannot fetch all media or defeat caps. Viewer has priority. Last URL lease revokes it; ordinary navigation retains valid persistent files. Submitted image/audio composer leases stay separate and cannot be evicted here.

Sweep own subtree/index before first use, on foreground, before writes and on invalidation. Clean expired/orphan/partial files. Revoke/purge old binding on profile/credential revocation or service switch. Unlink failure records pending purge, remains inaccessible and retries at next sweep; no hidden background job. If quotas cannot be restored, stop new writes. Offline metadata failure retains bytes but cannot start new display/playback. Existing foreground lease ends at its deadline; background revokes it. Retry is an explicit read action, never a mutation replay or silent binary retry. Disclose OS eviction, bounded retention and ordinary deletion, no encryption/secure-erase promise.

MediaAttachment acquires preview only while eligible/current and opens a parent-owned modal on explicit tap. Full photo requests image variant on tap only, orientation-correct image/jpeg at most2048px/4MiB; legacy preview PNG/GIF stays supported. Stickers/animations may show their bounded preview full-screen with an honest label. No owner display action prepares AI frames or changes model permissions.

## Viewer and existing lifecycle

Use a single source-anchored RN Modal, existing theme/safe area, contain fit,48px Close/back, web Escape, accessible labels, Reset and Zoom in/out capped1x..3x with bounded pan. Native pinch can use existing supported responders; no gesture-handler or visual redesign. No carousel/share/export/OS gallery action. Restore prior history anchor and keyboard intent after close, without erasing text/quote/attachment or unknown send feedback.

Block viewer opening synchronously during microphone preparation/recording, active picker or audio stop, with visible feedback. Do not rely solely on delayed onBusyChange effects. Once open, make recorder/picker inactive so pending operations cancel through their current epoch guards. Never obscure a continuing recording. Existing local audio clip stays owned. Viewer open cancels unread timers. Close and release on route/client/profile/background/unmount; known source denial unmounts decoded image immediately. Cleanup must not touch a released native object or mutate another scope.

Keep37's immutable gesture capture before awaits, ordered per-chat submission,20-intent bounded journal, no replay/rebind, mutation-before-refresh return, accepted-versus-receipt distinction and source-anchored Draft result/View. Keep dc99aa6's local read cancellation recovery, input identity, manual keyboard dismissal and acknowledged composer occupancy. Pagination/media errors are local read errors and cannot erase domain/unknown warnings.

## Tests, completion and handoff

Use repository render/lifecycle harnesses, synthetic storage/files/Blobs/clock/network, never actual media/book/mic. Cover101+ stored UI messages, equal times, prepend/eviction/resize anchors, older-window incoming updates, explicit Latest, true-visible ack, around quote/Draft View, stale cursor/error recovery, profile races and unchanged composition/keyboard/pending intents.

Cache tests must prove leave/reopen/foreground uses one binary download with metadata revalidation, process-style index reopen, source variant separation, failed/partial writes, coalescing/disposal, budgets with pinned/in-flight resources, corrupt/orphan sweep, failed physical unlink, service-at-same-URL namespace change and no cross-account stale callback. Test offline/no-first-validation, lease expiry, deletion/view-once/denial/source update mid-read and renderer unmount before purge.

Viewer tests cover tap/close/back/Escape/zoom/reset, safe areas, recording/preparation/picker races, source invalidation/background/profile/route, no auto keyboard popup and no hidden recording or model/upload calls. Existing pending-intent/read-feedback/receipt/name/instructions tests remain passing. No video dependency imported here; handed-off cache API must support43's source-validated local file/blob handle without premature playback.

Run narrow mobile tests, then `pnpm --filter @replybot/mobile test` and `pnpm --filter @replybot/mobile typecheck` from canonical root. No final export/build here. Parent later runs full workspace/packaging/types;44 owns isolated preview evidence and38 combined source review. Done means required42 behavior and owned checks pass, changed paths stay scoped and43 can consume the stable cache/viewer API. Return exact contracts/paths/checks, remaining conditional video work and honest native/browser limitations.33 remains held.

## Safety limits

No real DB/auth/.env/token/key/book/message/log/media reads, live APIs/model/WhatsApp downloads/sync, production3210/8081/8083, service/viewer/device/phone control, permission/gallery/mic access, install/SDK/toolchain work, paid/image quota, outside-project writes, final web/APK build or stage/commit/push. Only documented synthetic ui-task31/ui-task37 artifacts may be inspected; never overwrite39's output. Normal synthetic test temp data is allowed. No root/master/board/existing-status writes.

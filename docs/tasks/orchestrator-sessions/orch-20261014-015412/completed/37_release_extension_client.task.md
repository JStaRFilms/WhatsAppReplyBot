# Implement nonblocking sends and release extension controls

## Parent implementation acceptance

Implementation was accepted as69f01fd with320 parent tests/types. Browser39 passed
its then-frozen baseline, and the later complete44 gate is now accepted on2453912
with all452 serialized tests/types and independent108 browser assertions. The
previous pending record was stale tracking, not an active source writer. Client
implementation is complete. Combined source review38 remains a separate running
gate, with phone permission/contact/receipt hardware acceptance still unproven.
No release or production installation is claimed by this task completion.

## Agent setup

Persona coder, Takomi Sol High, Build. requiredCapabilities=[write-code]. Canonical root `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`. Every shell command explicitly cd there or use absolute project paths. Use unslop and the existing selected charcoal/blue/light UI. No new design exploration or automatic subagents. Parent owns commits, master plan, board and task status.

Read scoped instructions, docs/Coding_Guidelines.md, docs/Project_Requirements.md, Release_Gate_Extension.md, Release_Extension_Implementation_Plan.md, Daily_Use_Batch_1_Contract.md, Account_Profile_API.md, Owner_Control_and_Local_Drafts.md and completed28 through32. Read36's finalized API/DTO handoff and actual source/types/tests before editing.

## Finalized36 handoff and parent launch authorization

36 source is accepted after parent282 integrated tests and all workspace types.
Message.outgoingReceipt and Component.outgoingReceipt are optional
{level:sent|delivered|read,observedAt,source:wa_status|wa_recipient}; absence is
unconfirmed. SendResult remains {simulated,outbox}. Conversation.nameSource and
nameRevision are optional, with missing treated as legacy/0. Import settings and
single atomic body/response match this packet; use exported core schemas rather
than duplicating their types. No import chunk/staging protocol exists.

Parent fixed and regression-tested a name-toggle/import bug that renamed non-direct
or unresolved chats. Preserve this restriction; do not invent client name caches.
All current source safeguards and dc99aa6 Assistant read-feedback fix remain.

At launch37, parent authorizes only the exact existing-SDK dependency install in
canonical apps/mobile/package.json and root pnpm-lock.yaml:
`pnpm --filter @replybot/mobile add --save-exact expo-contacts@57.0.7 --ignore-scripts`.
No other package/SDK/toolchain/version choice, lifecycle script, actual contacts,
private data or build-copy write is authorized. API/integrity/permission preflight
below is complete; inspect the installed public types/source before calling it.
If installation fails or drifts other pinned dependencies, stop and report rather
than choosing another version or running additional installation commands.

## Objective

Keep composition/history/quote usable during send/upload, show honest pending intents and real outgoing receipt ticks, and add one per-profile owner instructions field plus optional minimal Android-to-PC contact-name synchronization. Do not replace uncertain outcomes with success, relax source/hold/profile guards or claim device acceptance.

## Scope and exclusive ownership

Own apps/mobile/lib/app-state.tsx, api.ts, the conversation screen, message-bubble, Settings, local pending-intent/media ownership and platform contact helpers, related existing voice/attachment/draft components only as required, mobile platform storage and focused tests. One writer owns all these shared UI/controller/conversation files. No core/backend/scripts changes; report contract blockers to parent/36 rather than patching them concurrently.

Conditional dependency/config ownership is apps/mobile/package.json, apps/mobile/app.json and root pnpm-lock.yaml for Expo Contacts only. Installation is blocked until parent confirms the exact version and target described below. No release version/package identity/signing changes. Do not touch master_plan, board, existing task statuses or unrelated docs.

## Required interaction

- At the original Send/reaction gesture, capture service/profile/account/binding epoch/chat, gesture order, fresh request UUID, composer revision, text/caption, quote ID and selected media reference before awaits. Upload has its own stable UUID. Same captured revision cannot enqueue twice; deliberate identical messages may. Do not dedupe by payload equality.
- Immediately display Preparing with no tick. Persist a service/profile/account-scoped submitted-intent journal before clearing captured composition or network submission. Bound20 unresolved intents; full/write failure preserves composition and explains the stop. Text/quote/request/upload IDs survive remount/restart, no credentials or media bytes/base64 in the journal. Keep media leases alive while pending; restart with unavailable media needs explicit reattachment, not automatic send.
- Clear only the captured revision after journal success. Preserve newer text/quote/attachment and keyboard identity/focus. Keep actual-visible unread and history follow rules. Text, scrolling, selection, swipe-to-quote and preparing the next reply work during pending send/upload. Disable only a specific action whose own media picker/recording operation requires it, not the entire conversation for sending.
- Keep existing acknowledged composer/hold semantics. Newer occupied composition cannot be reported empty by old intent cleanup. Local pending capture does not imply backend pause success. No automatic recording on return and no released native object access.
- Within each conversation lane, upload/send gestures in original order. Later text cannot overtake earlier media. Other conversations can progress. Backend lanes remain authoritative across devices. Do not auto-advance successors after unknown/partial/unacknowledged submission. Keep them visibly waiting and keep composing usable.
- `perform` returns current-scope validated mutation data without awaiting snapshot refresh. Schedule read refresh separately; audit all callers for snapshot assumptions. Preserve action/domain/unknown feedback independently from transient reads and dc99aa6 Assistant-local read cancellation/retry. Intent API calls need structured failures, not undefined interpreted as definite failure.
- Accepted result releases mutation wait, not a false WhatsApp tick. Show accepted-awaiting-ack unless receipt evidence exists. A slow/failed snapshot cannot change accepted into failed. HTTP timeout/parse failure/profile loss after submission stays uncertain. Never retry mutations or release unknown accounting.
- Read-only existing scoped snapshot reconciles journal by account/chat/request ID and then component/transport IDs, never matching text. Absence proves nothing. Restart/new binding never resumes mutations. Scope changes stop old lanes and callbacks; no old intent rebind/send in a new profile. Locally never-submitted content or definitive failed content may be explicitly restored only without overwriting newer work. No handed-off cancel/retry button or new unknown override.

## Explicit Draft reply feedback

Owner additionally reported the in-chat Draft reply spinner ending with no clear
result, sometimes before the content appears. Include this in the release gate.
Show immediate local Drafting feedback for the acknowledged button gesture; a
spinner alone is insufficient. Keep typing/history/quote available. Success uses
the typed Draft response: Draft ready with an explicit View draft action, Needs
your input for handover, No reply suggested for silence, or a clear stale/changed
conversation outcome. View locates the actual source-anchored draft without
inventing content or forcing an unsolicited history jump/keyboard popup.

Show actionable current-request failure feedback. Network/parse/timeout without
acknowledgment is unconfirmed, not proof of failed generation. Do not automatically
retry a paid draft request or pretend server progress stages exist. A delayed
snapshot must not hide a validated draft result or prolong its request spinner.
Read-only status refresh may show a confirmed current draft; an absent row proves
nothing. Guard chat/profile/client epochs and newer requests so stale completion
or errors cannot update another conversation. Do not clear unrelated unknown-send
or domain warnings. Explain silence/handover instead of leaving an empty result.

Focused tests defer generation and snapshot separately, cover pending, current
success/View, silence/handover, stale source, explicit server error, unacknowledged
timeout, scope change and no automatic duplicate request. No fabricated progress,
blind retry, auto-send or newer owner composition loss. Use actual existing Draft
state/action semantics, not a new backend generation/status API.

## Receipts

Consume36's optional OutgoingReceipt Message/Component projections, `level:sent|delivered|read`, `observedAt`, `source`. Pending has no tick, genuine sent has one neutral tick, delivered two neutral ticks, read two blue ticks, all with accessibility text. Absence/legacy accepted/privacy suppression is unconfirmed. No timer or HTTP success fabricates a level. Display per component, not entire outbox aggregate. Preserve unresolved action warning alongside receipt evidence for unknown/partial outboxes. Simulation is labeled. Incoming chat opens/viewed acknowledgments must never transmit WhatsApp read receipts.

## Owner instructions UI

One multiline plain-text `About me and reply instructions` field in existing Settings, scoped to accepted profile,2,000 code points/4,000 UTF-8 bytes. Explicit Save, empty save clears; no automatic extraction/import/demographic fields. GET/POST `/v1/owner-instructions` with36's exported schemas. POST `{requestId,expectedRevision,text}` returns `{text,revision}`. Show saved only after response, preserve unsaved editor on owner_instructions_changed conflict and offer reload. No cross-profile editor text carryover.

Explain that owner instructions and this eligible recipient's resolved name accompany model requests to OpenRouter, under existing consent/no-AI rules. They do not grant permissions or turn AI on. Changed instructions stale old pending drafts/cancel unsent AI work on backend; already handed-off messages cannot be recalled. No UI rewrite of owner text or generated approved sends.

## Contact setting and native flow

Use36's GET/POST `/v1/contact-names`, response `{enabled,revision,lastPhoneSyncAt,lastPhoneImportRequestId}`; POST `{requestId,expectedRevision,enabled}`. Default off, stored on PC per profile. Browser can toggle/use synchronized names, cannot import native contacts. Missing opt-in capabilities means unavailable controls, not false success. Native OS permission and server setting are distinct.

Prefer existing WhatsApp saved names. Explicit native Enable or Sync matched names action alone may query/request Android READ_CONTACTS, then look up names for existing verified direct phone-number conversations without a WhatsApp saved name. Never read on startup/chat open/background/AI generation. Denial/restriction/revocation leaves WhatsApp/push/number fallback. Never ask again without explicit action. Off deletes saved-book/phone aliases and caches through backend; it does not revoke Android permission, which UI must disclose. No WRITE_CONTACTS or unrelated fields.

The owner conditionally authorized SDK-compatible Expo Contacts, no other dependency. Installed Expo57.0.28 compatibility manifest nominates `expo-contacts ~57.0.7`; planned exact pin57.0.7. Before installation parent must confirm package availability/public API and canonical apps/mobile target plus root lockfile. Do not silently choose another version. No SDK/React Native/toolchain updates. If not confirmed, implement/test the pure mocked flow but report native integration blocked, do not call the task complete. No actual contact read during implementation.

Use the pinned module's supported public permission/query APIs, checked before coding. If no exact-number filter exists, disclose Android's book-wide read permission and use bounded foreground pages containing name/phone numbers only. Match locally by explicit international number after presentation-separator removal against existing canonical phone JIDs. Never guess country, match suffixes, resolve bare LIDs or pick between conflicting names. Release unmatched page data immediately, never persist/upload it. Request no email/photo/notes/birthday. Native helper is platform-specific with a web no-read implementation, not a browser import of native code.

Sync only matched `{conversationId,name}` pairs, name max120 code points/512 UTF-8 bytes. No full book/raw number list/phone contact ID upload. At most500 matches, fail visibly above limit without truncation. POST `/v1/contact-names/import` once with36's typed `{requestId,expectedRevision,entries}` schema. IDs max128 characters; route-specific512KiB, max500 matches, no chunks/staging/TTL. Do not replay mutations after connection failure. Failed import leaves prior rows; read settings and compare lastPhoneImportRequestId exactly to reconcile lost acknowledgment. A timestamp alone proves nothing. Empty success clears phone aliases. Show synchronized only on committed evidence, with last-sync time. Toggle-off/scope change discards local import data. Revision conflict requires reload and a fresh explicit sync, not silent merge.

Backend enforces saved WhatsApp > phone matched > push/notify > verified > number/unknown. UI uses sourced Conversation.name, not a private competing cache. Name sync creates no chat and grants no AI access. Full/unmatched/unrelated book names never enter model context or logging.

## Parent native dependency preflight

Public registry metadata confirms expo-contacts57.0.7 and the installed Expo
compatibility manifest nominates ~57.0.7. Parent downloaded its public archive to
memory only and verified the registry SHA512,11,445,987 compressed bytes. No files,
module install, real contacts or native permission call occurred. An initial5MiB
audit bound was too small; the declared12,272,227-byte unpacked package justified
the corrected16MiB in-memory bound. This is an API/source check, not hardware proof.

The package publicly exports `expo-contacts/legacy`; its types expose paged
getContactsAsync, getPermissionsAsync and requestPermissionsAsync. The root is the
new API, so do not assume legacy getContactsAsync is exported at the root. Verify
installed public types, select name/phone fields explicitly and do not use the
native default field set, which includes unrelated data. Public Kotlin confirms
permission methods request/check READ only when WRITE is absent from the manifest.
Its config plugin adds both READ_CONTACTS and WRITE_CONTACTS by default. Explicitly
block WRITE_CONTACTS in Android config and verify the resulting manifest. No custom
native bridge or second dependency is authorized.

When37 launches after36, the allowed install target is only canonical
apps/mobile/package.json and canonical root pnpm-lock.yaml, pinned exactly57.0.7.
Use existing pnpm and avoid lifecycle scripts/SDK changes. Do not install now or in
C:/Otherme-build. Parent will supply final API handoff and confirmation at launch.

## Definition of done and checks

Focused mobile tests defer hold/upload/send/snapshot independently. Cover immediate pending feedback, usable input/history/swipe, original capture, duplicate revision versus intentional identical send, media lease lifetime, pending remount, scope/background guards, sequential gestures, stale quote/source error, journal full/write failure, unknown/partial stop, no mutation restart and read-only request-ID reconciliation. Verify returning mutation result does not break draft approval, profile/Settings or Assistant feedback.

Tests cover per-component ticks/accessibility/legacy/unknown/simulated states with no read transmission; owner instruction save/reset/byte bounds/conflicts/profile isolation; contact enabled/off/denied/revoked/native/web paths, exact/ambiguous international matches, no unrelated data, single atomic commit/hash replay/body bounds/revision failure/exact lost-response reconciliation and honest offline status. Use fake contacts/model/API and invented numbers only.

Run focused files first, then `pnpm --filter @replybot/mobile test` and `pnpm --filter @replybot/mobile typecheck`. Parent runs workspace/packaging checks and isolated synthetic browser geometry/interactions, not final production export. Preserve selected320/360/390 and wide1280 dark/light/large-font UI. No confirmed blocking source regression remains. Native permission and actual mic/keyboard/receipts/contact sync remain explicit owner hardware checks, not mocked claims.

## Expected artifacts

Owned source/tests diff, exact API/dependency/config handoff, resolved Expo Contacts version if authorized, commands/results and unresolved hardware limits. Report manifest changes and how release33 will verify READ_CONTACTS without WRITE_CONTACTS. No final APK/web assets, real book, private runtime or release metadata. Parent handles authored docs and commits.

## Dependencies and review

Depends on36 integrated source/DTOs, no concurrent shared writer. Parent confirms conditional dependency target/version before install; task34 grants no installation action. Historical `C:/Otherme-build` is a release copy, not this writer's target. Parent verifies the existing approved C:/Otherme-build target and only then authorizes a credential-free input refresh in33, preserving caches/path fixes. Do not delete/recreate it, choose another target or rerun prepare-copy into it. No copying/installing outside project during37.

38 reviews the integrated changes plus32's original findings and dc99aa6 response.33 is blocked until source review/validation and confirmed release targets. No delegation ID exists yet; parent records the exact ID after launch.35 missing-incoming investigation is not part of this packet.

## Execution

Running after accepted backend commit b8b4f58. Sole mobile writer, provider takomi,
model openai-codex/gpt-6.1-sol, thinking high.
T3 task ID: `node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-release-extension-client-20261015-r1`.
Client request ID: otherme-release-extension-client-20261015-r1.
Scope includes the subsequent explicit Draft reply feedback request. Exact native
install target/command and no-WRITE permission constraint above are authorized.
No final build until38/parent source freeze; no actual contacts/device access.

## Implementation handoff and parent checks

The implementation task returned. Parent independently ran `pnpm test`, passing
all320 tests:78 core,82 backend,131 mobile and29 packaging. `pnpm typecheck` passes
all workspaces. Root lockfile diff adds only exact expo-contacts57.0.7; existing
pinned versions remain unchanged. app.json preserves version0.1.2/code3 and blocks
WRITE_CONTACTS alongside the existing restrictions. No real contact permission,
book, message, model, phone, build copy or service was used.

Source includes immutable gesture intents, scoped bounded storage and per-chat
lanes, mutation-before-refresh returns, visible Draft request outcomes/View,
receipt evidence displays and profile instructions/name controls. Parent source
inspection is not final acceptance. Task39 now supplies preview/browser geometry
and interaction evidence before38. The native manifest test is in-memory only;
33 must still verify actual merged/signed READ_CONTACTS without WRITE_CONTACTS.
No final desktop/APK export or hardware success is claimed.

## Limits

No .env/token/auth/signing/actual SQLite/runtime reads, live backend/WhatsApp/profile/model action, phone/device input, actual recording/contact read, service control, OS viewers, quota, final builds, SDK/toolchain/license install, outside-project writes or Git stage/commit/push. Dependency installation is only the conditional Expo Contacts step after explicit version/target confirmation. Synthetic disposable ports/stores only, not3210/8081/8083. Only documented `.runtime/ui-task31` synthetic artifacts may be inspected. Preserve previous authored context/style prompt; no Batch2 implementation or unrelated ingestion repair.

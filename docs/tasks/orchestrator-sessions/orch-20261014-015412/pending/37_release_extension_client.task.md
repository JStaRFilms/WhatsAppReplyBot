# Implement nonblocking sends and release extension controls

## Agent setup

Persona coder, Takomi Sol High, Build. requiredCapabilities=[write-code]. Canonical root `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`. Every shell command explicitly cd there or use absolute project paths. Use unslop and the existing selected charcoal/blue/light UI. No new design exploration or automatic subagents. Parent owns commits, master plan, board and task status.

Read scoped instructions, docs/Coding_Guidelines.md, docs/Project_Requirements.md, Release_Gate_Extension.md, Release_Extension_Implementation_Plan.md, Daily_Use_Batch_1_Contract.md, Account_Profile_API.md, Owner_Control_and_Local_Drafts.md and completed28 through32. Read36's finalized API/DTO handoff and actual source/types/tests before editing.

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

## Definition of done and checks

Focused mobile tests defer hold/upload/send/snapshot independently. Cover immediate pending feedback, usable input/history/swipe, original capture, duplicate revision versus intentional identical send, media lease lifetime, pending remount, scope/background guards, sequential gestures, stale quote/source error, journal full/write failure, unknown/partial stop, no mutation restart and read-only request-ID reconciliation. Verify returning mutation result does not break draft approval, profile/Settings or Assistant feedback.

Tests cover per-component ticks/accessibility/legacy/unknown/simulated states with no read transmission; owner instruction save/reset/byte bounds/conflicts/profile isolation; contact enabled/off/denied/revoked/native/web paths, exact/ambiguous international matches, no unrelated data, single atomic commit/hash replay/body bounds/revision failure/exact lost-response reconciliation and honest offline status. Use fake contacts/model/API and invented numbers only.

Run focused files first, then `pnpm --filter @replybot/mobile test` and `pnpm --filter @replybot/mobile typecheck`. Parent runs workspace/packaging checks and isolated synthetic browser geometry/interactions, not final production export. Preserve selected320/360/390 and wide1280 dark/light/large-font UI. No confirmed blocking source regression remains. Native permission and actual mic/keyboard/receipts/contact sync remain explicit owner hardware checks, not mocked claims.

## Expected artifacts

Owned source/tests diff, exact API/dependency/config handoff, resolved Expo Contacts version if authorized, commands/results and unresolved hardware limits. Report manifest changes and how release33 will verify READ_CONTACTS without WRITE_CONTACTS. No final APK/web assets, real book, private runtime or release metadata. Parent handles authored docs and commits.

## Dependencies and review

Depends on36 integrated source/DTOs, no concurrent shared writer. Parent confirms conditional dependency target/version before install; task34 grants no installation action. Historical `C:/Otherme-build` is a release copy, not this writer's target. Parent verifies the existing approved C:/Otherme-build target and only then authorizes a credential-free input refresh in33, preserving caches/path fixes. Do not delete/recreate it, choose another target or rerun prepare-copy into it. No copying/installing outside project during37.

38 reviews the integrated changes plus32's original findings and dc99aa6 response.33 is blocked until source review/validation and confirmed release targets. No delegation ID exists yet; parent records the exact ID after launch.35 missing-incoming investigation is not part of this packet.

## Limits

No .env/token/auth/signing/actual SQLite/runtime reads, live backend/WhatsApp/profile/model action, phone/device input, actual recording/contact read, service control, OS viewers, quota, final builds, SDK/toolchain/license install, outside-project writes or Git stage/commit/push. Dependency installation is only the conditional Expo Contacts step after explicit version/target confirmation. Synthetic disposable ports/stores only, not3210/8081/8083. Only documented `.runtime/ui-task31` synthetic artifacts may be inspected. Preserve previous authored context/style prompt; no Batch2 implementation or unrelated ingestion repair.

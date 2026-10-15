# Task41: Implement verified history reads and owner media contracts

## Agent setup and status

Persona coder, Takomi Sol High, Build. requiredCapabilities=[write-code]. Pending authored packet, no launch or execution ID assigned. Canonical root is `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`. Every shell command explicitly cd there or use absolute project paths. Use unslop and scoped instructions. Parent owns task records/status, board/master plan, commits and release decisions. Do not launch agents.

Read `docs/Coding_Guidelines.md`, Project_Requirements, History_and_Media_Reliability_Scope, History_and_Media_Implementation_Plan, Incoming_Message_Gaps_Investigation, Account_Profile_API, Daily_Use_Batch_1_Contract, completed35/36/39 and current37/38. Read actual owned source/types/tests and preserve earlier context/style prompt handoffs. The accepted implementation plan is the contract; bring significant deviations to parent before changing it.

## Objective

Fix verified same-account history/quote separation, partial blank/full recovery and access to older locally stored messages. Supply finalized bounded owner-display source/content APIs for42 and43, without coupling ordinary video to AI or installing a client module. No live repair or upstream full-sync promise.

## Dependencies and launch gate

Parent must accept40's plan AND39 must finish exporting frozen69f01fd before any source write here. Parent supplies exact accepted baseline and39 findings. Sole core/backend writer;42 starts only after this task's contracts and checks are accepted. No final build or runtime data operation follows acceptance.

## Exclusive file ownership

- `packages/core/src/store.ts`, `contracts.ts`, `api.ts`, `workflow.ts`, `context.ts`, `policy.ts`, `index.ts`.
- Optional cohesive new `packages/core/src/history.ts` for shared source/group types and pure rules, not a framework.
- `services/backend/src/whatsapp.ts`, `whatsapp-normalize.ts`, `server.ts`, `draft-model.ts`, `media.ts`, `audio.ts`, `reply-window.ts`, `assistant.ts`, `openrouter.ts`. Changes to the last four are only source membership, effective gates and unchanged media/model limits.
- Optional cohesive new `services/backend/src/media-display.ts` for owner display variants. `whatsapp-media.ts` only if needed to expose the existing safe download boundary, not relax it.
- Focused existing core/backend tests and new `packages/core/test/history-repair.test.ts`, `services/backend/test/history-media.test.ts` if useful.

No mobile, scripts, package/config/lock/version/signing edits. No docs/status changes by this writer; report finalized contracts and deviations to parent. A shared-file need outside this list is a handoff, not permission to expand ownership.

## Required implementation

1. Implement explicit `historyGroup`, `historySource`, `historyPage` and bounded `contextMessages`. Membership is exact stored same-account phone/LID evidence, including existing mappings. Do not rename/copy/delete message/raw records, follow arbitrary alias chains or use global/suffix/name guesses. Original message/request/draft/outbox/component/grant IDs, authorship, timestamps, ledger state and request hashes stay stable. Keep Workflow.conversation physical.
2. Effective canonical AI policy uses all verified members. Explicit never-reply/excluded/no-AI restrictions, all hours rules, live holds and unknown-send safeguards cannot disappear through projection. Exact verified LID membership resolves the identifier even when its immutable legacy kind says unknown; it must not permanently veto eligible canonical AI after normal explicit Resume. Unverified/conflicting/non-direct sources still fail closed. No automatic Resume at mapping, and no canonical control clearing explicit restrictions, live composer/recording holds or unknowns. Retired aliases are read-only for fresh actions, with409 retired_alias_read_only; recorded requests reconcile under original scope/hash/result with no dispatch. Canonical permission changes cannot clear another member's restriction, use alias_policy_restricted. Manual owner display is not AI access.
3. At a newly verified mapping, preserve current pause/restriction behavior atomically, cancel only affected queued work through its original ledger and serialize dispatch by group without rebinding outboxes. Handed-off/unknown/accepted state is untouched. Existing mappings get a once-only history_projection_version upgrade that invalidates only source-dependent pending/queued AI, preserving existing owner/manual work, reservations and pauses. Never cancel manual work merely because a read projection upgraded, reset limits, resume or generate. New mapping retains existing mapping-pause behavior. Legacy recorded manual outboxes keep original IDs and existing dispatch/reconciliation rules; only fresh retired-alias actions reject. No repeat pause/revoke on read/restart.
4. Collapse only equivalent same-event copies, choose stable earliest-rowid representative and retain physical records/references. Tombstone/view-once/earliest expiry dominate. Conflict remains explicit/unavailable, no quote/reaction/media/model/receipt guess. Real quote resolution covers old generated canonical IDs and new normalized context remoteJid/stanzaId, never inserts embedded content. Apply the same resolver to raw/getMessage/reactions/delete/media/audio, targets and every dispatch check. Preserve36's stricter receipt ambiguity rules.
5. Recover only a verified partial/legacy blank same-event row from meaningful supported full input. Add optional Message.contentState partial|complete and contentRecovered boolean. Atomic Workflow.recoverMessage updates raw and missing normalized fields at the original physical identity, invalidates sources and leaves ordering/provenance intact. No normal edit parity. Tombstone/view-once/expiry/conflict denies recovery. Neither a partial placeholder nor its recovery enqueues ReplyWindow. Recovery does not create unread, takeover, cooldown or handover completion. Clear a matching catch-up and exclude recovered/partial automatic triggers. Repeated full replay is a no-op.
6. Both context builds and all async generation/approval/dispatch checks capture group source epoch and effective gates. Select at most20 real transcript messages including required real quote targets. Query the up to three600-character owner examples separately, so an inbound-only recent window does not discard existing style. Preserve current instructions/name revisions and8,000 final serialized-request budget. UI pages are not model context. Source-only invalidation cannot revoke unrelated grants/refund unknown work or rewrite approved text.

## Shared schema and API handoff

Implement the exact accepted plan's additive records, not Batch2 tables:

- account_settings.history_projection_version default0 then1, and media_cache_id initialized once to a random UUID.
- history_group_state keyed account/canonical chat, persistent monotonic revision and source_epoch. Ordinary append/receipt updates revision; membership/repair/content/restriction changes also update source_epoch.
- message_views keyed account/message with same-account FK and appropriate unique referenced index; keep existing physical conversation_views as legacy floors. Composite occurredAt/stable-ID paging index. Reopen old serialized Message/Outbox/API factories safely.
- Shared Zod `HistoryPage`, `HistoryGroup`, `MediaSource` exports and inferred types. Optional historyPaging/privateMediaCache flags only for `/v1/session?capabilities=1&historyMedia=1`. Preserve both plain discovery and the old capabilities=1 object exactly, because37's capabilities schema is strict. Test old/new clients with old/new server query handling.
- Snapshot optional historyGroups `{id,memberIds,revision,sourceEpoch,lastMessageId,aiBlocked}`. Do not mutate Message.conversationId for inbox grouping or hide unresolved member work. Canonical latest-ten and last-message projection must agree with effective policy.
- GET history-page default50, max100; exclusive before/after/around parameters. Return `{conversationId,messages,unavailableSourceIds,revision,sourceEpoch,beforeCursor,afterCursor,hasOlder,hasNewer,latestMessageId}`. Strict max2,048-character scoped versioned cursors contain group membership/source epoch, max-rowid fence and occurredAt/ID tie-break. No OFFSET/full-list slicing. Changed membership/source returns409 history_cursor_stale, append retains old fence and offers Latest.
- POST viewed-messages `{requestId,messageIds}` max100 exact visible IDs, response `{viewed:true}`. Same-group validation and duplicate handling, no implicit intervening/newest acknowledgment. Old joined-history responses keep their shapes but compute legacy watermark only from requested-chat physical rows actually included, never alias-union maximum. Numeric viewed updates only that physical legacy floor. New clients never use it. Document this compatibility boundary in handoff. No WhatsApp read receipt.
- GET media source with variant preview|image|video returns namespace, physical source identity, sourceVersion, variant/state/mime/maxBytes, expiresAt and server validatedAt/validUntil at most30 seconds. No download/updateMediaMessage/model on metadata checks.
- GET media content with variant and expected sourceVersion returns authenticated complete bounded bytes and X-Otherme-Media-Version. All profile/auth/no-store/nosniff/origin/drain guards apply. Source/version checks before/after work and reply,409 media_source_changed on mismatch. No public route/token URL/Range/resume.

Owner preview/image preparation must not create model frames. Preview retains existing bounded PNG/GIF. Full photo is orientation-correct JPEG quality85, at most2048 per side/32Mi input pixels/4MiB output, image/jpeg in the new source/content contract; legacy preview PNG/GIF is unchanged. Ordinary owner video is MP4 only,10MiB/300 seconds/declared dimensions at most1920x1080, positive metadata and ftyp/MIME checks. Missing metadata/oversize is unsupported, codec failures remain explicit. Reuse existing guarded authenticated download, preserve MAC/hash/host/redirect/deadline/socket protections. Old unsupported video can be display-authorized from current raw without bulk Message rewrite. AI still has no ordinary video, no sending or background behavior.

Fingerprint immutable source/media identity and restrictions plus member/conversion version, not mutable CDN location. No keys/raw URLs/protobuf/contact text in descriptors/logs. A source-versioned valid cache check does not require a connected WhatsApp socket, but a miss still does. Server memory stays bounded24MiB/20 entries, two workers/24 pending across owner media preparation. A45-second total preparation deadline includes queue wait; expired queued work cannot start later. Existing download/conversion deadlines remain tighter inner bounds. Never return an invalid result to a coalesced waiter. Audio/model preparation keeps its existing policy/source checks and two-attachment/four-frame limits.

Parent acceptance corrections are authoritative over40's initial wording. Test a
verified legacy unknown-kind LID plus eligible canonical direct peer: mapping alone
does not generate, explicit canonical Resume restores normal eligible operation,
while explicit never-reply/excluded/hours, live holds and unknown work still block.
Test upgrade preserves already recorded manual/outbox identities and ledger units.
Cached_Chat_and_Draft_Opening.md is a42 client requirement; do not add a backend
mirror/new model call to satisfy cached paint.

## Tests and completion criteria

Use in-memory/reopened disposable SQLite and fake verified sockets/models/downloads, never production data or ports. Cover:

- Existing mapping and newly learned mapping; incoming LID plus phone owner reply/quote visible together. Original IDs/raw keys/request hashes/unknown grant units survive. Cross-account/group/conflict/suffix IDs fail. Retired controls and cached request replay cannot redirect/dispatch. Strict member policies/holds/hours/unknown work remain effective after canonical actions/restart.
- Same-source equivalent duplicates versus direction/body/provenance/raw-media conflicts; deletion/view-once/expiry dominates all candidate copies. Delete/reaction/raw/retry/quote/audio/model boundaries agree. Receipt regressions retain conservative correlation.
- Empty then full, legacy blank then supported full, duplicate full, ciphertext stub then full, expired/view-once/tombstone/conflict and genuine unsupported content. Assert no recovery model/transport call, unread increment, owner activity/catch-up send or second stored row.
- At least101 stored rows, equal timestamps, page boundaries both directions, around old quote/draft, late backfill/out-of-order append, receipts, source epoch invalidation, account/cursor tampering, restart and bounded query shape. Exact visible acknowledgment must not clear a newer unseen message at old-window bottom. Legacy floors survive.
- Auth/profile/no-store/namespace/sourceVersion; source validation with zero binary loads; profile/delete/expiry/version change during queued/download/convert/coalesced work; video metadata/MIME/signature/size limits and unchanged AI denial. No owner-display visual sampling, token URL, static cache or new filesystem server archive.

Run narrow tests, full owned core/backend suites and typechecks with existing scripts. Suggested root commands `pnpm --filter @replybot/core test`, `pnpm --filter @replybot/backend test`, `pnpm --filter @replybot/core typecheck`, `pnpm --filter @replybot/backend typecheck`. No install, live model/download or final export. Report actual commands/counts only.

Done means all required contracts/source guards work, focused tests and owned suites/types pass, old DTOs reopen, and the final diff is scoped. Return exact changed paths, finalized schema/DTO/route/error/cursor/fingerprint policy and any significant deviation to parent before42. Parent38 reviews once after42/43/44, with33 still held. Tests cannot establish actual WhatsApp incident cause or native playback success.

## Execution

Running Takomi Sol High, sole core/backend writer. Parent accepted40 in30f4f15;
39 finished and parent rerun passed. Source baseline69f01fd, newer commits docs-only.
T3 task ID: node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-history-media-backend-20261015-r1.
Client request ID: otherme-history-media-backend-20261015-r1. No42/43 writer active.
No real data operation, native dependency install or build is authorized here.

## Safety limits

No real DB/auth/.env/token/key/signing/book/message/log/media reads, live API/WhatsApp/history sync/model calls, paid quota, services/viewers/devices, production3210/8081/8083, dependency/SDK/toolchain install, final web/APK build, outside-project writes or stage/commit/push. Only documented synthetic ui-task31/ui-task37 artifacts may be read if needed; never write39's output. Synthetic test temp data is allowed. Preserve unrelated user work and future context/style docs.

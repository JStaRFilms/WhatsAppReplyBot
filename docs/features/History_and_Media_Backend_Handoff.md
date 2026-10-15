# Accepted41 core/backend handoff

## Acceptance and verification

41 implementation returned with21 focused tests,88core/93backend tests and owned
types passing. Parent inspected source resolver, policy/upgrade/ledger guards,
keyset paging, media descriptors/output and tests, then ran the whole workspace.

Parent found a related duplicate-arrival defect during this acceptance pass.
The same verified event classified live on one alias and replay/backfill on another
became unavailable; its replay copy could also be mistaken for a read event.
New regression failed before correction. Known arrival classes now compare as one
event while actual actor and unknown provenance remain strict. Physical source
classes/IDs are unchanged. Unread dedup checks actual exact/legacy acknowledgment,
not whether a copy happens to be replay/backfill. Explicitly viewing either real
copy acknowledges that same event, never unrelated/newer input.

After the correction parent ran22 focused tests, then pnpm test:342 passed,
89core/93backend/131mobile/29packaging. pnpm typecheck passed all workspaces.
No private runtime/DB/API/model/media/account, install or final build was used.
41 is accepted for downstream implementation, not combined38 or hardware acceptance.

## Stable source and policy contracts

Workflow.conversation remains physical. historyGroup/historySource/historyPage and
contextMessages resolve exact verified same-account LID/phone source membership.
HistorySource carries original message/account/conversation/messageId/transportId,
candidateIds/state/expiry. Persistent rows, original raw keys, requests/hashes,
outbox/component/grant scopes and accounting stay unchanged. Canonical explicit
Resume can resolve paired mapping pause/derived unknown kind, not explicit member
noAI/exclusion/hours, live owner holds or unknown reservations. Retired fresh actions
reject; recorded requests reconcile exactly. Existing-mapping upgrade invalidates
dependent queued AI only, preserving old manual work and handed-off states.

Added source epoch on AI draft/outbox captures, history_group_state revision/epoch,
exact message_views and account history_projection_version/media_cache_id. Raw
restriction markers preserve conflict/view-once/earliest-expiry evidence on replay.
Only guarded bodyless same-event recovery fills missing normalized/raw fields;
no new event/unread/cooldown/catchup/generation/send. Repeated full replay is a no-op.

## Frontend contracts

New shared Zod/types HistoryGroup,HistoryPage,MediaSource are in core/api.
GET session?capabilities=1&historyMedia=1 adds historyPaging/privateMediaCache.
Plain and old capabilities=1 responses retain exact legacy shapes.
Optional snapshot.historyGroups contains id/memberIds/revision/sourceEpoch/
lastMessageId/aiBlocked. Message.conversationId/IDs stay original physical values.

GET conversations/:id/history-page supports default50/max100 and exclusive
before/after/around. Response includes logical conversationId, original Message
DTOs, unavailableSourceIds, revision/sourceEpoch, before/after cursors, hasOlder/
hasNewer/latestMessageId. Scoped max2048-character cursors fence rowid/membership/
sourceEpoch and occurredAt/ID edge.409 history_cursor_stale requires reanchor.
POST viewed-messages {requestId,messageIds[1..100]} acknowledges exact verified
same-event IDs. Legacy numeric floors remain physical and are not raised by this.
New clients use actual visible IDs, not bottom-of-old-window inference.

Both context builds use at most20 real messages and three separate600-character
owner examples, final8k provider budget. No UI pages become a model transcript.

## Owner media contracts

GET conversations/:id/media/:messageId/source?variant=preview|image|video returns
cacheNamespace, physical conversationId/messageId, sourceVersion, variant/state/
mime/maxBytes/expiry/validatedAt/validUntil. Metadata is a local source read, no
binary load, WhatsApp refresh or model work. Lease<=30seconds/known source expiry.
States available/missing/deleted/expired/view_once/denied/unsupported/conflict.

GET same path/content?variant=...&sourceVersion=... returns authenticated whole
bytes, X-Otherme-Media-Version, no-store/nosniff; no Range,416 if requested. Recheck
source/version around queued/download/convert/reply.409 media_source_changed;
503 media_busy;504 media_preparation_timeout. New image is oriented JPEG85,
2048px/32Mi input pixels/4MiB. Preview remains bounded PNG/GIF without AI frames.
Ordinary video is owner-only bounded declared MP4/ftyp,10MiB/300sec/1920x1080,
no AI frames/transcription/sending. Shared owner preparation20entries/24MiB,
two workers, bounded pending and45-second total deadline including queue.

Fingerprint excludes mutable CDN location. Accepted local-image fallback uses
upload ID plus stored upload-request hash committing to original bytes, with no
BLOB read in metadata. Cached validation can work with WhatsApp disconnected;
byte miss still needs verified guarded transport download. Client42/43 still must
implement persistence/viewer/foreground ownership, not assumed complete here.

## Next ownership

46 is next, sole backend/core writer for Whisper STT and source-linked reuse/
unknown-paid-attempt protection. Rebase on actual41 APIs/guards, do not use media
membership epoch alone as immutable audio content identity.42 follows46, then
approved43 Video57.0.5,44 integrated browser,38 combined review and33 frozen
artifacts. Cached-first existing draft opening is explicitly in42/44. No released
artifact/version or actual running service changed through41 acceptance.

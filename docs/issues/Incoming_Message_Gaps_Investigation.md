# Incoming message gaps investigation

## Status and scope

Task35 completed read-only investigation against release399cc99 and candidate
69f01fd. It found reproducible source defects, not the proven cause of the owner's
actual missing messages. No real DB, auth, logs, contact/message content, API,
phone or service was inspected. No source repair, live history request, reset or
relink was performed. Owner subsequently approved all three identified history changes and requested
cached/tappable image/video viewing.40 now plans that release extension. No code
fix or live repair has yet occurred; browser39 stays on frozen69f01fd.

## Owner report

Some incoming messages appeared in original WhatsApp but not Otherme. The owner's
later replies from WhatsApp appeared in Otherme while those incoming originals
were absent. Approximate time/timezone and text/photo/voice type are not yet known.
The owner suggested an integration cause; that is not established.

## Confirmed source findings

### Verified identity mapping leaves history split

`services/backend/src/whatsapp.ts` canonical mapping and
`packages/core/src/store.ts` alias/read methods change future routing after a
verified LID-to-phone mapping but do not consolidate or logically join prior
Message/raw-message rows. mergeReleaseContext handles names/receipts, not history.

The delegated synthetic scenario receives incoming under LID, then an owner reply
under phone JID with matching alternate LID. The phone history contains the reply;
LID history still contains the incoming original. Phone-scoped quote lookup cannot
find that original. This behavior also predates the new receipt/name work.

Parent independently reproduced the storage consequence in memory with SqliteStore,
verified alias mapping, both synthetic conversations and mergeReleaseContext.
Alias resolves to phone, but exact-scoped histories remain separate. Assertions
passed, no real runtime was accessed. This can reproduce the reported pattern;
it does not establish which identity/events occurred for the owner.

Any proposed fix must use only verified same-account aliases, preserve original
records/IDs/provenance and strictest permissions, retain media expiry/tombstones,
unknown accounting and quote isolation, and never fabricate quoted originals.
Source-only synthetic work is separate from live data repair.

### Partial blank content can block later recovery

`whatsapp-normalize.ts` can turn `message: {}` into a blank Message.
`whatsapp.ts` later updates raw storage for a full same-ID upsert, but workflow
deduplication can leave the displayed row blank. Delegated synthetic assertions
confirmed blank normalized content remained while raw content recovered.
A ciphertext stub without message is skipped, and a later full replay inserts
successfully. It is not established that Baileys emitted the blank/full sequence
for the owner. Any fix must preserve deletion/view-once/source guards and must not
retrigger historical AI generation or send on a content recovery.

### Existing local display window is 100 messages

The store's recentMessages default and both server history endpoints expose the
newest100 stored messages. Mobile has no older-page request. A delegated synthetic
case persisted101 messages but returned100. Scrolling up cannot retrieve the
oldest omitted record. This is a local display limit, distinct from upstream full
history availability. Pagination is a separate enhancement, not automatically a
required fix to the reported recent-message case.

## Other checked boundaries and limits

Verified/stale socket gates passed synthetic checks and must not be weakened.
History/backfill/append/replay classification does not itself discard these events
or authorize historical replies. Missing embedded quoted content is not inserted
as genuine history. Cross-alias quote comparison can lose a reference even when
the source is stored elsewhere. Message update edits are not implemented; library
placeholder recovery uses upsert, so these must not be conflated.

Synthetic text/photo/voice normalized; ordinary video/documents produced unsupported
records, and location could produce a blank record. No full attachment-parity
change is authorized. Cache/coalescing/explicit refresh checks found no additional
cache defect. Full history is disabled; never-received/decryption/socket/library
loss remain hypotheses with no live evidence.

## Evidence and next decision

Delegate ran3 existing backend/history tests successfully and additional in-memory
assertions. A direct mobile-cache import hit React Native Flow syntax; the
repository transpiling test harness then passed. No tracked files or persistent
diagnostic script changed. Parent's independent alias-store assertion also passed.

Owner decision is now recorded: fix the identity split, blank recovery and local
older-message paging. Implementation needs40's scoped plan and tests, not live data
access or full upstream history sync. The smallest optional incident detail is approximate local
date/time, timezone and text/photo/voice classification. No private content,
contact details, screenshot, auth data or real diagnostic access is requested.

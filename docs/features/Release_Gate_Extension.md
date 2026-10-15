# Owner-added release gate

## Authority and timing

The owner explicitly added these requirements while the focused review32 of the
original Batch1 baseline74f26af was running. That review still covers its original
committed baseline. It is not final acceptance of this extension. Hold release33
and all final production browser/APK builds until this work is specified,
implemented, tested and reviewed. Keep the existing session and selected design.

## Required outcomes

### Nonblocking sending

The owner reports that pressing Send leaves a spinner in the composer, delays
visible sending and prevents continuing to type or swipe-to-reply. The candidate
already preserves editable text but must be checked for all remaining busy guards
and mutation-to-read waits. Show immediate, honest pending feedback. Keep the
conversation usable during send/upload and unrelated status refresh. A second
reply/quote gesture must not require waiting for the first message to finish.

Preserve duplicate-send protection and immutable request identities, per-intent
text/quote/media capture, newer composition revisions, acknowledged holds,
account isolation and uncertain outcomes. Never turn pending or unknown into
accepted success, silently retry transport, or erase recoverable owner content.
The exact pending/intents model and concurrent-send ordering need a scoped plan.

### Actual WhatsApp receipt indicators

Show outgoing pending/sent/delivered/read states only from evidence. A single tick,
double ticks and blue ticks must reflect the real transport acknowledgment and
recipient receipt levels available from WhatsApp, not HTTP success or a local
snapshot. Preserve accepted versus delivered/read semantics. Missing receipts or
privacy restrictions must not imply a read. Preserve profile/socket identity,
source lineage, monotonic receipt handling and multi-component/unknown accounting.

This request concerns outgoing status display. It does not authorize sending
WhatsApp read receipts when a chat is opened. Existing actual-visible app unread
acknowledgment remains separate. No live receipt diagnostics or sends are allowed
during implementation. Use synthetic adapter events and disposable stores.

### Optional contact-book display names

The owner selected synced names across phone and PC/browser, using WhatsApp sync
or phone-number matching, and explicitly wants AI to see the current contact's
name. Prefer saved names already available from WhatsApp. Where needed, provide
opt-in phone-book lookup and minimal matched-name synchronization to the own PC.
The question explained that native lookup may add SDK-compatible Expo Contacts;
this equivalent Android-and-PC choice authorizes that dependency if it is needed.
Confirm its exact version/target first. No other dependency or SDK/toolchain
installation, license acceptance or real contact read is authorized.

Keep the on/off control and define toggle-off/cache deletion, denial and fallback.
Only the resolved name for the current AI-permitted conversation may accompany its
model context. Never send the full address book, unmatched entries or unrelated
contact names to AI. Never-reply/no-AI and global model consent still apply before
context construction. Use a separate sourced alias with stable precedence, not
unconditional overwrites from incoming push names. Match verified phone identities,
never ambiguous suffixes or globally shared LIDs. Do not create inbox chats merely
by importing contacts. No actual address book is read during development.

### AI reply punctuation

The owner additionally requires automatic replacement of every em dash in
AI-written draft/reply prose with a comma followed by a space. Apply this before
persistence and review, so approved text and dispatched text match. Cover ordinary
text replies and each generated text-sequence component. Preserve owner-written
messages, original source/quoted messages, IDs, emoji and transport metadata.
Do not rewrite history or ASR source transcripts. Use one typed generation boundary
rather than a send-only mutation. Retain existing validation and limits after
transformation. Add focused tests for repeated/spaced/unspaced em dashes, sequence
components and unaffected owner/source data. No extra model call is needed.

### One owner instructions prompt

The owner requested a simple editable master/profile prompt for their name,
personality/tone and any facts they choose to add. Include one bounded plain-text
field per WhatsApp profile, synchronized through the independent PC service and
used for future AI replies under existing consent. No birthdate/demographic forms,
automatic extraction, private-history profiling or full Batch2 writing-profile/
session/memory implementation. Explain that this field and the current permitted
contact name are sent with eligible AI requests. Do not claim the model already
knows them; the inspected current prompt uses generic participant roles.

Plan storage/API revisioning, strict input limits and true context-budget
accounting. Define effects on in-flight generation and old drafts/queued AI work so
an instructions edit cannot silently rewrite approved text or bypass safety checks.
Permission/never-reply/source-expiry/unknown-send enforcement stays in backend
code, not merely this user-editable prompt. Use invented profile instructions in
tests. Preserve the full earlier style-extraction handoff for later Batch2.

## Settled implementation contract from task34

[Release_Extension_Implementation_Plan.md](Release_Extension_Implementation_Plan.md)
records the source inspection, proposed interfaces/schema, interaction rules,
privacy, tests and rollback. It is a plan, not an implementation claim. The owner
choices above remain authoritative, including permission to send only the current
AI-permitted recipient's resolved name with model context.

Use original-gesture immutable send intents with local pending feedback and a
recoverable device journal. Keep one ordered client lane per conversation and the
existing backend dispatch lane. Mutation completion releases its wait before a
snapshot refresh; accepted is still not a WhatsApp tick. Unknown/partial requests
retain identity/content/accounting and never trigger replay. Composition/history/
quote remain usable. Existing scoped snapshot outboxes support request-ID
reconciliation, so no asynchronous send service or new lookup API is needed.

Receipt evidence is optional, persisted by account/chat/transport ID and projected
per outgoing Message/Component. Only verified WhatsApp sent/delivered/read events
advance one/double/blue ticks monotonically. HTTP acceptance, own echoes and app
unread do not. Display receipts cannot refund/charge grants, resolve unknown
accounting or transmit WhatsApp read receipts.

Book names default off per profile. When on, use WhatsApp saved, phone matched,
push/notify, verified label, then number/unknown. Preserve source precedence and
partial contact updates. Explicit Android foreground sync reads minimal name/phone
fields, matches exact international numbers locally and sends only matched existing
chat/name pairs to PC. No inbox creation, book upload or automatic background read.
Off deletes saved-book/phone aliases and recomputes fallback; Android permission
remains separate. Chunked bounded phone imports commit as one replacement.

The simple owner field is About me and reply instructions,2,000 code points and
4,000 UTF-8 bytes, explicit versioned save per profile. No automatic extraction or
Batch2 work. Instructions/name changes invalidate affected pending/in-flight AI
work and unsent AI components without rewriting approved text, recalling handoff,
resetting grants or releasing unknown reservations. Count the actual serialized
prompt/schema/name/preferences within the existing conservative text budget.

Normalize generated Action prose once in createDraft and revalidate after
replacement, never at manual/edit/dispatch boundaries. A one-time extension upgrade
stales legacy pending AI drafts and cancels unsent legacy AI components while
preserving all history and dispatching/unknown reservations. No automatic redraft.

Installed Expo57.0.28 nominates expo-contacts ~57.0.7 in its local compatibility
manifest. Proposed exact pin57.0.7 still needs package/public-API verification and
parent confirmation of canonical install target before installation. The historical
short copy C:/Otherme-build must not be overwritten; release33 needs a confirmed
approved nonexistent copy target. No install, outside-root write or final build
occurred in task34.

Pending36 owns all backend/core shared contracts/store/WhatsApp/context work.
Pending37 follows36 and owns the client/controller/conversation/Settings/native
contact integration. Pending38 is the focused read-only combined review, including
review32's findings and dc99aa6 response. Release33 stays blocked on36,37,38 and
parent validation/source freeze.35 remains the separate ingestion investigation.
These packets have not launched; parent records exact execution IDs after launch.

## Planning and verification

Task34 records user choices, examines current send/outbox/receipt/contact paths
and authors a bounded implementation plan, including AI punctuation, resolved
current-contact names and the plain-text owner instructions field. Update the existing approved contract,
requirements and relevant feature docs once the data flow is settled. Create
self-contained implementation packets with non-overlapping ownership before
launching writers. Reuse current charcoal/blue/light UI, not new visual exploration.

Add focused regressions for pending-send interaction, edit/quote preservation,
acknowledgment ordering/identity and receipt truthfulness. Contacts use invented
numbers/names only. Native permission checks and the integrated signed update
still need owner hardware acceptance. One focused review of this added work is
required before the combined release. No new logo, Batch2 continuity work, live
account action or automatic service control is authorized.

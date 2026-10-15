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

The owner wants familiar saved contact names instead of WhatsApp display names,
with an explicit on/off switch. Resolve whether Android-only local lookup or
minimal phone-to-PC name synchronization is wanted. True native address-book
lookup may require the SDK-compatible Expo Contacts package; obtain that consent
before installing it. No SDK/toolchain installs or license acceptance are implied.

Default proposal is opt-in on-device display lookup, no full address-book upload,
no contact-book data sent to AI and a truthful WhatsApp-name fallback. This is a
proposal, not a completed user choice. Any PC synchronization needs explicit user
selection, minimal matched data and a separate display alias, not an overwrite of
canonical conversation/context names. Match verified phone identities, never
ambiguous suffixes or globally shared LIDs. Define toggle-off/cache deletion and
permission-denial behavior. Do not read actual contacts during development.

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

## Planning and verification

Task34 records user choices, examines current send/outbox/receipt/contact paths
and authors a bounded implementation plan, including the AI punctuation rule. Update the existing approved contract,
requirements and relevant feature docs once the data flow is settled. Create
self-contained implementation packets with non-overlapping ownership before
launching writers. Reuse current charcoal/blue/light UI, not new visual exploration.

Add focused regressions for pending-send interaction, edit/quote preservation,
acknowledgment ordering/identity and receipt truthfulness. Contacts use invented
numbers/names only. Native permission checks and the integrated signed update
still need owner hardware acceptance. One focused review of this added work is
required before the combined release. No new logo, Batch2 continuity work, live
account action or automatic service control is authorized.

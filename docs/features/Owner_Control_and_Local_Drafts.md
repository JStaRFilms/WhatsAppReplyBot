# Owner controls, local drafts and efficient chat loading

## Approved behavior

Owner-sent messages begin a five-minute cooldown, reset by each new owner send.
At expiry, any unanswered message received during the pause gets a draft only.
Later live messages follow the prior contact mode, using only an unexpired,
unspent original grant. No limits are reset. Never-reply and global consent
still gate all AI. A handover holds until owner intervention.

Typing sends only a composer-status change, never text or per-key requests.
A nonempty local composer holds AI. Clearing it releases only that typing hold
after ten seconds, without cancelling a longer cooldown, explicit indefinite
pause or handover. Resume now bypasses timed pauses, Extend adds time and Pause
indefinitely requires explicit resumption. Unsigned/unknown sends do not start a
successful-owner-send cooldown. Unsent text remains local and appears as Your
draft alongside AI drafts.

## Components and data flow

Core persists layered pause state on the conversation, cancels stale queued AI
work and retains original grant deadlines/accounting during eligible temporary
owner holds. A backend timer resumes due conversations and requests a draft for
backlog, never a retroactive automatic send. Inline controls use authenticated
owner actions. Contact modes and privacy consent remain separate.

The Expo client caches a bounded set of recently opened histories per API client.
Opening a cached chat is immediate; first visits show one loading state until
history and existing draft cards can appear together. Only changed conversation
history is reloaded. SQLite indexes supply the last message/history window
without parsing every message in every chat for a snapshot.

Local drafts use device storage scoped by service/account/chat. Their text never
enters the service, model context or server logs before Send. The backend only
sees composer occupancy. The same Drafts filter distinguishes Your draft from
AI draft. Avatar counters show unread incoming messages in Reply, not WhatsApp
read receipts. Viewing a chat never sends a WhatsApp read receipt.

## Database and client state

Conversation JSON gains optional layered pause metadata. Legacy manual records
stay manual until an explicit action or new owner send uses the new lifecycle. Composer holds are account/conversation/device scoped; unread view watermarks are
account/conversation scoped. History revisions detect edits and out-of-order
arrivals independently of the last chronological message. View acknowledgments
cover the highest row watermark actually included in the loaded window. Pause deadlines survive service restart. History
cache is bounded and scoped to the authenticated API client. Local draft storage
is device-only; server credentials stay in SecureStore rather than draft storage.

## Planned nonblocking send extension

The next-release amendment in
[Release_Extension_Implementation_Plan.md](Release_Extension_Implementation_Plan.md)
adds a separate recoverable submitted-intent journal, not server access to unsent
local drafts. At the original gesture capture text/quote/media/revision and stable
request IDs. Show pending immediately, persist before network/clearing and clear
only that captured revision. Keep input/history/swipe-to-quote usable during
send/upload and preserve newer acknowledged occupancy. One ordered client lane
prevents later text overtaking earlier media; backend dispatch lanes stay intact.

A mutation result no longer waits for snapshot refresh. Accepted is not a receipt
tick. Unacknowledged/unknown/partial work retains identity/content/reservations and
cannot auto-retry, including on remount/restart; queued local successors wait
without locking composition. Scoped outbox request IDs support read-only status
reconciliation, not content matching or absence-as-failure. Media bytes remain
locally owned while pending, never copied into the journal; missing restart media
requires explicit reattachment. See the plan for bounded storage/failure behavior.

Book-name and owner-instruction changes invalidate dependent pending/in-flight AI
work but cannot reset grants, lift holds or recall handed-off components. Real
outgoing WhatsApp receipt projections are independent from app-visible unread and
outbox accounting. Viewing incoming chats still sends no WhatsApp read receipt.
These are planned changes for36/37 and review38, not additional verified behavior.

## Verification

39 focused safety tests, strict typechecks and web export pass. Fake clocks cover
cooldown reset/expiry, empty and occupied composers, independent devices,
indefinite/handover holds, duplicate acceptance and original grant preservation.
Browser checks pass initial history/draft grouping, cached reopen during a held
refresh, unread views, local draft restore/clear and boolean-only occupancy.

The live snapshot check measured 726ms before indexed window reads and 263ms
after in separate local samples, not a controlled performance benchmark. No
private conversation or paid API request was used in the control/browser checks.
Physical Android countdown, device storage and responsiveness still need owner
feedback.

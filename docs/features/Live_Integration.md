# Live WhatsApp integration

## Goal

Connect the existing personal WhatsApp account, OpenRouter drafting and Android
Wi-Fi client in one implementation pass. The owner pairs through Linked devices.
Contact permissions and approved sends remain enforced by the existing workflow.

## Components and data flow

Baileys receives direct-chat history and live events. The adapter normalizes
messages into account-scoped SQLite records and maps verified phone/LID aliases.
Backfill never triggers drafting. Live incoming messages use existing policy and
consent gates. Generated drafts and sends pass through Workflow revision checks.
Transport acceptance is not a read receipt. An uncertain send is never retried.

Settings displays an authenticated pairing QR and connection status. The live
backend uses a separate database and auth folder from the demo. The LAN listener
requires the owner token, rejects non-private clients and permits only configured
browser origins. Phone setup does not expose the OpenRouter key.

## Data storage

The live SQLite database adds account-scoped WhatsApp message keys/raw payloads
for quoted messages and retry lookup, plus evidence-based LID/phone aliases.
The session identity is fixed to the first paired owner. A different account is
rejected rather than mixed into existing history. Credentials and raw history
remain in ignored .runtime/ and are never committed or logged.

## Verification

28 focused safety tests, strict typechecks and web export pass. Browser checks
verified authenticated live Settings and QR rendering without page errors. The
live backend is running on Wi-Fi at http://192.168.100.65:3210. The key was stored
privately in the ignored .env. No key or WhatsApp QR was copied into chat or logs.
The owner linked WhatsApp successfully. A paid synthetic GPT-6 Luna response
validated after correcting the provider schema to an object/anyOf envelope.
No real send was initiated by the agent. Physical-phone behavior still needs
owner verification.

A read-only Takomi reviewer found five blockers before pairing: revocation
updates, alias restriction carryover, nested view-once, library retransmissions
and unverified-owner ingestion. Each was fixed. Deleted messages retain raw
tombstones, alias reconciliation pauses both identities and retains restrictions,
view-once wrapper detection blocks caching, outgoing retransmission is disabled,
and queued data requires the current verified owner socket.

## Contact controls and conversation UX

Mode, resumption and an optional bounded auto grant are staged together under a
configure proposal. One exact-payload confirmation applies them atomically.
Global remote-context consent remains separate. Repeating an unchanged consent
value no longer invalidates all chats or revokes existing limits.

History and previews use message timestamps, not history-sync insertion order.
Chats open at the newest message. Scrolling upward keeps the reader in place.
Manual, draft and auto limits use colored badges, leaving previews unobstructed.

## Handover lifecycle and activity

Handover cards resolve after an acknowledged manual text reply, a verified live
owner text from WhatsApp, or explicit resumption/configuration. Typing, incoming
messages and unknown send outcomes do not resolve them or resume automation.
Recovery clears previously answered cards without changing manual control.
Drafts retain optional handoverAt for edits that become handovers later.
Needs me lists only active handovers; Handled dismisses one without resuming AI.
Future model handover reasons address the owner directly as you.

Filter dots indicate unseen incoming messages, pending draft revisions and new
handovers. Viewing a filter clears its dot without dismissing its work. Seen
activity is account-scoped in the current UI session and only acknowledged while
the Chats screen is focused. Incoming events can light All while another filter
is selected.

Typing no longer rebuilds message rows/date formatters on every keystroke.
Memoized rows/bubbles/cards, shared formatters, indexed lookups and deferred
search cut synthetic 3,200-chat mean input paint from 69ms to 28ms. This does not
claim the same timing on the owner's physical Android device.

## Limits

Live media encoding and understanding remain pending. Media is identified but
remote generation refuses media-bearing context. Delivery/read receipts are not
yet presented as verified events. Original WhatsApp typing cannot be reliably
observed, though a synced owner send pauses the assistant. Server HTTP is limited
to authenticated private-network clients; it is not an internet deployment.

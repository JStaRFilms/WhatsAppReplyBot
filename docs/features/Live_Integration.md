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
No paid generation or live send ran. The owner still needs to scan the QR and
verify physical-phone connectivity.

A read-only Takomi reviewer found five blockers before pairing: revocation
updates, alias restriction carryover, nested view-once, library retransmissions
and unverified-owner ingestion. Each was fixed. Deleted messages retain raw
tombstones, alias reconciliation pauses both identities and retains restrictions,
view-once wrapper detection blocks caching, outgoing retransmission is disabled,
and queued data requires the current verified owner socket.

## Limits

Live media encoding and understanding remain pending. Media is identified but
remote generation refuses media-bearing context. Delivery/read receipts are not
yet presented as verified events. Original WhatsApp typing cannot be reliably
observed, though a synced owner send pauses the assistant. Server HTTP is limited
to authenticated private-network clients; it is not an internet deployment.

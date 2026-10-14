# Owner images and reply window

## Goal

Support gallery/camera images with preview and caption, sent only by explicit
owner action. Keep draft cards at their source turn, avoid duplicate suggestions,
collect incoming message bursts for five seconds and allow meaningful quotes and
reaction-aware context. This extends media viewing/understanding to manual sends.

## Client and server flow

The picker acknowledges an owner composer hold before opening. Selection and
caption stay local. Send stages image bytes through an authenticated scoped
upload, then uses the durable manual outbox. The model cannot create an image-send
action. Image/caption form one component, with the same uncertain-send protection
as text. Successful owner acceptance starts the existing cooldown. Staged uploads
are bounded and cleaned only when not needed by queued/unknown transport work.

A per-conversation five-second quiet timer resets on live inbound messages and
re-evaluates consent, holds and allowance. Generation is shared by conversation
workflow version. The latest pending suggestion is reused; stale source turns
remain in history rather than being appended at the composer. Model quote IDs
are validated within the conversation. Reaction observations identify actor,
target and time, including edits/removals; legacy observations stay unknown.

## Schema and privacy

Outbox component gains owner-only image/upload ID; the AI Action remains textual
or reaction-only. Upload bytes/metadata are account and conversation scoped in
SQLite image_uploads stores id/account_id/conversation_id/mime/width/height/bytes
and created_at. Input is capped at 10MB; normalized JPEG is at most 2048px per
side. Staged bytes are limited to 100MB per account. One-hour-old uploads are
cleaned on staging only if no unfinished or uncertain outbox needs them.
Message reaction observations and optional quote IDs are backward compatible. View-once/private original WhatsApp media safeguards remain intact.

## Verification

68 tests, strict typechecks and Android/web exports pass. Synthetic LAN browser
checks cover gallery selection held locally, composer protection, caption, one
upload/one image send, authenticated sent-image preview and cooldown. Draft
anchoring/legacy duplicate dismissal, insecure HTTP UUID and existing conversation
visibility/gesture checks pass. No real send or private-chat diagnostic was used.

Review found reconnect revival and late reaction overwrite. Every socket loss
now clears the reply window, including active work tokens. Reaction completion
preserves newer account observations. Focused regressions pass.

Use isolated synthetic data for batching, quote/context, upload scope and send
states. Do not initiate real sends or private-chat model diagnostics. Run focused
checks, strict typechecks, Android/web export and LAN browser flow. Native camera
permissions and actual phone attachment UI require owner confirmation.

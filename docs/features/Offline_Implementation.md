# Offline implementation

## Current evidence

The first executable slice is packages/core. Node 24 node:sqlite persists
conversation, message, draft, delegation, owner-action and outbox records with
account/conversation metadata and validated JSON payloads. API idempotency is
transactional. This is a bounded implementation of the documented schema,
not all 21 production tables or a connected WhatsApp service.

Policy removes explicit modes before selecting ten eligible default-draft chats,
respects hours/manual control, and denies all AI access for never-reply/excluded
contacts. Same-contact context is bounded conservatively by UTF-8 bytes and
learns only verified owner-written examples. Source-less memory and view-once
content are not exported.

Workflow versions reject stale generation/approval/dispatch. Manual control and
revoked grants survive restart. Per-chat dispatch lanes prevent simultaneous
responses to the same stale turn. Persisted dispatch intent recovers as unknown.
Partial bundles retain only uncertain reservations; no blind retry occurs.
Reactions count against reply limits, and quote/reaction targets are scoped.

The core tests use synthetic data and callback-based fake handoff. They prove
local state invariants, not Baileys, real receipts, real media, phone typing or
model quality. No network transport, OpenRouter call or account pairing has run.

## Checks

From the project root:

- pnpm --filter @replybot/core typecheck
- pnpm --filter @replybot/core test

Both passed. Tests cover policy, privacy boundaries, budget limits, revisions,
confirmation expiry, SQLite restart, owner takeover, dispatch races, bounded
reaction accounting, unknown results and cross-account upsert protection.

## Remaining work

The backend and Expo client are subsequent slices. Secure production pairing,
HTTPS service identity, durable event replay, persistent source-linked memory
editing/deletion, retention workers, live sync/alias evidence and real media
encoding still need implementation or controlled verification. Do not claim v1
completion from this offline core. The live adapter and paid model remain off.

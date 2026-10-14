# Offline implementation

## Goal and current status

Run the accepted V2 light/dark client against a local service without opening
private WhatsApp chats, using paid APIs or sending real messages.
This is a runnable demo, not completed v1 coverage.

## Components and data flow

- `packages/core` owns contact policy, bounded context, source authorship,
  persisted drafts, owner confirmations, delegation and delivery accounting.
- `services/backend` exposes bearer-authenticated APIs on loopback, seeds
  synthetic chats and records assistant turns. Its default model and transport
  are fake.
- `apps/mobile` has Chats, Review, conversations, Assistant and Settings.
  It polls the service, displays local media fixtures and submits owner actions.
  Web uses session storage for the connection token; native uses SecureStore.
- `OpenRouterClient` can generate new text-only drafts when the owner starts
  the explicit OpenRouter command, supplies a backend key and grants consent.
  Keys never enter the client bundle. No real model request has run.

Draft generation captures the conversation workflow version before awaiting a
model. Consent revocation, takeover or new messages prevent stale results from
being saved. Concurrent requests with the same identifier share generation.
Assistant commands use the same draft path. Review and permission commands
do not call a model.

Approval persists outbox intent before simulated handoff. Restart recovery keeps
unknown results reserved instead of retrying. Typing requires an acknowledged
pause; manual sends keep control with the owner until confirmed resumption.
Reactions count as outbound units. Never-reply prohibits all AI access.

## Database

Node 24 SQLite stores validated JSON records with indexed account/conversation
metadata for chats, messages, drafts, grants, proposals, outbox, API idempotency
and assistant turns. This is a subset of the production schema.

`account_settings` adds an account-scoped `model_consent` boolean, false by
default. Changing consent invalidates pending AI work and revokes grants.
No model key is stored in this table. Runtime files remain in ignored
`.runtime/`; the owner token and demo database must not be committed.

## Verified evidence

- Workspace strict TypeScript checks pass.
- 23 core and 3 backend safety tests pass.
- Expo web export passes.
- Edge at a 390 by 844 viewport loaded the app and an isolated in-memory demo
  service. Connection, dark theme, draft approval, typing pause, manual send,
  explicit resumption confirmation and assistant review passed with no page
  errors.
- Screenshots are in ignored `.pi/takomi/ui-checks/`.
- OpenRouter transport tests use mock fetch only. The remote-drafting safety
  check uses a fake generator to cover consent, exclusion, duplicate requests,
  in-flight takeover and revocation without external calls.

The T3 preview tools timed out. Expo Go SDK 57 installed on the test emulator,
but an Android System UI ANR prevented useful device verification. The emulator
was stopped. Do not count this as a native pass.

## Remaining limits

The new live adapter implements pairing, direct-message history/events and
verified alias mapping. See Live_Integration.md for current evidence. Owner pairing,
real receipts, media encoding/understanding and phone typing interception remain
unverified or unfinished. Source-linked memory editing/deletion and retention workers are
not complete. Default browser success does not prove background execution,
native keyboard behavior, model quality or WhatsApp delivery.

The preview backend remains loopback-only. The live command permits authenticated
private-network access for Wi-Fi but is not safe for internet exposure. HTTPS identity and production pairing still need implementation.
`demo: true` remains true even when optional OpenRouter text drafts are selected
because the conversations and transport are synthetic.

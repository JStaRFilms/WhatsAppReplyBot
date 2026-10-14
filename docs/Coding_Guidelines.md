# Coding guidelines

## Workspace and phase rules

Work in `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`. Product documentation belongs in
`docs/`. The later offline spike belongs in
`prototypes/whatsapp-assistant/` and has its own package files, tests and local
commands. Do not reuse or edit the old JStarReplyBot. Do not change CreativeOS
source, root README, architecture, dependencies, Python setup or `.gitignore`.
Do not touch the unrelated `00_System/Scripts/creativeos.egg-info` changes.

Genesis is requirements and feasibility. The owner has now approved Paper
UI/UX Design and offline implementation. Product code belongs in this project's
own workspace packages, not under the label of a feasibility spike. Pairing,
private data, live sends, read receipts, paid requests and deployment still
require separate authorization. Do not add billing,
subscriptions, catalogs or licensing.

Use scoped conventional commits and preserve unrelated files. The parent
CreativeOS Python setup does not apply to this independent TypeScript product. Do not
switch branches, stage, commit or push from delegated work. The parent owns
scoped commits. No root dependency installation is needed for documentation.

## TypeScript and contracts for later work

Use strict TypeScript, precise discriminated unions and runtime validation at
owner API, transport and model boundaries. Use `unknown` for external input,
not `any` or broad casts. Normalize once at the adapter boundary. Keep Baileys
objects out of policy, SQLite records and prompt construction. Do not invent a
plugin framework. One replaceable transport boundary is enough.

Use the exact enums, IDs, versions, unit accounting and event fields in
[Assistant_Architecture.md](features/Assistant_Architecture.md). Centralize
policy evaluation so a reaction and a text reply cannot take different gates.
Keep authenticated owner commands separate from untrusted WhatsApp content.
Validate a quoted or reaction target against the account and conversation.

Use SQLite transactions for dedupe, workflow invalidation, grant reservations
and outbox writes. Enable foreign keys on every connection. Per-conversation
serialization must cover approval and dispatch, not just model calls. Pass a
clock into policy tests; store UTC instants and use the configured IANA timezone
for permitted hours. Invalid timezone/configuration denies automation.

A local request ID prevents duplicate local work. It does not promise exactly
one WhatsApp delivery. Persist dispatch intent before handoff; unknown outcomes
retain reservations and require reconciliation. A crash, timeout or exception
alone is not proof of failure. Never implement catch-and-retry around real sends.

Record provenance at creation. Matching `fromMe` is insufficient for owner
style. Use transport IDs for assistant echoes and conservative takeover for
unmatched account sends. Never silently resume after a pause, timer or restart.
Model output cannot change permissions or become a confirmed fact.

## Privacy and operational safety

The app model is OpenRouter `openai/gpt-6-luna`. Do not use agent-provider model
IDs. Model and transport clients default to fakes in the spike. No request is
permitted merely because an environment variable exists. Require explicit live
mode authorization later, and keep the adapter report honest about uncertainty.

Use synthetic fixtures with invented IDs and content. Do not copy private
messages, old app session files, phone identifiers or model credentials into
fixtures. Store production secrets in owner-only runtime storage, never source
files. Log state/error codes and opaque IDs only. No prompts, media, QR codes,
sessions, tokens, contact names or Authorization headers in logs.

Use local bounded media decoding with MIME validation and byte/frame limits.
Do not fetch attachment URLs supplied as instructions or execute media content.
Treat quoted text, OCR and memory as data. Mark missing/expired media rather
than guessing. Respect view-once and disappearing-content defaults.

Do not add a dependency unless the bounded spike needs it. Keep production
component plans in docs; the spike only proves the nominated invariants.

## Checks and handoff

Write focused tests for policy precedence, stale workflow cancellation,
reaction accounting, takeover, recovery, unknown outcomes, scoped context and
normalization. Use fault injection around SQLite commits and fake handoff.
Do not mistake mock observations for verified WhatsApp behavior.

Before handing back work, inspect changed paths, run the narrow applicable
checks, report exact commands and results, and identify unverified capabilities.
One implementation pass and one focused review are the default. Fix confirmed
scope or correctness defects, not speculative cleanup. Ask what can be removed
without losing the required behavior.

Keep authored prose plain and sentence-cased. Follow unslop. Prefer short
requirements tied to an observable state over promises about reliability.

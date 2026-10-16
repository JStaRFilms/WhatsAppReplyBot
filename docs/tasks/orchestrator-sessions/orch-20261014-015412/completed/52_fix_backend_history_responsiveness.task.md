# Task 52: Keep history processing and snapshot reads responsive

## Agent setup

### Workflow to follow
Build stage, coder persona, Takomi openai-codex/gpt-6.1-sol with high thinking. Required capability: write-code. This is a confirmed post-release correctness fix, not a new feature or redesign.

### Prime agent context
Every command must explicitly use `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`. The harness starts at C:/CreativeOS. Read this complete packet, `docs/issues/PC_Connection_and_Shutdown_0.1.3.md`, task51's packet, relevant source and focused existing history/adapter/shutdown tests. Primary source: `services/backend/src/whatsapp.ts` and `packages/core/src/store.ts`. Relevant callers: `services/backend/src/server.ts` and `packages/core/src/workflow.ts`. Preserve all existing release contracts.

### Optional overlays
Use unslop for the handoff. No design work or additional dependencies.

## Objective
Correct the demonstrated synchronous history-processing starvation and avoid sorting/scanning whole conversation histories for small paged reads. HTTP identity and owned-child shutdown must have an opportunity to run while a history batch is still processing. Existing clients should load snapshot data with less synchronous SQL work. Do not claim these source fixes prove the owner's exact earlier incident cause.

## Scope
- Add bounded real event-loop yielding to history/contact processing, preserving event ordering and stopped/sealed/generation/current-socket ownership across yields. A resolved promise is not an I/O yield. Consider both large single batches and consecutively queued events, but add only what the demonstrated path requires.
- Correct `historyRows` query planning using the existing `message_paging` index, without changing schema, persisted data or the alias/fencing/deduplication rules. The index is already created by the constructor. Prefer the smallest clear SQL change over an alternative history engine or snapshot cache.
- Add focused regressions for I/O/shutdown admission before batch completion, stale socket/sealed cancellation across a yield, and indexed limited-history correctness. Keep existing equal-time IDs, before/after/around paging, alias duplicates, rowid fences, source restrictions, unread and quote regressions passing.
- The normal source ownership is those two source files and focused test files. Touch server/workflow only if a concrete required defect cannot be corrected in those files, and explain before broadening.

## Context and evidence
Task51 is completed research. It used a fake socket, an actual WhatsAppAdapter plus createApp/manageServer in an owned subprocess, invented1000 existing plus500 incoming backfill messages, in-memory SQLite and an ephemeral listener. Identity checks timed out at2507ms and actual stopOwned timed out at15003ms while still waiting for stop acknowledgment. No matching phases had arrived. History finished at27625ms; an I/O timer first ran at27626ms; then gating through stopped arrived and the child exited0 normally. This matches the symptom pattern with correct authentication, but is not an observation of the owner's earlier process.

Its separate synthetic100-conversation/1000-message-per-conversation snapshot took9625ms and18612 SQL preparations. A query-only experiment using message_paging reduced a10000-message last-message query28.53ms to0.35ms with identical output, and another100000-message snapshot8911ms to1581ms. These are diagnostic measurements, not accepted thresholds or a validated patch.

The parent independently reproduced the underlying mechanism on unchanged7301e4b using `.runtime/pc-task51/parent-source-repro.mjs`:100 direct awaited receives over1000 invented stored messages took3853ms, and queued I/O did not run during that loop. EXPLAIN selected messages_conversation for the member scan with two sort steps, not message_paging. This parent diagnostic calls private receive directly, so if the correction yields in the outer listener instead, use the actual-listener regression for red/green rather than falsely treating the diagnostic loop as the fixed outer callback.

Parent separately performed exactly three owner-approved read-only metadata checks against the live PC. All returned200 in31/29/29ms. The saved owner token was accepted, root/protocol matched, desktop/history capabilities were present, and WhatsApp was disconnected at observation. The screenshot then showed127.0.0.1:3210/settings, discovery of Second account/completed transition, no loaded snapshot, a refresh error and repeated connecting feedback. This narrows the client stage, but no actual snapshot/chat read is authorized. The older promise-only batching limitation was amplified by the release's grouped-history work. No old-checkout complete benchmark was performed.

## Definition of done
- A focused deterministic test fails on the original code because I/O cannot run before a batch finishes, and passes with the corrected scheduler.
- Stop/seal or socket replacement during a yield prevents remaining stale work without replaying it later.
- Limited reads use the paging index with unchanged result semantics. Query-plan/correctness checks should not rely only on flaky wall-clock thresholds.
- Existing relevant core/backend tests and their typechecks pass. Report exact commands and results.
- Run an isolated synthetic HTTP/IPC or equivalent actual lifecycle demonstration showing responsive identity and acknowledged graceful shutdown during work. Fake services only, normal cleanup and no force-kill.
- Return the exact changed paths, red/green evidence, query-plan/scale observations, checks and limitations. Parent owns final acceptance and review.

## Expected artifacts
The narrow source diff, focused tests, and a handoff under `.runtime/pc-task52/`. Any synthetic scripts/logs/results go only there. Preserve task51 evidence and existing release/browser artifacts.

## Constraints
No actual env/owner-token/signing/auth/profile DB/chat/media/billing/general-runtime reads, live3210/8081/8083 requests, actual launcher/index startup, WhatsApp/OpenRouter calls, account changes, token rotation, lock deletion, forced shutdown, downloads, dependency changes, version metadata, app/mobile UI edits, icon work, Android build-copy or release artifact rebuilds. No commits, staging, push, nested agents or task/board edits. Keep consent/no-AI/privacy/physical alias identity, manual work, grants, unknown sends, paid-attempt markers and profile/socket isolation intact. Do not lengthen timeouts, weaken identity checks, remove ownership guards or introduce automatic retries/resumptions. Synthetic indexes/data must never be mistaken for permission to mutate real databases.

## Dependencies and review
Depends on task51's completed diagnosis and parent independent repro. One writer owns source files. Parent will run new tests against original source and corrected source, review this scoped diff once, and decide any later browser validation/build rollout. No new generic audit of the prior release.

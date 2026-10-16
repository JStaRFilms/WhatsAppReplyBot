# Task 53: Fix continued refresh hangs with a sparse, many-contact profile

## Agent setup

Build stage. Coder persona, Takomi openai-codex/gpt-6.1-sol high. Required capability write-code. Every command must explicitly use `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`; the harness starts in C:/CreativeOS. Read this whole packet, `docs/issues/PC_Connection_and_Shutdown_0.1.3.md`, task52 and relevant source/tests first. Apply unslop to reports.

## Objective and scope

The owner still cannot load either client after restarting. Correct the remaining snapshot/startup synchronous bottleneck for thousands of conversations and aliases with relatively few messages. The dense100-conversation benchmark used for52 missed the actual data shape. First reproduce that shape with invented data, then make the smallest measured correction.

Owned source: `packages/core/src/store.ts`, `packages/core/src/workflow.ts`, `services/backend/src/server.ts`, plus focused new core/backend tests. Preserve52's working scheduler and index hint. Parent owns all actual-service diagnostics, other source files, source acceptance, commits and artifacts. No parallel source writer owns your files.

## Evidence

Task52 is committedcae2642, with484 tests/types and dense200000-message/100-conversation browser acceptance. It fixed real scheduler/query defects, but the user's actual problem remains. Current listener PID72132 started2026-10-16T03:22:24.847Z, aftercae2642's03:18:39Z commit. Thus do not simply assume the owner failed to restart. Fresh local session and LAN health requests both timed out after4seconds. Current full cause is not yet accepted.

The owner explicitly authorized routine local testing/diagnosis/fixes without repeated approval questions and said the app data is not sensitive. The parent used a read-only SQLite connection to derive ONLY aggregate active-profile shape. You must NOT read the actual files yourself. Reproduce these counts with invented fixtures:

-3437 persisted conversations.
-3115 exact alias mappings.
-1657 messages across345 conversations, maximum275 messages in one conversation, mean4.8.
-135 outboxes and166 drafts.
-Zero duplicate transport IDs across the account.

The parent suspects repeated `historyGroup` calls and all-conversation scans, alias lookup by canonical without an index, `effectiveConversations`, `historyVersions`, `lastMessages`, and repeated snapshot assembly. This is a hypothesis to measure, not a mandate to patch every function. Do not pursue duplicate unread work as the actual trigger; current aggregate duplicate count is zero.

## Completion criteria

1. Reproduce and profile snapshot latency/SQL work on an invented sparse fixture at this scale, and compare the currentcae2642 path with the correction. Include real app/lifecycle HTTP behavior or a controlled equivalent, not only a tiny helper benchmark.
2. Remove the confirmed repeated/unbounded work without hiding empty legacy conversations, truncating legitimate data, deleting rows, guessing identities, releasing holds or weakening policy. Keep API output semantics and physical alias/source/outbox/request identities.
3. Prefer request-local reuse/bulk queries to a persistent or cross-request authority cache. No new framework or broad rewrite. A schema/index change needs explicit explanation and focused documentation; avoid one if a small query/projection correction is sufficient.
4. If yielding during snapshot assembly, preserve coherent per-source/current-scope/policy data. Never keep a write transaction open across awaits. Cancellation/shutdown must not replay work or return a misleading successful authoritative snapshot.
5. Add deterministic regressions that fail oncae2642 and pass after correction, covering sparse many-contact scaling structurally where possible and existing history, policy/manual/unknown/expiry/view-once protections.
6. Run relevant serialized core/backend suites and types. Demonstrate prompt metadata and graceful owned-child stop under the sparse fixture. Retain a dense-history case so52 does not regress.
7. Return exact changed paths, original/corrected evidence, measured limitations and a handoff under `.runtime/pc-task53/`. Parent performs independent source-original checks and one focused review.

## Constraints

Use invented fixtures, in-memory/temp SQLite, fake models/sockets and ephemeral ports only. No actual profiles.json/database/env/token/auth/chat/media/signing/runtime reads, real3210/8081/8083 probes, actual launcher/index startup, real WhatsApp/OpenRouter calls, sends, paid quota, restarts, locks, force-kills, account changes, data cleanup, downloads, dependencies, app/UI/icon/version/APK/build-copy changes. Do not commit, stage, push, launch agents or edit tracking/docs packets. Only own new task53 synthetic artifacts may be read. No larger timeouts, polling/backoff workarounds, automatic mutation retries or invalidation bypass.

## Deliverables and dependencies

Depends on52 and the new owner report, not on re-running a generic release audit. Deliver a narrow diff, focused regressions and diagnostic handoff. The parent will continue until the actual refresh failure is resolved or a concrete operational blocker remains; do not claim synthetic success alone resolves the owner's running instance.

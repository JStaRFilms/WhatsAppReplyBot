# Task34: Plan the owner-added release gate

## Agent setup

Persona architect, existing project Build planning. Canonical root:
C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot.
Use explicit cwd/absolute paths. Read scoped instructions, Coding_Guidelines.md,
features/Release_Gate_Extension.md, Daily_Use_Batch_1_Contract.md, current feature
and requirements docs, completed28–31 and the actual source/types/tests. Use unslop.

## Objective

Define the narrow implementation and review plan for the owner's added nonblocking
send UX, truthful WhatsApp receipt ticks, opt-in contact-book display names and
automatic AI em-dash replacement with comma plus space, and one editable owner
instructions prompt per WhatsApp profile.
Do not treat the existing original-baseline review32 as acceptance of new work.

## Scope

Record the owner's selected WhatsApp-first/minimal phone-name sync across Android
and PC, with the current permitted contact name available to AI. The described
Android-and-PC option conditionally permits SDK-compatible Expo Contacts if needed;
confirm exact version/target, prefer existing WhatsApp data, never install during
this docs-only task. Add the requested simple per-profile owner instructions field. Inspect current
composer busy guards and perform/refresh sequencing, durable request/outbox/transport
bindings and receipt events, contact-name ingestion, native/web storage and build
constraints. Locate one typed AI prose boundary for punctuation normalization
before draft persistence/review/send, without mutating owner/source text or IDs.
Resolve intent ordering, pending/unknown UX and monotonic scoped receipt correlation.
Choose the minimum supported contact permission/data flow, owner-prompt storage/API
revisioning, context budgeting and in-flight/old-draft invalidation semantics.
Reuse selected UI and prior safety logic. No product code changes in this task.

## Definition of done

User choices are recorded without assumptions. Authored plan states the required
interfaces/data flow/schema changes if any, interaction/status semantics, source
ownership, dependencies, focused tests, privacy constraints, rollback and remaining
hardware checks. New implementation packets have real scopes and completion
criteria. Include focused punctuation tests and validation after replacement.
Release33 is explicitly blocked on implementation and its focused review.

## Expected artifacts

A bounded feature/contract update and self-contained implementation/review packets
in this existing session. Record exact delegation IDs once launched. Preserve
prior findings, accepted source and all existing authored guidance.

## Constraints

No .env/auth/SQLite/signing/token or actual address-book reads. No live backend,
WhatsApp action, phone input, model/image quota, service control or final build.
Dependency installation needs the owner's explicit choice and a confirmed target.
No SDK/toolchain installs. Keep pending/unknown accounting, grants, consent, holds,
profile isolation and visible app unread distinct from WhatsApp read receipts.
No new design direction or Batch2 context work. Parent owns commits and integration.

## Dependencies and verification

Contact/source/privacy choice is recorded in Release_Gate_Extension.md. Review32
returned one P2; parent reproduced and fixed Assistant read-feedback persistence in
dc99aa6. All93 mobile tests and mobile types pass. Earlier parent250 workspace
tests/types and132 browser checks passed before that narrow fix. None proves native
mic/keyboard or real receipt/contact behavior. No implementation writer launches
before this scoped plan is ready. Missing incoming messages were separately reported
as an unproven ingestion issue, not permission to run live diagnostics or repair it.

## Execution

Completed docs-only with Takomi openai-codex/gpt-6.1-sol, thinking medium.
T3 task ID: `node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-release-extension-plan-20261015-r1`.
Client request ID: otherme-release-extension-plan-20261015-r1.
Scope and contact/AI choices are recorded. Parent owns source, master plan, board,
task status and commits. Architect authors the bounded implementation plan and
new36+ packets only.35 remains the separate pending ingestion investigation.

## Parent acceptance

Authored plan/contracts and36/37/38 packets are committed as c33e479. Parent made
one simplification pass: replace chunk/staging imports with one scoped bounded
atomic POST, preserve exact request-ID reconciliation, and retain the already
approved C:/Otherme-build target/caches rather than require a nonexistent copy.
These corrections precede code launch and are authoritative in the updated plan.

The installed Expo SDK nominates ~57.0.7; public registry metadata confirms exact
expo-contacts57.0.7 exists with MIT license and the expected Expo/React/RN peers.
No package was installed. Native public API/permission verification and confirmed
canonical install target remain gates before37 installs.36 has no dependency need.
Markdown whitespace checks pass. No product checks are claimed for docs-only work.
Implementation order is36 backend/core,37 client,38 integrated review,33 release.

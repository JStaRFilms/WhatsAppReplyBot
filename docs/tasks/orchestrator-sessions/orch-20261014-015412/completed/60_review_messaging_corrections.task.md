# Task 60: Review the combined messaging correction once

## Agent setup
### Workflow to follow
Build correction within existing session orch-20261014-015412. Canonical persona reviewer. Read-only focused review.
### Prime agent context
Project root: C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot
Every command must cd to this exact root or use absolute paths. The delegated harness starts in C:/CreativeOS.
Read docs/features/Messaging_Corrections_0.1.4.md and this packet first. Then docs/features/Messaging_Corrections_0.1.4.md; .runtime/ui-task56/handoff.md; .runtime/ui-task57/handoff.md; .runtime/ui-task58/handoff.md; .runtime/ui-task59/handoff.md; parent verification evidence when supplied.
### Skill overlays
Use unslop for all user-facing copy and handoff prose. The owner explicitly requests unslop-gpt-ui for this round. Load that skill and read C:/Users/johno/.agents/skills/unslop-gpt-ui/references/examples.md before copy remedies. Delete no-value explanations instead of replacing each with a tooltip. Trace actual visible/accessibility states and shared callers; retain decision-critical facts at the decision point and use only existing suitable relocation destinations. The copy pass does not itself authorize behavior or layout changes; the separate reported functional defects in this packet do. Follow existing native/component patterns and the approved UI references.

## Objective
Review the combined messaging correction once in response to the owner's new real-use feedback, preserving working nonblocking composition and all existing safety constraints.

## Scope
Read-only review of the56-59 combined diff against the owner's reported failures and Messaging_Corrections_0.1.4.md. No code, tracking, staging, commits, live/private/device/model requests or nested agents.

## Context
Review after parent focused tests and all implementation handoffs, not an open-ended audit. Check native DOM/lifecycle crash paths; quiet picker cancellation without recording resumption; real immediate target reaction and reconciliation; component/echo deduplication; Latest/automatic newer and visible-only IDs; stable editor/newer composition; truthful icon receipts/unknown/send gating; understandable copy with material consent still explicit; ASR context and no duplicate paid attempts. Prior source/browser tests missed physical-native failures, so identify missing native-runtime assumptions without claiming device proof.

## Definition of done
Write .runtime/ui-task60/review.md with only confirmed blocking correctness/security/requirement issues, precise file/line/evidence, test limits, and explicit acceptance/hold recommendation. Do not turn style preferences, unrelated defects or speculative abstractions into requirements.

## Expected artifacts
.runtime/ui-task60/review.md with focused findings and acceptance.

## Constraints
Preserve unrelated and uncommitted work, including the55 packet move. No staging/commit/push, tracking/session/requirements/version/package-lock edits by delegates. No nested agents. No real3210/8081/8083, private DB/media/auth/env, paid/model/send, account/relink/reset, device manipulation, service restart/kill/lock deletion, native build/copy or dist promotion by implementers. Synthetic temp SQLite and owned ephemeral servers only. No automatic mutation/paid retry, lost unknown accounting, widened consent, changed identities or stale source authority. No new dependency or speculative refactor. Preserve failed evidence and distinguish source/synthetic/browser/native/physical results.

## Dependencies
56, 57, 58, 59

## Verification and handoff
Start with focused failing-before/passing-after regression tests, then relevant existing checks/types. Report exact commands/results and unresolved blockers. Parent owns combined browser validation, review acceptance, versioning, commit and release.

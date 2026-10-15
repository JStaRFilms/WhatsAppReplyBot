# Review the integrated daily-use batch

## Agent setup

Persona reviewer, Takomi Sol High for the integrated boundary. Read-only,
requiredCapabilities=[]. Canonical root: C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot. Read approved
Daily_Use_Batch_1_Contract.md, plan, functional handoffs and actual diff/tests.
Do one focused review after28–31, not recursive style review.

## Objective and scope

Check confirmed correctness/security/requirement regressions across microphone
attempt/focus/permission lifecycle, keyboard persistence and late-send text cleanup,
foreground read-only resync and error recovery, truthful PC/profile/WA/AI state,
profile/QR identity, startup/shutdown ownership/drain, static browser asset serving
and responsive/native behavior. Actual physical mic remains owner acceptance.

## Definition of done

No confirmed unresolved blocking defect. Evidence-backed findings name exact
paths/scenarios. Verify saved credential reuse only for unchanged host, no mutation
retry or false unknown-send success, no QR/token leak or poll-driven viewer popup,
no path traversal/dotfile/API static fallback and no captured released native object.
Ensure successful read refresh doesn't erase unrelated action failures. New typing
during pending upload/send isn't cleared by old completion; keyboard manual hide,
scope change and actual app departure are respected. Keep all previous consent,
never-reply, holds, exact confirmation, source expiry, actual-visible unread and
unknown accounting. No new receipt/sync/hardware claims from synthetic results.

## Expected artifacts

Read-only final report with confirmed blockers or clean acceptance and limitations.
Report tests actually run. No edits/builds/live API/real data/phone actions.

## Findings already resolved before this review

-28 dd49d77 preserves input identity/edit revisions and queries granted permission
before requesting it. Parent41 focused tests passed, but real busy/hold/snapshot
rerenders did not reproduce the owner's microphone cancellation. No hardware root
cause or successful recording is claimed.
-30 9da586d initially missed29's optional capability query. Parent added the
`?capabilities=1` request and preserved404 upgrade classification. The new
regression failed before the fix, then all87 mobile tests/types and60 core tests
passed. Plain session discovery deliberately omits metadata for older strict
protocol2 clients.
-29's first static-host exemption used only a raw API-prefix check. A synthetic
encoded API request bypassed authentication. Parent fixed classification using
both the raw URL and matched route. The new regression failed before, then70
backend tests,29 packaging tests and backend/core types passed. Verify the fix
still denies encoded GET/HEAD without auth and missing/stale scoped reads, while
public assets and the authenticated app still work. None of this code was released
or exercised against the real account during validation.

These findings are responses for this first integrated review, not invitations to
expand scope. No unresolved source blocker is known at this handoff. Native device,
Windows viewer and original intermittent startup incident remain acceptance limits.

## Dependencies and execution

28–31 integrated and source diff available; parent provides exact baselines,
prior findings/responses and unresolved objections in each delegated round. Use a
new review task ID per T3 round. Not launched yet.

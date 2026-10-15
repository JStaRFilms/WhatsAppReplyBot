# Task 49: Diagnose and fix canceled thumbnail availability

## Agent setup

Takomi Coder, Sol High, Build. Required capability is write-code. Use canonical root
`C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`
for every command. Read local coding guidelines and use unslop. Parent owns docs,
tracking, decisions, commits and release. Do not launch another agent or review.

Prime context is `docs/issues/Thumbnail_Cancellation_Availability.md`, current44,
completed47/48, history/photo and video handoffs, actual media component/cache/API
code and focused tests. Read r3/handoff.md plus run-004 and supplements-003 failure
evidence and preserved verify-run-004/005.cjs. Only documented synthetic ui31/ui37/
ui44 and public source may be read under runtime.

## Objective

Find the actual cause of recorded visible thumbnail Retry after cancellation, then
make the smallest proven correction. Diagnosis comes first. A passing random rerun
or a hypothesis alone does not justify source edits. Product35cba0c is unchanged;
no other source writer or browser agent is active. Full44 has88 primary passes and
seven supplemental passes, but still records two genuine availability failures.

## Evidence and scope

Both failures had a physically visible image, correct4502 content coordinates and
nonpending geometry. Metadata was available and replacement preview bytes valid.
One occurred before busy recorder stubs; another after a registered old content
request was held, canceled offscreen and replaced on return. The12second readiness
deadline expired on Retry. No privacy denial, CSS change or network/browser error.
The acquire error/invalid handle cause was not recorded. Capture that evidence.

Primary owned source is apps/mobile/components/media-attachment.tsx,
apps/mobile/lib/media-cache.ts and focused mobile tests/fixtures. If an existing
caller in app-state.tsx or api.ts is proved to cause cancellation, a minimal fix
with a failing-before regression is allowed. Do not redesign the request layer.
No scroll/editor, backend, schema, dependency/config/lock/version/native changes.
No docs/status/master/board writes, stage/commit/push or final builds.

Write new synthetic artifacts only under `.runtime/ui-task44/fix49/`. Preserve all
r3 and fix48 evidence. Copy runners safely, not from a truncated read string.
All outputs need unique names that refuse overwrites. Parent reproduction probe
is r3/parent-probe.cjs; it wraps public cache acquire/release only in fake contexts.
Its timing may alter the race, so do not treat it as production code or a cure.

Parent reproduced a separate fixture overclaim: replacing a valid handle may make
a new Blob URI. Three unmodified isolated runs had two passes and one URI-only
failure. Eight instrumented diagnostic runs passed availability, observing canceled
old rejection, released handle and valid new handle, slots0 before replacement.
URI identity is not a product requirement. Replace that diagnostic-only assumption
with assertions of current valid source, valid bytes/lease and no stale publication.
Do not erase the original assertion/failure or label it the recorded Retry defect.

## Implementation constraints

Capture the current acquire rejection or invalidation and source/activity/abort/
publication ownership. Do not dump client credentials, private data or full runtime.
Use bounded tests and deterministic fake timing to expose a confirmed cause, not
an endless rerun-until-green loop. Consider promise resolution versus React commit/
cleanup, cancellation ownership and late shared-task completion, but these are leads.
Do not make speculative changes merely because a race seems possible.

Each handle, pending task, reservation and resource must have a clear current owner.
Old cleanup cannot release or replace a new handle. Canceled consumers must not
poison fresh visible acquisition. Keep all caps and shared consumers intact; no
unbounded requests, global retry framework or automatic retry of real unavailable,
denied, expired, view-once or wrong-scope sources. No paid/send/model replay.
A visible current authorized source should recover from lifecycle cancellation
without an unnecessary manual tap. Preserve actual-visible unread and video/audio
pause/detach-before-release rules. Never bypass visibility or lease validation.

## Verification and deliverables

Add a focused regression that fails before and passes after the diagnosed fix.
Run focused tests, serialized mobile tests and workspace types. Export from
apps/mobile using the existing credential-isolating wrapper, desktop mode and
max-workers2 to `../../.runtime/ui-task44/fix49/web`. Any source edit after export
requires a new export before claiming browser proof.

Use registered held-old preview content, offscreen cancellation and current-source
replacement. Check current photo remains usable after old completion, correct
source/bytes and no stale publication, rather than identical Blob URI. Preserve
actual12second readiness, real source rectangles and3px anchor/editor bounds.
Repeat the real cancellation scenario and normal pre-stub recorder opening a small
bounded number with error/handle tracing and separate outputs. Test genuine
revoke/denial/expiry and fresh handle cleanup, not only the successful path.

Return exact cause, changed paths, red/green regression and fresh browser evidence,
commands, counts and remaining limits under fix49/verification.json or handoff.md.
If unable to capture or prove a cause, return the bounded findings and real blocker
rather than invent a patch. Parent handles acceptance and subsequent44/38/33.

## Safety

Only invented APIs/scope/token/media, ephemeral loopback listen0 and full API mocks;
block external origins and trap device APIs. No3210/8081/8083. Use existing local
Sharp/FFmpeg fixtures and installed Node/Playwright/Edge only. Close owned browser
and server in finally, no persistent watchers. No full decoder suites during export.
No real.env/DB/auth/token/signing/contact/message/media/log/billing/runtime outside
approved synthetic directories, live API/model/WhatsApp/service/profile/phone,
mic/gallery/camera/permissions/OS viewer, paid/image quota, dependency/SDK/toolchain/
license/model downloads, outside writes or final desktop/APK builds. No native,
actual receipt, secure-erase or real incident root-cause claims.

# Task 48: Correct warm reopening, editor anchors and foreground photo recovery

## Agent setup

Takomi Coder, Sol High, Build. Required capability is write-code. Canonical root:
`C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`.
Every command must explicitly use this root. Read its coding guidelines and use
unslop. The parent owns docs, tracking, commits, metadata and release.

Prime context:
- `docs/issues/History_and_Foreground_Reopen_Blockers.md`
- `docs/issues/Photo_Visibility_After_History_Reflow.md`
- Completed packet 47 and current packet 44, especially its round 2 instructions.
- Cached history/photo and foreground video handoffs, cached chat/draft contract.
- `.runtime/ui-task44/r2/handoff.md`, `evidence-summary.json` and runner code.
- Actual scroll, conversation, media component/cache/provider and focused tests.

Task 44 round 2 is terminal and partial. No other source writer is active. Current
product is `eb8a242`, with 440 serialized source/packaging tests and all types passing.
The owner directs completion of the approved round and confirmed scoped fixes,
without routine approval stops. Do not start any agent or generic review.

## Objective

Correct all four normal-use failures independently reproduced by the parent:
wrong warm-reopen viewed IDs and missing photo, cached focused editor losing its
position after source arrival, clean responsive source-anchor loss, and foreground
photo recovery requiring Retry. Preserve source authority and stable controls.

## Source and artifact scope

Own `apps/mobile/lib/conversation-scroll.ts`,
`apps/mobile/app/conversation/[id].tsx` and focused mobile tests/fixtures.
Only if required by a diagnosed foreground defect, also own
`apps/mobile/components/media-attachment.tsx`, `apps/mobile/lib/media-cache.ts`
and `apps/mobile/lib/app-state.tsx`. These additional files are not cleanup targets.
A change there needs a focused failing-before regression of the real failure.

For integrated reproduction, write only `.runtime/ui-task44/fix48/` using a copied
runner, fresh preview export and invented fixtures. Preserve all r1/r2/parent data.
No docs, master, board, source tests outside scope, API/backend/policy/schema,
package/lock/native/version or final build changes. Do not stage, commit or push.

## Evidence and constraints

Warm source356 actual content y4502 was recorded as9004. The app posted inbound
310/311/313/314/315 while actual visible inbound sources were357/358/359. Parent
reproduced both warm failures from the unmodified preview. Saved/requested offsets
are not observed scroll positions. Inspect real supported RN measurement/ref
contracts and event timing. Do not load every media row or treat mounted IDs as seen.

A clean responsive sequence390 to360 to1280 to390 loses offsets by72 and144px.
Keep the last coherent ID/offset across reflow, including native scroll adjustments.
Do not recapture an anchor from old rows combined with new offsets or dimensions.

A cached draft editor starts at y350 while both source GETs are held. Its same
focused node and text survive, but it ends at y908 after source arrival. Preserve
its actual editor viewport position, not merely the source row or card presence.
Do not remount the input, dismiss the keyboard or hide the editing draft.

Foreground photo recovery failed in both round 2 and the parent run. Retry uses
cached bytes and current metadata successfully. Diagnose activity epochs, canceled
read maps, current handle publication and provider foreground ordering. Automatic
scoped metadata reads are allowed, never mutation or paid retries. Do not weaken
leases, expiry/delete/view-once, profile/service isolation, audio ownership, caps,
background stop or no-auto-resume. Late canceled work must not delete or replace
new current pending entries. Do not swallow genuine unavailable errors into loops.

The forced DOM CSS-height stress is diagnostic, not a separate request to support
arbitrary styles. Fix normal source arrival, width/viewport and route/foreground
behavior. Retain explicit Latest and real visible 600ms acknowledgment rules.
Keep all existing cached draft concurrency, pending send, scope and privacy guards.

## Definition of done and verification

Focused tests must fail before and pass after, including a restored nonzero offset
with real scroll arriving asynchronously, source or editor anchor reflow, old
callbacks after scope/page/scroll changes, and canceled-old/current foreground
read coalescing if implicated. Use actual method contracts, no broad casts.

Run isolated browser cases against your new fix48 preview: photo-cache, cached-draft,
resize-clean and photo-foreground. Preserve their assertions, including actual
source intersections captured synchronously at viewed POST time and editor delta
within3px. Prove foreground acquisition succeeds without an explicit Retry and no
extra image binary request. Repeat the intermittent foreground transition a bounded
few times after the first correct diagnosis. No dependency on arbitrary extra waits.
The original copied fixture's selectors or output paths may be repaired, but no
product requirement may be relaxed. No original r2 artifact overwrite.

Run focused tests, then all serialized mobile tests and workspace types. Report
exact changed paths, cause, red-to-green evidence, commands/results and limitations.
A source-only green result is not browser acceptance. Return any genuine blocker
with a reproduction, not a speculative cleanup or routine permission question.
Parent independently checks, commits and owns fresh44 r3 plus combined38 and33.

## Execution

Running Takomi Sol High, sole source writer, after terminal partial 44 r2.
T3 task ID is
`node:delegated-task:command%3Amcp%3A73c03ce5-b336-44e9-b7ac-b1c24f448a93%3Adelegate-task%3Aotherme-reopen-geometry-and-foreground-fix-20261015-r1`.
Client request ID is `otherme-reopen-geometry-and-foreground-fix-20261015-r1`.
The MCP instance prefix changed; use this exact returned ID, not the older 1c6 prefix.
Completed and parent accepted as `35cba0ce1a0ecda1af056d8f872feed87ea94f9b`.
Parent reviewed the diff and verified all eight source/test and 28 export hashes.
Parent serialized checks passed 94 core, 109 backend, 217 mobile and 29 packaging,
total 449, plus all types and diff checks. The four isolated browser cases passed
27 checks in separate parent output folders with zero failures or unexpected/errors.

Confirmed causes are saved-offset double counting, recapturing anchors from mixed
old/new geometry, unstable focus callback plus insufficient last-row trailing room,
and old canceled foreground reads coalescing with new reads. Actual content origin,
last coherent anchors, stable focus and measured editor space fix the first three.
Current pending-entry identity and cancellation ordering fix foreground recovery.
No product correction was needed after parent inspection. No backend, dependency,
version or native setting changed. No generic review or release acceptance yet.

Task 44 round 3 follows on the frozen commit. Review 38 and build 33 remain held.

## Preview and safety

Use installed Node, pnpm, Playwright1.64 and Edge only. Export from apps/mobile with
`EXPO_PUBLIC_DESKTOP=1 node ../../scripts/mobile-node.cjs node_modules/expo/bin/cli export --platform web --output-dir ../../.runtime/ui-task44/fix48/web --max-workers 2`.
Every source change after export needs a new export before claiming browser proof.
All mocked APIs and harmless local media, loopback listen0, no3210/8081/8083.
Intercept every API and block outside origins. Trap device APIs. Close own browser
and server in finally. No persistent watchers or full decoder suites during export.

No real environment, DB, auth, token, signing, contacts, messages, media, logs,
billing or unapproved runtime reads. Only documented synthetic ui31/ui37/ui44 may
be read. No real API/model/WhatsApp/service/device/permissions/recording/gallery/
OS viewer operations, quota, SDK/toolchain/dependency/model/license downloads,
outside writes or final desktop/APK builds. No physical root-cause claims.

Original r2 raw results were overwritten by the parent's first two reruns. Its
handoff, evidence-summary and browser log retain the original partial run. See
r2/parent-repro/README.md. Do not attribute its current raw file to69 checks or
change the original manifest to conceal that. Your fresh fix48 evidence is separate.

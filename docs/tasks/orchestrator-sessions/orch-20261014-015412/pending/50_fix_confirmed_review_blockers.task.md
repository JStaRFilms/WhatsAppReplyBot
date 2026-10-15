# Task 50: Correct the two confirmed review38 blockers

## Agent setup

Takomi Coder, Sol High, Build. Required capability is write-code. Every command must
use canonical root
`C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`.
Read local coding guidelines and use unslop. Parent owns docs, tracking, commits,
review decisions and artifacts. No agents or generic review. Product is24539121.
No other source writer is active. Owner directs the full approved round and these
confirmed fixes without routine approval questions. Do not expand scope.

Prime context is docs/issues/Release_Review_38_Findings.md, current38 and completed
49/44, media/photo handoffs and release extension name/alias contracts. Read actual
media-viewer and thumbnail ownership, WhatsApp canonical/contact/receive handlers,
Workflow.verifyAlias, SqliteStore.saveWaAlias and relevant tests first.

## Source ownership

Own only apps/mobile/components/media-viewer.tsx,
services/backend/src/whatsapp.ts, apps/mobile/test/media-viewer.test.cjs,
services/backend/test/release-extension.test.ts and, if needed, one existing focused
history-media test. A minimal fixture adjustment is allowed. Do not change core
schema/workflow/store unless a confirmed constraint makes that unavoidable; report
the concrete need before expanding. Existing aliases can persist without chats.

No cache/thumbnail/scroll/editor/request-layer refactor, new helpers/framework,
API/schema, dependency/config/lock, native/version, docs/master/board/status or Git
stage/commit/push. Write synthetic evidence only under .runtime/ui-task44/fix50/,
preserving every existing parent repro and earlier runtime artifact.

## P2 viewer ownership

After acquire resolves, MediaViewer stores the handle only in queued state. Closing
before another React layout commit leaves no release owner, leaking the sole viewer
slot. Reviewer proved it with fake hooks and actual MediaCache. Parent unchanged
component also fails, releases0 rather than1. See parent-viewer-red.cjs.

Apply the minimal committed/uncommitted ownership pattern already proved in49.
The acquiring effect owns handles until layout commit. A committed ref preserves
existing detach-before-release cleanup and idempotence. Cover unmount after resolve
before commit, close/render before passive cleanup with late acquisition, scope
change and repeated opening. No pixels after revocation, no double accounting or
leaked slot. Video's own working cleanup is not an invitation to refactor it.

## P2 contact observation

canonical() always creates the phone conversation when given phone and LID. Contact
upsert/update/history contacts and lid-mapping events therefore create unrelated
inbox entries even with names disabled. Parent repro on empty in-memory store shows
savedNames=false, conversationCount1 and mapping present with no message. Existing
no-chat test has no alternate ID and misses the bug. See parent-contact-red.mjs.

Persist exact trusted alias observation without materializing unrelated chats.
Preserve message-driven conversation creation and later use of mappings learned
before the first message. With real existing LID history, canonical creation/join
may still be required by Workflow.verifyAlias. Keep its policy/manual/unknown holds
and physical IDs, source epochs, explicit resume and ASR/source authority behavior.
No deleting existing chats, schema changes, guessed identities or auto generation.
Use existing canonical/verifyAlias/store behavior rather than new identity machinery.

Regression coverage must include paired upsert/update and contacts-only history,
names off/on, remembered mapping used by later genuine synthetic message, and an
existing LID history alias learned through contact observation. Retain already
resolved same-mapping projection/manual accounting and owner/socket isolation tests.
No actual Baileys socket start, pairing or real auth access. Reuse fake event fixtures.

## Definition of done

Add focused failing-before/passing-after tests for both findings. Existing viewer
committed detach, video, private cache and source revocation tests remain. Run
focused mobile and backend release/history tests first, then serialized full mobile
and backend tests and all workspace types. No parallel FFmpeg deadline churn or
assertion/timeout weakening. Parent independently runs broader checks and commits.

If useful, create a fresh approved synthetic preview at fix50/web using existing
credential-isolating wrapper from apps/mobile, desktop1 and max-workers2. Re-export
after any final source edit. Use narrow real photo open/close/reopen/video transition
checks and current-source/no stale URI rules, not arbitrary Blob URI identity.
Core event regression is sufficient for no-chat behavior; do not use live accounts.
Return exact changed paths, causes, red/green logs/commands/counts and limitations.
No new generic review; these are the two confirmed findings from the one combined38.
Parent verifies responses, closes blockers and owns version/verifier/source freeze33.

## Execution

Running Takomi Sol High as sole source writer. Parent reproduced both P2 findings
before dispatch. T3 task ID is
`node:delegated-task:command%3Amcp%3A73c03ce5-b336-44e9-b7ac-b1c24f448a93%3Adelegate-task%3Aotherme-confirmed-review38-fixes-20261015-r1`.
Client request ID is `otherme-confirmed-review38-fixes-20261015-r1`.
Review38 is blocked on these responses;33/version/verifier freeze remains held.

## Safety

Only public source and approved synthetic ui31/ui37/ui44, invented profile/account/
contact/messages/token/media and test-managed temporary SQLite/ports. No3210/8081/
8083. Intercept all browser APIs and block outside origins; trap device APIs and
close owned browser/server in finally. No watchers or full decoders during export.
Use installed Node/tsx/pnpm/Playwright/Edge/Sharp/FFmpeg only, no downloads/installs.
No real.env/DB/auth/session/token/signing/book/message/media/log/billing/runtime,
model/WhatsApp/API/service/profile/phone/mic/camera/gallery/permissions/OS viewer/QR,
paid quota, toolchain/SDK/licenses/weights, outside writes or final desktop/APK build.
Do not claim native/hardware/physical incident proof. No agents/Git/docs/status writes.

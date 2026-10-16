# Task63: Fix draft gesture geometry and covered-source viewing

## Agent setup
Canonical Takomi coder; Build focused correction. Every command explicitly cd to C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot. Read this packet, docs/features/Messaging_Corrections_0.1.4.md and .runtime/ui-task62/handoff.md first. Prime context: apps/mobile/components/draft-card.tsx; apps/mobile/lib/conversation-scroll.ts; apps/mobile/app/conversation/[id].tsx; apps/mobile/components/pause-controls.tsx; apps/mobile/test/ui57-conversation.test.cjs; docs/features/Cached_Chat_and_Draft_Opening.md; docs/issues/History_and_Foreground_Reopen_Blockers.md.
Use unslop and unslop-gpt-ui/examples for user-facing text and evidence claims. Do not edit unrelated copy.

## Objective
Correct the two demonstrated runtime62 blockers without changing what Save means or weakening privacy/revision checks.

## Scope
Single product writer for apps/mobile/components/draft-card.tsx, apps/mobile/lib/conversation-scroll.ts, apps/mobile/app/conversation/[id].tsx, and PauseControls only if a narrow existing-dialog visibility callback is needed; focused uniquely named ui63 tests. No backend/cache/receipt/permission semantics, native config, version, locks, release/tracking/old evidence edits.

## Context
Frozen4a9257d0.1.4 browser evidence: .runtime/ui-task62/handoff.md, focused-diagnostics-001.cjs, overlay-diagnostic-001.cjs, attempt-003/results.json and attempt-005/results.json. Save mouse pointer-down at y480 blurs editor; editor and button move225px before pointer-up; pointer-up hits another message, no decision POST. Keyboard Enter posts once with captured revision2/409 and preserves edits. Likely immediate editor-space/follow change on editor blur, but reproduce and confirm. Save is genuinely save-only: server decision operation edit calls flow.editDraft and returns outbox:null. Do not rename it Send, approve it, or change its mutation semantics. Keep the actual completed gesture, captured revision, text, node/focus and server conflict safeguards; never submit on pointer-down, use arbitrary sleeps or restore keyboard focus secretly. Geometry may need separate edit-session versus actual-focus bookkeeping, but choose the smallest correct fix. Check scrolling away after blur, closing/unmounting editing, navigation/profile change and no old cleanup revoking a newer editor.
Reaction Modal opening permits an already-scheduled app-view POST while overlay:true. Current timer only excludes media viewer, not selected message. Cancel pending timer synchronously at opening and fence the callback with current overlay/scope state, not only a stale render/effect closure. Cover the existing conversation-owned reaction/permissions/pause dialogs consistently where the same proven path applies, with narrow plumbing rather than a new modal framework. Resume only after dialog closes and actual sources settle for600ms; no hidden, covered, stale geometry or WhatsApp read calls. Do not hide ordinary reaction feedback or reintroduce duplicate bubbles.
Parallel read-only64 investigates two other intermittent observations against the original immutable web export. It must not write product files. Do not fix speculative auto-newer/cache problems or overlap its output.

## Definition of done
Failing-before regressions and narrow existing checks/types pass; real newly built browser mouse Save stays within prior3px tolerance from down to up and makes exactly one save-only decision using captured revision, conflict keeps text; no viewed POST while reaction/related owned dialogs cover sources, including pending timer opening race, close/background/scope cases. Actual viewport/editor geometry, no invented recovery, no permission/send/provider operation. Preserve source/node/keyboard/newer composition and lifecycle.

## Expected artifacts
.runtime/ui-task63/handoff.md, uniquely named before/after logs and real-browser evidence under ui63; scoped source/test diff only.

## Constraints
No stage/commit/push, nested agents, current dist promotion, native/build-copy/dependency/version/schema changes, private DB/env/auth/media, real3210/8081/8083, provider/payment/WhatsApp send, device/permission/contact/gallery/mic operation, service restart/kill/lock deletion. Invented fixtures, owned ephemeral servers/browser contexts only, closed in finally. Never kill unrelated processes. Preserve all62 attempts and frozen rejected manifest; new output directories for each attempt. No automatic mutation or paid retry, source identity rebinding, unknown release, hidden-source app-view, revived recording/playback or arbitrary waits/caps/tolerance changes.

## Dependencies
62's4a9257d browser candidate is blocked and must not be released.63 writes only its assigned product files while64 investigates old immutable browser bytes. Parent61 integrates results, freezes a new explicitly named manifest and revalidates before any APK build.60's static source review is not browser acceptance.

## Verification and handoff
Demonstrate original failure then focused tests and fresh actual-browser correction, not just a keyboard workaround. Report exact commands/files/results/limits. No physical/provider success claim.

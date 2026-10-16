# Task 56: Fix native media opening and picker cancellation

## Agent setup
### Workflow to follow
Build correction within existing session orch-20261014-015412. Canonical persona coder. Implement the approved correction, not a product redesign.
### Prime agent context
Project root: C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot
Every command must cd to this exact root or use absolute paths. The delegated harness starts in C:/CreativeOS.
Read docs/features/Messaging_Corrections_0.1.4.md and this packet first. Then apps/mobile/components/media-viewer.tsx; apps/mobile/components/video-playback.tsx; apps/mobile/components/voice-composer.tsx; apps/mobile/lib/foreground.ts; apps/mobile/test/lifecycle-harness.cjs; docs/features/Voice_Notes.md; docs/features/Foreground_Video_Handoff.md; docs/issues/Thumbnail_Cancellation_Availability.md.
### Skill overlays
Use unslop for all user-facing copy and handoff prose. The owner explicitly requests unslop-gpt-ui for this round. Load that skill and read C:/Users/johno/.agents/skills/unslop-gpt-ui/references/examples.md before copy remedies. Delete no-value explanations instead of replacing each with a tooltip. Trace actual visible/accessibility states and shared callers; retain decision-critical facts at the decision point and use only existing suitable relocation destinations. The copy pass does not itself authorize behavior or layout changes; the separate reported functional defects in this packet do. Follow existing native/component patterns and the approved UI references.

## Objective
Fix native media opening and picker cancellation in response to the owner's new real-use feedback, preserving working nonblocking composition and all existing safety constraints.

## Scope
Sole writer for apps/mobile/components/media-viewer.tsx, media-attachment.tsx, video-playback.tsx and .web.tsx, voice-composer.tsx, attachment-picker.tsx, apps/mobile/lib/voice-recorder.ts and .web.ts, media-cache.ts and audio-clip.ts only when required, and focused uniquely named tests. Read other sources but do not edit conversation/[id].tsx, app-state.tsx, message-bubble.tsx, outgoing-status.tsx, draft-card.tsx or settings. No backend/native-build edits.

## Context
Photo, sticker and video opening crash the installed0.1.3, while ordinary voice playback and image sending work. A concrete shared risk is MediaViewer's useEffect checking only typeof window before window.addEventListener; native can expose window without DOM event methods. Reproduce this native environment before deciding what it proves about the actual crash. Examine SDK/lifecycle paths for any further demonstrated crash rather than hiding exceptions. Picker cancellation currently increments operation when active becomes false and finally emits Audio setup was cancelled during audio picker: app left the foreground. Intentional picker activity must not be treated as unexpected recorder interruption. Retain cancellation for route/profile change, no auto-resume, native object cleanup ordering and current-source media gates. Shorten viewer titles/footer/codec copy and use compact visual loading; do not fake download progress. An image-only picker must not silently accept unsupported video as a photo. Do not add video sending. Preserve VoiceComposer's existing public API for57.

## Definition of done
Native-like viewer opening/closing and revocation tests reproduce old failure and pass after; repeated photo/sticker/video paths own/release resources; normal picker cancel and valid return are quiet, cross-scope late results discarded, recording interruption never restarts; media loading/copy is concise and honest; focused existing audio/media tests and mobile typecheck pass. Report physical validation limits.

## Expected artifacts
Scoped source/test diff; .runtime/ui-task56/handoff.md with root cause, exact files, before/after results, test commands and unproven device/provider limitations.

## Constraints
Preserve unrelated and uncommitted work, including the55 packet move. No staging/commit/push, tracking/session/requirements/version/package-lock edits by delegates. No nested agents. No real3210/8081/8083, private DB/media/auth/env, paid/model/send, account/relink/reset, device manipulation, service restart/kill/lock deletion, native build/copy or dist promotion by implementers. Synthetic temp SQLite and owned ephemeral servers only. No automatic mutation/paid retry, lost unknown accounting, widened consent, changed identities or stale source authority. No new dependency or speculative refactor. Preserve failed evidence and distinguish source/synthetic/browser/native/physical results.

## Dependencies
Existing accepted0.1.3 and f0efbe3 PC fixes; shared correction contract.56-59 are parallel nonoverlapping writers. Shared API changes require parent coordination.

## Verification and handoff
Start with focused failing-before/passing-after regression tests, then relevant existing checks/types. Report exact commands/results and unresolved blockers. Parent owns combined browser validation, review acceptance, versioning, commit and release.

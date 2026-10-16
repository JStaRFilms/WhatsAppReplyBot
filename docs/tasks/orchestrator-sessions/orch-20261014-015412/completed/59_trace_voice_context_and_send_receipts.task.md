# Task 59: Trace voice-note context failures and real send delays

## Agent setup
### Workflow to follow
Build correction within existing session orch-20261014-015412. Canonical persona coder. Implement the approved correction, not a product redesign.
### Prime agent context
Project root: C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot
Every command must cd to this exact root or use absolute paths. The delegated harness starts in C:/CreativeOS.
Read docs/features/Messaging_Corrections_0.1.4.md and this packet first. Then services/backend/src/draft-model.ts; services/backend/src/audio.ts; services/backend/src/openrouter.ts; services/backend/src/whatsapp.ts; packages/core/src/context.ts; docs/features/Voice_Notes.md; docs/features/Economical_ASR_Handoff.md; docs/features/PC_Refresh_Performance.md; docs/features/Release_Extension_Implementation_Plan.md.
### Skill overlays
Use unslop for all user-facing copy and handoff prose. The owner explicitly requests unslop-gpt-ui for this round. Load that skill and read C:/Users/johno/.agents/skills/unslop-gpt-ui/references/examples.md before copy remedies. Delete no-value explanations instead of replacing each with a tooltip. Trace actual visible/accessibility states and shared callers; retain decision-critical facts at the decision point and use only existing suitable relocation destinations. The copy pass does not itself authorize behavior or layout changes; the separate reported functional defects in this packet do. Follow existing native/component patterns and the approved UI references.

## Objective
Trace voice-note context failures and real send delays in response to the owner's new real-use feedback, preserving working nonblocking composition and all existing safety constraints.

## Scope
Backend/core sole writer only for confirmed causes in services/backend/src/openrouter.ts, audio.ts, draft-model.ts, reply-window.ts, whatsapp.ts, whatsapp-normalize.ts, server.ts and packages/core/src/context.ts, workflow.ts, store.ts/contracts.ts only when strictly necessary, plus uniquely named focused tests. No mobile, native, actual config/data or release/tracking writes. Avoid speculative changes and new schemas.

## Context
Owner says AI receives voice notes as audio attachments, asks someone to listen/interpret them through an unavailable interaction, and never actually reads their content. Trace eligible incoming audio ingestion -> readableAudio -> source/consent -> ASR HTTP request/parse -> durable reuse/unknown -> prepared context -> generated reply. draft-model currently catches transcription exceptions and continues without explaining a failed step; inspect why and distinguish legitimate ineligibility, suppression, uncertainty, protocol failure and missing context. There has been no new actual Whisper paid acceptance; don't claim this from fake tests. Public provider docs/status metadata are allowed, but no actual key/provider/voice/file request or paid test. Parent may publish narrowly redacted runtime metadata in .runtime/ui-task59/parent-audio-metadata.json; read it if present, otherwise report exact aggregate queries/needed fields for parent. Existing approved ASR scope is at most2 recent eligible incoming notes, not all historic/outgoing audio. Do not broaden export or add paid retry/fallback to mask failure. Preserve unknown/suppressed markers, no-AI/consent/expiry/source checks and transcript role/budget. Missing audio must not become fabricated understanding or an automatic recipient-facing request to operate internal tooling. Investigate real send/receipt delay separately from status-text annoyance: verify actual reaction transport sends a reaction, not an extra text; ensure genuine status evidence isn't lost/raced/queued behind avoidable work. Do not use accepted sendMessage/HTTP as synthetic receipt, invent delivery/read, raise deadlines, or alter cooldown/grants for speed. Change only demonstrated defects and report if further runtime data is needed.

## Definition of done
Reproduced failure and before/after tests for confirmed fix, full fake-ASR pipeline proves eligible transcript reaches reply context and reuse blocks duplicate payment, unavailable/unknown outcomes handled truthfully without a bogus normal reply, permissions/source constraints remain. Fake adapter tests validate reaction payload and any real receipt-race correction. Record configured-provider/quality/live-send limits and concrete parent diagnostic needs. Focused core/backend tests/types pass. No actual model/send/service/account operation.

## Expected artifacts
Scoped source/test diff; .runtime/ui-task59/handoff.md with root cause, exact files, before/after results, test commands and unproven device/provider limitations.

## Constraints
Preserve unrelated and uncommitted work, including the55 packet move. No staging/commit/push, tracking/session/requirements/version/package-lock edits by delegates. No nested agents. No real3210/8081/8083, private DB/media/auth/env, paid/model/send, account/relink/reset, device manipulation, service restart/kill/lock deletion, native build/copy or dist promotion by implementers. Synthetic temp SQLite and owned ephemeral servers only. No automatic mutation/paid retry, lost unknown accounting, widened consent, changed identities or stale source authority. No new dependency or speculative refactor. Preserve failed evidence and distinguish source/synthetic/browser/native/physical results.

## Dependencies
Existing accepted0.1.3 and f0efbe3 PC fixes; shared correction contract.56-59 are parallel nonoverlapping writers. Shared API changes require parent coordination.

## Verification and handoff
Start with focused failing-before/passing-after regression tests, then relevant existing checks/types. Report exact commands/results and unresolved blockers. Parent owns combined browser validation, review acceptance, versioning, commit and release.

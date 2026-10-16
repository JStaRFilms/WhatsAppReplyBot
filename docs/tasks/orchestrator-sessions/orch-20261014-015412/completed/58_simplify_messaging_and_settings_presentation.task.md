# Task 58: Replace technical UI clutter with compact messaging controls

## Agent setup
### Workflow to follow
Build correction within existing session orch-20261014-015412. Canonical persona coder. Implement the approved correction, not a product redesign.
### Prime agent context
Project root: C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot
Every command must cd to this exact root or use absolute paths. The delegated harness starts in C:/CreativeOS.
Read docs/features/Messaging_Corrections_0.1.4.md and this packet first. Then apps/mobile/components/outgoing-status.tsx; apps/mobile/components/message-bubble.tsx; apps/mobile/components/draft-card.tsx; apps/mobile/components/release-settings.tsx; apps/mobile/app/(tabs)/settings.tsx; docs/design/Otherme_UI_States.md; docs/features/Daily_Use_Batch_1_Contract.md; docs/features/Release_Extension_Implementation_Plan.md.
### Skill overlays
Use unslop for all user-facing copy and handoff prose. The owner explicitly requests unslop-gpt-ui for this round. Load that skill and read C:/Users/johno/.agents/skills/unslop-gpt-ui/references/examples.md before copy remedies. Delete no-value explanations instead of replacing each with a tooltip. Trace actual visible/accessibility states and shared callers; retain decision-critical facts at the decision point and use only existing suitable relocation destinations. The copy pass does not itself authorize behavior or layout changes; the separate reported functional defects in this packet do. Follow existing native/component patterns and the approved UI references.

## Objective
Replace technical UI clutter with compact messaging controls in response to the owner's new real-use feedback, preserving working nonblocking composition and all existing safety constraints.

## Scope
Sole writer for apps/mobile/components/outgoing-status.tsx, message-bubble.tsx, draft-card.tsx, release-settings.tsx, profile-controls.tsx, whatsapp-connection.tsx, pause-controls.tsx, permission-sheet.tsx, apps/mobile/app/(tabs)/settings.tsx, review.tsx and assistant.tsx only for this UI correction, plus focused uniquely named tests. Do not edit conversation/[id].tsx or app-state/history/pending libraries owned57, or media/voice/picker files owned56. No backend/core/native/version/build/tracking edits.

## Context
Owner wants clock pending, one genuine sent tick, two delivered ticks, blue read ticks, not Sending/Dispatching/Accepted by transport/Awaiting WhatsApp acknowledgment paragraphs. Use a stable compact slot beside timestamp where possible, accessible labels and touch-accessible details, with real unknown/failed/cancelled distinctions and simulation honesty. Keep OutgoingStatus existing receipt/simulated props and add optional deliveryState: pending|failed|unknown|cancelled for57. No false tick from accepted outbox/HTTP/local optimism. OutboxStatus must retain useful content for its shared Review/Assistant callers.57 owns removing duplicate bodies and standalone reaction bookkeeping in its chat caller. Coordinate through the existing API; do not globally erase meaningful action descriptions. Keep existing MessageBubble props; don't mistake normal emoji text or target Message.reaction metadata for a reaction event to remove. Suppress known generic attachment placeholder prose only where an actual media presentation replaces it, never a real caption. Cached draft source-loading warnings need brief ordinary words while source/revision/privacy gates remain unchanged and known editable body remains immediate. Remove routine model reason and transport/domain prose from main flow; expose real blocking reason/help only where actionable. Settings screenshot shows paragraphs about OpenRouter, source authority, permissions, storage and codec internals. Apply the six unslop-gpt-ui decisions to actual display sites and states. Delete irrelevant work explanations without inventing a replacement reassurance or a new Details panel. Relocate only into an existing suitable accessible destination. Keep provider identity, external-AI data categories/costs and permission breadth beside the actual consent decision, but remove repeated disclosure from unrelated instructions/help. Do not silently change AI/contacts/profile choices. Do not claim Local preview simply because snapshot/profile is not yet accepted. Retain explicit Continue and meaningful account identity. Keep charcoal/blue/light hierarchy and native tap targets, not a visual redesign.56 owns its own viewer/recorder copy;57 owns conversation inline copy.

## Definition of done
Focused tests verify icons/real receipt levels, pending/unknown/failure/simulated behavior and stable ordinary layout, no duplicate outbox body, no routine internal strings in main UI, editable known draft source gates still enforced, provider/privacy info accessible without permanent prose and consent unchanged. Existing focused component/settings/draft tests and mobile types pass. Write .runtime/ui-task58/copy-decisions.md with bounded screen/state coverage, display site/original text, evidence, decision and user-purpose reason, plus any deferred facts. Supply screenshots or precise browser acceptance selectors if available; no private/live access.

## Expected artifacts
Scoped source/test diff; .runtime/ui-task58/handoff.md with root cause, exact files, before/after results, test commands and unproven device/provider limitations.

## Constraints
Preserve unrelated and uncommitted work, including the55 packet move. No staging/commit/push, tracking/session/requirements/version/package-lock edits by delegates. No nested agents. No real3210/8081/8083, private DB/media/auth/env, paid/model/send, account/relink/reset, device manipulation, service restart/kill/lock deletion, native build/copy or dist promotion by implementers. Synthetic temp SQLite and owned ephemeral servers only. No automatic mutation/paid retry, lost unknown accounting, widened consent, changed identities or stale source authority. No new dependency or speculative refactor. Preserve failed evidence and distinguish source/synthetic/browser/native/physical results.

## Dependencies
Existing accepted0.1.3 and f0efbe3 PC fixes; shared correction contract.56-59 are parallel nonoverlapping writers. Shared API changes require parent coordination.

## Verification and handoff
Start with focused failing-before/passing-after regression tests, then relevant existing checks/types. Report exact commands/results and unresolved blockers. Parent owns combined browser validation, review acceptance, versioning, commit and release.

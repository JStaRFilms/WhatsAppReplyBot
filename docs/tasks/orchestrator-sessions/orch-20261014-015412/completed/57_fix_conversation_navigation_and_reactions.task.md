# Task 57: Fix Latest, reaction feedback and pending conversation rendering

## Agent setup
### Workflow to follow
Build correction within existing session orch-20261014-015412. Canonical persona coder. Implement the approved correction, not a product redesign.
### Prime agent context
Project root: C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot
Every command must cd to this exact root or use absolute paths. The delegated harness starts in C:/CreativeOS.
Read docs/features/Messaging_Corrections_0.1.4.md and this packet first. Then apps/mobile/app/conversation/[id].tsx; apps/mobile/lib/conversation-scroll.ts; apps/mobile/lib/history-cache.ts; apps/mobile/lib/pending-intents.ts; apps/mobile/lib/message-reactions.ts; docs/features/Cached_Chat_and_Draft_Opening.md; docs/issues/History_and_Foreground_Reopen_Blockers.md; .runtime/ui-task44/fix50/verify-browser.cjs.
### Skill overlays
Use unslop for all user-facing copy and handoff prose. The owner explicitly requests unslop-gpt-ui for this round. Load that skill and read C:/Users/johno/.agents/skills/unslop-gpt-ui/references/examples.md before copy remedies. Delete no-value explanations instead of replacing each with a tooltip. Trace actual visible/accessibility states and shared callers; retain decision-critical facts at the decision point and use only existing suitable relocation destinations. The copy pass does not itself authorize behavior or layout changes; the separate reported functional defects in this packet do. Follow existing native/component patterns and the approved UI references.

## Objective
Fix Latest, reaction feedback and pending conversation rendering in response to the owner's new real-use feedback, preserving working nonblocking composition and all existing safety constraints.

## Scope
Sole writer for apps/mobile/app/conversation/[id].tsx, apps/mobile/lib/conversation-scroll.ts, history-cache.ts, pending-intents.ts, conversation-control.ts, message-reactions.ts and app-state.tsx only as needed, plus focused uniquely named tests. No viewer/voice/attachment components owned56; no message-bubble/outgoing-status/draft/settings components owned58; no backend/core changes.

## Context
Latest is broken on native and browser. pageHistory currently awaits history.latest before scrolling; verify actual path and fix, not just a renamed button. Automatically page newer near the end with existing bounds/cancellation and no manual Load newer requirement. Preserve accurate measurements, anchors/editor focus, settled visible-only IDs and unread. chooseReaction currently enqueues OwnerAction reaction but pending rows render it as an ordinary outgoing emoji/message with Preparing/Sending/Accepted by transport, then OutboxStatus repeats its content. Put local owner reaction feedback on the target before backend completion and reconcile by immutable request/scope and actual server evidence. Do not suppress legitimate ordinary emoji text, confuse Message.reaction target-badge metadata with reaction event rows, or remove ledger records. No standalone reaction bookkeeping bubble. AI reaction components also belong to their actual target. Render each pending text/media component once; keep a stable recognizable voice/image placeholder through upload/echo, deduplicate accepted echo, do not persist private media URI/bytes in the journal or invent a playable asset. Remove routine Pause acknowledged footer, dispatch bookkeeping and cached-authority warnings from this file.58 supplies icon OutgoingStatus with optional deliveryState pending|failed|unknown|cancelled, existing props intact. Existing MessageBubble accepts Message.observedReactions; project an optimistic observation without changing its required interface. Trace intermittent disabled-send conditions and ordinary refresh versus real authority blockers before changing gating. Do not allow stale/cross-profile/unknown-lane sends or replay. Keep composing during ongoing sends.

## Definition of done
Old failure reproduced in focused tests; warm cached Latest visibly jumps before a held GET, cold/latest races bounded and correct, newer rows load without a routine manual button, no premature viewed IDs; reaction appears on target before held mutation and handles accepted/failure/unknown/scope change without extra bubble or duplicate real send; pending text/audio/image display once with icon statuses; ordinary read refresh does not unnecessarily freeze send; prior editor/keyboard/history/pending-intent tests and mobile types pass. Supply real-browser test hooks/fixture notes for parent rather than source-only claims.

## Expected artifacts
Scoped source/test diff; .runtime/ui-task57/handoff.md with root cause, exact files, before/after results, test commands and unproven device/provider limitations.

## Constraints
Preserve unrelated and uncommitted work, including the55 packet move. No staging/commit/push, tracking/session/requirements/version/package-lock edits by delegates. No nested agents. No real3210/8081/8083, private DB/media/auth/env, paid/model/send, account/relink/reset, device manipulation, service restart/kill/lock deletion, native build/copy or dist promotion by implementers. Synthetic temp SQLite and owned ephemeral servers only. No automatic mutation/paid retry, lost unknown accounting, widened consent, changed identities or stale source authority. No new dependency or speculative refactor. Preserve failed evidence and distinguish source/synthetic/browser/native/physical results.

## Dependencies
Existing accepted0.1.3 and f0efbe3 PC fixes; shared correction contract.56-59 are parallel nonoverlapping writers. Shared API changes require parent coordination.

## Verification and handoff
Start with focused failing-before/passing-after regression tests, then relevant existing checks/types. Report exact commands/results and unresolved blockers. Parent owns combined browser validation, review acceptance, versioning, commit and release.

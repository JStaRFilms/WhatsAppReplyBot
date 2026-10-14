# 15 reactions presence and sequences

## Objective and scope

Core/backend only. Fix real-client reaction event ingestion, replace the tiny emoji enum with validated single Unicode emoji, add optional paced text_sequence actions and guarded typing presence. Expected artifacts are packages/core and services/backend code/tests, required manifest/lockfile only; no mobile writes.
Read docs/features/Chat_Interaction_Fixes.md for the complete shared contract and
owner constraints. Target only this independent project; parent cwd is not target.

## Execution

Takomi Coder, openai-codex/gpt-6.1-sol high.
node:delegated-task:command%3Amcp%3A36cd3de2-212d-491d-91d3-c8b1673a0759%3Adelegate-task%3Aotherme-paced-replies-20261014-r1

## Implementation result

Core/backend coder returned complete. Faithful reaction event shapes handle omitted
chat and PN/LID aliases without owner inference from target. SingleEmoji supports
fire/family/skin/flag. text_sequence reserves the entire batch and has cancellable
five-second gaps, per-component quotes and restart cancellation. Presence is leased
to the verified socket/turn. Components optionally add quotedMessageId,
delayAfterPreviousMs and dueAt. Workflow.dispatch adds signal/check, constructor
sleep injection and onChange subscription. ReplyWindow adds lifecycle callback.
58 core and 41 backend tests/types passed. No mobile/docs/live edits or sends.
Parent combined verification and focused review are pending.

Focused review execution:
node:delegated-task:command%3Amcp%3A36cd3de2-212d-491d-91d3-c8b1673a0759%3Adelegate-task%3Aotherme-interaction-review-20261014-r1

## Final verification

One focused combined review found a pending-media inactivity race in the composer.
Parent fixed operation invalidation and carried guards through native/web startup;
late picker/recording clips are discarded. Three regressions passed. Native release
ordering remains preserved. Final workspace checks: 121 tests, typechecks,
Android/web exports and diff checks passed. Real device presence/reactions and
microphone remain owner checks. Authenticated outbox had zero queued, dispatching or unknown entries. Parent
verified the exact backend process and project launcher before restart, left Expo
untouched and reconnected the saved WhatsApp session. Scoped commit follows.

## Done and artifacts

Requested behavior implemented with the smallest clear diff, focused regressions
and relevant typechecks passing. Report exact changed interfaces, checks and any
confirmed blocker. No commits, real sends, paid/private model diagnostics, live
restart or unrelated changes. Parent performs final integration and one review.

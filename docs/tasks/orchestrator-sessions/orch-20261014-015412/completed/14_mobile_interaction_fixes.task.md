# 14 mobile interaction fixes

## Objective and scope

Mobile only. Fix sibling keys, mic/send/stop placement, acknowledged Resume state, reaction observation rendering and sequence previews. Expected artifacts are apps/mobile code/tests; no backend/core/lockfile writes.
Read docs/features/Chat_Interaction_Fixes.md for the complete shared contract and
owner constraints. Target only this independent project; parent cwd is not target.

## Execution

Takomi Coder, openai-codex/gpt-6.1-sol high.
node:delegated-task:command%3Amcp%3A36cd3de2-212d-491d-91d3-c8b1673a0759%3Adelegate-task%3Aotherme-mobile-interactions-20261014-r1

## Implementation result

Mobile coder returned complete. History/voice keys are scoped; right action switches
Mic/Send/Stop. Audio import moved to attachments. A new control method applies
acknowledged state without full-snapshot latency, with epoch/account/version guards.
Actor observations drive grouped reactions; fire/picker/custom emoji are exposed.
Sequence previews are ordered, and editing explicitly flattens into one reply.
19 mobile tests, mobile typecheck and web/iOS/Android exports passed. No code outside
apps/mobile was changed. Combined workspace verification/review is still pending.

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

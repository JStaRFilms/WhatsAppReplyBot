# Microphone cancellation and chat keyboard lifecycle

## Agent setup

Persona: coder, Takomi Sol High. Stage: Build of the owner-approved plan.
Canonical root: C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot. All commands explicitly cd there or use absolute paths.
Read docs/features/Daily_Use_Batch_1_Contract.md, Daily_Use_UX_and_Continuity_Plan.md,
Coding_Guidelines.md, selected design/state handoffs and current source/types/tests.
Use unslop for human-facing copy. Do not modify code before understanding its path.

## Objective

Reproduce the reported granted-permission cancellation, check permission before asking, preserve genuine cancellation. Keep keyboard open through send/history/quote, restore only appropriate unfinished same-chat focus and protect newer composer revisions from accepted-send cleanup.

## Scope and ownership

apps/mobile/lib/voice-recorder.ts, components/voice-composer.tsx, app/conversation/[id].tsx, lib/conversation-scroll.ts, components/draft-card.tsx and new/focused tests. Only this slice owns these files while parallel work runs. Do not edit
other slices, docs or release version files. New helpers/tests only when cohesive.
No git commit/stage/push; parent integrates and commits reasonable chunks.

## Definition of done

Synthetic regressions for permission/setup stages, parent rerenders, navigation and app background/return, released native objects, keyboard retention/manual hide/quote/return and typing during a pending accepted/unknown send. Mobile tests/types pass. Report exact changes and hardware limits. No physical mic claim.

## Expected artifacts

Narrow owned source/test diff, focused test evidence and final handoff with paths,
interface changes, any blockers and unverified owner-device behavior. No private
runtime evidence, credentials or content copied into tests/logs.

## Constraints

The shared contract is authoritative. No live API/services/accounts/model/phone
operations, actual recording/sending, private DB/auth/key reads, SDK/dependency
installs or outside-project writes. Normal test-managed temporary/cache files are
allowed; use isolated ports and synthetic IDs. Preserve unrelated/concurrent work.
Do not retry blocked/cancelled launches or force recovery. No broad cleanup.

## Dependencies and review

28/29/30 may run in parallel with this exclusive ownership. Contract changes in29
must be reported before frontend integration; 30 consumes optional fields safely.
31 visual integration follows owned functional changes. One focused parent review
checks confirmed correctness/security/requirement blockers, then source freeze and
one desktop/APK release. Do not claim success from mocks as hardware proof.

## Execution

Running as a T3-owned task with Takomi Sol High.
Task ID: `node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-mic-keyboard-batch1-20261015-r1`.
Implementation returned and parent accepted this source slice for integration.
Parent reran the41 focused audio/interaction/scroll/composer-lifecycle tests and
mobile typecheck successfully. The lifecycle harness now runs effect dependency
cleanup and layout-before-passive teardown. Busy/hold/snapshot rerenders did not
reproduce the physical cancellation; repeated permission requests were removed
without claiming a device-proven root cause. Permission queries, cancellation
stage/reason, editable/focused send, guarded edit revisions, quote focus, manual
hide and same-chat restoration have synthetic regressions.

Owned source: conversation/[id].tsx, voice-composer.tsx, voice-recorder.ts,
conversation-scroll.ts, new composer-focus.ts and focused audio/interactions/
keyboard-scroll/composer-lifecycle/lifecycle-harness tests. No other slice's files,
release metadata, live data or service was changed by this coder.

Physical record/playback/keyboard acceptance remains pending in the integrated
candidate. This completes the implementation handoff, not the owner's hardware
issue. Parent owns source-scoped commit and integrated review/release.

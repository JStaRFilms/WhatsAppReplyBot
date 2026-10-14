# Task 08: Model and chat UX fixes

## Scope

Fix the provider failure, newest-message opening, status prefixes that obscure
previews and repeated mode/resume/limit dialogs. Keep copy short. Preserve
never-reply, bounded grants, stale confirmations and uncertain-send safety.

## Implementation

Provider rejected oneOf in the schema with HTTP 400. The request now uses a strict
object envelope with action/anyOf and validates returned actions. A paid synthetic
request succeeded. No private conversation was used for that diagnostic.

Backend history/previews are timestamp ordered. Initial scroll opens at newest;
subsequent updates only follow near the bottom. Colored badges replace prefixes.
A configure proposal combines mode, explicit resumption and limits under one
confirmation. Global consent remains separate; unchanged consent is a no-op.
Settings/permission buttons show progress and reject repeated presses.

## Verification and review

30 focused safety tests and strict typechecks pass. Edge against isolated
synthetic data verified newest-message positioning, clean previews and combined
configuration. Native physical-device scrolling still needs owner feedback.

Read-only Reviewer via Takomi, openai-codex/gpt-6.1-sol medium, found no confirmed
blockers. T3 task ID:
node:delegated-task:command%3Amcp%3A86dc010a-802e-4fbf-92bb-5c634accd4ed%3Adelegate-task%3Areplybot-ux-model-review-20261014-r1

# Backend profile lifecycle and scoping

## Completion

Parent integrated the approved fixes. The review's discovery-revision P1 was fixed
with a create/return regression. All 177 tests, typechecks and actual APK signature,
version, embedded-bundle and privacy checks passed for 0.1.1/code2. The original
0.1.0 and private release key are preserved. No live account switch was performed.
Owner updates the APK and restarts the launcher, then confirms the chosen profile.
QR/device verification remains an owner action. Unrelated designer/contact-memory
documents are preserved and excluded from the commit.


## Objective and scope

Own packages/core, services/backend and launcher scripts/start-otherme.mjs + launcher-service.mjs and focused tests. No mobile/packaging scripts/docs/runtime writes.
Owner approved explicit separate-account switch and old-profile preservation, fresh
AIoff target, same-owner repair, and current safe-area/inbox fixes. Read feature
Account_Switching.md, Account_Switching_Plan.md and Account_Profile_API.md fully.

## Execution

Takomi Coder openai-codex/gpt-6.1-sol high:
node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-profile-backend-20261015-r1

## Implementation result

Coder returned exact sharedDTOs, atomicregistry/journal/separateDBs/scopeadmission,
suspensionandrepair; protocol2launcherboundedIPC verifiedexitrestart/recovery;
adapterstartup/shutdown/stalecredentialcallbackguards. Core/backendtypes and
60core/56backend/11launchertests passed. No mobile/runtime/credentials/commits.
Parent combinedreview and signed update are pending.

## Deliverables and done

Smallest coherent scoped implementation following exact shared DTO/routes. Focused
synthetic tests for A/B sameJID and A-B-A revision isolation, queued/unknown/active
handoff safety, correct-owner repair and stale async media/UI rejection. Relevant
typechecks/tests pass. No live credentials/data/service mutations, scans/sends,
paid/private models, commits or unrelated designer work. Parent handles one review,
API integration, signed update and real transitions onlyafterownerconfirmation.
Report precisefiles/interfaces/checks/confirmedlimitations. No speculative scope.

# Mobile profile-bound sessions and Settings controls

## Completion

Parent integrated the approved fixes. The review's discovery-revision P1 was fixed
with a create/return regression. All 177 tests, typechecks and actual APK signature,
version, embedded-bundle and privacy checks passed for 0.1.1/code2. The original
0.1.0 and private release key are preserved. No live account switch was performed.
Owner updates the APK and restarts the launcher, then confirms the chosen profile.
QR/device verification remains an owner action. Unrelated designer/contact-memory
documents are preserved and excluded from the commit.


## Objective and scope

Own apps/mobile API/app-state/root layout/WhatsApp settings UI/tests and app.json version0.1.1/code2. Preserve task20 tabs/inbox/chat-row changes. No core/backend/launcher/lockfile/docs/runtime writes.
Owner approved explicit separate-account switch and old-profile preservation, fresh
AIoff target, same-owner repair, and current safe-area/inbox fixes. Read feature
Account_Switching.md, Account_Switching_Plan.md and Account_Profile_API.md fully.

## Execution

Takomi Coder openai-codex/gpt-6.1-sol high:
node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-profile-mobile-20261015-r1

## Implementation result

Mobile coder returned: discovery-first binding, immutable scoped headers/client
revocation, revision-safe remounts and explicit Continue. Confirmed create/return/
repair controls use bounded readonly polling with no mutation retries. Focused
local-draft disposal/write races fixed. App0.1.1/versionCode2, ID/signing unchanged.
45 mobile synthetic tests, typecheck and diff checks passed. Task20/designer work
preserved. No runtime/build/keys/commits/live actions. Parent integration/review
and signed update are pending.

## Deliverables and done

Smallest coherent scoped implementation following exact shared DTO/routes. Focused
synthetic tests for A/B sameJID and A-B-A revision isolation, queued/unknown/active
handoff safety, correct-owner repair and stale async media/UI rejection. Relevant
typechecks/tests pass. No live credentials/data/service mutations, scans/sends,
paid/private models, commits or unrelated designer work. Parent handles one review,
API integration, signed update and real transitions onlyafterownerconfirmation.
Report precisefiles/interfaces/checks/confirmedlimitations. No speculative scope.

# Task24: Account profile integration, review and signed update

## Completion

Parent integrated the approved fixes. The review's discovery-revision P1 was fixed
with a create/return regression. All 177 tests, typechecks and actual APK signature,
version, embedded-bundle and privacy checks passed for 0.1.1/code2. The original
0.1.0 and private release key are preserved. No live account switch was performed.
Owner updates the APK and restarts the launcher, then confirms the chosen profile.
QR/device verification remains an owner action. Unrelated designer/contact-memory
documents are preserved and excluded from the commit.


## Scope

One focused review of tasks21/22 and bounded task20 fixes, then parent integration
and updated signedAPK0.1.1/code2. Shared plan/API docs are authority. Preserve legacy
data/known owner lock, inactive account isolation, scoped requests, no stale UI/local
media/drafts afterprofilechanges, safehandoff/unknown accounting and verifiedrestart.

## Execution

Takomi Reviewer openai-codex/gpt-6.1-sol high:
node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-profile-review-20261015-r1

## Parent integration checks

Initial combined workspace typecheck and176tests passed:60core,56backend,45mobile,
15packaging. No realaccount switching or testsends. Parent release scripts now
targetOtherme0.1.1/code2 and preserveold0.1.0APK; actualnewbuild follows review.

## Review result and fix

One confirmedP1: discovery advertised the registry's incremented revision before
profileactivation, then reused that revision for the target, causingmobiletosafely
rejecttargetdescriptor. Parent changed /v1/session to publishimmutable runtime
scope and its matchinglabel. Regressioncovers createA-B andreturnB-A discovery
throughquiescenceandreplacement, withsnapshotaccessaftercompletion. Noother
confirmedblocker. All177tests/types passedafterfix; signed0.1.1build is active. Noliveswitch occurred.

## Review and artifact

Read-only reviewer reports confirmed correctness/privacy blockers only. No live
runtime/credentials/history/phone/private model operations, no source writes or
commits. Designer docs/assets and unselected logo concepts are outside review.
Parent fixes confirmed issues once, runs focused then workspace checks, syncs only
allowlisted source to approved C:/Otherme-build, builds/verifies same release signer
and embedded bundle, and preserves oldAPK0.1.0. No source/app logo change yet.

## Done

Combined tests/types and new signedAPK signature/version/privacy checks pass. Exact
account switching/repair limitations documented; actualQRscans and native hardware
remain owneractions. Parent commits onlyownedsource/docs and reports artifact.
No liveaccount change until owner explicitly confirms it in the new UI.

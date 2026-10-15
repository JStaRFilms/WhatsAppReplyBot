# Mobile keyboard, scrolling and mic recovery

- Status: completed, source/review/verified signed release delivered; owner hardware checks pending.
- Persona: parent coder, Takomi reviewer, bounded build worker.
- Scope: canonical Otherme project only. Preserve concurrent designer/context docs.

## Objective

Keep composer and inline draft editing above the Android keyboard. Follow chat
content intelligently, preserve history browsing and provide Latest. Recover from
native microphone startup failure with visible feedback and an explicit local
record/preview/Send path. Package the change as signed 0.1.2/code3.

## Scope

- Mobile Page keyboard avoidance, draft card, conversation scroll hook and focused
  tests; hide tabs while typing and remove nested keyboard containers.
- Native recorder prepared-state retry cleanup, real recording-state validation,
  local composer feedback and regression tests. No hold/foreground safety removal.
- Release version/default/verifier and reuse the approved credential-free build
  copy C:/Otherme-build. Signing key stays in canonical ignored runtime storage.
- No account switch, actual recording/send, paid model call, backend restart, logo
  replacement, profile-UX redesign or unrelated edits.

## Definition of done

- Relevant tests/types and Android/web bundle checks pass.
- Focused review has no confirmed unresolved blocker.
- Actual 0.1.2/code3 APK verifies against the same release certificate, embedded
  bundle, Android resize mode, permissions and private-file/credential-byte scans.
- Previous APKs stay unchanged; no credential/session files reach the build copy.
- Owner gets install-over-existing instructions and honest physical-device limits.

## Expected artifacts

- Scoped mobile source/tests and docs/features/Chat_Interaction_Fixes.md.
- .runtime/releases/Otherme-0.1.2.apk.
- Ignored .runtime/keyboard-mic-apk-build-report.md and redacted build log.

## Execution and findings

Keyboard review task ID:
`node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-keyboard-scroll-review-20261015-r1`

Its one confirmed drag/content race is fixed with gesture/momentum suspension and a
focused regression. No other keyboard blockers were reported.

Voice review task ID:
`node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-voice-start-review-20261015-r1`

Voice review reported no blockers, verified installed Expo API shapes and ran
20 focused tests successfully. Two native-shaped recorder regressions failed
before the fix and pass after. The owner confirmed the installed Android APK and prior grant
of microphone permission. Exact on-device failure is not yet proven.

Build task ID, Takomi Luna High:
`node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-keyboard-mic-apk-20261015-r1`

Build completed in the approved existing short copy. All 66 allowlisted inputs
still matched canonical source afterward. Parent reran 190 tests, workspace types
and web export successfully, then independently ran the actual APK verifier.
Native adjustResize, approved signer, version/package, bundle, permissions and
private-file/credential-byte checks passed. Previous 0.1.0 and 0.1.1 hashes match.

Canonical artifact: `.runtime/releases/Otherme-0.1.2.apk`, 75,499,947 bytes.
SHA-256: `264bc467271accecae6ee45ff8f69c613d845d0c484ae6df395be16aa6d47bdc`.
Report: `.runtime/keyboard-mic-apk-build-report.md`.

Install over the existing app without clearing data, restarting the backend or
re-linking accounts. No hardware recording/keyboard interaction is claimed
verified. Owner checks typing, draft editing, history browsing/Latest and a local
mic/Stop/play/delete preview. Do not require a test send. Profile setup tasks remain
paused until the owner resumes them.

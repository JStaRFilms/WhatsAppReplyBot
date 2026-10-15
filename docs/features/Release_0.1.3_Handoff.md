# Otherme 0.1.3

## Ready artifacts

The approved source and artifact round is complete. This is a local verified release,
not a deployment or a phone installation performed by the agent.

- APK: `.runtime/releases/Otherme-0.1.3.apk`
- Version: **0.1.3 / code 4**
- Package: `com.jstarstudios.otherme`, same approved signing key.
- APK bytes: **76,080,237**
- SHA256: `41d8ab4b746e181dc378c6b3e5f1c487776c153aa236429da780c88b74645e9b`
- Production browser assets: `apps/mobile/dist`, 28 files, 5,226,702 bytes.
- Detailed actual-artifact proof: `.runtime/releases/build-0.1.3/final-artifact-report.json`

Previous 0.1.0, 0.1.1 and 0.1.2 APK hashes and sizes remain unchanged. Neither real
profile/auth data nor the original 2025 project was used or modified by validation.
No live service was started, stopped or connected during this release work.

## Update both PC and phone

1. If Otherme is running on the PC, use its normal **Q** action and wait for verified
   shutdown. If shutdown is not verified, stop here. Do not delete its launcher
   lock, force-kill processes, start a second backend or resend unknown work.
2. Start `Otherme.cmd` from the canonical 2026 project again. This loads the updated
   backend and serves the compiled desktop assets. **D** opens the browser client;
   no daily Metro server is needed. Confirm the intended profile before enabling AI.
3. Install this APK **over the existing Otherme app**. Do not uninstall, clear app
   data or re-link WhatsApp as an update step. Package, certificate and increasing
   version code were verified; actual device installation remains your action.

The PC restart matters. Whisper Turbo transcription, durable transcript reuse,
history joining and new APIs are backend changes. Installing only the APK does not
update a currently running PC process. The existing OpenRouter credential is reused;
no new key or account is needed, and the real `.env` was not changed. Unsupported
custom transcription overrides fail closed rather than silently using an expensive
fallback. No paid quality or savings benchmark was run.

## What changed

The round includes composer/mic/keyboard lifecycle and foreground/profile fixes,
verified launcher/QR/browser hosting, narrow/wide UI, nonblocking immutable sends,
immediate Draft/View feedback, genuine receipt labels, optional matched contact
names, owner reply instructions and generated-prose punctuation normalization.
It also includes verified local history/quote joining, partial recovery, stored
paging, cached-first chat/draft editing, private photo/video viewing and economical
source-linked Whisper reuse with uncertain-attempt protection.

Contact names remain optional. Use explicit matched-name sync only if wanted. The
app does not upload the whole book or request contact-writing authority. No video
sending, video AI, background playback, PiP, full Batch2 writing profiles or insights
UI was added. Branding and the existing icon remain unchanged.

## Verification and provenance

Application inputs were frozen at `645f5699477328a0abe5520f6f8a428d4c9b68b5` after
the single combined review's two confirmed findings were fixed and independently
verified. Source/packaging checks passed across 94 core, 113 backend, 224 mobile and
34 packaging tests, **465 total**, plus all workspace typechecks. A fresh independent
full synthetic Edge replay passed **108 assertions**, with all 16 viewed POSTs
matching actual visible inbound sources, no ordinary anchor drift and no unexpected
network, device or browser errors. Default parallel FFmpeg timing is not claimed.

Android compilation succeeded in the approved existing `C:/Otherme-build`. The
initial verifier could not parse full Android namespace attributes and Windows CRLF
from `aapt2`. Commit `2c8d658b145ccb02d269df6634c7dab5874c4333` fixes only that parser
and its regression test. The test failed before and passed after. No application
binary or policy requirement changed, so no rebuild was needed. Original freeze
and failed-build handoff remain intact; the final report records the exact verifier
hash overlay and both canonical/build-copy artifact checks.

The actual signed APK passed single signer, package/version/name, non-debuggable,
LAN HTTP, no-backup and MainActivity adjustResize checks. READ_CONTACTS is present;
WRITE_CONTACTS and all foreground-service permissions are absent. Both required
activities explicitly disable PiP, and ExpoVideoPlaybackService is absent. The
embedded bundle is 4,650,112 bytes across an archive with 1,586 entries. APK and
desktop private-file and real credential-byte scans passed without exposing values.
All frozen inputs except the documented verifier/test overlay still match; all 84
build-copy inputs match their original or explicitly updated verifier hash.

## Owner hardware checks

These remain separate from source/build acceptance:
- Mic preparation/record/stop/send, keyboard visibility and manual dismissal.
- Send then type a newer message or quote; Draft feedback/View; genuine receipts.
- Old-history position, quote navigation, cached draft edits and conflict feedback.
- Photo/video open, close, foreground return and audio exclusivity.
- Optional contacts permission/sync, profile isolation and Windows Q/D/QR behavior.

If a send outcome is unknown, do not resend. No test proves the original phone mic,
launcher or missing-message incident's physical cause. Native codecs, permissions,
recording interruptions and real WhatsApp behavior still need those hardware checks.

# Otherme 0.1.3 release freeze

## Status

Source, validation and actual artifacts are accepted. The local signed APK and
production browser assets are ready. No live deployment or phone installation was
performed. See Release_0.1.3_Handoff.md for rollout and owner hardware checks. Final frozen product is
`645f5699477328a0abe5520f6f8a428d4c9b68b5`. Later documentation-only HEAD changes
are allowed. No further product or dependency changes during the artifact build.

Native version is0.1.3/code4, packagecom.jstarstudios.otherme. Branding remains
Otherme, JStar Studios, https://jstarstudios.com. Signing certificate stays
6D:DE:74:9B:5E:71:31:A7:D1:B1:27:2B:38:57:25:4B:F4:3E:B7:A1:B1:E6:39:DB:C6:47:2C:93:5C:75:E9:3E.
No icon, package, key, profile, data-reset or toolchain change is authorized.

## Review closure

The one combined review38 reported two confirmed P2 defects. Parent independently
reproduced both, then verified correctionf32808b. Viewer effects own returned but
uncommitted handles; committed cleanup still detaches before release. Contact
observations preserve verified pairs without unrelated inbox creation, while actual
messages and existing LID history still materialize/join through current policy.
A necessary one-line Workflow guard skips name refresh before a canonical chat
exists. No schema/store change, identity guess, auto-resume or data cleanup.

Parent unchanged red reproductions now pass. Full serialized checks passed94 core,
113 backend and224 mobile tests. Packaging passed29 before final metadata and33
after the four actual-manifest policy tests were added,464 total. All workspace
types and diff checks pass. No second generic review or unrelated cleanup is needed.

Version/config, build filename and verifier are finalized in645f569. The verifier
now checks actual signed artifact READ_CONTACTS/no WRITE_CONTACTS, both explicit
PiP=false activities, no ExpoVideoPlaybackService or foreground-service permission,
plus retained signer, package/version, non-debuggable, LAN HTTP/no-backup,
MainActivity adjustResize, embedded bundle and private-file/credential-byte checks.
Pure synthetic aapt tests pass. Actual merged/signed proof remains build33's job.

## Fresh final browser evidence

A fresh credential-isolated preview was exported after the fixes and metadata to
`.runtime/ui-task44/fix50/web/`. Parent independently replayed the full primary and
supplements against this candidate, with fresh output directories:
- `fix50/parent-freeze-1792103858312-primary/`:91 passed,544 API calls,234 metadata,
  57 content requests and13 exact viewed POSTs.
- `fix50/parent-freeze-1792103858312-supplements/`:17 passed,122 API calls,60 metadata,
  15 content requests and three exact viewed POSTs.

All108 assertions pass. All16 viewed POSTs match actual visible inbound sets; zero
unexpected calls, browser/device errors or nonzero ordinary anchor deltas. Earlier
2453912 browser evidence remains attributed to that older candidate, not relabeled.
Final data is synthetic and does not prove native mic, keyboard, contacts, codecs,
actual WhatsApp receipts, Windows operation or the owner's historical incidents.

## Frozen inputs and approved targets

`.runtime/releases/Otherme-0.1.3-inputs.json` records184 public inputs and84 Android
copy inputs, all with SHA256, plus previous release hashes verified before the build.
Source manifest SHA256 is7cd204cea040ac9d7c763b33d53e4b70f39b526fd84795f2a9f2d382e51e0f30.
Android allowlist SHA256 is320522a3c5ca3d16d7feca119090de6694386598da08c266fcdee7a9e2b59708.
The0.1.3 APK target did not exist at freeze. Preserve0.1.0/0.1.1/0.1.2 bytes.

The sole approved physical Android copy isC:/Otherme-build. Verify its real path,
sync only the manifest allowlist and preserve its short pnpm settings, caches and
existing native path/codegen adjustments. Do not delete/recreate it, run prepare-copy
over it or select another copy. The owner already approved exact Contacts57.0.7 and
Video57.0.5, canonical pins and normal native dependency refresh in this existing
copy after freeze. No unrelated lock drift or SDK/toolchain/license installation.

Production browser output iscanonical apps/mobile/dist through build-desktop.mjs.
The signed APK target iscanonical .runtime/releases/Otherme-0.1.3.apk, copied only
after verification. Logs/reports may use .runtime/releases/build-0.1.3/. No final
production app export is inferred from the earlier preview. No live service restart,
D/QR OS launch, account connection, send, model call or phone install is authorized.

Signing tools may privately read the existing canonical signing env/key solely
through the approved build/verifier scripts. The actual credential-byte scan may
privately read that env and owner-token file without exposing values. Never read
or print them in chat/tool output or copy them into the build copy. No new key.
Build subprocesses and desktop assets must remain isolated from these credentials.

## Completed artifact verification

Android and production desktop artifacts are verified. APK SHA256 is
41d8ab4b746e181dc378c6b3e5f1c487776c153aa236429da780c88b74645e9b,
76,080,237 bytes, same certificate/package, version0.1.3/code4. Actual Contacts,
PiP/service, resize, embedded bundle and private-file/credential checks passed.
Desktop28 files/5,226,702 bytes passed the blind scan. All previous APK hashes match.

Initial verification stopped because aapt2 emitted full namespace attributes and
CRLF. The parent independently reproduced the parser failure and fixed only the
verifier/test in2c8d658. No policy was removed or relaxed and no binary changed.
The original645f569 application freeze and manifest remain preserved. The final
artifact report records exactly those two source hash changes and the one updated
build-copy verifier. Five manifest tests and34 packaging tests now pass; total465.
The unchanged cached APK and its exclusive release copies passed complete verification.
This is not a silent re-freeze or claim that the old verifier passed.

## Owner handoff after artifacts

Delivery must include install-over-existing instructions, exact APK/hash/version,
and a coordinated canonical backend/service restart through the normal verified
launcher lifecycle. Do not delete locks, force-kill, clear app data, uninstall,
re-link or blindly resend unknown outcomes. The backend update is required for the
Whisper route, durable transcripts and new APIs; the APK alone does not update PC
code. The real.env remains unchanged. No paid ASR quality/savings test was run.

Owner hardware acceptance remains mic/keyboard/dismissal, contacts opt-in, genuine
receipts, history positions, photo/video/audio behavior, profiles and Windows Q/D/QR.
No build or mock result substitutes for these checks. Full Batch2 and insights stay
out of this release.

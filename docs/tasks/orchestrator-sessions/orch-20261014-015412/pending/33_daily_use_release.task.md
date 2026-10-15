# Build the integrated browser and Android release

## Agent setup

Persona worker, Takomi Luna High, artifact-only after source freeze and extension review38.
Canonical root: C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot. Approved physical Android build copy
C:/Otherme-build only. Read Daily_Use_Batch_1_Contract.md, Release_Extension_Implementation_Plan.md,
36/37 dependency/API handoffs,38 findings/responses and current build tooling.
Parent supplies final version/source hash after review; do not choose or edit it.

## Objective

Produce compiled desktop web assets usable through Otherme.cmd D without Metro,
and the actual signed Android update with the same package/certificate. No app-data
reset, signing-key replacement or blind live backend restart. New service/desktop
features require explicit coordinated owner rollout instructions.

## Scope and artifacts

Credential-isolated production web export at canonical apps/mobile/dist, optional
ignored-runtime verification preview, allowlisted
inputs/generated build files/cache in approved C:/Otherme-build and canonical
ignored release APK/report/log. No canonical source/docs/env/auth/key/DB edits.
Preserve all previous releases byte-for-byte and original signing material.
Do not rerun exclusive prepare-copy over an existing destination; verify then sync
its allowlist only, preserving short pnpm store/codegen fixes and native cache.
Sign using original env privately; never put keys/env/session into build copy or
print credentials. No SDK/toolchain installs, licenses, firewall/services or cloud build. Only a
parent-confirmed frozen dependency refresh in the existing approved short copy is
allowed for the exact frozen approved native pins, including Contacts and only
separately owner-approved Expo Video if present. No worker package choice/install
outside that confirmed refresh. Read40's accepted plan and41+ dependency handoffs.

## Definition of done

Actual desktop production export and signed APK verified, matching frozen source.
Single approved signer, package/version, non-debuggable, LANHTTP/no-backup/permissions,
embedded bundle/native resize and private-file/real credential-byte scan pass.
If Expo Contacts is used, assert READ_CONTACTS present and WRITE_CONTACTS absent in
the actual merged/signed artifact, not just app.json. Retain mic/camera safeguards.
Desktop assets contain no secrets and can only expose public bundle/static files.
Source input hashes and previous APK hashes remain unchanged. Exact bytes/hash,
redacted evidence and errors are reported. No physical microphone/phone install or
live desktop service/account action is claimed tested from a build. No real sends,
recordings, models or private content diagnostics. No debug APK fallback.

## Dependencies and review checkpoint

36 and37 integrated,38's confirmed blockers resolved, parent validation accepted,
parent-owned version/config/defaults and final source snapshot frozen. Original32
alone is insufficient. Owner-added send/receipt/name/prompt/punctuation gate must
be complete. The later owner-approved history and cached/full-screen image/video
work from40/41+ and updated integrated browser evidence must also be accepted by38.
39's69f01fd baseline alone cannot authorize this build. If Video is included, verify
actual foreground-only/native permission/plugin configuration and explicit module
approval. No source changes or new dependency choices in this artifact task.
Owner's later46 Whisper STT and durable source-linked reuse/paid-attempt protection
must also be integrated/reviewed before freeze. Backend switch is not an APK model
client/key change; desktop/service rollout instructions must explicitly cover it.
No actual runtime config or live paid ASR test belongs in this artifact task.
Preserve existing C:/Otherme-build caches/path fixes and refresh only
the verified credential-free allowlist; do not run prepare-copy into it again.
Worker does not commit/push or alter scopes. Parent independently verifies final
artifacts, commits exact owned changes and guides owner install/service update.

## Execution

Authorized after source review and parent freeze. Version0.1.3/code4,
packagecom.jstarstudios.otherme, frozen645f5699477328a0abe5520f6f8a428d4c9b68b5.
Read docs/features/Release_0.1.3_Freeze.md and completed38/50 plus current verifier.
Inputs are canonical .runtime/releases/Otherme-0.1.3-inputs.json,184 public and84
allowlisted Android inputs with hashes. Previous three APK hashes were verified;
canonical0.1.3 target did not exist. Parent464 source/packaging tests/types and fresh
full108 browser checks pass. No source writer, unresolved review blocker or new
permission/dependency question. Existing exact native module refresh is approved.

Build desktop with scripts/build-desktop.mjs, outputapps/mobile/dist. Build Android
only in verified physical C:/Otherme-build. Sync only androidInputs from the frozen
manifest. Preserve .npmrc, caches and the existing path/codegen adjustments. Inspect
known prior build metadata/patches before dependency/prebuild refresh; reapply only
existing approved fixes if generation replaces them. No prepare-copy or new path.
Use frozen pins/lock and existing toolchain. Normal Contacts/Video native dependency
refresh is approved, no ad hoc upgrades or SDK/license/toolchain downloads.

Private signing env/key and credential-byte scan are tool-only exceptions to the
normal no-private-runtime rule. Use canonical .env by path through build/verifier,
never read/print values or copy into build inputs. Its token path may be scanned
privately for leaked bytes by the verifier. No live account data or other runtime
inspection. Desktop build must also pass a blind private-file/credential-byte scan.
Keep credentials out of Expo, installers and source copies. Same signer only.

Invoke node C:/Otherme-build/scripts/build-android.mjs --signing-env-file <canonical>/.env.
Verifier now requires actual READ_CONTACTS/no WRITE_CONTACTS, both explicit PiPfalse
activities, no ExpoVideoPlaybackService/foreground-service permission, correct
version, signer, resize, embedded bundle and private data. Verify the real signed
APK and exact canonical copy, not source config alone. Do not weaken verifier or
change canonical source if the native build fails; return exact redacted blocker.

Final targets are canonical .runtime/releases/Otherme-0.1.3.apk and apps/mobile/dist;
report/logs .runtime/releases/build-0.1.3/. Refuse an existing unknown0.1.3 artifact,
never overwrite older releases. Check all public/Android source and old APK hashes
before and after. Return APK SHA256/size, signer/version/package, bundle bytes,
actual policy checks, production desktop hashes/scan, commands, dependency refresh,
source copy proof and honest limits. Never start live services/D/QR, scan/pair,
install/clear/uninstall on phone, send, run models, mutate real config or old data.
Owner explicitly approved expo-video57.0.5 and its normal native module dependency
refresh in existing C:/Otherme-build after source freeze.43 must first implement/
verify the exact canonical package/lock/disabled-background/PiP plugin changes;
this approval does not allow33 to select dependencies or begin a build early.

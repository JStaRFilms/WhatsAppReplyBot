# Task 16: Android daily-use build and Windows launcher

## Approval and dependency

Owner chose Android APK plus Windows launcher, click-to-start, and explicitly
requested signing from the first release. Final public name is Otherme. Owner corrected the earlier Order Me typo.
Publisher is JStar Studios, https://jstarstudios.com. A dedicated product domain is not confirmed; no new domain is a configured
deployment target.
Begin after tasks
14/15 interaction fixes are integrated, reviewed and committed. No separate UI
thread requested. No cloud build/source upload or Windows sign-in startup approved.

## Signing gate

The private form was cancelled. Owner then explicitly authorized generating a
strong random password and keeping it in ignored .env, with local documentation
and no GitHub push. scripts/create-signing-key.mjs creates/reuses the dedicated
RSA4096 PKCS12 key without printing secrets or replacing an existing key.
Private files: .env OTHERME_SIGNING_PASSWORD; .runtime/signing/otherme-release.p12;
.runtime/signing/README.txt. Git ignore checks passed. APK signing still must be
performed and its certificate verified; key creation is not an APK build.

## Execution

Takomi Coder, openai-codex/gpt-6.1-sol high.
node:delegated-task:command%3Amcp%3Aeb8f1f9f-998e-46ff-aa9e-be24c2fecda2%3Adelegate-task%3Aotherme-daily-use-build-20261014-r1
Short-build implementation round 2:
node:delegated-task:command%3Amcp%3Aeb8f1f9f-998e-46ff-aa9e-be24c2fecda2%3Adelegate-task%3Aotherme-daily-use-build-20261014-r2
Owner-approved temporary physical checkout C:/Otherme-build; original project and
private signing inputs remain authoritative. No credentials/session/key copy.

Interaction baseline 4fe50d7. Parent owns docs/Git/runtime while packaging coder
owns scoped build/launcher code. Unrelated designer HTML files are left untouched.

## First implementation result and blocker

Packaging code/Otherme.cmd implemented. 128 tests, workspace types, Android/web JS
exports and diff checks passed. Native assembleRelease failed when Ninja rejected
a 277-character Worklets source path; installed Ninja 1.10.2 and 1.12.0 both failed.
Evidence is .runtime/android-build.log. No APK exists; actual signature/archive and
installation checks are unrun. Live services/private signing data/designer HTML
were not touched. Owner explicitly approved creating C:/Otherme-build as a shorter physical build-only
copy with fresh dependencies. Do not copy .env, runtime/session data or signing
material. Original project remains authoritative; copy APK back there and do not
alter/delete other outside-project resources.

## Round 2 artifact

Signed ARM64/x86_64 release built and copied to canonical
.runtime/releases/Otherme-0.1.0.apk, 75,472,555 bytes. SHA-256
60e2e9175ff041f70160762ce3077dc27b30fcbc8918cf63a7755f7de292c55d.
Parent reran actual APK verifier: approved single signer, package/name, embedded
bundle, non-debuggable/HTTP/backup and required permissions, all-entry private-file
and actual-secret-byte scans passed. Parent reran all130tests/types successfully.
Task18 focused review found two launcher blockers, both fixed by parent: late QR
writes after exit, and missing checkout/instance matching. Root hashes/nonces and
stop guards now cover attach/readiness/pairing; three regressions passed. Parent
reran133tests/types/actualAPKverification. APK hash unchanged. An isolated empty
emulator failed to boot in90seconds and was shut down; no physical phone was touched.
Native launch/capture remains owner tested, not claimed verified.

## Completion

Parent fixed task18's two confirmed launcher blockers and ran three focused
regressions, all133tests/types and the actualAPKverifier successfully. A controlled
real-launcher run started/verified its owned backend and Q exited through graceful
IPC without a PID kill or message send. Native emulator environment failed to boot;
phone install/launch/hardware/background remain owner checks. Deliverable is the
signedAPK plus Otherme.cmd, not a portable installer or cloud deployment. Signing
files and APK remain ignored. Designer modifications are preserved and excluded.
Scoped source/docs commit follows. No GitHub push.

## Scope

Produce a personal-use installable Android build with embedded JS, no Expo Go or
Metro runtime requirement. Use Otherme as the public app name, publisher JStar Studios. Preserve existing
internal IDs where needed for compatibility; if this first native release needs
an applicationId, propose com.jstarstudios.otherme. Preserve phone
settings/token storage and backend-only key. Initial service address/token setup
must be understandable; a release phone cannot default to phone localhost as if
it were the PC. Same trusted Wi-Fi and an awake PC remain required.

Provide one-click Windows backend launch with saved pairing/database, visible
status and no shell commands for owner. No duplicate server on occupied ports;
verify service identity/authenticated target before attaching or stopping. No
second Expo server. Preserve all current live data and unknown-send accounting.
Launcher can live in project deliverables. Ask exact paths before writing desktop
shortcuts, persistent installers or any files outside project. Tool-managed build
caches are exempt unless meaningful disk/system risk arises. Never silently add
firewall rules, startup entries, system services or background boot automation.

## Build and privacy

Inspect existing JDK/Android SDK first; prefer local Gradle. No SDK installers,
license acceptance or cloud upload without required approval. Use a dedicated private Android release keystore, never the public debug key.
Certificate publisher metadata can use JStar Studios / Otherme. Do not claim
that a self-signed Android certificate proves website ownership. Preserve the key
for future updates; use a private secret form for its password, never chat. Keep
keystore/password out of source, frontend, build archives and Git. Back up private
signing material through an owner-controlled path with exact-path approval.
Windows launcher signing is distinct from Android signing; no claim of trusted
Authenticode signing without a suitable certificate. No secret/session data in
APK, build archive or Git.
Generated native files and APK artifacts stay scoped/ignored as appropriate.
Check real native dependency compatibility; Android JS export alone is not an APK.
Use proportionate checks for cleartext trusted-LAN access, microphone/camera/media
permissions, bundled frontend imports and absent credentials. Do not use or claim
private phone data, real sends, delivery/read proof or physical capture tests.

## Artifacts and done

APK artifact, click-to-start launcher, short usage/recovery instructions, exact
signing/build/evidence limitations. APK builds and launches without Metro in an
available isolated device/emulator if feasible. If native tooling is blocked,
report the concrete blocker rather than substituting another Expo dev build or
claiming success. Physical owner test remains explicit. Scoped commit and clean
handoff to UI work follow verification.

# Daily-use build

## Approved goal

Signed Android APK with embedded JS and a click-to-start Windows backend launcher.
No Expo Go or Metro required at runtime. No auto-start at Windows sign-in, cloud
build upload, firewall change, Windows service installation or public hosting.
Publisher JStar Studios, jstarstudios.com; final name Otherme.

## Signing

Owner explicitly approved a cryptographically random password stored in ignored
.env. OTHERME_SIGNING_PASSWORD unlocks the dedicated RSA4096 PKCS12 release key
at .runtime/signing/otherme-release.p12, alias otherme. Private backup instructions
are in .runtime/signing/README.txt. None of these files belong in Git or an APK.
The generator refuses to replace an existing key or print secrets. Preserve both
keystore and password for future updates. A hash cannot unlock a signing key.
Android self-signed release identity does not imply website verification or trusted
Windows Authenticode signing.

## Client/server plan

First native applicationId com.jstarstudios.otherme. Existing storage keys and
paired backend identity remain. Release initial service setup must point to the PC,
not the phone's localhost. Trusted-LAN HTTP needs explicit native configuration;
permissions remain action-triggered. Backend key is never a public Expo variable.
Launcher targets this backend only, preserves SQLite/session and cannot start a
duplicate service or attach to an unverified occupied port. PC remains awake and
on the same network. Existing unknown-send recovery remains authoritative.

## Build evidence

The native ARM64/x86_64 assembleRelease build passed in the owner-approved short
physical copy C:/Otherme-build. Fresh local dependencies and shorter pnpm/codegen
paths resolved the Ninja limit. The copy excludes credentials, runtime, key and
session data; --signing-env-file references the original .env for Gradle only.
Node bundling strips signing/OpenRouter/owner-token environment fields.

Verified artifact: .runtime/releases/Otherme-0.1.0.apk, 75,472,555 bytes.
APK SHA-256: 60e2e9175ff041f70160762ce3077dc27b30fcbc8918cf63a7755f7de292c55d.
Parent independently verified the approved single signer, package/name,
non-debuggable manifest, Internet/microphone/camera permissions, trusted-LAN HTTP,
disabled backup, 4,395,176-byte embedded bundle and no private files/secret bytes.
133 tests and strict workspace typechecks pass after the focused review fixes. No SDK/JDK installs or cloud upload
were needed. The earlier microphone-blocking picker option was corrected and the
final merged manifest verified.

Focused review found delayed QR recreation after launcher exit and incomplete
checkout/instance identification. Exit guards prevent late QR writes. Authenticated
status now carries a canonical-root hash and instance nonce, checked before attach,
new-child readiness and pairing. Three focused regressions passed; APK bytes and
signature are unchanged because these fixes affect the Windows backend/launcher.

An isolated empty emulator did not boot within 90 seconds, so APK installation/
launch could not be tested there. The emulator was stopped; no physical phone was
touched. Native microphone/camera/speaker and phone background behavior still need
owner testing. No delivery/read claim follows from build or synthetic checks.

## Owner use

Copy the APK to the Android phone and install it. On the existing PC, double-click
Otherme.cmd in this project. Keep the status window and PC awake; no Metro/Expo Go
is needed by the APK. This launcher uses the PC's installed Node24 and project
dependencies; it is not a portable installer for arbitrary computers. It verifies
an occupied service before attaching and never stops a service it did not start.
Type Q to stop its owned backend gracefully, or P to show a private pairing QR.

Phone Settings uses the editable PC Wi-Fi URL, initially
http://192.168.100.5:3210. Enter the private token from .runtime/owner-token.txt once
and Connect. Native secure storage persists it. DHCP can change the PC address.
The new standalone app has its own storage, so Expo Go's saved token does not
transfer automatically. Saved WhatsApp pairing/database remain on the PC.

Parent ran the actual launcher with a controlled Q input: it started and verified
its own backend and exited gracefully through IPC without a PID kill. This check
made no sends or pairing diagnostics. Backend is not left running by that check;
owner should double-click Otherme.cmd for normal use.

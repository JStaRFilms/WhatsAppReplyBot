# Daily-use build

## Approved goal

Signed Android APK with embedded JS and a click-to-start Windows backend launcher.
No Expo Go or Metro required at runtime. No auto-start at Windows sign-in, cloud
build upload, firewall change, Windows service installation or public hosting.
Publisher JStar Studios, jstarstudios.com; final name Otherme.

## Owner-added release hold and dependency targets

Release33 is held for the extension in
[Release_Gate_Extension.md](Release_Gate_Extension.md) and
[Release_Extension_Implementation_Plan.md](Release_Extension_Implementation_Plan.md).
Backend/core36 and client37 must land, parent validation must pass and focused
review38 must accept the combined source before final production browser/APK
artifacts. Original review32 is not acceptance of the new requirements. Preserve
existing signing/package identity and let parent choose the next version at freeze.

Task34 inspected Expo57.0.28's installed compatibility manifest, which nominates
expo-contacts ~57.0.7. Conditional phone fallback proposes exact pin57.0.7, pending
package/public-API verification and confirmed install target. No module was
installed during planning. No other dependency/SDK/toolchain change is authorized.
Canonical apps/mobile package/config plus canonical lockfile are source authority.

C:/Otherme-build remains the owner's sole approved short physical build copy.
Preserve its caches and path/codegen fixes. It is not an implementation target.
Before33, parent verifies the exact directory and credential-free allowlist, then
confirms only an input/dependency refresh after source freeze. Do not delete or
recreate it, rerun prepare-android-copy into an existing destination, clear caches
or choose another path. That script refuses overwrite; it does not revoke the
owner's existing target authorization.
No delegated planner/implementation writer may write outside project, touch actual
signing/credentials or perform final builds. Final merged native manifest must
verify contact read permission only if used, no WRITE_CONTACTS, with all existing
mic/camera/network/backup restrictions preserved. Owner hardware checks remain.

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

## Batch 1 source, awaiting the integrated release

The source now supports a production browser client on the existing service.
`pnpm desktop:build` exports credential-isolated public assets to
`apps/mobile/dist`, with same-origin API discovery. After those assets are built,
D in Otherme.cmd opens `http://127.0.0.1:3210/` without a token in the URL. Daily
browser use needs no Metro, second server or installer. Final assets are not yet
accepted; visual integration and the combined release are still pending.

Only known app routes and allowlisted built assets are public. API authentication,
profile/revision checks, private-network/origin restrictions and loopback-only
credential provisioning remain. Source, runtime, dotfiles, traversal, symlinks and
source maps cannot fall through to the SPA. The auth guard checks the matched route
as well as the raw URL, since the router decodes encoded literal path segments.

Explicit native Link can request the owning launcher's private QR viewer. Session
capabilities are opt-in through `/v1/session?capabilities=1`; the plain response
stays compatible with strict older protocol2 clients. IPC contains only scoped
identity/request/nonce/status, never QR bytes. Ready acknowledges the OS launch
request, not visible pixels. P remains fallback; read polling alone never opens a
viewer or retries connect. QR files are cleaned up on expiry, change and exit.
An already-open external image viewer can retain rendered pixels. If Windows locks
the file, the launcher reports manual cleanup instead of claiming deletion.

Stop handlers are installed before listen yields. Q gates admission and reports
its drain phase, closes idle HTTP connections and waits for admitted work before
SQLite closes. A timeout does not force-stop a process, release unknown accounting,
remove an unverified lock or cancel outstanding work. The original owner startup/
shutdown incident remains unreproduced; the fixes have synthetic lifecycle evidence.

Parent reran70 backend tests,29 packaging tests, backend/core typechecks and
launcher/helper syntax checks. The encoded-route authentication regression failed
before the fix and passes after it, including HEAD and missing/stale profile scope.
No live launcher, viewer, pairing, profile or device operation was used. Final web
export, signed APK and actual Windows/device acceptance follow UI integration and
focused integrated review.

## Batch 1 selected UI source evidence

The selected charcoal/blue and light layouts now cover Chats, Conversation,
Review, Assistant and Settings. At browser width900 and above, a64-unit navigation
rail and340-unit inbox sit beside the actual routed detail. There is one scoped
AppProvider/LocalDraftProvider and one conversation, not a duplicate desktop client.
The detail remains mounted across responsive resizing so local text and input
identity survive. Header/bottom safe-area ownership and native measured keyboard
avoidance remain separate.

Parent reran all250 workspace tests and workspace typechecks successfully. The
isolated browser rerun passed132 geometry/interaction checks with122 synthetic
screenshots and zero page errors. It covers dark/light/system,320/360/390/1280
widths, browser text inflation, navigation, scoped detail identity, local draft,
quote/editor/image-preview and synthetic visual-viewport behavior. The preview
export and screenshots are in ignored `.runtime/ui-task31/`. They use invented
data and cannot prove native microphone/keyboard or actual Windows behavior.
The focused integrated review and final production export/APK are still pending.

## Initial 0.1.0 build evidence

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

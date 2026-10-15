# Account switching and pairing repair

## Approved goal

The owner requested an explicit way to use another WhatsApp number without mixing
its data with the original account. Preserve the original profile, start a new
account with AI off, and allow a deliberate return. Same-number pairing repair is
a separate action. Never switch or erase a live account automatically.

The original failure was a logged-out session with saved credentials and an owner
lock, but no QR. P reconnected those credentials instead of resetting them. The
existing owner lock correctly rejected another number; deleting it would have
allowed account data to mix.

## Storage and account identity

The original profile remains in place:

- Account ID `whatsapp-owner`.
- Database `.runtime/whatsapp.sqlite`.
- Authentication `.runtime/whatsapp-auth/`.

New profiles have unique IDs and separate databases/authentication under
`.runtime/profiles/<uuid>/`. They inherit no chats, aliases, uploads, grants,
contact permissions, drafts or model consent. `.runtime/profiles.json` stores the
active descriptor, monotonic revision and durable transition journal. Paths derive
from validated IDs, never API-supplied filesystem paths. The service token, model
key and signing key remain service-owned and private.

## Transition and repair

Settings provides **Use another number**, **Return to preserved profile**, and
**Repair this number**. Each previews the consequences and requires confirmation.
The API returns an operation acknowledgment, not a claim that switching finished.

The verified launcher closes admission, refuses an executing handoff, suspends AI
and cancels queued components from every origin. Accepted and unknown components
keep their accounting; unknown outcomes never retry automatically. It clears old
quiet windows, presence, composer/catch-up state and generation authority, then
drains admitted work and credential callbacks. The replacement starts only after
the owned child has exited. A new or returning profile starts disconnected with
AI off. Pairing and enabling AI remain explicit owner actions.

Repair archives the expired authentication after process exit, copies the exact
known owner lock to fresh authentication, and preserves its database/account ID.
A missing lock blocks repair. A wrong-number scan cannot become a verified socket
or ingest contacts, messages or media.

Failed or interrupted transitions stay blocked for operator recovery rather than
force-killing, starting two backends or silently reconnecting the old profile.
Direct backends without an owning launcher cannot perform transitions.

## API and client isolation

Authenticated account requests carry `X-Otherme-Profile` and
`X-Otherme-Revision`. Missing scope returns upgrade-required; stale scope and
transitioning scope fail closed before body processing or account access. Session
and operation discovery expose descriptors, not chat content. Exact request ID,
body and source-scope binding make operation replay idempotent.

The mobile client revokes the old binding before accepting another scope. It
replaces history/client/composer/clock state and remounts navigation/local-draft
providers. This stops old playback/recording and releases pending attachments.
Late responses or local writes cannot populate another profile, even when the
chat JID matches. Persistent text drafts remain URL/account-ID scoped. An externally
discovered profile change requires Continue; a rejected mutation is never retried
against a newly discovered account. A return to the same profile has a new revision.

Old APKs cannot access the new profile API. Install the update and restart the PC
launcher together. Full contract details are in `Account_Profile_API.md`; the
runtime plan is in `Account_Switching_Plan.md`.

## Verification and release

The focused review caught a discovery revision published before activation. The
session endpoint now publishes the immutable runtime scope. Create and return
regressions cover discovery during quiescence and after replacement.

All 177 tests and workspace typechecks passed. The signed ARM64/x86_64 APK is
`.runtime/releases/Otherme-0.1.1.apk`, versionCode 2, 75,495,131 bytes. It uses the
same package and release certificate as 0.1.0. Embedded bundle, actual manifest,
permissions, version, private filenames and credential-byte scans passed.

APK SHA-256:
`ebbbc45f0421ca6991ce03ba7082b6d01eb3d288d4c129e75223a020d244d926`.
The original 0.1.0 APK remains unchanged. Task20's bottom-inset and contact-only
inbox fixes are included. Logo concepts remain unselected assets, not app icons.

The owner separately approved an immediate original-account repair. With the
backend stopped, expired auth was backed up, exact owner-lock bytes and chat row
count were retained, and AI was paused. Proof is in ignored
`.runtime/original-pairing-repair-proof.json`. A successful login was not claimed
before the owner scanned the QR.

No live profile switch, test send or private model diagnostic was performed.
Real QR scans, native hardware and background behavior remain owner checks.
Designer and contact-memory documentation were left untouched.

## Owner update steps

1. Install 0.1.1 over the existing app without uninstalling it.
2. Type Q in the PC launcher, then reopen `Otherme.cmd`.
3. If prompted, choose **Continue with this profile** in Settings.
4. Use **Connect WhatsApp** for normal pairing, **Repair this number** for a
   logged-out same-number session, or **Use another number** for a fresh profile.

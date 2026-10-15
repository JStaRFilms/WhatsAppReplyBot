# Chat interaction fixes and paced replies

## Owner request

Fix duplicate React keys, put the mic in the Send slot when the composer is empty,
make Resume feel immediate after server acknowledgment, sync reactions from the
original WhatsApp client and allow fire/other valid emoji reactions. Add typing
presence during eligible AI reply waiting, plus optional two-to-five-message
replies with five-second gaps. Existing quoted replies already work; preserve
those. Owner reactions starting a cooldown are accepted.

## Shared contract

New AI Action shape:
`{kind:'text_sequence',messages:[{text:string,quotedMessageId?:string|null}],reason:string}`.
Two to five nonempty text messages, at most 4000 characters per message and 4000
characters in the complete sequence. Ordinary replies remain `text`; no forced
burst or splitting short answers. Each sequence component costs one reply unit.
Reserve the complete sequence before dispatch. Insufficient grant capacity must
not send a partial or silently enlarge a grant.

Outbox max components becomes five. Per-component quote and pacing metadata are
optional for backward compatibility. Backend defines durable due times; gaps are
about five seconds after the preceding accepted handoff. Existing single replies
and reaction-plus-text retain existing delivery behavior. Recheck permissions,
grants, audio source availability and workflow immediately before each handoff.
New incoming messages, human intervention, revoke, exclusion, expiry, socket loss
or unknown outcomes stop remaining components. Never blindly retry unknown parts;
accepted parts remain accounted for. Restart recovery must not resurrect a burst.

Typing is optional ephemeral presence, not a message, receipt or model export.
Only verified direct auto-eligible chats with consent and capacity can show it
during the five-second window, generation and sequence gaps. Clear it on pause,
composer occupancy, owner activity, exclusion, consent loss, window cancellation,
completion, failure or disconnection. Stale leases cannot clear a newer turn.
Presence errors do not turn a successful send into an unknown outcome.

## Ownership

Mobile coder owns only apps/mobile and focused mobile tests. Backend/core coder
owns packages/core and services/backend, plus its manifest/lockfile if needed for
proper single-emoji validation. Parent owns docs, integration, review, Git and
runtime. No concurrent writers in any one file. No real test sends, private-chat
model diagnostics, hidden live restart or edits outside this project.

## Client changes

Confirmed duplicate-key cause: conversation ScrollView and VoiceComposer are
siblings with the same `key={id}`. Preserve chat-switch recorder reset with unique
scoped keys; do not dedupe chat data or append row indexes to hide the warning.

Right-side action is Mic with empty composer, Send with text/image/voice clip,
and Stop while recording. Keep local voice preview/delete and acknowledged hold
before permission/picker. Audio file selection remains reachable without a
permanent extra mic/file row. Preserve native layout teardown before Expo release.

Resume must show immediate busy feedback and apply the acknowledged Conversation
without waiting for a second full snapshot. No optimistic claim that the backend
resumed before success. Keep session-epoch/workflow guards and failure feedback.
Reaction UI renders actor observations from both clients, including removal, not
only the legacy single message.reaction field. Add fire to quick reactions and
allow other validated single emoji through the existing picker where practical.
Sequence draft previews show separate messages in order. Editing may deliberately
flatten the sequence into one owner-edited text reply; label that behavior.

## Implementation and evidence

The implementation is complete. Components optionally store quotedMessageId,
delayAfterPreviousMs and dueAt; Workflow serializes dispatch per conversation,
wakes cancelled gaps immediately and checks every handoff. Restart cancels queued
sequence parts instead of replaying them. Presence is a verified socket/turn lease;
old cleanup cannot stop a newer lease, and presence failures do not alter accounting.

The focused review found one race: delayed microphone/picker operations could
continue after the composer became inactive. Operation epochs now invalidate those
continuations, recorder guards cross permission/preparation awaits, and late clips
are released. Native layout teardown before Expo release remains. Regression tests
cover inactivity while waiting for hold, picker, native preparation and web mic.

Parent reran 121 tests, strict workspace typecheck and Android/web exports after
that fix; all passed. No real test sends, private model diagnostics or test presence
updates were used. Real typing/reaction visibility remains owner-device evidence.

## Verification

Synthetic source-shaped Baileys reactions, duplicate siblings, no-empty Send,
mic/text transitions, Resume acknowledgment vs delayed snapshots, family/flag/skin
emoji and invalid text rejection. Pacing, every-component units/quotes, pause/new
input/expiry after first accepted message, unknowns/restart, stale presence and
existing photo/voice guards need focused tests. Then workspace typecheck, one
focused read-only review and mobile exports. Real typing visibility remains owner
verified; do not claim it merely from mocked sendPresenceUpdate.

## Mobile usability update, 15 October 2026

The owner reported the Android keyboard covering the composer and inline draft
editor, missing chat auto-scroll, and a microphone that did nothing after granting
permission. These fixes are bundled as 0.1.2/code3 with the same Android identity
and release key. No icon, model, consent, account data or live backend changes are
part of this update.

Page now owns one keyboard-avoiding container, using Android height/iOS padding
and the measured screen offset rather than a guessed header height. Review inputs
are revealed after keyboard display; draft editors autofocus and have bounded
height with internal scrolling. Tabs hide while typing and scroll taps reach their
actions without requiring keyboard dismissal first. Assistant/conversation no
longer nest an additional keyboard container.

Conversation scrolling is isolated in a scoped hook. Follow intent is distinct
from the actual visible bottom used for unread acknowledgment. New content and
keyboard/media resizing follow only near the latest messages; history browsing
stays put. An accepted owner text/photo/voice send or draft approval jumps to its
latest view. Reactions do not pull the reader away from an older message. A Latest
button resumes following. Draft focus reveals the editor instead of chasing new
incoming content. Position restoration is keyed by history cache and chat; stale
callbacks cannot scroll a replacement profile. Drag and momentum suspend following,
including incoming content arriving before the first drag scroll event.

Two native-shaped recorder regressions reproduced a failed-start retry lock and a
silent native no-op. Failed startup now releases a prepared recorder while it is
still alive, resets mode and removes local bytes. The UI only claims recording
when the native recorder reports it. Preparing/error/cancel feedback is visible by
the microphone, permission instructions name Otherme, and inactive starts remain
blocked. Permission/background cancellation does not silently resume recording.
Existing layout teardown before Expo SharedObject release, hold acknowledgments,
operation epochs and explicit Send remain required. No real recording was captured
by the agent. The exact physical-phone failure still needs the owner to retry the
new APK; simulations are not hardware proof.

Review task: `otherme-keyboard-scroll-review-20261015-r1`, Takomi Sol Medium.
Its one drag/content race was fixed with a regression. A separate scoped voice
review checks the added native retry cleanup. Release evidence and exact task IDs
are recorded in the session's task26 packet. All 190 workspace tests, typechecks
and web export passed after both fixes. The actual signed 0.1.2/code3 APK passed
the build worker's checks and the parent's independent verifier, including native
adjustResize, approved certificate, embedded bundle and credential-byte scan.
The artifact is `.runtime/releases/Otherme-0.1.2.apk`, 75,499,947 bytes, SHA-256
`264bc467271accecae6ee45ff8f69c613d845d0c484ae6df395be16aa6d47bdc`.
Both earlier APK hashes are unchanged. Install over the existing app without
clearing data. No backend restart or account re-link is needed for this update.

## Deferred profile/linking feedback

The owner wants familiar Create profile, Switch profile and Link/Relink labels
instead of Use another number, Return to preserved profile and Repair this number.
The flow should explain whose account is linked and where to display/scan the QR,
including when Otherme and WhatsApp are on the same phone. This belongs to the next
UX batch. It is recorded here, not implemented as unrelated scope in the keyboard,
scroll and mic patch.

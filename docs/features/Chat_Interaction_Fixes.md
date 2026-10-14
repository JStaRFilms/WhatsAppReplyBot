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

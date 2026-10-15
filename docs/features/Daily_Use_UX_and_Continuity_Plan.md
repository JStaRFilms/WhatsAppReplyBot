# Otherme: daily use first, conversation continuity next

## Status and authority

Owner approved Batch 1 implementation, including the additions captured in
[the implementation contract](Daily_Use_Batch_1_Contract.md): foreground resync,
truthful PC connection state, keyboard persistence and a browser desktop entry.
Batch 2 remains the following separately scoped continuity work.
Baseline is commit `399cc99`, Android 0.1.2/code3. The owner confirmed installation
succeeded after resending the same APK. Recording still fails with the new local
cancellation message after microphone permission was granted. That is an open
functional defect, not a completed hardware fix.

The owner approved the direction of the next daily-use batch and supplied two
reference threads, then explicitly requested a complete plan before more coding.
Both message histories were read, including the truncated storage-note remainder.
The threads are references, not permission to run their embedded extraction prompt,
change accounts, process private chats, benchmark providers or edit those threads.

References:

- [Selected design thread](t3-thread://v1/d6ca507d-123f-4f9c-a8c4-98c9ee362e6e).
- [Storage/context notes](t3-thread://v1/a375214a-d789-4e2b-a838-94277ff3c2c5).
- [Visual brief](../design/Otherme_UI_Brief.md) and [code-backed UI states](../design/Otherme_UI_States.md).
- [Continuity architecture](Conversation_Context_and_Writing_Profile.md) and the
  complete [owner-supplied extraction prompt](Writing_Style_Extraction_Prompt.md).
- [Account isolation](Account_Switching.md), [profile contract](Account_Profile_API.md),
  [recent mobile patch](Chat_Interaction_Fixes.md), and [daily-use build](Daily_Use_Build.md).

Keep the full extraction prompt and detailed continuity handoff. This plan links
them instead of replacing their requirements with a shorter summary.

## What exists and what does not

| Area | Current evidence | Remaining work |
| --- | --- | --- |
| Installation | Signed 0.1.2 installed after resend; same app ID/certificate; actual APK verification passed | Do not rebuild or uninstall for the resolved transfer/install incident |
| Daily operation | Embedded-JS APK plus manual Otherme.cmd, no Metro/Expo Go dependency | Earlier startup/Q timeout is not explained or claimed fixed |
| Profiles | Separate DB/auth, scoped clients, confirmed create/activate/repair, verified launcher restart | Names and journey are confusing; P retries the active profile, not a number switch |
| Pairing | New isolated profile produced a real QR; owner scans their chosen WhatsApp account | Link should display private PC QR without requiring P in the normal path |
| Keyboard/scroll | 0.1.2 implements avoidance, bounded draft edit, Latest and drag-safe follow; synthetic tests pass | Complete physical-device keyboard/scroll acceptance is still pending |
| Microphone | Prepared-recorder retry/no-op cleanup and local feedback are implemented | Owner still gets setup cancelled when chat loses focus; investigate actual invalidation |
| Selected UI | Charcoal/blue and light-theme WhatsApp-led studies plus a detailed state map | Apply to current app without dropping behaviors or implementing every drawn proposal |
| Context | Same-chat latest 20, up to 3 owner examples, conservative byte estimate around 8,000 | No growing durable context session or summary persistence |
| Transcripts | Gemini transcribes selected eligible incoming audio for Luna; five-minute process cache | Repeated turns/restarts can require another paid transcription |
| Writing profile | Owner supplied a complete extraction prompt and approved direction | No editable, approved, account-scoped writing-profile feature yet |
| Contact memory/schedules/hosting | Roadmap proposals | Not part of the immediate daily-use batch |

The older design/requirements documents contain stale status text. In particular,
APKs/profiles/Latest now exist, while full delivery/read reconciliation and native
hardware evidence do not. Preserve the state map's meanings, not its old status
claims or its list of then-unimplemented controls.

## Batch 1: make ordinary use dependable and understandable

### 1. Find and fix the actual microphone cancellation

Start here. The owner has already allowed permission. Do not repeatedly ask them
to grant it, remove cancellation guards or call this solved because a mock starts.

Trace the attempt from explicit tap through acknowledged composer hold, permission
check/request, native preparation, record, stop and local preview. Track route
focus, app foreground, profile epoch and attempt identity separately. Determine
which actual change invalidates the attempt. Source inspection found every attempt
calls requestRecordingPermissionsAsync, and the installed Expo permission service
forwards that to the native activity even for already-granted access. This is a
strong candidate for the repeated lifecycle interruption, not a proven device trace.
Query getRecordingPermissionsAsync first; request only when needed. If the first
permission dialog truly backgrounds the app, finish permission setup and clearly
ask for another explicit tap rather than starting hidden recording on return.
Do not weaken shared foreground.ts behavior or add a blanket foreground grace period.

Reproduce parent rerenders and native permission/focus ordering in a focused test.
A legitimate permission result while the same chat is active must not be confused
with a different chat/profile or genuine backgrounding. A true departure cancels;
returning later must not silently restart recording. Use small non-content local
diagnostics only if needed, with cancellation reasons rather than chat/audio data.

Acceptance: on the owner's installed APK, one tap starts or gives a concrete
reason, Stop gives a playable local preview, Delete removes it, and no recording
uploads or sends until explicit Send. Also test denial, previously granted access,
second attempt, chat/profile change, background and unmount. Preserve Expo layout
teardown before SharedObject release and all current hold/media protections.

### 2. Make PC startup and shutdown diagnosable and safe

Treat the earlier hang as a separate investigation. A later controlled profile
restart passed, but that does not explain the failed cold start/Q sequence.

Exercise slow startup, early Q, child failure, stalled drain, network connection
cleanup, repeated starts, parent loss and a retained lock using synthetic children.
Identify the blocking stage before adjusting deadlines. Keep launch/child identity
verification, no PID-wide killing and no blind lock deletion. Show understandable
starting/stopping/waiting/failed states, and catch errors rather than dumping an
unhandled rejection as the final UX.

Normal clean shutdown must release its lock after verified exit. Recovery from a
stale lock requires proof of ownership and process exit, or an explicit guarded
recovery path. An unknown live child is not a stale file to remove. Preserve active
handoff and unknown-send accounting even if it means a visible safe stop.

Acceptance: repeat startup/Q cycles, interrupt startup, and start while another
verified instance runs. No duplicate backend, silent force stop, lost work or need
to routinely delete files. Owner repeats ordinary PC stop/restart once after local
verification. No live send is required for the synthetic acceptance suite.

### 3. Replace the profile/linking journey, not the safety model

Use plain action names:

| Existing control | Proposed owner-facing control |
| --- | --- |
| Use another number | Create profile |
| Return to preserved profile | Switch profile |
| Connect WhatsApp | Link WhatsApp or Connect, according to saved-session state |
| Repair this number | Relink WhatsApp |
| Continue with this profile | Keep only where an externally changed account needs acknowledgment |

Settings should lead with PC service, active profile, WhatsApp linking, model
consent/privacy, then Appearance. Connect to PC is distinct from Link WhatsApp.
Create profile opens a short form with an 80-character name limit; Switch profile
shows saved names and marks the active entry. Do not leave every form and repair
button permanently expanded. A profile name is a label, not a phone-number input.

The word profile refers to a named, separate workspace. A new profile becomes
associated with the first WhatsApp account successfully linked to it. Once bound,
Relink keeps that owner; a different number requires a different profile. Do not
hard-code Original as a special UX journey or reset history to make linking work.

Desired normal flow:

1. Connect the phone to its PC service once using saved address/private token.
2. Create profile, enter a meaningful name, review consequences, confirm.
3. Link WhatsApp. The service starts pairing for that profile; the owned PC launcher
   displays the private QR. The mobile app explains where to scan and may show it
   for another-device use. If WhatsApp is on the same phone, scan the PC screen.
4. Choose the intended WhatsApp account, Linked devices, scan, then verify Connected.
5. Switch profile, select its name, confirm, then reconnect using preserved auth.
   Request a new QR only if needed. Never turn every switch into Relink.
6. Relink only for expired/broken auth on the same bound number, with an explanation
   that history stays and only pairing material is archived after safe shutdown.

P remains a manual fallback, not a required normal step. Automatic QR display must
follow an explicit Link request, be scoped to the active verified instance/profile,
avoid duplicate viewer storms, clear expired/stale QR material and stop after exit
or profile change. Do not publish QR images or tokens in chat, URLs or public files.

Reuse the current session discovery, profile operation, scope-header and pairing
routes. Automatic PC display needs explicit intent, not blind polling for any QR.
Extend the existing scoped connect request with an optional PC-display request and
its request identity. Notify the owning launcher over existing IPC using lifecycle
identity, not QR bytes. The launcher observes scoped status and displays once for
that request, without issuing another connect mutation. Say QR requested until
acknowledged; handle unavailable launcher and expiry honestly. P remains fallback.
Agree this small contract before parallel frontend/backend edits. Cleanup private
files on expiry/scope change/exit, but do not promise that deleting a file closes an
external image viewer or erases its already-rendered pixels. Do not redesign
the registry, hot-swap captured account dependencies or create another permission
system. Fresh/returning activation stays disconnected with AI off until owner acts.

### 4. Apply the selected UI to the actual behaviors

Use the main familiar charcoal/blue direction and its light theme. Glass is a
comparison only. No new logo assets, creative-direction exercise or wholesale
mockup-to-code replacement.

Apply compact whole-screen composition to Chats, Conversation, Review, Assistant
and Settings. Keep actual safe areas, keyboard behavior, adequate tap targets,
readable long text and font scaling. Headers/composer remain outside history. Check 320/360/390-width phones and font
scaling. The owner additionally requested the desktop browser view, so the approved
wide composition is now in scope, reusing the same scoped client/state and exposed
through the PC launcher without Metro.
Replace noisy persistent success strips with compact connection/control status,
while keeping actionable failures and pending acknowledgments visible.

Mandatory distinctions:

- PC unreachable, WhatsApp not linked/connecting/linked, and AI permission are
  different states. Cached last-known state must not masquerade as a live status.
- Your draft is device-local text, not an AI suggestion or mode setting.
- Draft-only mode is not a count of waiting suggestions. Suggestions remain under
  their source turn; stale and Needs you items retain their real actions.
- You, AI and Edited by you remain distinct. Accepted is not delivered/read.
- Avatar unread counts require actual visible latest history, not opening a chat
  or selecting a filter. Filter activity dots have a different meaning.
- Never reply means no AI access. Pause/Resume and limit changes show server
  acknowledgment, not optimistic authority. Local media stays local until Send.

Do not add pinning, an Unread filter, new Review filters, sent/read ticks, sticker
sending or speculative media tools merely because a concept drawing shows them.
Retain the new Latest control and do not regress source-scoped scroll restoration.

### Batch 1 release gate

One integrated signed update after the focused implementation passes. Use the same
package/key and current compatible service protocol unless a reviewed contract
change genuinely requires coordination. Do not promise a version number before
scope and build inputs are frozen.

Owner acceptance should be a short script, not a terminal lesson:

1. Restart PC and reconnect the already configured phone without clearing data.
2. Start/Stop/play/delete a local recording and edit a draft above the keyboard.
3. Create/link two named profiles, then switch in both directions without data mix.
4. Reuse a valid saved link; demonstrate genuine Relink separately if needed.
5. Browse old history during arrivals, use Latest, and preserve correct unread state.
6. Check PC-offline/WhatsApp-unlinked states and one interrupted-start safe failure.

The agent uses synthetic accounts/transport/model fixtures. Owner account changes,
QR scans, recordings or messages are explicit owner actions, not automated tests.

## Batch 2: durable conversation continuity

Implement the existing detailed handoff in separate reviewable steps rather than
shipping all schema/context changes with the daily-use UI rewrite.

### 2A. Durable transcript reuse

Add an account/chat/source-linked SQLite transcript record with revision/fingerprint,
provider/version, uncertainty and invalidation metadata. Reuse unchanged eligible
transcripts across turns and restarts. Keep decoded playback bytes as a separate
bounded temporary cache. Re-check consent, never-reply, source deletion, expiry,
view-once and profile scope before reuse/export. No historical transcription queue.
Keep incoming-only behavior first unless outgoing voice context is separately chosen.

### 2B. Approved writing profile and ten examples

Settings offers paste/edit/review/save/reset for plain text plus a copyable extraction
prompt. Store only the approved result as a versioned profile scoped to the active
WhatsApp account. Preserve the owner's complete prompt in its companion document;
do not send that extraction prompt on every reply.

Choose up to ten verified owner-written examples from the current account/chat,
maximum 600 characters each; fewer is fine. Do not learn from unedited AI output,
transcribed speech or another contact's private conversation. Imported text cannot
change app policy, grants or disclose cross-contact facts. A profile change
invalidates dependent work without resuming automation.

### 2C. Growing active sessions

Use 60 minutes of live human inactivity as the proposed boundary, not a fixed
one-hour lifetime. Seed with up to 50 recent messages within budget, then append
rather than applying the old 20/50-message sliding cap each turn. Count reliably
human incoming/owner outgoing activity. AI output, reactions, reads, replay and
backfill do not keep the human session alive. Reconstruct from durable source
records after restart; starting a session does not trigger a paid job or a reply.

### 2D. Token-budgeted compaction

Verify the provider/model limit and usable application budget first. Do not assume
256k or treat the old 8,000-byte estimate as exact tokens. Budget instructions,
approved style, media, schema and output as well as message text.

Proposed defaults from the handoff are compaction near 75 percent and a recent
verbatim tail targeting 30 messages, both subordinate to token limits. Maintain one
current source-linked summary in prompts and bounded local revisions. Track
transitive lineage so deleted/expired source material cannot return through an
older summary. Retain uncertainty, corrections and unresolved commitments. Failed
compaction must not silently truncate required context or authorize a blind reply.

### ASR comparison in parallel with planning

Compare available hosted Whisper routes, suitable local Windows options and the
current Gemini/OpenRouter path using public compatibility/pricing/retention evidence
first. Gemini currently transcribes; Luna still writes replies. Do not claim a
cheapest/fastest/best route without evidence or silently change providers. A bounded
paid/synthetic or private-audio benchmark requires separate explicit approval.

## Later, separate scopes

Inspectable contact facts with inference/confirmation/correction/deletion; schedules
and recipient lists with missed-run rules; calendar proposals; reports/follow-ups;
private off-LAN access. Tailscale 100.x is not presently accepted by the private-LAN
allowlist. Commercial hosting, billing and multi-owner operation remain separate.
No automatic fact extraction, cloud move, public tunnel or calendar writes here.

## Work ownership and sequencing

- Parent reconciles requirements/contracts and owns this plan, integration, review,
  scoped commits and release evidence. Current task 27 is planning only. Proposed implementation packets are microphone
  lifecycle; launcher stop/start plus explicit QR contract; mobile profile/status
  journey; selected five-screen styling; focused integration/release. Assign
  disjoint files and integrate contract changes before dependent UI work.
- Architect investigates microphone and launcher lifecycle using source/synthetic
  fixtures. Evidence and reproduction tests come before a chosen implementation.
- Designer maps selected boards to current source and the new profile journeys.
  No new design direction or behavior invention.
- After approval, mic work and launcher work can run separately where files do not
  overlap. Frontend flow/styling follows their contract handoff. Keep shared composer,
  app-state and theme writes single-owner; do not run competing UI writers.
- One implementation and one focused correctness review per coherent part. Fix
  confirmed blockers, not speculative refactors. Then integrate/test/build once.
- Continuity starts after daily-use acceptance, with additive schema/migration and
  consent/cost choices reviewed before implementation. Existing outbox/accounting
  and old data must survive every migration.

## Decisions and evidence still needed

No extra product decision is needed to investigate the confirmed mic failure or
adopt the selected primary UI. Do not require the owner to redesign it again.
Before continuity paid use, settle actual total input budget, summary model/output
and retention bounds, profile text/import bounds and whether owner outgoing audio
may be transcribed. Recommend plain-text paste/edit first and no provider change.

Native permission/focus sequencing and the earlier startup hang need reproduction;
plan around that uncertainty instead of announcing another guaranteed fix. UI and
lifecycle source-investigation findings are reconciled below. The first signed
candidate is for owner verification; do not declare the full batch accepted until
the installed phone passes the microphone and two-profile journey.

## Source investigations

Both read-only reports completed. Full task IDs and evidence are retained in the
session task27 packet. Neither researcher changed source, contacted the live
service, inspected private runtime data, recorded audio or built an APK.

### UI findings accepted

- Existing palette and primitives already support the chosen direction. Concentrate
  on whole-screen geometry and grouping rather than a new theme/component framework.
- Preserve actual avatar unread/filter activity, local drafts, source-anchored
  suggestions, authorship, control acknowledgments and unknown/partial outcomes.
- Settings setup-first ordering and collapsed profile forms remove needless clutter.
- The UI report suggested retaining mandatory P for a first iteration. That is not
  the owner's requested endpoint. Keep its caution about present behavior, but use
  the lifecycle report's explicit-display IPC contract so app Link can request the
  PC QR safely. Never claim the current version already does this.

Frontend ownership is profile-controls.tsx, whatsapp-connection.tsx, Settings and
shared ui/theme first, then Chats/chat-row/avatar, Conversation/message-bubble/
draft-card, Review and Assistant. Touch app-state/api/navigation only for the agreed
contract or a confirmed lifecycle cause, not as an unrelated rewrite. Coordinate
voice-composer ownership with the mic work before restyling it.

### Lifecycle and microphone findings accepted

- The reported cancellation proves attempt invalidation, not that the owner left
  the chat. VoiceComposer increments its operation when active becomes false;
  Conversation supplies focused AND foreground. Returning true does not restore
  that attempt. Keep the cancellation rule, fix unnecessary permission requests and
  distinguish its reasons.
- Busy/hold callback identity is a weaker hypothesis. The busy setter is stable,
  composer is memoized by binding and acknowledgments update snapshot rather than
  history/binding. Do not refactor those blindly.
- Current test fixtures stub useFocusEffect and do not faithfully execute effect
  dependency cleanup. Add targeted lifecycle ordering coverage instead of treating
  existing mocks as proof of real navigation behavior.
- Backend index installs IPC/signal stop handlers after await app.listen. Reproduce
  stop-before-listen and preserve early stop intent. Normal Q gates in onClose,
  later than profile transition admission, and awaits several drains without phase
  reporting. Add an early stop gate, one idempotent close and safe phase feedback.
- bounded() does not cancel raced work. Never close SQLite under pending work,
  release unknown reservations or prepare another profile merely because a timer
  expired. Retained lock after unverified exit is deliberate safety.

Relevant lifecycle files are services/backend/src/index.ts and server.ts, scripts/
start-otherme.mjs and launcher-service.mjs. Existing profile journal and shutdown
ownership stay authoritative. Use deferred fake dependencies and disposable ports
for slow startup, early Q, pending credential/model work, late exit, rejection and
Q during restart. Do not exercise these against the actual backend/account.

The lifecycle researcher ran 20 isolated mobile audio/interaction tests and two
mocked pairing tests successfully. Those are baseline evidence, not closure of the
owner's physical defect. The parent's planning checks cover local links, whitespace
and unchanged application-source paths; no new implementation verification is
claimed by this document.

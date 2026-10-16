# Messaging corrections for 0.1.4

## Why this round exists
The owner tested 0.1.3 after the PC refresh corrections and reported native photo, sticker and video crashes; broken Latest on both clients; reaction bubbles and delayed reaction feedback; intrusive receipt, draft, provider and recording text; a normal audio-picker cancellation shown as an error; slow or confusing media transitions; intermittent disabled sending; and AI replies that apparently lack voice-note transcripts. Keep composing during sends and the working image-send/audio-playback paths.

This is a correction to the existing approved design and implementation. Genesis and the original UI design are complete. Do not create a new product, visual language or orchestration session. The owner wants routine compatible diagnosis and fixes without approval polling.

## Visible behavior
- A reaction appears on its target immediately. It is not a new chat message. Preserve real failures and uncertainty without presenting transport bookkeeping as conversation content.
- Message status occupies a stable small slot beside the timestamp. Clock means pending. One tick means genuinely sent, two ticks delivered, blue two ticks read. Accessibility labels and tap-accessible details explain states. Never infer receipt evidence from HTTP success, an optimistic row or an accepted outbox.
- Remove normal Sending, Dispatching, Accepted by transport and Awaiting WhatsApp acknowledgment paragraphs. Unknown outcomes remain clearly actionable and must not invite blind resend.
- Latest moves immediately using a known current tail, without waiting for an unnecessary network read. If that page is genuinely absent, fetch it with a compact honest indicator. A delayed old page must not cancel a newer jump. Load newer automatically when needed near the visible end; do not require the routine Load newer button or fetch unbounded history.
- Keep the viewport, focused editor, newer composition, quotes and exact visible-only app-view acknowledgments. No WhatsApp read receipt on opening.
- Known draft text paints immediately. Use brief ordinary language when the original message is loading or sending is blocked. No cached-authority jargon. Do not weaken source/revision checks to change the copy.
- Normal file-picker cancellation is quiet. Returning from an intentional picker is not a microphone failure. Actual route blur must still cancel even while the app is already backgrounded. Recording never resumes secretly. When browser recording is unavailable, the voice control offers its existing explicit audio-file picker with a matching file icon/label instead of a disabled mic and permanent HTTPS paragraph. This is the same authorized picker path, not a claim that recording became available.
- Photo/sticker/video viewing must not crash. Preserve explicit paused video, one audio lane, foreground-only behavior and source revocation. Show a visual loading state and real transfer information only when measurable, never fabricated percentages. Avoid raw attachment placeholders beside a supported viewer.
- Keep voice messages visually recognizable through upload/acknowledgment instead of several incompatible text-only cards.
- Apply unslop-gpt-ui to the encountered UI, not a word blacklist. Delete explanations that do not help the user understand, decide, act or recover. Do not replace every deleted paragraph with a tooltip or a new explanatory panel. Relocate useful secondary detail only to a suitable existing accessible destination; otherwise report a proposal. Keep decision-critical provider identity, external-AI data categories/costs, permission breadth, storage limits, uncertainty and retry risk at their actual decision points. Never silently enable AI.
- Show the reason for a real disabled action, but do not disable sending merely because an unrelated read is in progress. Preserve actual unknown-lane, profile, recording, permission and source blockers.
- Eligible incoming voice-note transcripts must reach the reply context under existing consent and paid-attempt rules. Diagnose the actual missing step. Do not send an internal instruction asking the recipient/owner to interpret an attachment as if that were a normal reply. Do not invent transcripts.

## Copy-pass boundary
The intended user is the account owner using ordinary messaging, not a developer inspecting transport/workflow internals. Copy edits are authorized for the reported settings/setup and consent states, chat/pending/receipt states, draft source loading/conflicts, media opening/loading/failure, and composer/picker cancellation/restriction states. Review and Assistant are included only as directly affected shared callers, not a whole-app tone rewrite. Trace actual handlers/data and accessible labels before deciding delete/rewrite/retain/relocate/defer. Keep UI copy changes separate from the independently authorized functional corrections below. Each copy-owning slice records bounded decisions and real verification limits. No invented success, recovery route or progress claim.

## Implementation boundaries
56 owns media viewers, attachment/voice picker lifecycle and their local loading/copy.
57 owns conversation rendering/navigation, history/scroll, pending intents/reaction overlays and app-state/controller gating.
58 owns message-bubble presentation, outgoing status, draft cards and settings/control presentation. Keep existing component props compatible. OutboxStatus must retain useful content for its shared non-chat callers;57 owns eliminating duplicate content and standalone reaction bookkeeping in the conversation caller. OutgoingStatus may add optional deliveryState: pending | failed | unknown | cancelled for local pending rows; existing receipt/simulated props remain. Preserve the existing MessageBubble interface; 57 can project pending reactions through Message.observedReactions.
59 owns backend/core transcription/context and measured send/receipt diagnosis. No mobile files.
60 is one combined focused read-only review. 61 is parent integration, verification and release.
Do not edit a sibling's files. Request a handoff for a truly necessary interface change rather than racing another writer.

## Safety and evidence
Do not delete or rebind message IDs, aliases, outboxes, grants or history. Keep scope, epochs, expiry, view-once, no-AI, unknown accounting, bounded caches and immutable captures. No automatic mutation or paid retry, account relink/reset, live send, provider request, service restart, lock deletion or process kill. Delegated tests use invented data, fake transports and ephemeral ports, never real3210/8081/8083 or private DB/media/auth/env. Parent may use existing authorized narrow read-only local diagnostics with redacted results.
No new native dependencies or permissions. Keep Contacts57.0.7 and Video57.0.5. All-day testing hold is superseded only for this reported correction scope, not unrelated enhancements.
Target new candidate0.1.4/code5, same package/signing key, through the existing approved C:/Otherme-build only. Parent owns versioning, build-copy updates, commits, review acceptance and artifact delivery. Preserve0.1.3 and every failed evidence artifact. No uninstall/clear-data instruction.

## Completion
Each implementation slice supplies a demonstrated failure, focused regression checks, exact changes and limitations. Parent runs relevant combined checks, real narrow/wide browser interactions, one review, fresh public/private artifact checks and actual signed APK verification. Source tests and browser mocks do not certify physical media/recording/codecs. Deliver the APK as an update and explicitly distinguish automated proof from owner-device acceptance. No release until blocking regressions are resolved.

## Data flow and storage
Use existing scoped snapshots, HistoryCache, PendingIntents, outboxes, receipt observations, media leases and source-linked ASR attempts. UI projections may be optimistic but are never backend authority. No persistent full-history mirror, new database schema, background generation or analytics scope is planned.

App-view acknowledgment now checks fresh physical viewport and source geometry after the existing600ms interval. If geometry changed before the native scroll event arrived, it starts a new full interval instead of marking the old sources viewed. Unchanged verification does not republish media visibility. Page, profile, refs, dialog generations and foreground state still fence the request.

The browser message-action dialog completes its focus cleanup before Quote focuses the composer once. Newer composition or scope changes cancel that request. Escape and Cancel retain opener return; native fade and hardware-back behavior remain unchanged.

## Corrected candidate verification
Parent serialized checks pass609 tests:101 core,153 backend,321 mobile and34 packaging. Workspace types and41 independent focused interaction checks pass. Task68's final16-context browser matrix passes, including real-wheel quote navigation, keyboard focus return, completed mouse Save, dialog privacy and exact-byte initial/reloaded photos with raw controls. A separate frozen-candidate browser gate and artifact verification are still required before release.

Earlier failed runs remain evidence. The original editor-movement observation lacks its baseline, and the original thumbnail spinner still has no proven cause. Current controls pass without a speculative editor or cache patch. Those passes do not establish a historical remedy. Actual configured-key ASR failures and physical Android media, keyboard and recording behavior remain owner-device checks. No paid probe, service restart, native-copy update or artifact promotion has occurred in this correction round.

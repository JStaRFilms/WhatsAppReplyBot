# Otherme UI states and flows

## Authority

This is the behavior companion to [the visual brief](Otherme_UI_Brief.md). It corrects the first DOOP composition studies. Apply the WhatsApp-led styling to these behaviors. Do not replace recent app changes with the simpler states in those older studies.

The source baseline is commit `4fe50d7`, `fix: align composer and reactions and add paced AI replies`, and the current working tree inspected on 14 October 2026. The preceding local-draft and owner-control commits also matter. No application code, live account, service restart, message send, or model request belongs to this design pass.

The new DOOP row uses three evidence labels:

- Code-backed behavior. The conditions, actions, and wording exist in the inspected implementation. The composition is still a mockup, not a screenshot of the running app.
- Design proposal. The first visual pass introduced this interaction or placement. It is not implemented or approved by being drawn.
- Device verification pending. Synthetic tests or source inspection cannot prove native microphone, gestures, keyboard layout, actual WhatsApp reactions, or remote typing visibility.

Visual choices such as compact headers, 48-unit targets, bubble radii, and blue accents can change. Draft ownership, triggers, unread semantics, acknowledgment, authorship, and send safety cannot silently change with them.

## Corrections to the first boards

| Earlier depiction | Current behavior and required handoff |
| --- | --- |
| All / Unread / Drafts / Needs me | Only All, Drafts, Needs me exist. Unread filtering is a proposal. |
| Unread count in the trailing lane | Count attaches to the lower-right of the avatar. The trailing lane remains timestamp and control/mode badge. |
| AI draft text replacing the latest-message preview | Local text displays Your draft. Otherwise the preview is the last message text, media-kind fallback, or No messages. Pending AI work can tint that preview; its proposed text is not the preview. |
| One Draft badge means one waiting suggestion | Draft also represents draft-only mode, even with zero pending suggestions. Do not count badges as proposals. |
| No persistent contact-mode labels | The current ChatBadge shows mode/control state in both inbox and conversation. Preserve it. Moving it is a proposal. |
| Every proposal collected at the latest end of history | The newest draft for each trigger stays directly beneath that trigger message. Earlier outdated drafts stay with their earlier turn. |
| Outgoing metadata says Accepted | Current bubbles show You, AI, or Edited by you and time. Demo AI output adds simulated. They do not render accepted/delivered/read receipts. |
| Review only contains AI drafts | Review also links local Your draft entries, and renders pending, needs_owner, and stale cards. |
| Resume is always actionable during typing | Resume now is disabled while the acknowledged composer is occupied, offline, or a control request is busy. |
| Outdated draft has Review changes | Current stale card has Dismiss. A regeneration or Review changes action is a proposal. |
| Jump-to-latest button with a new-message count | Current code preserves reading position but has no such control or count. Mark the control as proposed. |
| Review tab badge and Review filter controls | Current tab has no count badge. Current Review has no Drafts/Needs me subfilter. Both were visual proposals. |
| Pin and full-screen media viewer | Not present in the inspected conversation UI. Keep them out of current-state screens. |
| Interaction fixes marked in progress | The feature note now records implementation complete with synthetic verification. Real-device verification remains separate. |

## 1. Inbox, drafts, and activity

Sources: [Chats](../../apps/mobile/app/(tabs)/index.tsx), [ChatRow](../../apps/mobile/components/chat-row.tsx), [Avatar](../../apps/mobile/components/avatar.tsx), [ChatBadge](../../apps/mobile/components/chat-badge.tsx), and [local drafts](../../apps/mobile/lib/local-drafts.tsx).

### I01. Normal chat

The inbox sorts by latest human activity. Each row has initials, name, last-message preview, latest-message time, and the applicable control badge. Search matches the contact name. A draft-only contact may have a blue Draft badge without any pending suggestion.

### I02. Unread live messages

A green count badge sits on the avatar. It shows 99+ above 99. It counts inbound live messages after the stored conversation-view watermark. History sync and outbound messages do not add unread counts. It is Otherme's count, not a WhatsApp receipt or synced native unread indicator.

### I03. Filter activity dots

An inactive filter gets a small green dot when it contains activity not seen during that filter's current in-memory tracking. All tracks latest inbound-live message IDs; Drafts tracks pending draft ID plus revision; Needs me tracks needs_owner IDs. Visiting a filter while focused records its activity. Tracking resets on account change and component remount. It is not a persistent unread counter.

Removing a filter dot does not mark messages read. Opening All does not clear an avatar count. The selected filter does not show its own fresh dot.

### I04. Local owner draft

Any nonempty saved text displays Your draft in the preview, even when AI suggestions also exist. The current preview does not reveal the saved text. It remains scoped to service URL, account, and chat on this device. Its text never reaches the backend or model before Send. The backend sees only occupied/not occupied.

Whitespace-only text is still locally nonempty and occupied, but cannot be sent as text because the Send condition uses trimmed text. A selected photo or voice preview occupies the composer while mounted; neither is persisted as a local text draft in the draft store.

### I05. Pending AI suggestion

Drafts includes any chat with a pending AI draft or local owner text. The label count is pending draft records plus local-draft IDs, not distinct conversations. One contact can contribute more than once. Needs me includes needs_owner items. Stale-only work appears in Review but does not qualify a chat for Drafts or Needs me by itself.

When pending AI work exists, ChatRow tints the preview blue. It still shows Your draft if local text exists, otherwise the latest message. Keep the trailing badge's precedence intact.

### I06. Mode/control badge precedence

Evaluate in this order. Do not stack every badge on a row.

| Condition | Current label |
| --- | --- |
| Group, excluded contact, or Never reply | AI off |
| Manual control and composing | Your draft |
| Manual control and indefinite pause | Paused |
| Manual control and unresolved handover | Needs you |
| Manual control and future cooldown | Cooldown · N min, rounded up |
| Manual control and future empty-composer hold | Typing pause |
| Other manual control | Manual |
| Allowed auto mode with active finite allowance | Auto · N, remaining after successes and reservations |
| Allowed auto mode with active unlimited grant | Auto · unlimited |
| Auto mode without allowance or active eligible grant | Auto paused |
| Otherwise pending AI work or explicit draft-only mode | Draft |

AI off wins over all other badges. Manual holds win over auto status. Auto status wins over pending-draft status. The local preview and unread-avatar count are separate signals and can coexist with the winning badge.

## 2. Opening, reading, and unread acknowledgment

Sources: [ConversationScreen](../../apps/mobile/app/conversation/[id].tsx), [history cache](../../apps/mobile/lib/history-cache.ts), [app-state viewed operation](../../apps/mobile/lib/app-state.tsx), [unread storage](../../packages/core/src/store.ts), and [viewed endpoint](../../services/backend/src/server.ts).

### H01. First load

Load history before exposing a falsely positioned conversation. Cached history remains hidden and non-scrollable until its initial position is acknowledged by layout/scroll. Without cached messages, show the history spinner or Could not load messages. The initial open goes to the latest position unless a saved reading position exists.

### H02. Cached reopen

Use cached messages immediately and refresh by history version. Preserve the saved offset and whether the owner was at the bottom. Do not replace a known conversation with a whole-screen loader during a refresh. A failed refresh does not authorize clearing unread.

### H03. Reading older messages

When the owner scrolls above the newest messages, new content must not pull them down. Opening a chat, focusing the route, viewing a filter, or seeing an old message is insufficient to clear unread.

### H04. Mark viewed

The current screen waits 600ms while all of these are true: route focused, app foreground, initial position ready, at bottom within the 24-unit tolerance, current history version loaded, service online, and no history error. It acknowledges the loaded history watermark. Newer messages beyond that watermark remain unread. Leaving, backgrounding, scrolling away, or content changes cancel the pending acknowledgment. This does not send a WhatsApp read receipt.

Draw a before/after state where the avatar count clears only after this flow. Do not draw a tap-to-open animation clearing it immediately.

## 3. Source-anchored suggestion lifecycle

Sources: [ConversationScreen](../../apps/mobile/app/conversation/[id].tsx), [DraftCard](../../apps/mobile/components/draft-card.tsx), and [Review](../../apps/mobile/app/(tabs)/review.tsx).

### D01. Pending suggestion

For each trigger message, choose the newest draft by creation time. Render pending, needs_owner, and stale cards beneath that trigger, not at the end of the newest conversation. The current pending heading is Suggested reply with Not sent. Keep the exact proposed action separate from sent bubbles. Actions are Send reply, Edit where text is editable, and Dismiss.

### D02. Edit a single reply

Edit opens a local text field and captures the draft revision. The primary action becomes Save draft. Saving changes the draft; it does not send. A separate subsequent Send reply approval is required. Offline or busy blocks server decisions; empty or overlong text cannot save. A stale edit revision fails rather than silently overwriting a newer proposal.

### D03. Outdated draft

An outdated turn keeps its draft beside the original trigger with Outdated draft. It is not sendable. Dismiss removes it from the active render. New messages and newer proposals do not turn the older draft into a sent bubble or move it beside the latest message.

### D04. Needs you

A needs_owner card shows Needs you, the available action text or reason, and Handled. Handled dismisses that item. It is not Send, permission to generate, or Resume. Handover/control can remain paused after the card is handled. Typing alone does not resolve Needs you.

### D05. Accepted owner reply or explicit resumption

The workflow can resolve owner-attention work after the accepted reply or explicit resumption. The conversation only renders pending, needs_owner, and stale cards. Approved, dismissed, and resolved records are not permanent action cards in the history. Sending a draft does not imply general permission to resume unattended automation.

### D06. Ordered sequence

Preview each component as Message 1, Message 2, and so on, in order. Components with quotedMessageId show quoted reply. Two to five messages are optional; a single reply stays single. Each component consumes a unit. Dispatch is about five seconds after the previous accepted handoff, with policy checks before each component.

Edit as one reply deliberately flattens the sequence into one text action. The warning must say that saving combines the messages into one reply and removes sequence quotes. Use Save draft, not Send, during this edit. Do not preserve a multi-message visual preview after the save has changed its action type.

### D07. Reaction proposal

Reaction-only drafts currently display React followed by the emoji. Combined text-and-reaction actions currently render their text without a full separate target preview in DraftCard. Exact target/quote context remains a handoff requirement, but a new detailed combined-action preview is a design gap, not an implemented control. Label any richer preview as proposed.

### D08. Review queue

Local Your draft links appear before the server draft cards and open the owner composer. They do not expose text or provide AI approval buttons. Server items show the contact and their DraftCard state. Review includes stale items. Empty means No drafts need review. There is no current Review subfilter or tab-count badge.

## 4. Authorship, quote, status reply, and reactions

Sources: [MessageBubble](../../apps/mobile/components/message-bubble.tsx), [reaction grouping](../../apps/mobile/lib/message-reactions.ts), and [interaction tests](../../apps/mobile/test/interactions.test.cjs).

### M01. Authorship

Outgoing messages use the same outgoing alignment/color, with metadata identifying You, AI, or Edited by you. In demo mode AI and edited-AI metadata add simulated. Incoming messages have time, not an invented contact-authorship label. Bubble metadata is authorship and time, not an accepted, delivered, or read receipt.

### M02. Quoted reply

Swipe right to quote or use the long-press Quote this message action. The composer tray refers to the selected source and can be removed. The sent bubble renders available quoted context. Current quoted author text is You for outbound sources and Quoted message for inbound sources. A missing source does not currently render the brief's proposed Source unavailable block.

### M03. Direct status reply

Show Reply to your status with the available context, or Reply to your status · original unavailable. This is not support for browsing or publishing WhatsApp statuses.

### M04. Reactions and removal

Group reactions by emoji, with a count only when multiple distinct actor slots use it. Owner and AI echoes share the same account slot, so they do not double-count. Latest observations win; removal removes that slot's emoji and must not revive the legacy fallback. Accessibility identifies You, Contact, or Unknown sender. Reaction updates do not count as a new unread inbound message.

Quick reactions include fire. More emoji accepts one validated Unicode emoji, including supported joined/family, flag, or skin-tone forms. Invalid text gives Choose one emoji for a reaction. Selecting a manual reaction sends that action immediately; unlike a saved photo, it has no second local-preview Send step. Verified owner reactions can start a cooldown.

## 5. Occupied composer and acknowledged owner control

Sources: [ConversationScreen](../../apps/mobile/app/conversation/[id].tsx), [PauseControls](../../apps/mobile/components/pause-controls.tsx), [AppProvider](../../apps/mobile/lib/app-state.tsx), and [owner-control notes](../features/Owner_Control_and_Local_Drafts.md).

### C01. Occupied composer

Text, selected image, picker work, audio preview, or active audio work occupies the composer. Show the current Pause requested… state until acknowledged, Pause acknowledged after success, and Pause was not acknowledged on failure. Failure cannot visually grant safety. Media permissions/pickers/recording wait for the hold acknowledgment and invalidate late results after inactivity or a chat/session change.

### C02. Writing while held

An acknowledged composing hold gives Your draft in the control badge. Resume now is disabled while composing. Local text can remain editable offline when restored and not otherwise busy, but Send, attachments, and recording require the service. Audio preview locks the text input. Never reply has no AI control UI and still allows owner messaging.

### C03. Empty-composer grace

Clearing the composer releases only its typing hold after ten seconds. Show Typing pause if it is the winning reason. Other holds can keep the contact manual: indefinite pause, handover, cooldown, or another device's occupied composer. Do not animate every pause into active automation at ten seconds.

### C04. Owner send cooldown

An accepted owner send starts five minutes; further accepted owner sends reset the timer. The current badge uses rounded minutes, not seconds. At expiry unanswered backlog is drafted only; later incoming messages follow the prior mode and original remaining grant. No automatic send of accumulated backlog or creation of a new grant.

### C05. Resume request

Resume now becomes Applying… immediately and blocks repeated actions. Apply only the returned, acknowledged Conversation, without waiting for a full snapshot. Older workflow versions and responses from another session cannot replace the newer state. Failure keeps manual control and shows an error. Do not show a success toast before acknowledgment.

### C06. Pause menu

Extend pause · 5 min and Pause indefinitely are deliberate owner actions. An unresolved indefinite pause or handover requires owner action. Show Paused or Needs you, not an expiring countdown. Pause controls and Draft reply are absent for groups, excluded contacts, and Never reply. Draft reply is also absent while manual and becomes Drafting… while its request is busy.

## 6. Composer media and send outcomes

Sources: [VoiceComposer](../../apps/mobile/components/voice-composer.tsx), [AttachmentPicker](../../apps/mobile/components/attachment-picker.tsx), [MediaAttachment](../../apps/mobile/components/media-attachment.tsx), and [ConversationScreen](../../apps/mobile/app/conversation/[id].tsx).

### V01. Empty / text / quote

Empty composer shows Mic in the single primary action slot. Trimmed text, photo, or voice clip shows Send. A quote tray alone does not make an empty text send valid. The emoji picker inserts at the cursor/selection without sending. Photo captions use the same text field.

### V02. Recording

After hold acknowledgment and permission, show Stop in that slot and elapsed duration against the five-minute limit. Stop creates a local clip; it is not Send. Inactivity stops recording and prevents delayed operations from becoming active again. No persistent extra microphone or audio-import row.

### V03. Local audio / photo

Audio has Local preview, playback, delete, and explicit Send. Photo has its preview, Add a caption below, remove, and explicit Send. Audio import remains in attachments. Choosing or recording media is not uploading, exporting to a model, or sending. Local text is durable; these media selections are transient, not promised across restarts.

### V04. Uploading / sending

Show busy in the primary slot and block duplicate work. The input/attachment controls follow the busy state. Do not draw a completed bubble just because bytes uploaded. Clear text, quote, and media only after an accepted non-reaction send. Sending a reaction must not erase the owner's text.

### V05. Failure / unknown / partial

Known failed or unaccepted sends show the error and retain input/media. Unknown or partial outcomes use Send outcome is uncertain. Do not resend this message. The current screen uses its error notice and retains the pending intent; it does not have a separate per-bubble unknown badge, reconciliation button, or specially disabled unknown-state composer. Those would be proposals requiring implementation.

Do not add a Retry affordance to unknown outcomes in the design. A partially sent sequence keeps accepted components accounted for and stops remaining components; do not replay the whole sequence. Distinguish an attachment-download Retry from an outbound-send Retry.

### V06. HTTP microphone limitation

On insecure HTTP web, an empty recorder is disabled and shows Recording needs Expo Go or HTTPS. Choose Audio in attachments on HTTP. Keep text and file paths available when permitted. Device recording and native lifecycle need real-device verification.

### V07. Incoming media

Show download loading, actual supported preview, Media unavailable. Tap to retry. for a retriable preview failure, or Media unavailable for expiry. View-once media is not retained. Unsupported kinds show their attachment kind. Do not replace these with imaginary content. Only one audio playback lane is active; starting another note pauses the previous one.

## 7. Connections, permissions, and presence

Sources: [Page, ServiceStrip, ErrorNotice](../../apps/mobile/components/ui.tsx), [PermissionSheet](../../apps/mobile/components/permission-sheet.tsx), and [interaction feature notes](../features/Chat_Interaction_Fixes.md).

### P01. Service and WhatsApp are separate

The current service strip is persistent. Online service can still mean disconnected, connecting, QR pairing, connected, or error for WhatsApp. AI enabled/paused is separate consent. Preview explicitly says not linked or shows Preview · AI state. Moving this information into a compact header can be proposed; silently removing it cannot.

With no snapshot show Connect to your PC and Settings instructions. Offline with an existing snapshot keeps known content and local text, with server actions disabled. Errors appear in a dismissible ErrorNotice; dismissing one does not fix the connection or confirm a send outcome.

### P02. Permission change

Never reply, Draft only, and Auto-reply are explicit. Save creates a proposal; Confirm applies its exact payload. Auto permits finite or unlimited actions and preset, selected-date, or indefinite expiry. Longer/unlimited runs need risk acknowledgment. Reactions count toward the limit. Selecting a radio or saving the proposal is not final activation. Changing from manual may explicitly include Resume AI in the confirmation.

### P03. Auto allowance

Show remaining units after accepted and reserved components. Expired, exhausted, or missing allowance shows Auto paused, even if mode is Auto-reply. Presence or a green dot is not authority to send. Never reply and exclusions block model access, not only automatic sends.

### P04. Typing presence

The recent feature adds outbound composing presence toward the contact during an eligible auto turn, generation, and paced gaps. It is not a new inbound contact-typing indicator rendered by the phone UI. Do not add Leah is typing to the header based on this feature. Presence failures do not become unknown sends. Actual visibility in the contact's WhatsApp client needs device evidence.

## Design proposals kept separate

These can be evaluated later, but the state handoff does not approve them: Unread filter, Review subfilters/count badge, jump-to-latest count, pinned messages, a full-screen image viewer, hiding persistent service state, seconds-based cooldowns, regeneration on outdated cards, richer reaction-target previews, and dedicated unknown/partial reconciliation controls.

This design pass preserves current behavior rather than fixing those gaps. It does not claim that the proposed spacing, 48-unit targets, glass treatment, native responsive layout, or keyboard handling is already implemented.

## Verification

The existing mobile test suite was rerun with Node's TAP reporter. All 22 tests passed. This includes composer Mic/Send/Stop, acknowledgment before picker/permissions, inactive recorder guards, ordered sequence editing, reaction grouping/removal, and acknowledged Resume/session guards. No new test or app code was added. Unread and draft placement above are source-backed; do not describe them as new device-test results.

DOOP screenshot and design-board layout review is recorded below. Browser-scaled boards are visual evidence, not native accessibility, microphone, account integration, or keyboard tests.
## Delivered DOOP state boards

[Open the Otherme canvas](https://doop.design/c/zD7O0jmGDo). The new state row starts at y=3000; the unread flow sits at y=4300. These six boards contain 18 full-screen studies supporting the 39-state map above. They are source-backed behavior studies with proposed composition, not runnable native screens.

| Board | Frame ID | Local HTML |
| --- | --- | --- |
| Inbox, unread, and review | X_l9hjfjbP | [Open study](otherme-states-inbox-review.html) |
| Draft lifecycle and authorship | b_jscMoelw | [Open study](otherme-states-draft-lifecycle.html) |
| Owner control and resumption | 7LLt1XBBZn | [Open study](otherme-states-owner-control.html) |
| Composer media and sequence editing | sZpqtikfZO | [Open study](otherme-states-composer-media.html) |
| Failure and permission confirmation | GEne09GXh0 | [Open study](otherme-states-failures-permissions.html) |
| Reading position and unread acknowledgment | vpMtKbOM2C | [Open study](otherme-states-reading-unread.html) |

The first composition row now carries a notice directing readers to this state handoff. Its earlier Unread filter, receipt-like metadata, and simplified draft treatment are not implementation requirements.

All six new boards were screenshot-reviewed in DOOP. Headless checks at 1240-wide board size found no phone horizontal overflow, history/composer overlap, or hidden latest suggestion actions. Review items beyond the first viewport remain scrollable. The focused review also made a later Drafts snapshot show a genuinely new inbound message before displaying fresh All activity, retained Nadia's AI item alongside her local draft in Review, and avoided an impossible extra reaction slot in the two-actor sample.

The read flow shows the count unchanged while reading older messages, then clears only Leah's acknowledged count while other chats and filter activity remain. It does not draw an unimplemented jump-to-latest control or a WhatsApp read receipt. Real-device acceptance and the explicitly proposed controls remain outside this design pass.

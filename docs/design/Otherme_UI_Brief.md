# Otherme: UI design brief

## Product

**Public name:** Otherme

**Publisher:** JStar Studios

**Publisher website:** https://jstarstudios.com

Otherme is a personal WhatsApp-linked messaging client with an assistant that helps the account owner write and manage replies. The assistant can draft in the owner's voice, but the owner controls which contacts it may answer and under what limits. This is one person's tool, not a commercial multi-user service.

The phone app connects to a service running on the owner's Windows PC. The PC must stay awake and on the same local network. It uses the owner's existing WhatsApp account through an unofficial linked-device connection. Make connection state clear; do not suggest complete WhatsApp feature or history parity.

The owner will return to refine branding. The final public name is Otherme, correcting the owner's earlier Order Me typo.
A dedicated Otherme domain is not confirmed; jstarstudios.com is the current
publisher website. Product-domain names are only future options, not confirmed or configured. Start from charcoal/blue and light/dark themes, open to refinement. The product must have independent branding.

## Design goal

Make messaging feel familiar and compact while keeping assistant actions legible and under the owner's control. Match messaging-app density without copying WhatsApp logos or identity. Design phone-first and responsive at wider widths. Prioritize readable conversations, an accessible composer, and clear distinctions between owner-written, AI-drafted, and AI-sent messages.

Avoid decorative cards, excess labels, persistent warnings, and fake trust signals. Do not invent encryption, privacy, delivery, or receipt assurances. Show relevant state beside its action and remove it when it no longer applies.

## Screens and flows

1. **Chats.** Show recent conversations in a scannable list with contact, activity, preview, and concise draft or owner-attention indicators. Include search and filters.
2. **Conversation.** Show messages, timestamps, quotes, reactions, image previews, and voice-note playback in chronological order. Distinguish each author. The composer supports text, quoted replies, photos, and voice notes. When empty, its right-side action is the microphone; typing changes it to Send, and an active recording changes it to Stop. Local media stays unsent until the owner explicitly sends it. Recording, playback, and choosing a file need clear preview, pause/play, delete, and send actions where relevant.
3. **Review.** Gather drafts and items marked Needs Me. Show the exact proposed text, reaction, or sequence and its contact, with clear edit, approve, and dismiss actions. For autonomous work, show the permission and remaining limit that govern it. Handover and cooldown belong to that conversation, not a global alarm.
4. **Assistant.** Provide a separate owner-command conversation for requests such as reviewing unanswered chats or drafting for a contact. Resolve ambiguous names first. Preview and confirm before sending or changing permissions. Do not let incoming contact text or media act as owner instructions.
5. **Settings and pairing.** Explain the PC connection, pairing state, contact configuration, theme, and model/data boundary in plain language. The initial backend-token entry is private. Never ask for or put an OpenRouter key on the phone.

## Permission and handover model

Every contact has a clear mode: **Never reply**, **Draft only**, or **Auto-reply**. Never reply means no assistant access or reply. Draft only requires owner review. Auto-reply permits bounded sending only within the owner's configured limits. Show the active mode where it matters, with a deliberate path to change it and confirmation for consequential changes. A small indicator should make it possible to tell whether a reply is waiting for the owner, allowed to send, paused, cooling down, or held for Needs Me, without leaving warning clutter on every screen.

When the owner starts composing or takes over, the assistant must yield. Show a pause or handover only after the service acknowledges it; if acknowledgment is pending or unavailable, say so. Resume should feel immediate after acknowledgment, but never claim success before it. Cooldowns and message limits should be understandable at a glance. Timed cooldowns count down and expire. Unresolved handovers and indefinite pauses require explicit owner action; do not show those as automatically resumed.

## Content, delivery, and privacy states

The product handles actual message text, photos, and voice notes. A photo may be sent as image context to the model; a voice note may be transcribed to text for a reply. Treat transcription as fallible and identify its speaker from message ownership, not voice recognition. Keep a local recording or selected file private and unsent until explicit Send. Use a preview before sending media. Do not imply that an AI has seen media when it has not.

Show connecting, offline, draft, sending, accepted, failed, and unknown states only when supported. Transport acceptance is not proof of WhatsApp delivery or read status. An unknown outcome needs checking, not a retry button. Keep reactions tied to their target message and quotes tied to their source. Mark unavailable, expired, or unsupported media honestly.

## Current status and boundaries

Core messaging, media handling, review, contact permissions, and voice-note recording/playback/transcription are implemented in development. The interaction-fix pass is implemented in commit `4fe50d7`, including Mic/Send/Stop, reaction synchronization, acknowledged Resume feedback, outbound typing presence, and optional paced two-to-five-message replies. The feature note records synthetic verification. Native behavior and actual WhatsApp typing/reaction visibility still need owner-device evidence.

An installable signed Android APK and click-to-start Windows launcher are **planned**, not shipped. The first Android APK has authorization for dedicated release signing in a separate build pass after the current bug fixes. Daily use must not depend on Expo Go or Metro. The Windows PC still needs to be awake and reachable on the same LAN. Longer-term memory of facts and writing style beyond the three most recent examples, schedules, calendar features, and commercial hosting are future work, not current UI promises.

## Code-backed state handoff

Read [Otherme UI states and flows](Otherme_UI_States.md) before implementing or interpreting the mockups. It traces the current code's local drafts, filter activity, avatar unread counts, source-anchored suggestions, authorship, control acknowledgment, media, and uncertain sends. These meanings take precedence over the simpler first composition boards. Apply the visual direction to the existing behavior; do not replace that behavior with the mockups.

The DOOP composition row at y=1800 is an earlier visual study, not a complete state specification. The new code-backed flow row separates implemented behavior from proposed interactions. Unread filtering, Review filter/count controls, jump-to-latest, pinning, and a richer unknown-outcome UI remain proposals. No app code changes are part of this handoff.

## WhatsApp-led composition update

This section responds to the owner's three WhatsApp Android screenshots. It defines proposed composition and styling, not proof of the current app's exact geometry. Keep the product, permission, privacy, and delivery rules above and the state companion. Preserve the earlier accepted charcoal/blue direction. Glass is a comparison, not an approved replacement.

### Reference reading

The supplied screenshots are the primary composition reference. They show a dark full-width app, compact contact toolbar, edge-aligned bubbles, quoted-message blocks, voice notes, a pinned-message strip, a bottom-anchored composer, and a four-destination inbox navigation bar. The inbox has a separate title row, broad search field, horizontally scrolling filters, and contact rows with consistent avatar, preview, time, and unread lanes. The conversation has no bottom tab bar. Messages use most of the available height.

Treat screenshot pixels as reference proportions, not Android layout units. The captures are 720 by 1520 pixels; their status and system navigation areas belong to the OS. A 390 by 844 design frame uses logical layout units and representative safe areas, not a literal half-scale copy.

Borrow the interaction grammar, density, and anchoring. Do not copy the WhatsApp wordmark, logo, proprietary wallpaper, camera/call controls for unsupported features, or green brand palette. Use Otherme and JStar Studios. All example contacts and messages on the new boards must be synthetic. Do not reproduce the owner's screenshot conversation text or portraits.

### Direction A, familiar charcoal

Recommended starting point. Keep charcoal grounds, slate incoming bubbles, muted blue outgoing bubbles, and a clear blue primary action. Round search and composer fields, circular avatars, simple outline icons, and restrained bubble tails provide familiarity. Use a new sparse line pattern behind conversations at very low contrast, or a plain background. No decoration behind the inbox.

The creative element is how assistant work fits into ordinary messaging. A draft appears beside its source conversation as an unsent proposal, not as a dashboard card. Its label, border, and Send reply action distinguish it from a sent bubble. A small contact-mode control opens the permission sheet. Resume appears only when the contact is paused. No oversized assistant hero, analytics panel, floating AI orb, or stack of warning cards.

### Direction B, quiet glass

A secondary study using identical content, geometry, and navigation. Use near-opaque translucent charcoal only on the contact header, bottom navigation, composer shell, and sheets. Keep all messages, quotes, previews, and approval text opaque. Use one fine border and a small highlight, not glow or refraction animation. Blue remains the action color; amber indicates owner attention and green indicates enabled automation. Pair every state color with text or an icon.

For the web study, use a 16px backdrop blur and roughly 92 percent opaque dark chrome. This is a visual target, not a confirmed native implementation. Reduced transparency, unsupported blur, battery-saving mode, and reduced motion must have a flat equivalent with identical geometry. No animated wallpaper, gradient haze, tinted message text, or transparent text-bearing bubble. Default to Direction A until the owner chooses otherwise.

### Whole-screen geometry

Base artboard is 390 by 844. Evaluate 360 by 800 and 320 by 568 before handoff. Dimensions below are starting values at default font scale; let text-bearing rows grow for accessibility.

| Region | Chats | Conversation |
| --- | --- | --- |
| Top safe area | Use actual device inset; 24 in the Android study | Same |
| Main toolbar | 56, Otherme title and overflow | 64, back, 40 avatar, name, mode, overflow |
| Search | 48 high, 12 side insets, 8 top/bottom gap | Open on request, not a permanent row |
| Filters | 64 total, 48 tap lane with 8 top/bottom gap | None |
| Optional context | Offline strip only when needed | Pinned item 40 or interactive state strip 48; allow growth |
| Scroll area | Flex-fill list; 76 contact rows at default scale | Flex-fill chronological message history |
| Bottom app controls | 64 tab navigation plus actual bottom inset | Composer starts at 64 plus actual bottom inset |
| Study bottom inset | 24, not an extra second app footer | Same |

At 390 by 844 with those study insets and no exception strip, the inbox has 548 logical units for its list and the conversation has 668 for messages. A 48-unit takeover strip leaves 620. Keep these as useful-space budgets, not hard maximums for large text. Do not add a separate connection header above the toolbar, a large page title inside the conversation, or a second footer.

Use one safe-area owner per edge. Android gesture navigation, three-button navigation, iPhone home indicators, and web browser chrome differ. Never bake the screenshot's system bar into the application layout. Native conversations resize above the keyboard. The tab bar is absent in the conversation. The composer and its quoted-reply/media tray remain reachable when the keyboard opens. On web use a dynamic viewport height and a tested visual-viewport response where required.

### Chats

Use 12 to 16 side padding. Set avatars to 48, avatar-to-text gap to 12, and reserve a 56 to 64-wide trailing lane. Contact names use 17 semibold; previews use 14 to 15 regular; timestamps use 12. Names and previews truncate independently. Keep unread counts distinct from assistant-work counts. Unread here means unread in Otherme and does not imply WhatsApp read-receipt synchronization.

Current filters are All, Drafts, and Needs me. Unread filtering is a proposal, not implemented. Preserve filter activity dots separately from unread counts on avatars. Local text displays Your draft; otherwise show the latest message or media fallback, not the AI proposal text. Pending AI work can tint the preview. Keep the existing mode/control badge and its precedence. Draft can mean draft-only mode without a waiting suggestion. Drafts counts pending records plus local draft IDs, not distinct contacts. Horizontal scrolling and exact filter geometry are visual proposals.

Keep Chats, Review, Assistant, and Settings. An active navigation item has an icon pill and visible label. A Review count badge was proposed in the first study; the current tab has no count badge. Do not depict it as existing behavior. Avoid unrelated WhatsApp destinations such as Calls or Updates because they are outside current scope. No inert camera or new-contact button merely to resemble the reference.

### Conversation

Toolbar has a 48-wide back target, 40 avatar, flexible name block, compact mode control, and 48-wide overflow target. Contact mode can sit on the second line when width is tight. Do not show online or typing status without a supported event. No decorative video/phone buttons.

History uses 12 side padding, 4 between consecutive bubbles from the same author, and 10 between author groups. Text bubbles size to content, with a maximum of 86 percent of the available history width. Use 12 horizontal and 8 vertical bubble padding and 16 body text. Metadata uses 12; reserve its own last-line space so timestamps never cover text. Align incoming left and outgoing right. Use bubble tails only at the start of a group.

Quotes have an accent rail, author label, and up to three preview lines. They remain inside their parent bubble. Preserve the target identity and show Source unavailable when needed. Reactions attach below their target and reserve layout space instead of covering the next bubble. Long-press opens a reaction/action menu; swipe-to-reply also needs an accessible menu equivalent.

Voice notes use a minimum 44 play target, honest duration, progress, and explicit playback state. Do not invent an audio waveform without audio-derived data in the real app. Photos keep their aspect ratio, can open into a viewer, and use meaningful unavailable/expired states. A pinned row occupies the reserved context lane only when an actual pin is supported; the study does not authorize implementing pinning.

The history follows new messages only when the owner is already at the bottom. Otherwise preserve reading position. A 48 jump-to-latest target and new-message count are proposals absent from the current code. Loading earlier history must not jump the viewport. Keep draft proposals separate from chronological sent-message status.

### Composer, drafts, and takeover

Use a 48-minimum composer field and separate 48 circular primary action with an 8 gap and 8 to 12 outside padding. The field contains emoji, flexible text, and attachment controls. Empty means microphone, nonempty means Send, recording means Stop. A typed reply grows to roughly five text lines before internally scrolling. Multi-line text and large fonts may require more height; message history takes the remaining space.

Selected images and recordings get a local preview tray above the field, with delete and explicit Send. A quoted reply gets a compact source tray with dismiss. Distinguish recording, stopped local preview, uploading, sending, failed, and unknown. Preserve unsent text and local media when a request fails. Do not use a disabled-looking composer to represent a service connection failure if local writing remains possible.

A pending AI proposal currently shows Suggested reply and Not sent, exact text, and Send reply, Edit, and Dismiss. Place the latest draft for each trigger immediately beneath that trigger message. Keep outdated cards beside their earlier turns. Save draft edits without sending; send requires a separate approval. It has a dashed or otherwise distinct unsent outline. It never has receipt ticks or a sent timestamp. For reactions and two-to-five-message sequences, preview every action, its order, target, and reply-unit cost before approval. Approval affordances collapse to one primary action and an overflow only if all alternatives remain accessible.

Preserve the code's Your draft, Typing pause, Cooldown · N min, Paused, Needs you, Manual, and Auto allowance labels. Resume now is disabled during composing. Its busy state is Applying… and success follows the acknowledged Conversation. Seconds-based countdowns were a visual proposal. Use a slim 48-minimum strip with a 48 Resume target. During acknowledgment show Requesting pause or Resuming, not a success state. Failed acknowledgment stays explicit. Indefinite pause and unresolved Needs me require owner action. Never reply has no assistant-generation controls.

### Review, Assistant, and Settings

Review contains local Your draft links plus pending, needs_owner, and stale server cards. It currently has no subfilter. Always name the contact. Local entries open the owner's composer, not an AI approval card. Outdated draft has Dismiss; Needs you has Handled, which does not resume automation. Review subfilters and regeneration/review-change actions are proposals. A list selection or swipe must never send a proposal.

Assistant is an owner-only conversation with the same full-height history and composer grammar. It has no contact Auto-reply switch. Proposed sends and permission changes show exact recipients, content, and consequences before confirmation. Typing a command is not approval. An unknown send outcome cannot be repeated through another assistant confirmation.

Settings uses grouped rows rather than marketing cards. Put PC service state and WhatsApp pairing state in separate rows. Show theme, contact permissions, model/media data boundary, and publisher information. Pairing includes a private backend-token field and plain local-network instructions. Do not put the OpenRouter key on the phone. Do not depict an Android installer or Windows launcher as shipped.

### Visual tokens

Use the existing palette as the baseline so this design does not introduce a new brand without approval.

| Token | Dark | Light |
| --- | --- | --- |
| Background | #111418 | #F7F8FA |
| Incoming / raised surface | #22262D | #FFFFFF |
| Main text | #F3F5F7 | #151B23 |
| Secondary text | #A2AAB4 | #617081 |
| Divider | #30363E | #E0E5EC |
| Primary action | #7AA9FF | #2C68D4 |
| Primary action text | #111418 | #FFFFFF |
| Outgoing bubble | #293B55 | #DCE8FA |
| Outgoing metadata | #A2AAB4 | #566374 |
| Selected filter / draft tint | #1D2A3C | #EAF0FC |
| Owner attention | #F4BE74 | #885316 |
| Attention background | #352A1D | #FFF0D9 |
| Automation state | #8DD5AA | #246E41 |
| Automation background | #1B3025 | #E2F3E8 |
| Error text | #FFB0B0 | #AB2634 |

Use Inter in the app, with a native system sans fallback. DOOP uses system sans to keep studies self-contained. Title 24 to 26 bold, contact title 18 semibold, message 16 regular, row title 17 semibold, preview 14 to 15, supporting label 12 to 13. Rounded search/composer 24, bubbles 16, quote blocks 8, sheets 20 at the top corners. Use consistent 22 to 24 outline icons. Avoid decorative sparkle icons as general-purpose controls.

All Android tap targets are at least 48 by 48, including 24 icons. Compact filter visuals may be 32 high inside a 48 target. Body and supporting text need at least 4.5:1 contrast; meaningful icon boundaries need 3:1. State colors never replace labels. Test font scale 1.0, 1.3, and 2.0, visible keyboard focus on web, screen-reader labels, and reduced motion/transparency. No timed message disappearance or automatically dismissed error essential to a decision.

### Responsive behavior

Under 600, use one pane with stack navigation. Between 600 and 899, keep the same phone flow and allow the inbox to use available width; cap long-message reading width rather than stretching bubbles across the screen. At 900 and above, use a 64 navigation rail, 320 to 360 inbox, and flexible conversation pane. Both panes fill the application height, with separate scrolling and pinned headers. No centered phone-sized chat inside a large empty canvas.

On wide screens, the conversation uses a centered message column capped near 760 while its toolbar and composer fill the conversation pane. Review and Settings can use the detail pane. At 1280 by 800, verify the inbox, long messages, proposal actions, and composer all fit. At 200 percent zoom, collapse back to the single-pane flow if the effective width crosses the breakpoint.

### State matrix for design handoff

| State | Placement and behavior |
| --- | --- |
| Connecting | Small service status, no claim of WhatsApp connectivity |
| PC unavailable | One retryable connection strip; preserve local drafts |
| Pairing needed | Settings action; do not replace all screens with warnings |
| Empty inbox | Compact explanation and connection action; no invented chats |
| Loading history | History-only loading treatment; toolbar/composer stable |
| Draft only | Named contact mode; exact proposal requires owner Send |
| Auto-reply | Named mode and accessible remaining units/expiry; no implied unlimited grant |
| Never reply | Owner messaging remains; no AI controls or media-to-model access |
| Paused/cooldown | Acknowledged state and Resume; timer only when genuinely timed |
| Needs me | Contextual item and Review entry; not a persistent global alarm |
| Accepted | Transport accepted only; no delivered/read tick unless proven |
| Failed | Explain known failure; retry only when non-delivery is established |
| Unknown | Check outcome; no blind Retry or duplicate Send |
| Unsupported media | Name the limitation; never synthesize content |

### Research and rationale

Reviewed on 14 October 2026. Public pages are product references, not evidence that Otherme has their capabilities.

- Owner-provided WhatsApp Android screenshots. Primary evidence for screen composition, list lanes, header spacing, quoted blocks, and bottom anchoring.
- [Signal](https://signal.org/). DOOP browser inspection showed dark conversations with distinct blue outgoing messages and compact bottom controls. This supports preserving the familiar chat grammar while using Otherme's independent blue palette. Do not borrow Signal's encryption claims.
- [Telegram, AI summaries, new design and more](https://telegram.org/blog/new-design-ai-summaries). DOOP browser inspection confirmed the January 2026 article's iOS Liquid Glass direction and user controls for interface effects, performance, and battery life. Its embedded demonstration videos did not play in the capture, so no detailed motion or refraction behavior was verified. Use it as a reason to offer a restrained optional glass comparison, not to copy an unseen animation or its AI/privacy architecture.
- [WCAG contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Retrieved guidance supports 4.5:1 normal-text contrast and 3:1 large-text contrast. The brief applies 4.5:1 to supporting text as well.
- WhatsApp's design blog and the Apple/Material documentation pages returned only page shells through text retrieval. A guessed Meta article URL and Signal blog URL returned 404. No design conclusions rely on those unavailable pages. No broad app-search result set was available in this session.

### DOOP deliverables and acceptance

Add a new row to the existing Otherme canvas. Leave the nine provisional brand studies and their guide unchanged. Add a named guide for this brief with an explicit override limited to the new WhatsApp-led row. Deliver a readable brief board, complete dark Chats/Conversation/Review studies, light Assistant/Settings studies, a same-geometry glass conversation comparison, and a wide two-pane study. Put a visible synthetic-concept label outside app screens. Do not pretend that mockup controls perform live actions.

Review all new frames with DOOP screenshots. Check header/list/footer budgets, long message wrapping, timestamp clearance, real composer space, proposal distinction, light/dark consistency, and meaningful contrast. The frame review is visual evidence only. Native keyboard behavior, accessibility, real audio/media, and server acknowledgment still require implementation and device testing.

The design succeeds when a person familiar with WhatsApp can read the inbox and compose a reply without learning a new layout, and can still tell what the assistant is allowed to do. Header, scroll area, and bottom controls must fill the screen together. No design is accepted merely because one attractive chat card fits.

### Delivered studies and review evidence

[Open the DOOP canvas](https://doop.design/c/zD7O0jmGDo). The new row starts at y=1800. Earlier brand studies remain untouched.

| Study | DOOP frame | Self-contained local HTML |
| --- | --- | --- |
| Brief and screen budgets | hh-rTfphAo | [Brief board](otherme-brief-board.html) |
| Dark Chats, Conversation, Review | Raz7j5rj6- | [Dark studies](otherme-dark-studies.html) |
| Light Assistant, Settings, glass comparison | QQoaiooAad | [Alternative studies](otherme-alternative-studies.html) |
| Wide two-pane messaging | WZnvXDCExk | [Wide study](otherme-wide-study.html) |

All four frames were screenshot-reviewed in DOOP. The review corrected partially hidden latest-draft actions by opening contact histories at their newest content. Headers and composers remain outside the scrolling history. This is a study initialization, not evidence that the real app's scroll-follow behavior is implemented.

Headless HTML checks at board widths of 1240 and 1280 reported no phone horizontal overflow, history/composer overlap, or hidden latest approval actions. These checks cover the provided artboard dimensions, not native keyboards or every responsive breakpoint. The local HTML files are design boards, not responsive production components.

Contrast checks passed for ten representative text/background pairs after one correction. Light outgoing-message metadata used the existing secondary color at only 4.10:1, so the design adds #566374 for that context, giving 4.94:1. Dark outgoing metadata is 4.83:1. Dark/light primary action labels are 7.87:1 and 5.20:1. No app palette was changed. Native font scaling, reduced transparency, keyboard behavior, screen-reader use, blur performance, and 320/360-width layouts remain implementation acceptance checks.

## Designer deliverables

Provide editable phone-first screens and a responsive system for Chats, Conversation, Review, Assistant, and Settings/pairing. Show the core paths for receiving a message, reviewing/editing/sending a draft, taking over and resuming, and handling a photo or voice note. Include light and dark themes, empty/loading/offline/error states, permission modes, cooldown/handover/Needs Me states, and the unknown-send outcome. Label which parts are current and which represent the in-progress or planned experience. Keep the visual identity easy for the owner to refine later. This is a design handoff only: make no application-code, manifest, runtime, or backend changes.
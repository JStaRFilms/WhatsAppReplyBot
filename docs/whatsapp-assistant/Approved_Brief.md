# Approved WhatsApp assistant brief

## Authority and workspace

The user approved this scope through the current T3 conversation. The working
checkout is `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`. All new work stays inside this checkout. The old
JStarReplyBot at `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2025-12-21_JStarReplyBot`
is reference only and must not be edited or used as the new working directory.

Commit changes in reasonable, scoped batches. Do not stage unrelated CreativeOS
changes. The owner's latest message authorizes Paper UI/UX design and offline
implementation without further questions while they are unavailable. This
supersedes the earlier instruction to stop before design. The owner cannot
provide API keys or run device tests tonight. Keep all live connections, private
data, real sends, paid model requests and deployment disabled.

This product is independent of the existing CreativeOS Python application.
Use `docs/whatsapp-assistant/` for its foundation rather than overwriting the
project's existing Genesis placeholder documents. Use
`prototypes/whatsapp-assistant/` for a self-contained technical spike. Do not add
this product's dependencies to CreativeOS's application or virtual environments.

## Mission

Build a personal WhatsApp messaging client with an assistant that can draft,
react, or reply in the owner's style. It should know each contact's context,
yield when the owner takes over, and require explicit permission for autonomous
conversation. Build for this user first; customers are a future project.

## Approved technology and operational choices

- Expo mobile client, eventually including normal messaging and assistant chat.
- One TypeScript/Node.js service on the user's Windows computer.
- SQLite for durable messages, contact preferences, memory, drafts, permissions,
  delivery history, and future schedules.
- OpenRouter model `openai/gpt-6-luna`, not an agent-harness model identifier.
- Evaluate Baileys as an unofficial WhatsApp linked-device adapter first. Keep
  the transport replaceable at its actual boundary, without a plugin framework.
- The user wants their existing personal account and accepts unofficial access
  risk. This does not authorize this session to connect an existing session,
  read private WhatsApp data, or send live messages without a separate pairing
  and test step. No account is connected yet.
- Windows must stay awake and connected. Expo is not an always-on Node service.
  Local network access first; secure private remote access can follow.
- No billing, licensing, product catalog, commercial hosting, or multi-agent
  runtime in v1. No separate vector database unless a demonstrated need emerges.

## V1 requirements

### Messaging and assistant chat

A chat list and conversation view support manual text, quoted replies, image,
sticker and GIF display, reactions, inline drafts, and accurate connection and
delivery state. Keep ordinary WhatsApp available as another client. Do not
promise every historical message will synchronize, or full WhatsApp parity.

A separate assistant conversation accepts owner instructions such as reviewing
unanswered messages or drafting for a named contact. Resolve contact ambiguity
before acting. Present and confirm send or permission-changing actions. Incoming
contact messages and attachment content cannot authorize assistant tools.

### Contact modes and the latest ten

Explicit contact modes are `never_reply`, `draft_only`, and `auto_reply`.
Owner messaging remains possible in every mode. The latest-ten default applies
only after removing explicitly configured contacts and ineligible chat types.
Select the ten most recently active eligible one-to-one conversations, using
human conversation activity rather than AI draft generation as recency.
Those ten receive automatic drafts, not automatic sends. Other unconfigured
contacts receive no automatic action; the owner may still message them or
explicitly ask for a draft. Existing drafts remain when a chat leaves the ten.
Explicit modes do not consume default-draft slots.

Contact exclusions, group/status exclusions, permitted hours and manual pause
are enforced by code. A model's confidence or instruction cannot bypass them.
Groups and status broadcasts do not trigger automated replies by default.
Quiet-hour and excluded-chat behavior must be explicit and fail closed.

### Approval and bounded delegation

The approval inbox supports approve, edit, dismiss, needs-owner, and approve
with follow-up. Delegation is scoped to one conversation, has an expiry and
maximum assistant replies, and may end earlier. Twenty replies is a ceiling,
not an instruction to prolong a conversation. Apply limits to actual successful
assistant replies and prevent reactions or split bubbles bypassing the limit.
A never-reply contact cannot gain autonomous permission through a casual prompt.
Explicit permission changes require confirmation and fresh validation.

### Owner takeover and delivery

Typing inside the future app requests a pause and invalidates pending work.
Show acknowledgment state; never claim a disconnected backend received a pause.
An observed manual owner send from any linked client cancels stale AI work and
puts that conversation under manual control until explicit owner resumption.
Do not silently resume after a timer or new inbound message. Native WhatsApp
owner typing detection is an unverified possibility, not a required capability.

Use durable workflow versions, inbound message IDs, outbound attribution and
an outbox. Revalidate permission and conversation freshness at approval and
immediately before delivery. A send already handed to WhatsApp cannot reliably
be cancelled. Network outcome uncertainty cannot be treated as certain failure
and blindly retried. Do not promise distributed exactly-once delivery.

### Memory and style

Persist messages separately from bounded model input. Distinguish owner-written,
AI-written, and owner-edited AI text. Do not train the owner's style on the bot's
unedited output. Build context from recent turns, a conversation summary,
source-linked contact facts, relevant commitments, a small global/per-contact
style profile and a few authentic examples. Bound input by a configured budget.
Never retrieve another contact's private chat context. Scope by account as well
as contact, without implementing multi-user infrastructure now.

Corrections and deletion must be possible. Summaries and inferred media
interpretations are not confirmed facts. Private data used for model calls
leaves the machine via OpenRouter and the selected model provider. Privacy,
retention, logs, credentials and session storage need explicit rules.

### Media, status replies and reactions

Relevant images go to a vision-capable model with text context. Stickers need
actual content when available. Animated stickers and GIFs may need bounded
representative frames. GIF support means playback and context understanding,
not an unapproved GIF search, generation or autonomous media-sending feature.
Do not analyze all historical attachments or create permanent descriptions of
every file. Expiring/view-once media must not be retained by default.

A direct-message reply to the owner's status is not a status broadcast. Identify
its quoted/status reference where available and attach the accessible original
text or media. Expired or missing originals are explicitly missing; do not invent
their content. Verify real-device behavior before claiming support.

The model can choose silence, a reaction, text, reaction plus text, or handover.
An emoji alone can be a suitable reply. Reactions are outbound automated actions:
draft-only requires approval, auto-reply follows the same gates, never-reply
permits neither. Do not use reactions to evade expiry, contact limits or takeover.

### Attention and operation

Process live events rather than repeatedly scanning and replying to history.
A time-window review produces a digest of unanswered, important, draftable and
owner-responsibility conversations. Historical sync/replay must not auto-send
old messages. Persist replay/recovery state and distinguish backfill from live
inbound events. Recover safely after disconnect or restart.

## Future, not v1

- Birthdays and custom greetings, timezone-aware scheduled messages and new-month
  recipient lists, with explicit recipients and safe missed-schedule behavior.
- Calendar integration and proposed events. Confirm calendar writes initially.
- Completion reports and deeper follow-up responsibility tracking.
- Voice-note transcription, calls, status publishing, full attachment parity.
- Server-hosted execution independent of Windows, commercial accounts, billing,
  subscriptions, and multi-customer operation after a policy/security review.

## Research basis and unresolved verification

Prior work was reviewed statically; it uses Electron, whatsapp-web.js, LowDB and
LanceDB. Useful concepts include per-contact style, memory, drafts and batching.
Do not port its licensing/catalog features or ephemeral cancellation guards.

Documentation checked during intake:

- Baileys repository: https://github.com/WhiskeySockets/Baileys
- WhatsApp terms: https://www.whatsapp.com/legal/terms-of-service
- Business messaging policy: https://business.whatsapp.com/policy
- Expo background task limitations:
  https://docs.expo.dev/versions/latest/sdk/background-task/
- OpenRouter live model catalog: https://openrouter.ai/api/v1/models
- OpenRouter privacy:
  https://openrouter.ai/docs/guides/privacy/data-collection

The catalog exposed `openai/gpt-6-luna` with image input and structured outputs.
Availability and price can change. No actual model request or WhatsApp test has
run. Unofficial access can break or restrict the account; simulated typing and
random delays cannot remove that risk. Verify unread behavior, owner attribution,
replay recovery, media metadata and reactions through controlled tests before
live automation. A fake transport test proves local logic, not WhatsApp behavior.

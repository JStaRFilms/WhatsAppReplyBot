# WhatsApp assistant requirements

## Authority and phase

[Approved_Brief.md](Approved_Brief.md) is the approved scope. This document
turns it into testable requirements. No live capability has been verified.
The Genesis foundation is ready for focused acceptance review. The owner has
now authorized Paper UI/UX design and offline Expo/backend implementation.
Device testing, credentials, live WhatsApp and paid requests remain gated.

The product is a personal messaging client and assistant for one owner and one
WhatsApp account. Ordinary WhatsApp remains usable as another client. Expo
provides eventual mobile messaging and owner-command conversations. One
TypeScript/Node service on the owner's Windows computer owns SQLite, transport,
policy, model calls and delivery. Windows must remain awake and connected.
Start with local-network access. Secure private remote access is later work.

Evaluate Baileys as an unofficial linked-device adapter. Do not promise full
WhatsApp parity or complete history. Account restriction and adapter breakage
remain risks. OpenRouter's app model is `openai/gpt-6-luna`. This is not an
agent execution model ID. Check availability before a separately approved paid
test. Prior catalog evidence indicated image input and structured output, not
proof that actual requests or all media types work.

## MUS requirements and issue index

MUS means required for v1. Each row maps to exactly one issue. Acceptance details
in those issues share the contracts in
[Assistant_Architecture.md](features/Assistant_Architecture.md).

| ID | Required behavior | Issue |
| --- | --- | --- |
| FR-001 | Owner-authenticated messaging and honest connection state | [FR-001](issues/FR-001.md) |
| FR-002 | Separate owner-command assistant conversation | [FR-002](issues/FR-002.md) |
| FR-003 | Explicit modes and latest-ten automatic drafts | [FR-003](issues/FR-003.md) |
| FR-004 | Approval workflow and fresh authorization | [FR-004](issues/FR-004.md) |
| FR-005 | Bounded autonomous replies and reactions | [FR-005](issues/FR-005.md) |
| FR-006 | Durable owner takeover, cooldown and resumption | [FR-006](issues/FR-006.md) |
| FR-007 | Durable outbox and uncertain delivery recovery | [FR-007](issues/FR-007.md) |
| FR-008 | Live-event processing, replay isolation and attention review | [FR-008](issues/FR-008.md) |
| FR-009 | Account/contact-scoped memory, style and bounded context | [FR-009](issues/FR-009.md) |
| FR-010 | Media-aware context and direct status replies | [FR-010](issues/FR-010.md) |
| FR-011 | Privacy, exclusions, deletion and protected local storage | [FR-011](issues/FR-011.md) |
| FR-012 | Windows operation and evidence-based adapter boundary | [FR-012](issues/FR-012.md) |

### Shared acceptance rules

- Incoming messages, quotes, media, retrieved facts and model output are
  untrusted data. None can grant permissions or invoke confirmed owner actions.
- Code enforces account identity, exclusions, chat type, contact mode, permitted
  hours, manual control, workflow freshness and delegation limits. Uncertain
  identity or policy fails closed for AI access and automated delivery.
- Explicit `never_reply`, `draft_only` and `auto_reply` modes do not use
  latest-ten slots. After removing explicit modes and ineligible chats, rank
  eligible one-to-one conversations by human activity and select ten.
  Selection permits automatic drafts only. Leaving the ten preserves drafts.
- Owner sends remain possible in every mode. Excluded and never-reply contacts
  have no AI access, even for an explicit draft request. Never-reply blocks AI
  drafts, summaries, automated text and reactions until a confirmed mode change.
- Groups and status broadcasts have no automated replies in v1. A direct
  message replying to the owner's status remains an eligible direct message
  when its contact and provenance can be resolved.
- Quiet hours and manual pause block automatic generation and automated
  delivery. Owner-initiated drafts may run during quiet hours, but automated
  sends wait for permitted hours and fresh validation. Invalid timezone or
  missing permission data denies automation. The approved owner-control update
  allows a five-minute post-send cooldown and a ten-second empty-composer hold.
  Unanswered backlog gets a draft only at expiry. Explicit indefinite pause and
  unresolved handover require owner intervention. See
  [owner controls](features/Owner_Control_and_Local_Drafts.md).
- A reply action may contain text, a reaction, or both. Each successful outbound
  component consumes a reply unit. A twenty-unit ceiling covers reactions and
  split bubbles; expiry and early completion stop the grant sooner.
- Approval and the last pre-delivery check both validate freshness. A transport
  handoff is not cancellable with certainty. Unknown outcomes never trigger a
  blind retry and never free reply capacity for another action.
- Logs and tests contain synthetic data, not contact content, secrets or session
  material. Export to OpenRouter requires explicit owner privacy consent.

## Product and feasibility are different deliverables

Future production requirements include Expo messaging, assistant chat and a
Windows backend. The pre-design spike lives only in
`prototypes/whatsapp-assistant/`, with its own dependency setup.
It tests policy, SQLite workflow durability and event normalization using fake
transport and fake model responses. It has no Expo UI, real account, credential,
read receipt, outbound send, paid model call or deployment by default.

A later read-only device probe requires separate explicit authorization for the
account, pairing, exact observations, privacy handling and cleanup. Read-only
intent does not prove an adapter will avoid read receipts or session side
effects. Inspect adapter configuration before pairing and record uncertainty.
Live sending and model requests need separate permissions again.

See [Verification_Plan.md](Verification_Plan.md) for evidence boundaries and
[Builder_Prompt.md](Builder_Prompt.md) for the constrained handoff.

## Deferred requirements

No issue files or v1 implementation for these items:

- Birthdays, greetings, timezone-aware schedules and new-month recipient lists.
  Require explicit recipients and safe missed-schedule decisions later.
- Calendar integration and proposed events. Initial calendar writes need
  confirmation.
- Completion reports and deeper follow-up responsibility tracking.
- Voice-note transcription, calls, status publishing and full attachment parity.
- GIF search, generated media and autonomous media sending.
- Server-hosted operation independent of Windows, commercial hosting, billing,
  licensing, subscriptions, catalogs and multi-customer operation. Require a
  later policy and security review.
- Vector databases, plugin platforms and multi-agent runtimes without a
  demonstrated requirement. SQLite retrieval is the v1 choice.

## Remaining capability questions

Controlled device evidence must establish owner attribution across linked
clients, stable identity aliases, history/replay boundaries, status references,
media access and expiry, reactions, unread behavior and delivery reconciliation.
Native WhatsApp owner typing detection is optional and unverified. The future
app must use its own acknowledged pause path regardless. Model image behavior,
structured output, price and data retention also need later approved checks.

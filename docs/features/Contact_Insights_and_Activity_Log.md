# Deferred contact insights and activity log

## Status and goal

Owner proposed this after the current release extension was underway and suggested
deferring it. This is a future discovery/design brief, not an implementation task
or another release blocker. Current client37, review38 and release33 stay scoped
to the approved extension. No instrumentation, private-data access or design agent
is authorized by this note.

Provide a contact details/insights page reached from that contact's avatar or the
chat-header name. This is separate from WhatsApp account profiles. The owner wants
message counts, who wrote them, human interventions and model spend, with useful
per-contact activity history. Agree on data and definitions before designing UI.

## Source inventory, not a live-data audit

The inspected contracts and provider parser at backend baseline b8b4f58 show:

| Requested information | Available source or gap |
| --- | --- |
| Recorded incoming/outgoing messages | Message account/chat/transport IDs, direction, occurredAt and live/backfill/replay/unknown source. Count only stored evidence, not all WhatsApp history. |
| Human and AI authorship | Message authorship distinguishes owner_written, assistant_written, owner_edited_assistant, contact_written and unknown. Keep unknown separate. |
| Draft/send activity | Draft trigger/revision/state/edited flag and Outbox origin/components/states exist. Current rows are not a complete immutable transition log. |
| Sent/delivered/read | Optional outgoingReceipt is now in backend source. It is evidence separate from accepted/unknown accounting, not proof all historical receipts exist. |
| Human interception | No proven canonical event/count. Owner sends, edited AI drafts, paused automation and cancelled components are different events and must not be conflated. |
| Model usage/spend | OpenRouter's current Envelope parser retains choices, not usage/cost. No reliable per-contact paid-usage ledger was found in this source check. Historical spend must not be invented. |

Do not query actual databases, messages or billing to fill this brief. The owner
also reported missing incoming messages, tracked separately in35. Coverage limits
must be visible in future statistics even when outgoing replies are present.

## Definitions to settle in discovery

- Count actual message records/components consistently. Do not count one accepted
  outbox plus its own echo as two messages. Collapse only verified account-scoped
  aliases/transport identities. Keep reactions, system events and sequence parts
  explicit rather than silently mixing their units.
- Decide whether By me includes owner-edited AI text, with a separate breakdown.
  Unknown authorship is not automatically human or AI.
- Define Intercepted with the owner. Possible distinct metrics are manual takeover
  before an AI handoff, editing a suggestion and cancelling unsent AI work. One
  takeover cancelling three components is not automatically three interventions.
- Decide the date window, timezone, profile/contact identity and coverage wording.
  Counts describe recorded history and may omit messages never ingested or old
  history not supplied by WhatsApp. No lifetime/completeness claim.

## Data that may need future collection

Use a bounded backend-owned audit/usage design because Windows works while the
phone/browser is closed. First map existing durable records, then propose only
missing events and schema. Preserve profile isolation and retention/deletion rules.

For costs, verify provider-returned request IDs, model, token/usage and cost fields
before committing to a UI. Track generation and ASR separately, including calls
whose result was discarded as stale or failed after billing. A cache hit is not a
new paid call. Timeouts or absent usage mean unknown, not zero. Sum verified
provider-reported amounts by scoped call/chat and label estimates separately.
Do not substitute grant units, an outbox reservation or current catalog pricing
for actual historic spend. Resolve currency/precision and any billing reconciliation
limits during the audit. No paid or private benchmark is implied.

Event metadata should refer to source/request/draft/outbox IDs, revisions, actor,
reason and outcome as needed. Do not duplicate full message bodies, audio, prompts,
owner instructions, contact-book snapshots, provider keys or tokens into logs.
Resolve currently permitted display names at read time. Deleting aliases or media
must not leave a second hidden content archive. Do not change permissions, send
receipts, resolve unknown accounting or trigger AI by opening insights.

## Handoff into design

1. Audit source/API/provider documentation using synthetic fixtures and classify
   each metric as available, derived, newly collectable or unavailable.
2. Agree on interception, cost and coverage semantics with the owner. Author the
   minimum event/schema/API and privacy/retention proposal before implementation.
3. Then delegate a focused UI/UX design pass, using the selected Otherme visual
   system and the agreed data. Design known, unknown, empty, offline and partial
   coverage states, plus avatar/header entry and preserved permission access.
4. Review the design with the owner before a separately scoped build.

No design agent, new thread, image quota, dependency, live telemetry collection,
real billing request or code change was launched for this deferred idea. See
[Roadmap](../Roadmap.md) and [requirements](../Project_Requirements.md).

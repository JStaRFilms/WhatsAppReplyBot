# Assistant architecture

## Responsibility boundaries

Expo eventually displays messages, quotes, image/sticker/GIF content, reactions,
inline drafts, approvals and connection/delivery state. It also carries a
separate owner-command conversation. This document defines behavior and data,
not screen layout. The owner has now approved Paper design and offline Expo
implementation; live device/provider operations remain disabled.

One Windows Node service authenticates the owner, stores SQLite state, builds
bounded context, calls OpenRouter and drives a narrow transport adapter. Expo
is not the always-on worker. There is no cloud queue, vector store, plugin
framework or multi-agent runtime. The adapter is replaceable where WhatsApp
protocol data crosses into normalized events and outbound actions.

The adapter contract has connect/disconnect, capability reporting, normalized
inbound observation, media access and outbound handoff/reconciliation. Production
may use Baileys only after feasibility evidence. The offline spike implements
fake observation and handoff. Protocol IDs must never double as owner API
credentials. Raw adapter objects do not enter policy or model prompts.

## Identity and authorship

Use local UUIDs for account, contact, conversation and owner-device identities.
One account is provisioned in v1, but every query includes `account_id`.
WhatsApp phone JIDs, linked identifiers and protocol aliases map through
`identity_aliases`; display names cannot resolve identity. A duplicate or
conflicting alias suspends AI work until owner resolution. Never merge contacts
by matching names or guessed phone text. Groups and broadcasts have distinct
conversation kinds and cannot masquerade as a direct contact.

Messages distinguish direction from authorship. `fromMe` means account-outbound,
not owner-written. Match known outbound transport IDs to outbox components
first. Preserve authorship as `owner_written`, `assistant_written`,
`owner_edited_assistant`, `contact_written` or `unknown`. An unmatched observed
account-outbound message conservatively triggers takeover. It becomes an
owner style example only after reliable attribution or owner confirmation.
AI-written messages never train style. Edited AI text is labeled separately;
only the owner's explicit correction may become a style instruction. A known
assistant echo does not trigger takeover or human-activity ranking.

## SQLite records

These are implementation contracts, not executed migrations. UUID primary keys
are `id` unless a composite key is specified. UTC instants use integer Unix
milliseconds. Booleans use checked 0/1 values. Enums use CHECK constraints.
Foreign keys are enabled on every connection. Account/contact relationships
use composite foreign keys so another account's contact cannot be attached.
JSON fields hold bounded validated payloads, not arbitrary transport dumps.

| Table | Fields and constraints |
| --- | --- |
| accounts | id, owner_principal_id, timezone, model_consent_at nullable, retention_days default 30, created_at; one active account in v1 |
| owner_devices | id, account_id, credential_hash, revoked_at nullable; no plaintext credential |
| contacts | id, account_id, display_name, explicit_mode nullable or never_reply/draft_only/auto_reply, ai_excluded default 0, permitted_hours_json, policy_version default 1; unique account_id,id |
| identity_aliases | account_id, protocol, alias as composite PK, contact_id nullable, is_owner; exactly one resolved owner/contact target; conflict is recorded and blocks resolution |
| conversations | id, account_id, contact_id nullable, kind direct/group/status_broadcast/unknown, workflow_version default 1, control assistant_allowed/manual, last_human_activity_at nullable, last_human_message_id nullable, latest_ten_rank nullable; unique account_id,id |
| messages | id, account_id, conversation_id, transport_message_id, sender_alias, direction inbound/outbound, authorship enum above, text nullable, quoted_message_id nullable, status_reference nullable, occurred_at, observed_at, source live/backfill/replay/unknown, observed_sequence; unique account_id,conversation_id,transport_message_id |
| media_items | id, account_id, message_id, kind image/sticker/animated_sticker/gif/other, mime, local_path nullable, expires_at nullable, view_once, access available/missing/expired/unsupported, interpretation nullable, interpretation_source, delete_at; no stored view-once payload by default |
| reactions | id, account_id, conversation_id, target_message_id, actor_alias, emoji nullable, transport_message_id, source, occurred_at; null emoji represents removal, not a new assistant permission |
| drafts | id, account_id, conversation_id, trigger_message_id, workflow_version, policy_version, action_json, state pending/needs_owner/approved/dismissed/stale, revision, context_source_ids_json, created_at; action changes increment revision |
| delegations | id, account_id, conversation_id, starts_at, expires_at, max_units checked 1..20, successful_units, reserved_units, state active/ended/expired/revoked, policy_version; at most one active grant per conversation |
| assistant_turns | id, account_id, author owner/assistant, text, created_at, proposed_action_id nullable; separate from WhatsApp messages |
| owner_actions | id, account_id, conversation_id nullable, kind send/change_mode/delegate/resume/delete_history, payload_json, payload_hash, expected_workflow_version nullable, expected_policy_version nullable, expires_at, confirmed_at nullable, consumed_at nullable; one-use confirmation |
| outbox | id, account_id, conversation_id, client_request_id, payload_hash, trigger_message_id nullable, draft_id nullable, workflow_version, policy_version, origin owner_manual/assistant_approved/assistant_auto, delegation_id nullable, state queued/dispatching/accepted/failed/unknown/cancelled/partial, created_at; unique account_id,client_request_id |
| outbox_components | id, account_id, outbox_id, ordinal, kind text/reaction, payload_json, transport_message_id nullable, state queued/dispatching/accepted/failed/unknown/cancelled, delivery_state unconfirmed/server_ack/delivered/read, attempt_id nullable; unique outbox_id,ordinal and non-null transport ID per account/conversation |
| memories | id, account_id, contact_id, kind fact/commitment/summary/style_instruction, text, certainty inferred/owner_confirmed, source_message_ids_json, revision, deleted_at nullable; sources must belong to same account/contact |
| style_examples | id, account_id, contact_id nullable, source_message_id, owner_selected_global, created_at; only verified owner-written source, global reuse requires explicit sanitized owner selection |
| event_log | account_id, sequence as composite PK, type, conversation_id nullable, workflow_version nullable, payload_json, occurred_at; minimal bounded events for client recovery |
| processed_events | account_id, adapter_event_key as composite PK, source, message_id nullable, processed_at; duplicate processing is a no-op |
| transport_state | account_id as PK, connection disconnected/connecting/connected/degraded, sync_phase backfill/live/uncertain, adapter_cursor nullable, last_observed_at, capability_json |
| api_requests | account_id, client_request_id as composite PK, payload_hash, result_json, created_at; conflicting reuse returns conflict, same reuse returns prior result |

Use local message IDs for quote/reaction foreign keys after protocol-ID
resolution. Missing originals leave nullable links with a missing reason.
Source-ID JSON lists are validated against the account/contact on writes and
reads. Deletion nulls optional quote/trigger links, removes dependent media and
style examples, and invalidates derived memory. Outbox evidence keeps only
opaque IDs, hashes and states when its source content is deleted. Never cascade
delete an unresolved outbox component into an apparent retryable absence.

SQLite stores credentials neither in messages nor event payloads. Runtime
session material is outside source control in an owner-only Windows application
data directory. Store only its reference in service configuration.

## Workflow versions and policy

Per-conversation serialization and SQLite transactions protect local state.
Every inbound content change, human activity, takeover, resume, mode change,
exclusion or permission change invalidates pending assistant work by advancing
`workflow_version`. Mode/exclusion/hours changes also advance `policy_version` and revoke any
active grant. Restoring a mode does not restore that grant. Record the durable
event in the same transaction. Model responses and approvals
carry the versions they read. Stale work remains inspectable but cannot send.

Automatic eligibility is evaluated in this order:

1. Resolve account, contact, direct chat and event provenance. Unknown identity,
   groups, broadcasts and uncertain source deny automatic work.
2. Deny AI access for excluded contacts or absent model privacy consent.
3. Deny automatic work under manual control or outside permitted hours.
4. Apply explicit mode before the latest-ten default. `never_reply` denies
   automated delivery and automatic drafts. `draft_only` generates drafts only.
   `auto_reply` permits delivery only with a current bounded grant. Without a
   grant it produces drafts, not open-ended autonomous sends.
5. For unconfigured contacts, remove explicit modes and all ineligible chats,
   then select the ten most recent by `last_human_activity_at`, breaking ties
   by conversation UUID ascending. Human inbound messages and verified manual
   owner messages affect ranking. Assistant output, drafts and reactions do
   not. Backfill can establish historical recency but cannot trigger generation.
6. Selected unconfigured contacts receive automatic drafts. Others receive no
   automatic action. Existing drafts remain when rank changes.

Owner-requested drafts can target unselected contacts, but never-reply and
excluded contacts remain inaccessible to AI. Neither explicit drafting nor an
assistant command bypasses that exclusion. Owner manual sending is a separate
authenticated path and remains possible in every mode and during quiet hours.

A mode proposal from assistant chat does not modify permission. The owner must
confirm the exact contact, mode and current versions. Switching to `auto_reply`
does not itself create an unbounded grant. Delegation requires `auto_reply`, a
confirmed conversation, expiry and maximum units. No casual prompt overrides a
never-reply mode. Switching from never-reply requires its own explicit confirmed
permission change before a grant can be confirmed.

## Approvals and delegation accounting

A draft action is `silence`, `handover`, `reaction`, `text`, or
`reaction_plus_text`. Text is one bounded bubble by default. Reaction target IDs
must belong to the same conversation. No autonomous media sending in v1.
Silence has no outbox item; handover sets needs-owner and ends an active grant.
Both are legitimate model decisions, not failures to generate text.

Approval operations are approve, edit, dismiss, needs-owner and
approve-with-follow-up. Edit saves a new revision and records
`owner_edited_assistant` provenance when sent. Approve-with-follow-up requires
a separately confirmed valid grant and `auto_reply`; it cannot promote a
draft-only or never-reply contact by itself. Approving an ordinary draft permits
only its exact action, not future turns. Approval during manual control fails
until an explicit resume; editing alone never resumes.

At confirmation, approval and dispatch, validate the exact payload, revision,
trigger ID, workflow/policy versions, hours, mode, control and grant. Permission
changes during a model call invalidate its result. New inbound activity makes
pending drafts stale; the owner can request a refreshed draft.

A grant specifies UTC expiry, 1..20 reply units and one conversation. It can end
on owner revocation, takeover, expiry, model handover or completion. Reserve one
unit per planned outbound component in the same transaction that queues the
outbox. Reaction plus text reserves two units; split bubbles reserve one each.
Dispatch must satisfy `successful_units + reserved_units <= max_units`.
Accepted transport components consume successful units, and their reservation
is removed once. Later delivery receipts never increment again. Definitive
pre-acceptance failure releases capacity. Unknown outcomes keep reservations;
expiry still stops new dispatch. A grant with one unit remaining cannot send
reaction plus text without a newly reviewed single-component action. It must
not silently omit approved content. Twenty is a ceiling, not a target.

Here, successful means positive transport acceptance evidence, not proof that
the recipient read the content. Ambiguous components remain accounted for
conservatively until reconciliation. Fresh one-shot approvals cannot bypass an
active grant's limit; count their assistant components against that grant too.
After a grant ends, new owner approvals remain one-shot actions, never an
implicit renewal of automation.

## Takeover and delivery races

Typing in the future app requests a backend pause before it implies success.
On acknowledgment, set manual control, increment version, revoke the grant and
cancel queued assistant work. If disconnected, the client reports pause
unacknowledged, not paused. Pause requests are idempotent and do not require a
fresh expected version, because they only remove authority.

A manual send in the app durably applies takeover before queuing owner content.
An observed unmatched account-outbound send from another linked client applies
the same takeover. Known assistant echoes are matched by outbound transport ID.
Unknown authorship never becomes a style example. Native-client typing cannot
be relied on; detection is an unverified optional capability.

Resume requires explicit owner confirmation against the current version. It
sets assistant-allowed control, invalidates stale work again and leaves revoked
grants revoked. Resume alone authorizes neither old drafts nor auto-reply.
Timers, restart, new inbound messages and model output never resume control.

Before transport handoff, persist component `dispatching` and an attempt ID,
then revalidate under the per-conversation dispatch lock. A pause cancels
components not handed off. Events observed after handoff cannot reliably stop
WhatsApp delivery. Record that limit rather than showing a false cancellation.
A crash after marking dispatching but before recording acceptance becomes
unknown on recovery, even if handoff may never have occurred. Reconcile by
stable protocol ID where evidence exists; never blindly retry. There is no
distributed exactly-once guarantee. Owner retry of an unknown action requires
explicit duplicate-risk acknowledgment and a new request ID, not reuse of a
failed-looking old request.

Partial bundles report each component. Do not retry the entire bundle when the
reaction succeeded and text is uncertain. `accepted` is not `delivered` or
`read`. Read-receipt transmission is not required and is forbidden in the
spike. Receipt observation alone must not cause a read receipt to be sent.

## Live events, recovery and attention

Normalized inbound observations carry account, adapter event key, stable
message ID, resolved conversation, sender alias, source, protocol time,
observation time and payload. Quotes/status references carry accessible source
IDs or an explicit missing reason. Source is `live`, `backfill`, `replay` or
`unknown`; do not classify a sync batch as live because it arrived recently.

Persist observation, dedupe key, message update, version advance and any draft
job decision atomically. A duplicate echo updates receipts without repeating
policy actions. Persist adapter cursor/sync phase, but do not trust the cursor
as the only dedupe mechanism. On restart, reconcile dispatching components,
restore manual control and grants, and enter uncertain sync until the adapter
establishes a live boundary. Backfill/replay/unknown may populate history and
attention results, never auto-send or automatically generate old-message drafts.
An owner can explicitly request review of that history later.

Time-window review returns conversations with unanswered inbound human turns,
importance, draft eligibility and owner responsibilities. Use deterministic
unanswered candidates based on the latest inbound versus subsequent outbound
activity, then bounded model classification if consent and eligibility allow.
A reaction is not automatically proof a responsibility was fulfilled. Digest
items carry source IDs, missing-history flags and reasons; no claims that all
history is available. Excluded contacts may appear as owner-only unread or
activity counts without content/model processing. Review is read-only; sending
or changing permissions requires another confirmed action.

## Context, memory and media limits

Stored history is not prompt history. Initial configurable limits are 8,000
input tokens total and 1,000 output tokens. Include at most 20 recent turns,
one summary of at most 800 tokens, eight relevant facts/commitments totaling
800 tokens, a 400-token style profile and three authentic examples totaling
600 tokens. System policy, current instruction, quotes and media count toward
the total. Drop oldest optional turns/examples first, then low-relevance memory;
if required current input exceeds the budget, return needs-owner rather than
truncating policy. Use the provider tokenizer where available, otherwise a
conservative estimate and reject uncertain oversize requests.

Read memory only for the current account/contact. Global style contains
sanitized owner-approved instructions and explicitly selected examples, never
another contact's chat history. Contact summaries, inferred facts and media
interpretations remain labeled inferred with source IDs. Missing sources
invalidate derived records. Owner correction creates a new revision; deletion
removes sources, examples and dependent summaries or marks them invalid pending
rebuild. No model writes a confirmed fact without owner confirmation.

Initial media limits per request are two media items, three representative
frames per animated item, six frames total, 5 MiB decoded bytes total and a
1,024-pixel longest side per frame. These are local limits to verify against
actual provider limits, not claims about Baileys or OpenRouter. Use accessible
image/sticker pixels with text context. Animated sticker/GIF understanding uses
bounded frames, not guessed filenames; eventual client GIF playback is separate
from model input. Unsupported/oversize/missing media returns an explicit reason
and text-only context or needs-owner when meaning depends on the media. Do not
analyze historical attachments in bulk or persist every description.

A direct status reply includes the quoted status text or accessible original
media only when provenance resolves to the owner's status and the same reply.
Missing/expired originals stay missing. Broadcast status events are stored as
ineligible, never automatic reply triggers. View-once or disappearing media is
not downloaded, retained or exported to a model by default. Any later exception
requires specific owner consent and must respect actual access limitations.

## Owner API and backend events

Future local API uses HTTPS with a pinned service identity and a separately
provisioned owner-device credential, stored in Expo secure storage. Bind only to
approved local interfaces; no public listener or remote deployment. Initial
provisioning is a local owner-controlled operation, not a WhatsApp message or
model tool. Revoke credentials per device. Never log Authorization headers.
The spike uses fake authentication and exposes no live network listener.

All mutations require authenticated account ownership, `clientRequestId` and
schema-validated payloads. Account comes from authentication, not a trusted body
field. Target IDs must belong to that account. Idempotency covers API requests;
a reused key with a different payload returns 409. Version mismatch returns
409 with current versions and no send. Unknown identity is 422, denied policy
is 403, expired confirmation is 410, unavailable transport is 503 unless an
explicit owner manual-send request opted into local queuing.

| Endpoint | Request and result |
| --- | --- |
| GET /v1/conversations and /v1/conversations/{id}/messages | cursor/limit capped at 100; return normalized history, authorship, missing-media and connection/delivery states, never session credentials |
| POST /v1/conversations/{id}/pause | clientRequestId; return acknowledged=true, workflowVersion, control=manual after durable transaction |
| POST /v1/conversations/{id}/manual-send | clientRequestId, text optional max 4,000 chars, quotedMessageId optional, reaction target/emoji optional, queueIfOffline boolean; validate same-chat target, apply takeover then return outboxId and actual queued state |
| POST /v1/assistant/turns | clientRequestId, text max 4,000 chars; return assistantTurnId and proposedActionId or ambiguity choices, never a side-effecting tool execution |
| POST /v1/owner-actions | clientRequestId, kind send/change_mode/delegate/resume/delete_history, exact target/payload, expected versions; return proposalId, payloadHash, expiresAt within five minutes |
| POST /v1/owner-actions/{id}/confirm | clientRequestId, payloadHash, expected versions; one-use confirmation validates again, applies permission/resume/deletion or queues exact send, returns durable state/outboxId |
| POST /v1/drafts/{id}/decision | clientRequestId, revision, expected versions, operation approve/edit/dismiss/needs_owner/approve_with_follow_up, editedAction optional, confirmedGrantId only for follow-up; edits return pending new revision, send decisions return outboxId after validation |
| POST /v1/reviews | clientRequestId, UTC start/end max 30 days; return digest with source IDs, classification, responsibility and incomplete-history flags; excluded contacts have counts only |
| GET /v1/events | afterSequence, limit max 100; durable ordered event batches, snapshotRequired if cursor fell outside retention |
| PUT /v1/memories/{id} and DELETE /v1/memories/{id} | clientRequestId, revision, corrected text or deletion; verify ownership, invalidate derivatives and pending context jobs |

Mode changes include the exact mode; exclusion and permitted-hours changes use
the same confirmed change-mode proposal with explicit changed fields. Delegation
payload is `{conversationId, expiresAt, maxUnits}`. Resume payload names the
conversation only and cannot recreate a grant. Send payload names text/reaction,
quote/target IDs and the content hash. Manual-send requires text or a reaction,
and a quote requires text. Owner manual reactions follow the manual send path
and count as takeover, not assistant permission. Assistant-chat send proposals
use assistant_approved origin and all assistant gates; they cannot masquerade
as owner_manual to bypass never-reply. A delete_history proposal names the
conversation and deletion scope; confirmation performs local deletion without
transport handoff. Configure model consent and retention through an explicit
local owner-controlled privacy setting before any model use. This setting is
not a model tool and defaults to no consent.

API confirmation records come only from the authenticated owner API. The model
can propose a payload but cannot call the confirm endpoint or manufacture its
record. WhatsApp content never acts as owner authentication, even if it claims
to be the owner. Contact-name ambiguity returns candidate local IDs for owner
selection; it never picks the first matching name.

Events use `{accountId, sequence, type, conversationId?, workflowVersion?,
occurredAt, payload}`. Required types are `connection.changed`,
`message.upserted`, `reaction.changed`, `draft.changed`, `control.changed`,
`permission.changed`, `outbox.changed`, `delivery.changed`, `review.ready` and
`needs_owner`. Payloads reference IDs and typed states, not secrets. Client
sequence dedupe and snapshot recovery do not themselves authorize sends.
Pause acknowledgment must correspond to `control.changed` in durable state.
Connection state and last-observed timestamp distinguish offline from idle.

Model response is a validated object with decision
`silence|handover|reaction|text|reaction_plus_text`, optional text, optional
`{targetMessageId, emoji}`, reason, source IDs and inferred memory proposals.
Reject unknown tool names, cross-contact IDs and contradictory fields. A model
suggestion cannot change mode, grant, clock, version or authorship. Invalid or
unsupported output becomes needs-owner without delivery.

## Privacy and retention

Before first model use, explain that selected messages/media leave the Windows
computer via OpenRouter and its selected provider. Require explicit consent;
policy/provider retention is not assumed to be zero. Excluded contacts never
enter prompts, summaries, style examples or model-based attention review.
Exclude or delete immediately cancels their pending AI work and removes derived
AI records. Manual history remains subject to the owner's retention settings.

Initial configurable retention is 30 days for ordinary message content and
model-derived records, seven days for cached ordinary media and durable client
events, and no retention of view-once payloads. Disappearing content expires at
the earlier of protocol expiry and the local retention deadline. Owner deletion
runs promptly, removes dependent records and cancels pending context work.
Delete responses acknowledge local deletion, not provider deletion or removal
from other WhatsApp clients. Minimal IDs/hashes/states for unknown delivery may
remain until resolution so deletion does not cause resend. Clear resolved
operational records after 30 days.

Protect SQLite and session files with owner-only Windows permissions. SQLite
is not encrypted by default; document that limitation and require Windows disk
protection for the production machine. Backups are opt-in, encrypted and follow
the same deletion/expiry rules. No session material in source control, fixtures,
logs or exports. Model prompts/responses are not logged by default. Safe logs
contain opaque IDs, state transitions, durations and error codes, never phone
numbers, message text, frames, tokens, QR pairing data or request headers.

## Feasibility boundary

The foundation is documentation. The isolated feasibility spike may implement
SQLite policy tests, fake adapters, synthetic event fixtures and restart fault
injection under `prototypes/whatsapp-assistant/`. It must not alter CreativeOS's
root architecture, README, dependencies, Python environments or old app.
Read-only device tests, model calls and sending are separately gated.

[Verification_Plan.md](../Verification_Plan.md) lists offline proof and live
questions. An adapter report states supported, unsupported or unverified for
each capability. Unverified required behavior blocks production automation.
The owner now authorizes Paper design and offline application implementation.
Passing a fake test is never permission to pair a phone, spend money or send real
messages. Demo delivery must be visibly distinct from WhatsApp delivery.

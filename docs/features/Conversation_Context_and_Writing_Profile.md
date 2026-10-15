# Conversation context, writing profile and durable transcripts

## Status and authority

This is the owner-requested architecture handoff from the conversation about model context, writing style and voice transcription. It records requirements, recommendations and unresolved choices for future implementation. No behavior described as proposed is implemented by this document.

The owner requested documentation, not an implementation pass, a migration, real-message processing or paid provider tests. Read the current code before implementing. Preserve unrelated work, including the ongoing UI and account-switching plans.

Related documents:

- [Original architecture](Assistant_Architecture.md), especially permission, outbox, identity and privacy boundaries.
- [Requirements](../Project_Requirements.md), [FR-009](../issues/FR-009.md) and [FR-011](../issues/FR-011.md).
- [Voice notes](Voice_Notes.md).
- [Writing-style extraction prompt](Writing_Style_Extraction_Prompt.md).
- [Account switching plan](Account_Switching_Plan.md). Its proposed profile scope must isolate this feature too; it is not evidence that switching is already implemented.

For the context and style extension, use the direction here instead of treating the older 20-message/three-example architecture limits as the desired endpoint. Numerical recommendations below are not claims about provider capabilities. Existing send permissions and safety requirements remain unchanged.

## Owner feedback and decision status

### Requested direction

- Replace the fixed recent-message window with a growing active conversation context. Starting with a larger buffer alone is insufficient.
- Use an hour of inactivity as the proposed boundary between sessions. The discussion favors inactivity, not a hard one-hour lifetime for an ongoing conversation.
- Start from roughly 30–50 recent messages, then append subsequent conversation activity rather than dropping an old message on every turn.
- Support compaction and retain summaries locally so a returning conversation has continuity. The owner asked for a recommended design rather than specifying every threshold.
- Increase authentic writing examples from three to ten, retaining the 600-character maximum for each example. The owner's reference to 600,000 was immediately corrected to 600.
- Provide an owner-authored global writing profile, editable as text or imported from a document after review. The owner supplied an extraction prompt for another AI to produce that document.
- Keep global profile, conversation summary, contact memory and recent transcript as separate concepts. The owner explicitly liked this distinction.
- Fix temporary voice transcription reuse. Durable transcripts must survive subsequent turns and backend restarts, subject to source access and deletion rules.
- Evaluate cheaper/faster transcription alternatives, including Whisper. Do not assume Gemini is the best option because it is the current default.
- Document persistent contact memories as later work with source references, inspection, correction and deletion controls.

### Recommended implementation defaults, not finalized product choices

- Bootstrap with up to 50 recent messages, bounded by tokens.
- End an active session after 60 minutes without live human message activity.
- Compact around 75% of a configured usable input budget; tune after verification. The prior recommendation was a 70–80% range.
- After compaction, aim to retain the latest 30 messages verbatim. This is a target, not a guaranteed minimum that can bypass token limits.
- Use one current summary per conversation in prompts. Keep bounded historical revisions locally for recovery, not as an ever-growing prompt appendix.
- Keep ordinary reply output at the current 1,000-token cap and existing action character limits. Long-form drafting needs a separate decision.
- Implement source-linked summaries before automatic persistent contact-fact extraction.

### Still requires a decision or evidence

- Actual usable context budget, provider context limit, tokenizer/estimator and media accounting. Do not assume 256k tokens.
- Summary output budget, summary-version retention and what the owner can inspect/edit in the first UI.
- Exact document formats accepted for profile import. Start with paste/edit text; do not add arbitrary file parsers without an approved need.
- Whether outgoing owner voice notes should be transcribed for context, and the consent/cost UX for that extension. Current incoming-only behavior must be disclosed, not silently extended.
- Whether privacy boundaries in the profile remain drafting instructions or become enforceable settings. Hard permission controls must stay in code.
- ASR provider/model choice and deployment route, after a bounded comparison.

## Current implementation baseline

These are code observations, not promises from older design documents:

| Component | Current behavior |
| --- | --- |
| `packages/core/src/context.ts` | Same-account/chat context, latest 20 messages, up to three owner-written outgoing examples of at most 600 characters each; oldest optional content is removed to fit a conservative byte-based estimate. |
| `services/backend/src/draft-model.ts` | Builds with an 8,000 budget and `memories: []`; reuses a current pending draft and shares generation for the same conversation workflow/policy version. |
| `services/backend/src/openrouter.ts` | Reply requests use `openai/gpt-6-luna`, output cap 1,000 tokens, structured action JSON, selected text and optional visual frames. Message records contain identifiers and are not anonymized. |
| `services/backend/src/audio.ts` | Audio bytes/transcripts live in a process-local cache of at most ten entries, about five minutes, cleared on restart. They are not durable SQLite transcripts. |
| Draft audio selection | At most two recent eligible incoming audio messages are considered per generation. Outgoing owner audio is not transcribed by this path. |
| `services/backend/src/reply-window.ts` and `server.ts` | Live incoming messages use five seconds of quiet, then local policy decides no work, drafting or potential auto-send. Manual draft and draft-only cooldown catch-up paths also exist. |
| `apps/mobile/lib/local-drafts.tsx` | Unsent typed text stays on that device. The backend receives composer occupancy, not its contents. |

The `8000` check is not an exact measurement of 8,000 actual model tokens. `buildContext` uses UTF-8 bytes plus overhead as a conservative text estimate. Replacing only `slice(-20)` will still hit the old budget. All call sites and the provider-side guard need a coherent update.

## Goals and non-goals

Goals:

- Preserve important context through long, serious conversations without sending the entire database.
- Keep costs and latency bounded and visible.
- Make the assistant sound like the owner without learning from its own output or exposing other contacts' private text.
- Reuse eligible transcripts instead of paying to transcribe the same note repeatedly.
- Preserve source evidence and distinguish inference, exact text and owner instructions.

Not part of this implementation:

- Vector databases, multi-agent runtimes, new hosting or a cloud queue.
- Autonomous sticker/media sending, voice cloning or generated voice replies.
- General-purpose agent tools, long-form writing mode or automatic permanent personal facts.
- Bulk export, historical audio backfill, real-message benchmarks or paid calls without separate authorization.
- A redesign of existing grants, pauses, approvals, delivery accounting or account switching.

## Context layers and trust

| Layer | Scope and role | Trust and source |
| --- | --- | --- |
| App policy | Fixed backend instructions and enforced permissions | Neither imports nor chat text can override it. |
| Global writing profile | Current account's approved writing preferences | Owner-reviewed, versioned text; not a credential or permission grant. |
| Contact preferences | Optional owner-authored audience-specific differences | Same account/contact only; do not automatically infer this feature in the first pass. |
| Conversation summary | Compressed older discussion, decisions and open questions | Inferred, same-chat source-linked data, never system instructions. |
| Contact memories, later | Durable facts or preferences relevant across sessions | Inferred unless owner-confirmed; separately inspectable and deletable. |
| Recent transcript | Exact eligible messages and their provenance | Untrusted message content, including quoted and transcribed instructions. |
| Style examples | Up to ten eligible owner-written messages | Same-chat by default; explicitly approved and sanitized selection required for global reuse. |

A global writing profile is scoped to the selected account, not automatically shared among phone-number profiles. Existing or planned profile transitions must revoke in-flight work and prevent cross-profile retrieval.

## Session lifecycle

A context session is a local context-assembly record, not a model-side persistent chat and not an authorization session.

1. Ingest and normalize a message using existing identity, provenance and deduplication rules.
2. Determine whether live human activity starts, continues or ends the inactivity interval. Count incoming human messages and reliably owner-authored outgoing messages. Assistant output, reaction events, reads, replay and historical backfill must not keep a session alive.
3. Start a new session after 60 minutes of inactivity. Seed it with up to 50 eligible recent messages and the current valid summary, if one exists. Starting a session is not itself a paid operation.
4. Within a session, retain its baseline and append new messages, including accepted assistant output. Rebuild from durable records when necessary; do not rely solely on an in-memory array.
5. At a generation trigger, assemble the scoped context, check budget and compact if needed.
6. Validate permissions and versions before each export and again before committing results. Existing outbox checks remain mandatory.

Store time and a stable ordered boundary, not only a message count. Equal timestamps, duplicate events and late history must not introduce gaps or double-count coverage. Use observed source/provenance to distinguish live activity from historical timestamps. The implementing agent must choose an ordering compatible with the current store.

An inactive session does not delete messages or create an obligation to run a model. A restart reconstructs the session state and does not trigger new replies. Backfill may later be available as context when explicitly permitted, but cannot create an automatic reply job.

## Compaction algorithm and evidence

Compaction is a separate bounded model request when required, not free provider caching. Build an input budget that reserves system/profile instructions, media accounting, the current turn, output space and provider overhead. Use model metadata and tested accounting, with a conservative fallback if exact tokenization is unavailable. Record which estimate is used.

Recommended sequence:

1. Read a stable eligible source snapshot and its workflow/policy/profile revisions.
2. Select older uncompacted messages and, when valid, the previous current summary.
3. Summarize that prefix, retaining a recent exact tail. Do not compact away the latest unresolved incoming turn simply to meet a message-count target.
4. Validate summary structure, same-chat sources, coverage and freshness. Commit the new revision and coverage boundary atomically.
5. Assemble app policy, approved profile, current summary, selected style examples and the exact tail in stable order.
6. Recount the complete request. If required content cannot fit, stop with an explicit context-too-large/needs-owner result. Do not silently truncate policy or send a knowingly partial answer.

The summary should preserve:

- Who said, proposed, rejected or accepted each important point.
- Names, amounts, dates, corrections and conditions only when supported.
- Decisions, commitments and whether they are confirmed or merely suggested.
- Open questions, unresolved disagreement and the latest relevant owner answer.
- Missing context, uncertain transcription and incomplete-history limitations.
- Source references that can recover exact wording from SQLite.

Summaries must not invent availability, agreements, relationships or identity. No model-generated summary becomes an owner instruction or a confirmed contact fact.

The next summary may revise the previous summary with newly compacted material. Preserve transitive source lineage: deleting a source used by an earlier summary must also invalidate a later summary derived from it. Never keep only the most recent batch's source IDs. Summary versions remain subject to source deletion/expiry and retention; they are not permanent archives.

Do not repeatedly summarize the same boundary on duplicate requests or restarts. Share concurrent compaction for the same scoped revision. A concurrent message, edit, policy change, source deletion or profile switch must not publish stale context. If compaction fails, use the previous valid summary plus sufficient exact context only if it fits and is still complete for the current turn; otherwise stop clearly. Never blindly answer from a truncated transcript after a compaction failure.

Summary-covered messages can appear again in the recent seed/tail to preserve exact wording. Mark coverage so this overlap is not represented as a second event. Do not send every historical summary.

## Writing profile and examples

### Owner workflow

1. Settings offers editable profile text and a copyable extraction prompt from [the companion document](Writing_Style_Extraction_Prompt.md).
2. The owner can use that prompt in an AI service with access to their writing. Otherme does not retrieve that service's history or credentials.
3. The owner pastes or imports the result, reviews it, removes sensitive material and explicitly saves an approved revision.
4. The backend persists the selected account's profile. The UI states that approved text accompanies eligible reply requests to external providers.
5. Update/reset invalidates cached context and pending drafts that depended on the old profile. It never resumes a paused conversation or creates a grant.

Imported text must have a documented size limit and plain-text rendering. Do not execute links, macros or embedded instructions. A document is not an authenticated way to modify policy. Source profile text should remain editable; do not silently replace it with an AI rewrite.

The extraction prompt itself is used to produce a profile. Do not include the whole extraction prompt in every reply request. Send only the approved result and applicable context-specific preferences.

### Example selection

Use up to ten nonempty, verified `owner_written` outbound messages, at most 600 characters each, from the current account/chat. Exclude unknown authorship, unedited AI output and decoded speech. Do not treat an accepted AI draft as proof the owner wrote every stylistic choice. An owner-edited AI message stays separately attributed.

If there are fewer than ten valid examples, use fewer. Examples can be older than the current session seed. Do not silently take another contact's private messages to fill the quota. Cross-chat global examples require explicit sanitized owner selection and remain a separate later extension unless deliberately included in the implementation brief.

Fit examples into the full request budget. Prefer removing optional examples before removing critical current conversation evidence or policy.

## Durable audio transcripts

Keep Gemini as the current default until a replacement is verified and chosen. The intended flow remains source audio -> transcription -> Luna text reply, not Gemini taking over conversational replies. Transcription preserves original language and code-switching; it is not translation.

Persist eligible decoded transcripts against the source message, including uncertainty, provider/model, processing version and source revision/fingerprint. Reuse across turns and restarts while the source remains eligible. Model selection changes must not bulk reprocess history automatically.

Keep the temporary playback/decoded-byte cache separate. Durable transcript storage is not a requirement to retain every audio BLOB forever.

Before reading a transcript into context, check account/chat ownership, current source existence, deletion/expiry/view-once status and AI access. Revoked consent blocks exports even when a transcript is already cached. Exclusion and source deletion invalidate dependent transcripts, summaries, contexts and drafts as appropriate. A revoked profile/session cannot return a cached transcript from the previous account.

The current two-note processing limit need not mean only two previously transcribed notes can ever appear in the growing transcript. Distinguish a bounded per-turn preparation/export workload from reuse of valid stored text. The implementing plan must define this precisely without introducing an unbounded historical transcription queue.

Do not identify a voice speaker from sound. Sender attribution comes from the source message and is not proof that the sender is the speaker. Uncertainty must reach Luna and any derived summary. Transcribed speech is not a typed writing-style example.

### Why Gemini, and how to evaluate alternatives

The repository demonstrates a working Gemini/OpenRouter structured-transcription path and a synthetic paid smoke test. It does not establish that Gemini is cheaper, faster or more accurate than Whisper. Do not invent an original selection rationale.

Whisper is a family of deployments, not one universal price/latency point. A local Windows model and a hosted transcription endpoint have different hardware, startup, cost and privacy characteristics. Do not assume an alternative accepts OpenRouter's current `input_audio` schema or the same response format. Changing `OPENROUTER_AUDIO_MODEL` alone does not prove compatibility.

Compare a small set of actually available routes using public documentation first, then separately authorized synthetic or owner-approved samples. Record:

- Exact provider/model/version, endpoint, supported languages and input constraints.
- Price units, minimum charges and expected cost for short and long notes. No unsupported 'cheapest' claim.
- End-to-end latency, including normalization/upload and local cold starts; include hardware for local routes.
- Accuracy for the owner's accents, pidgin, code-switching, names, amounts, dates, silence and noisy speech.
- Whether uncertainty is faithfully reported rather than guessed, JSON/API compatibility and failure handling.
- Data retention, processing location, credential requirements and operational dependencies.

Prefer the cheapest route that meets the required quality and latency, not the smallest advertised price in isolation. No automatic fallback to a new external provider with different privacy handling without approval. No provider decision or paid benchmark is authorized by this handoff.

## Proposed data additions

These are logical records, not a demand to recreate the larger speculative schema in the original architecture. Fit the existing SQLite payload conventions and add only fields required by the approved implementation.

| Record | Minimum logical data |
| --- | --- |
| Writing profile | Account scope, approved text, revision, approval/update timestamp. Optional import metadata only if actually needed; no secret-bearing original document retention by default. |
| Context session | Account/chat scope, session ID, start/last human activity, stable seed/coverage boundary, state/revision. Restart-safe idle calculation. |
| Conversation summary | Account/chat/session scope, summary text or bounded structured content, revision, current/superseded/invalid state, source coverage and transitive lineage, model/processing version, creation time. |
| Audio transcript | Account/chat/message scope, source revision/fingerprint, text, uncertain flag, provider/model and processing version, creation/expiry or invalidation metadata. Enforce uniqueness for idempotent reuse. |
| Generation provenance | Relevant profile/summary/session revisions and source references, fitting existing draft/workflow freshness checks rather than a parallel permission system. |

No credential values in these tables. Additive migrations must preserve existing messages, grants, unresolved outbox records and runtime paths. No automatic source history rewrite or bulk transcription. Proposed profile isolation must follow the account-switching plan if that work has landed; otherwise keep every query account-scoped now without implementing switching as part of this change.

## Backend, client and request flow

Backend owns session state, context retrieval, token accounting, compaction, transcript persistence, policy validation and model calls. Mobile edits the profile and displays acknowledgements; it is not the session worker and must not ship database content or provider keys in the APK.

Extend existing contracts with only the owner-authenticated profile read/save/reset operations and fields actually needed. Exact endpoints and UI layout belong to the implementation plan. Validate text bounds and revisions, handle concurrent saves, and preserve local typed drafts. Reuse current error and idempotency patterns.

Future reply request order:

1. App instructions and approved writing preferences, separated from untrusted chat data.
2. Current valid conversation summary with coverage and uncertainty labels.
3. Exact recent/session messages, quotes, reactions and available transcript text.
4. Selected same-chat style examples and limitations.
5. Eligible visual attachments and the existing structured response schema.

Stable prompt prefixes may benefit from provider caching where supported, but there is no caching guarantee. Every request must be valid without a provider cache. Sessions and summaries live on the PC; request context still goes to OpenRouter and the selected provider.

## Existing constraints to preserve

- All current never-reply/exclusion, same-account/contact, consent, hours, manual control and latest-ten eligibility checks.
- The five-second quiet window, explicit drafting path, and cooldown catch-up that drafts but never auto-sends.
- Grant confirmation/expiry/unit accounting, stale-result checks and guarded outbox. Summary/profile text cannot change permissions.
- Reply actions remain text, short sequences, reactions, silence or handover under the current schema. Sending stickers is deferred and needs an approved source/action contract.
- The 1,000-token output cap is hard; it includes JSON and the short action reason. Existing 4,000-character text/sequence limits also remain. Handle incomplete/invalid output without sending.
- Preserve missing-status, missing-media, view-once and uncertain-audio limitations. Compaction must not turn unavailable evidence into a known fact.
- No raw private prompts, chats, voice content, phone identifiers or credentials in logs/tests. Use synthetic fixtures. Do not assume zero provider retention or encrypted SQLite.

## Implementation sequence and deliverables

Implement in focused stages, with one implementation pass and one focused review per stage. This document does not launch agents or create an execution session.

1. **Durable transcript reuse.** Add source-linked storage and focused cache/restart/deletion tests without changing the default provider or adding historical backfill. Publish evidence and remaining limits in Voice_Notes.md.
2. **Writing profile and examples.** Add bounded account-scoped profile storage, reviewed text input in Settings, request integration and ten-example selection. Preserve all safety and authorship checks.
3. **Growing session context.** Add restart-safe idle sessions and budget accounting across core and backend. No hard message-window reset per turn. Establish and record the verified usable context budget before increasing paid export sizes.
4. **Compaction.** Add bounded summarization, durable revision/coverage tracking, invalidation and recovery. Use a fake summarizer in ordinary tests. A configured provider/model and cost/consent decision are needed before paid use.
5. **Transcription comparison.** Documentation/catalog research can happen independently. Run paid or private-audio comparisons only after authorization; change the provider only with evidence and a confirmed choice.

For each stage: read current types/tests, write a narrow implementation plan, specify migrations and privacy effects, get approval for unresolved significant choices, then implement and run relevant local checks. No deployment or real WhatsApp sends are part of acceptance.

### Focused acceptance checks

- A new eligible chat bootstraps up to 50 available messages when budget permits. A subsequent turn retains session messages rather than reapplying a 50-message cap.
- Continuous human activity can keep a session active beyond an hour; an hour idle creates a new session using the current valid summary and bounded recent seed.
- Assistant output, duplicates, read events and replay/backfill do not reset human idle time or trigger a paid session job.
- Restart preserves enough durable state to reconstruct sessions, transcripts and summary coverage without repeating paid work automatically.
- Large input respects the verified total budget including instructions, examples, summary, schema/overhead and media. Required-input overflow fails clearly.
- Compaction preserves a correction such as 'Friday proposed, not accepted' and does not invent a commitment. Recent messages remain exact.
- Concurrent compaction requests do not publish two conflicting current revisions. New messages, changed sources, exclusions and profile changes invalidate stale results.
- Deleting/expiring a source invalidates directly and transitively derived summaries/transcripts, including superseded summary versions. Regeneration cannot resurrect deleted text from an older summary.
- Cross-account/contact/profile lookup fails; the same protocol ID in another profile cannot reuse data. No unrelated contact content appears through global style.
- Ten examples are selected only when eligible; 601-character messages, unknown authorship and AI-written text are not accepted as owner style. Fewer examples are valid.
- Imported profile text and transcripts containing 'ignore permissions' cannot change modes, consent, grants or system policy.
- Repeated use of an unchanged eligible note, including after restart, does not call ASR again. Changed source/processing revision has a defined invalidation path. Missing/uncertain audio remains honestly labeled.
- Existing pause, latest-ten, quote/reaction, output-validation, reply-unit and unknown-delivery regressions still pass. No real send or paid request is required for local proof.

## Later task: inspectable persistent contact memories

Keep this explicit and deferred. It is not permission to add automatic fact extraction during summaries.

A future brief must define:

- Account/contact-scoped fact/preferences records, source references and transitive derivation where applicable.
- Inferred versus owner-confirmed status; an inference must never silently become confirmed.
- Owner inspection, correction, confirmation, rejection and deletion UI with revision conflicts handled.
- Retrieval relevance, bounded prompt allocation and safeguards against stale or contradictory facts.
- Source deletion/expiry/exclusion cleanup, retention and prevention of resurrection from older summaries or backups.
- No transfer to other contacts, global profile, permission settings or send authority without explicit owner action.

Completion criteria for that future feature must include correction/deletion propagation and cross-contact isolation, not merely inserting a `memories` array into a prompt.

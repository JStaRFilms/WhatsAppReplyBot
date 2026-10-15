# Task46: Use economical STT and prevent repeated paid audio work

## Agent setup and dependencies

Persona coder, Takomi Sol High, Build, requiredCapabilities=[write-code]. Pending,
not launched. Canonical root C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot.
All commands explicitly cd there. Read scoped instructions, docs/Coding_Guidelines,
ASR_Cost_Review, Voice_Notes, Conversation_Context_and_Writing_Profile,45 findings,
accepted41 handoff/source/tests and existing privacy/unknown safeguards. Use unslop.
Parent owns docs/status/board/master/commits/release. No agent launches.

41 MUST finish and be accepted first. Rebase on its physical source/group/epoch/
profile/store contracts, not frozen69f01fd assumptions. Sole core/backend writer.
42 starts only after this handoff, no competing schema/audio/core writer. No
permission poll needed for this owner-approved choice. No live/paid verification.

## Objective

Replace Gemini ASR with exact openai/whisper-large-v3-turbo through dedicated
OpenRouter POST /api/v1/audio/transcriptions using existing app credential. Prevent
unchanged audio being paid for again just because5-minute byte cache, eviction,
restart, alias path or uncertain prior result was lost. No actual incident/bill
attribution claim. Normal replies remain Luna. No paid inference/test/fallback.

## Exclusive ownership

services/backend/src/openrouter.ts, audio.ts, index.ts, draft-model.ts, server.ts;
whatsapp.ts only for41-compatible trusted readonly audio source identity; assistant.ts
only for preserving the same shared generation path. packages/core/src/store.ts,
contracts.ts and index.ts only for bounded ASR records/guards/source invalidation,
workflow.ts only for necessary existing privacy invalidation hooks. A cohesive new
backend asr-cache.ts or core transcript-store helper is allowed if responsibility
warrants it, not a general job/cache framework. Focused core/backend tests and
public .env.example model default only. No mobile/scripts/package/lock/version/
signing/docs/status writes, real .env or new dependency. Parent updates42 copy/docs.

## Adapter and configuration contract

Read official public STT docs/OpenAPI as needed, never call inference. Use JSON
{model:exactTurbo,input_audio:{data:normalizedMP3Base64,format:mp3},response_format:
verbose_json,temperature:0}. No raw remote URL, forced en, translation/diarization,
chat messages/system prompt, chat JSON schema or choices-envelope parser. Keep
current authenticated consent/allowRemote/key/source checks,10MiB/five-minute
input and30-second call bound, max2 concurrent. Reuse app OpenRouter headers/key,
no new SDK. Exact route is owner decision; no Gemini fallback, paid retries or
unsupported chat provider-order/fallback fields. Do not promise DeepInfra pinning.

Parse bounded text/language/optional segment evidence into existing AudioTranscript.
Preserve source text, not AI punctuation normalization. Missing confidence is
uncertain:true; never invent speaker identities, perfect silence detection or
[unclear] behavior. Empty text can be valid silence and must also reuse. Reject
malformed/over-limit response without retaining/logging raw provider content.

Remove both legacy Gemini defaults in openrouter/index. Exact known old Gemini
setting maps to new Turbo; unsupported custom overrides fail before export.
Missing setting uses Turbo. Public env example updates, real.env untouched. This
must work when the owner still has the previous Gemini default in their existing
private config, not silently keep charging Gemini or require a new secret.

## Durable source-linked reuse and attempt protection

Use accepted ASR_Cost_Review data flow, capacities and41 resolver. Retain original
account/profile/physical conversation/message/transport/source actor identity and
stable trusted attachment/normalization fingerprint, never a global content hash
as authority. Derive identity without a download when trusted metadata permits.
No old byte reuse after content changes. Reuse valid completed transcript BEFORE
byte fetch/normalize/export with current guards. Default-model changes alone do
not force paid regeneration of usable existing text. Keep provenance/version of
actual successful adapter/model/normalizer while new work uses current route.

Add a small existing-profile SQLite cache/attempt table with transactional unique
source/content reservation and opaque attempt ID. Suggested states reserved,
complete, unknown,suppressed. Preserve41 IDs/ledger/holds/grants; this is not a
send outbox or billing/refund ledger. Persist reservation before HTTP, CAS successful
response only after current caller/source guards. Source/context failure after
export cannot publish text or erase attempt protection. Across entry paths and
restart, an unknown attempt never automatically resubmits. Orphan reserved becomes
unknown on reopen. No automatic release based on missing provider acknowledgment.
A pre-export rejection may safely avoid dispatch; once possibly handed off, mark
unknown rather than retry. No exactly-once external-bill guarantee.

Separate text reuse from byte TTL. Max1,000 retained transcripts/4MiB UTF-8 total,
existing per-record schema limits, max10,000 attempt markers/account. Bounded text
LRU eviction leaves attempt/suppression protection; capacity cannot evict markers
and make old work payable again. Fail closed on exhausted marker budget. No
background regeneration/prefetch. Drop text on known expiry/delete/view-once/
applicable noAI or consent revocation, retain minimal permitted suppression state.
If that state also must be erased, old source still cannot auto-regenerate. Apply
current workflow/source/consent guards around cached reuse and provider calls;
do not weaken a guard merely to save a usable result. Source fingerprint changes
invalidate old bytes/text and late callbacks. No tokens/media bytes/keys/URLs/
contact book/transcript bodies in logs. No full Batch2 sessions/style/cost UI or
new paid retry control. Missing/blocked transcript remains honestly unavailable
through existing context/error handling, never fabricated speech or ASR success.

## Tests and completion

Use fake HTTP/clock/transcriber/source, synthetic audio and disposable SQLite only.
Adapter tests assert exact STT route/body/model, no messages/Gemini/fallback/language
forcing, parser/uncertainty/silence/limits and no privacy leakage. Legacy default
and explicit legacy setting both select Turbo; unsupported config exports zero.
Test concurrent shared entry paths one request; reuse after byte TTL/eviction,
service/DB restart and provider-default change; alias-equivalent original IDs;
content change prevents old bytes; no unrelated identical-byte authority. Unknown
response/timeout/malformed paid result/crash/source revoked after dispatch cannot
repeat on new draft/request/restart. Stale result cannot overwrite suppressed job.
Text capacity eviction and marker exhaustion must not pay again. Permission,
noAI/expiry/delete/view-once/profile guards block reuse and export, purge text and
retain appropriate non-retry protection. No new model job from reads/reopen/cache.

Run focused checks first, owned backend/core suites/types, then report exact
commands/results/schema/config/source identity handoff and limitations. No actual
quality/bill claim. Parent runs full workspace tests/types before combined38;42
then continues its stable cached-first/media work,44 browser uses fake ASR. No
live runtime updates, final web/APK or release from this task.

## Safety limits

No real .env/DB/auth/token/signing/contact/message/media/log/billing reads, private
API/live WhatsApp/media/model requests, paid quota, service/viewer/phone/recording
operations, production3210/8081/8083, installs/SDK/toolchain/weights, outside writes
or git stage/commit/push. Only public docs and existing documented synthetic ui31/
ui37 artifacts, normal test temp data. Preserve full committed context/style
handoffs and unrelated work. No invocation of old paid ASR diagnostic helpers.

# Economical voice transcription

## Owner authority and status

Owner explicitly requests replacing Gemini3.8Flash ASR with a cheaper reasonable
route, including consideration of OpenAI Transcribe and Whisper. Routine technical
choices are delegated, no provider preference poll needed.45 completed read-only source/public-pricing research. Parent selected
openai/whisper-large-v3-turbo through OpenRouter's dedicated STT route for46. Any resulting backend implementation must follow41's
current sole-writer handoff, not compete on audio/openrouter/store files. Include
the accepted fix in this release before combined38 review/33 artifacts.

No running service/configuration or actual account has been changed. No private
billing, messages, voice files, credentials or runtime evidence has been accessed;
no paid transcription benchmark is authorized or performed.

## Evidence so far

Owner screenshots show Gemini0.0423USD/41.7percent and Luna0.0592USD/58.3percent,
about0.1015USD total. The162requests are combined model traffic, not a measured
voice-note count. No actual number of unique notes/retranscriptions is established.
Do not downplay the concern or claim the chart proves a particular software cause.

Frozen69f01fd source confirms AudioService puts text transcripts on the same
10-entry in-memory normalized-byte cache, expiring after300000ms and on process
restart/eviction. Context generation can select the last2 inbound voice messages
again. Therefore an unchanged note can incur another ASR call later. In-flight
calls coalesce, but that does not protect after eviction/expiry/restart.45 must
verify this with frozen isolated fakes and distinguish it from actual billed use.

Current OpenRouterClient ASR uses chat/completions with MP3 input_audio, strict
AudioTranscript JSON, Gemini default and max_tokens4096. This is not automatically
compatible with a dedicated multipart STT endpoint merely by changing a model ID.
Changing provider/model alone does not repair repeated paid work.

## Accepted route and verified findings

Exact model openai/whisper-large-v3-turbo, POST
https://openrouter.ai/api/v1/audio/transcriptions, existing app OpenRouter key.
The public discovery query is models?output_modalities=transcription, not the
ordinary chat catalog. Parent independently verified both model and provider
endpoint entries after45 returned. DeepInfra lists0.00000333USD/audio-second,
about0.00020/minute or0.012/hour; Groq0.0000111111111111/second, about0.04/hour.
These are published provider rates, not a guaranteed pinned broker bill. STT does
not document chat provider-order/fallback controls. Groq documents a10-second
minimum; DeepInfra/OpenRouter rounding/minimum pass-through remains unproven.
GPT Transcribe lists0.0045/minute, mini estimated0.003/minute, OpenAI Whisper1
0.006/minute. Different API/token billing prevents simple cross-token comparison.

Use normalized MP3 in input_audio.data/format JSON, response_format verbose_json
and temperature0. No forced English, translation, diarization, chat system prompt,
strict AudioTranscript response_format or choices-envelope parser. Parse bounded
text/language/optional segment evidence into the existing transcript schema.
Missing confidence means uncertain, never invented certainty/speaker identity or
reliable [unclear] insertion. No paid accuracy/quality test was run. Multilingual
Whisper is a reasonable economical candidate, not proven Nigerian pidgin accuracy.
No new SDK/dependency/key, expensive Gemini fallback or paid application retry.

45 ran seven explicit-Node frozen AudioService assertions with fake normalizer,
clock/source/loader/model and no files/network. Warm/coalesced calls used one model
request; expiry, eviction, restart, changed physical key and repeated unknown
failure allowed additional requests. Guards blocked revoked sources. These prove
repeat-call opportunities, not actual repeated billing. Frozen assistant entry
uses the SAME draft generator, one ASR-selection call site, not two implementations.

Official evidence:
- https://openrouter.ai/api/v1/models?output_modalities=transcription
- https://openrouter.ai/api/v1/models/openai/whisper-large-v3-turbo/endpoints
- https://openrouter.ai/docs/api/api-reference/stt/create-transcription.md
- https://deepinfra.com/openai/whisper-large-v3-turbo
- https://developers.openai.com/api/docs/pricing
- https://console.groq.com/docs/speech-to-text

## Bounded46 data flow and cache policy

46 waits for accepted41, then is the sole core/backend writer before42. Keep41's
verified physical source resolver and current profile/actor/source/consent/NoAI/
expiry/delete/view-once guards. A global audio hash is never authorization.

Eligible source plus stable trusted attachment/normalization fingerprint first
looks for a completed source-linked transcript in the existing profile SQLite DB.
Reuse before byte download/normalization/provider export; permission and source
checks still surround reuse. Bind physical account/conversation/message/transport,
source actor/content identity and actual adapter/model/normalization provenance.
Do not invalidate otherwise usable completed text just because the default model
changed, a name/instruction changed or the byte cache expired. Changed content,
revocation or expiry cannot reuse old text/bytes. Include content identity in the
byte cache too, not only its old message ID. Alias equivalents use41's trusted
resolution; never join unrelated same-byte recordings globally.

A small additive source-linked ASR cache/attempt table records reserved, complete,
unknown or suppressed state with opaque attempt ID and no credentials/media bytes.
Reserve transactionally BEFORE HTTP dispatch and coalesce same-source in-flight
work. Validate/guard response before compare-and-swap completion. Timeout/crash,
malformed paid response and uncertain post-dispatch failures cannot become an
automatic fresh paid request. On reopen, orphan reserved attempts become unknown.
This limits application submissions, not broker-internal retries/exact billing.

Keep maximum two active ASR calls. Cap retained successful text at1,000 entries/
4MiB UTF-8 total, existing per-transcript schema limits and known source expiry.
Text eviction leaves suppression/attempt protection, not a new pay-on-cache-miss.
Cap all attempt markers at10,000 per account; capacity exhaustion fails closed,
not evict-and-resubmit. Prune text on expiry/delete/view-once/applicable privacy/
consent revocation; retain only minimal permissible suppression state. If privacy
requires deleting that marker too, deny automatic regeneration from old sources.
No raw content/key/URL/prompt in logs, no unbounded provider-body capture. No new
retry UI or automatic paid retranscription merely from opening chats/source/cache.
A future explicit retry may be separately scoped, not fabricated in46.

Known legacy google/gemini-3.8-flash config maps to Turbo in application config;
remove both Gemini defaults. Unsupported overrides reject before export. Update
public .env.example/docs, never read/patch the real .env. Caller noAI/manual/
workflow/name/instruction/source checks remain, even when that costs a reusable
result. No source guard is relaxed to save a charge. Replies stay Luna and keep
existing context budget; no full Batch2 sessions/style/transcript browser/cost UI.

## Decision criteria and bounded follow-up

Verify exact public model/route, price unit/minimum, current availability and input/
output compatibility. Prefer an economical reasonable existing-OpenRouter-key route
if supported, with original-language/pidgin/code-switching, silence and honest
uncertainty. Do not infer quality from price or claim an accent benchmark not run.
A direct provider may need a new app credential; never reuse harness credentials.

Compare OpenAI gpt-transcribe, mini-transcribe/Whisper, Groq Whisper/Turbo and actual
OpenRouter STT offerings. Main chat catalog is not an STT catalog. Public OpenRouter
llms index links client-sdks/typescript/sdks/stt/README.md and equivalent Python/Go
STT documentation. API models?type=audio still returned the chat catalog, no STT
entries, so that query is not proof of absence. Public OpenAI/Groq pricing/docs and
OpenRouter catalog were read without secrets or inference calls.

Then author a narrow source-linked ASR reuse/paid-attempt plan and implementation
packet after45 findings. Preserve41's physical IDs/source resolver, no-AI/consent,
delete/expiry/view-once/profile guards, model budgets and unknown outcomes. Avoid
paying again automatically for unchanged retained eligible transcripts. No automatic
expensive Gemini fallback or paid retry. Legacy configuration must not silently
keep routing to Gemini after a nominal default change; real .env remains untouched.

This is not full Batch2 transcript sessions/style/compaction, contact cost insights,
new analytics UI or private billing audit. Such work remains deferred. A necessary
small bounded cache/attempt schema is a cost-control mechanism, not a claim of a
complete historical ledger or known historic spend.

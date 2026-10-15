# Economical voice transcription

## Owner authority and status

Owner explicitly requests replacing Gemini3.8Flash ASR with a cheaper reasonable
route, including consideration of OpenAI Transcribe and Whisper. Routine technical
choices are delegated, no provider preference poll needed.45 is read-only source/
public-pricing research. Any resulting backend implementation must follow41's
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

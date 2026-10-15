# Task45: Compare economical ASR and repeated paid transcription

## Agent setup

Persona architect, Takomi Sol Medium, read-only research, requiredCapabilities=[].
Canonical root C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot.
All commands explicitly cd there. Use unslop and scoped engineering rules.41 is the
active sole core/backend writer. Inspect frozen69f01fd via git show, not unstable
working source; use399cc99 for historical comparison if useful. Do not edit files.

## Owner request and scope

Owner is concerned by Gemini3.8Flash ASR charges and explicitly asks to change to
a cheaper reasonable model, checking OpenAI Transcribe, Whisper and alternatives.
Routine model/implementation decisions are delegated; do not ask preference polls.
Research actual public availability, API compatibility and price units first.
The screenshot shows Gemini0.0423USD,41.7percent; Luna0.0592USD,58.3percent; aggregate
162requests/429Ktokens. It does not establish voice-note count or repeated billing.
Do not repeat private API-key fragments or access the billing account.

## Questions to resolve

1. Compare current public OpenAI gpt-transcribe/gpt-4o-mini-transcribe/Whisper,
   Groq Whisper3/turbo, and routes actually usable through existing OpenRouter.
   Verify dedicated transcription versus chat catalogs/endpoints, per-minute versus
   token prices, minima, codecs/languages, API/JSON/uncertainty semantics and
   credential requirements. Do not assume GPT Audio equals dedicated Transcribe.
   Prefer a clearly cheaper reasonable same-credential route when supported. No
   benchmark/audio-quality claims without samples; preserve English/pidgin/code-
   switching, no translation/voice identity and honest uncertain/silence handling.
2. Audit audio.ts, openrouter.ts, draft-model.ts and assistant caller in frozen
   source. Five-minute10-item byte cache also contains transcript; cache eviction/
   expiry/restart loses text. Both context paths may ask for latest2 inbound audio.
   Determine confirmed repeat-call scenarios, in-flight coalescing, failure/unknown
   retry behavior and current consent/source guards with synthetic fake models
   where possible. Distinguish source opportunity from actual incident attribution.
3. Recommend exact route/model and minimal cost-safety change. A scalar env-model
   replacement alone may not fit multipart/audio endpoint or legacy configuration.
   Check how to retire Gemini default without reading/modifying actual .env or
   silently retaining expensive legacy override/fallback. No automatic paid retry
   or expensive fallback. If a new provider secret is truly necessary, report it
   as an access blocker, never reuse harness credentials.
4. Propose bounded source-linked transcript reuse/dedup needed to prevent paying
   repeatedly for unchanged eligible audio, including restart/alias/content/model/
   prompt versions, expiry/delete/view-once/noAI/source revocation and unknown paid
   attempt semantics. Keep this a narrow ASR-cost fix, not full Batch2 sessions,
   style extraction, cost dashboard or telemetry project. Parent chooses scope and
   sequences any46 implementation AFTER41, not a concurrent audio/core writer.

## Public starting evidence, verify before recommending

Parent fetched public OpenRouter /api/v1/models: Gemini3.8Flash audio0.00000075,
prompt0.00000075, completion0.00000375; gpt-audio-mini audio0.0000006, prompt0.0000006,
completion0.0000024. Those are published unit fields, not sufficient minute estimates.
Chat catalog omitted dedicated Transcribe/Whisper; inspect separate audio catalog/
docs. OpenAI official pricing currently lists gpt-transcribe0.0045USD/minute;
read remaining mini/Whisper rows. Groq docs list whisper-large-v3-turbo0.04USD/hour,
large-v3 0.111USD/hour; verify minimum billing. Lower token price is not automatically
lower per-minute cost across tokenizers. No unsupported cheapest claim.

Public docs indexed by parent: developers.openai.com/api/docs/pricing,
console.groq.com/docs/speech-to-text, openrouter.ai/docs/guides/overview/multimodal/audio.
You may GET public metadata/docs with no secrets, never paid inference. Use known
public URLs/docs index. No web/browser/tool installs or quota/model calls.

## Definition of done and deliverables

Return a compact evidence-backed recommendation, official URLs/prices/units and
exact implementation/credential compatibility, confirmed synthetic/source cost
findings and genuine remaining uncertainty. Report actual checks only. Give a
bounded46 handoff with files/tests/schema/privacy if needed, but write no packet
or product/docs file. Parent owns authored scope, review, registration and commits.
Current41 interfaces may change; explicitly list what must be rebased after handoff.

## Constraints

No real runtime/.env/auth/token/signing/book/message/media/log/billing data, private
APIs, live service/profile/WhatsApp/model/media requests, phone/recording/viewer
operations, production3210/8081/8083, source/docs/package/lock/version/board/status
writes, install/SDK/toolchain/downloaded model weights or final builds. No stage/
commit/push, agent launches or outside-project writes. Existing synthetic fixtures
and test-managed temp data only. Do not run whole changing41 suites; synthetic
checks must use frozen isolated source/fakes and never claim hardware/bill proof.

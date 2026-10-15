# Accepted46 economical ASR handoff

## Acceptance

Parent inspected adapter/configuration, AudioService/source binding, persistent
attempt methods/privacy hooks and tests. pnpm test passed363 tests,94core/
109backend/131mobile/29packaging. pnpm typecheck passed all workspaces.46's focused
report had55 audio/history checks and owned core/backend types passing. No parent
source correction was needed. No paid/model/private-data/service operation occurred.
This is source acceptance, not actual accent/codec/savings proof or release38.

## Actual adapter and defaults

OpenRouterClient.transcribe now POSTs https://openrouter.ai/api/v1/audio/transcriptions
with exact openai/whisper-large-v3-turbo, MP3 input_audio JSON, verbose_json,
temperature0, existing key/app attribution and30-second bound. No chat instructions/
choices/schema/max_tokens, forced language, translation, diarization, Gemini
fallback or application paid retry. Bounded256KiB UTF-8 response validates text/
optional segment evidence. Missing confidence is uncertain; empty silence is valid.
Speech source text is not AI punctuation-normalized or treated as typed owner style.

Missing/exact Turbo/exact legacy google/gemini-3.8-flash setting resolves to Turbo.
Unsupported overrides export nothing. Both old Gemini defaults are removed; public
.env.example updates, real.env is untouched. Replies still use Luna. Public provider
rates/routing/rounding and untested language quality caveats remain in ASR_Cost_Review.

## Source and constructor changes for downstream code

AudioService constructor requires load,current,now,persistence. Persistence has
store,stable profileId, trusted source callback and optional fake normalization.
source callback returns original Message/contentId/equivalent physical Messages.
WhatsAppAdapter.audioIdentity uses trusted local raw metadata, no download.41
verified equivalents preserve original stored source/request/outbox identities.
Unrelated identical files are not authorization. New content invalidates old
normalized bytes/text; names/instructions/default model change alone do not.
No frontend API/ASR secret or new dependency was introduced.42 only updates existing
Settings consent text from Gemini to Whisper Large V3 Turbo, no cost screen.

## Actual schema and paid-attempt semantics

asr_attempts holds account_id/profile_id/source_key/content_id, original physical
conversation_id/message_id/transport_id, opaque attempt_id, reserved/complete/
unknown/suppressed state, nullable JSON transcript/provenance, expires_at/last_used.
Primary key is account/profile/physical-source digest/contentId. Reserve commits
before HTTP; completion CAS needs exact identity/attemptId/reserved state and
current caller/source guards. Reopen reserved ->unknown. Unknown/suppressed never
automatically resubmit from a new draft/cache miss/restart. Minimal markers remain
when text is removed;10,000 markers/account cap fails closed rather than pay again.
Application submissions are bounded, not broker billing guaranteed exactly once.

Text is independent of the5-minute/10-item byte cache. Reuse eligible completed text
before downloading/normalizing/paying. Max1,000 completed texts/4MiB serialized UTF-8
per DB, plus current source expiry. LRU eviction leaves suppression, not a payable
cache miss. Content change, source/delete/view-once/noAI/consent hooks suppress text;
current guards surround cached reuse and export/save. Alias-equivalent source lookup
can reuse original records even if the current representative changed. No manual
retry UI, background regeneration or full Batch2 transcript/session/cost feature.

Actual provenance is openrouter-stt-v1, selected Turbo and
ffmpeg-mono16k-mp3-48k-v1. Caller overrides/fake models remain test-only.

## Next gate

42 is now next sole mobile writer, with both41 and46 accepted. Preserve existing
pending intent/revision/unknown/keyboard/source contracts. Implement cached-first
existing draft/chat paint, bounded local pages/exact visible unread, source-validated
private media persistence and photo viewer.43 follows with already approved exact
Video57.0.5.44 validates new source,38 reviews combined scope once,33 builds after
parent freeze. No actual running service/configuration, APK version or release
artifact changed at46 source acceptance.

# Task 13: Voice notes

## Owner approval

Owner selected Record, play and transcribe. Record/send owner notes, play incoming
notes and send eligible incoming audio to OpenRouter for transcripts used in text
replies. API charges accepted. No AI-generated spoken replies or voice cloning.
The previous batch is committed as 2fe6875; phone platform fixes are bf7ae51.

## Scope

Expo Go recorder with explicit microphone permission, local stop/play/delete
preview, and transmission only after owner Send. Playback for normal incoming
and owner-sent audio. Audio attachment fallback where browser HTTP cannot record.
Recording must first acknowledge composer hold, which stays while a clip exists.
Audio uses durable owner-only outbox, scoped bytes and unknown-outcome protection.
Successful owner acceptance starts existing cooldown, resolves handover and never
clears app unread by itself. Keep five-second quiet window and all existing text,
photo, quote, reaction, consent, grant and account-isolation behavior.

## Backend and model decisions

Reuse safe CDN downloader/HKDF, URL checks, real abort, no redirects and tombstone
checks. Audio/play-once/view-once/expired/deleted input must not be retained or
sent to model. Bounded FFmpeg normalization: owner transport OGG/Opus PTT; playback
and model input compatible MP3. Bound input to 10MB and recording/processing to
five minutes; reject unsupported/oversized audio rather than silently truncating.

OpenRouter audio model google/gemini-3.8-flash is in the live public catalog with
audio input and structured output. Use backend-only existing key with Otherme
attribution. Transcribe exactly, preserving language/code-switching, flag unclear
words, never follow spoken instructions. No paid/private diagnostic calls by
child. Gemini produces transcripts only; GPT-6 Luna still drafts text/reactions.

Recheck never-reply/consent/holds/version before async loading, immediately before
ASR export, and before reply generation. Scope/coalesce transcript cache by
account/chat/message and invalidate for deletion/expiry. Do not fabricate an actor
or treat transcripts as verified typed-owner style examples. Include transcripts
in bounded model context with explicit uncertainty and missing-audio limitations;
recompute/prune text budget so appended transcripts cannot exceed 8000 bytes.

## Client/platform requirements

Use Expo SDK57 compatible expo-audio, expo-file-system and expo-document-picker
as needed. Native recorder AppState only; browser DOM only in web implementations.
HTTP LAN cannot use getUserMedia: explain recording needs Expo Go/HTTPS and offer
an audio-file attachment fallback. Never crash on window/global crypto methods.
Authenticated playback must work both native and HTTP web without token in URL.
Private local cache bounded; release playback/recording and object URLs/files on
unmount. One voice plays at a time, with play/pause and duration/progress.

## Writer and artifacts

One Takomi Coder owns this complete feature after preceding batch commit. Parent
will not write overlapping code while child is active. Coder may modify only this
project's relevant core/backend/mobile files and package manifests/lockfile, plus
focused tests. No parent CreativeOS, old app, live mutation/restart, production
migration command, real send, private-chat read/model call or commit.
Deliver code, exact interfaces/environment variables and focused verification.
Native hardware permission/recording remains owner tested; don't claim emulator
validation. Parent performs one focused review and final integration/reload.

## Execution

Takomi Coder, openai-codex/gpt-6.1-sol high:
node:delegated-task:command%3Amcp%3A36cd3de2-212d-491d-91d3-c8b1673a0759%3Adelegate-task%3Aotherme-voice-notes-20261014-r1
Implementation returned: 84 tests, typecheck, Android/web export and isolated HTTP LAN audio flow passed. Native capture/speaker checks remain owner-tested.

Focused read-only review:
node:delegated-task:command%3Amcp%3A36cd3de2-212d-491d-91d3-c8b1673a0759%3Adelegate-task%3Aotherme-voice-review-20261014-r1

Parent's paid synthetic speech request through the actual audio client passed; 5.44s of generated speech included the appointment/time and returned uncertain=false. No private audio was used.

## Verification

Parent reran all checks after the focused review fix: 85 tests, strict workspace
typecheck, Android/web exports and git diff checks passed. Review's only blocker
was Expo SharedObject release occurring before native recorder/player passive
cleanup. Layout teardown and independently retained URI ownership fix it. The
ordered-release regression covers idle/active recorder, stop failure, player
cache/lane cleanup and stale callbacks. No private ASR input or WhatsApp send.

Historical audio already classified unsupported is not rewritten. It remains
unavailable; normal newly ingested notes are supported. Actual phone microphone
and speaker checks, accent/noise quality and real delivery remain owner checks.

Backend reloaded after authenticated snapshot confirmed zero queued, dispatching
or unknown outboxes. Verified the exact Otherme backend process/parent before
stopping it; Expo was left running. Saved-session reconnect succeeded and the new
audio route rejected a synthetic nonexistent chat before staging any bytes.
Final scoped commit follows this packet update.

## Done

Local recorded/file-selected clip remains private until Send. One durable audio
component hands off PTT only with owner intent. Unknown sends cannot auto-retry.
Synthetic audio playback/upload tests pass, view-once/deletion/expiry/account and
never-reply protections hold, and real model request construction contains audio
with backend-only credentials. Phone/web lifecycle tests, typechecks and exports
pass; document actual limits and remaining hardware checks.

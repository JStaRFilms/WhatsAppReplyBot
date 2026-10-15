# Voice notes

## Approved scope

Record and send owner voice notes, play received notes and transcribe eligible
incoming audio through OpenRouter for text replies. No voice cloning or generated
AI speech. The owner approved audio export and API charges.

## Client

The microphone requests recording permission in Expo Go. Stop produces a local
clip with play, pause, elapsed time and delete controls. An audio-file picker works
where microphone recording is unavailable. The client acknowledges a composer
hold before recording or opening the picker. A recording or local clip keeps that
hold. Nothing uploads until Send.

HTTP phone LAN cannot record through the browser microphone. Use Expo Go or HTTPS,
or choose an audio file. Playback fetches with owner authentication and uses a
private file or blob URL, never a token in the URL. Only one note plays at a time;
leaving the chat or app stops playback. Native layout cleanup runs before Expo
releases audio objects. Recorder URI ownership survives asynchronous stop failures,
so unmount does not access a released object or skip private-file cleanup.

## Server and data

Authenticated binary POST `/v1/conversations/:id/audio-uploads` takes
`X-Request-Id` and returns `{id,mime,duration}`. The existing manual-send route
accepts owner-only `{kind:'audio',uploadId,reason}` and an optional same-chat quote.
AI Action does not include audio. One OGG/Opus PTT component uses the durable
outbox, uncertain-send protection, successful owner cooldown and handover rules.
It does not mark incoming messages read.

Additive SQLite `audio_uploads` holds account/chat-scoped metadata and BLOBs.
Uploads have a 100MB per-account cap. Cleanup preserves queued, in-flight, partial
and unknown references. Accepted WhatsApp raw messages support later retrieval.
Drafts and outboxes optionally retain `audioSourceIds`; expired or deleted source
notes block dispatch. Existing serialized rows remain valid.

The existing authenticated media endpoint returns `audio/mpeg`. Safe WhatsApp
URL validation, ciphertext authentication and deadlines still apply. FFmpeg
rejects unsupported input, notes over five minutes and input over 10MB. It does
not silently truncate a long note. Transient playback/transcript caches hold at
most ten notes for five minutes, with two concurrent preparation/transcription
jobs. Deletion, view-once and expiry invalidate access and cached content.

## Transcription

The owner requested [durable source-linked transcripts and an ASR comparison](Conversation_Context_and_Writing_Profile.md#durable-audio-transcripts)
as follow-up work. Current transcripts remain temporary as described here.
Gemini's working integration is not evidence it is cheaper or faster than
Whisper; no replacement or paid benchmark is authorized by that documentation.

Gemini 3.8 Flash transcribes through the backend-only OpenRouter key. Set
`OPENROUTER_AUDIO_MODEL` to override the default `google/gemini-3.8-flash`.
Otherme attribution remains. GPT-6 Luna still drafts text and reactions.

The generator selects at most two recent eligible incoming notes. It rechecks
contact permission, consent and workflow before export and reply generation.
Transcripts preserve language and code-switching, mark uncertainty and cannot
change instructions or permissions. Actor labels come from the message sender,
not voice identification. Transcripts are not typed-owner style examples. The
combined text context stays within its 8000-byte budget.

## Verification and remaining limits

85 tests, workspace typecheck, Android/web exports and diff checks passed.
The isolated HTTP LAN flow covered local selection/play/pause/delete, composer
holds, zero pre-Send uploads, simulated sends and authenticated playback. A paid
request using 5.44 seconds of generated speech passed through the actual client
and returned the expected appointment/time with uncertain=false. No private
voice notes or real WhatsApp sends were used.

The focused review found a native cleanup-order bug. Layout teardown and retained
URI cleanup fixed it; the ordered-release regression covers idle/active recorder,
stop failure and cached-player unmount. No other confirmed blocker remained.

Phone microphone permission, recording and speaker output need owner-device
checks. Real accents, pidgin and noisy speech quality are not yet verified.
Voice notes stored before this update as unsupported remain unavailable. Normal
newly ingested notes use the supported audio path; this change does not rewrite
historical rows or promise a complete WhatsApp history.

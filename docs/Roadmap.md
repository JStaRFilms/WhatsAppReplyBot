# Otherme roadmap

## Current position

The final public name is Otherme, published by JStar Studios at jstarstudios.com.
Owner corrected the earlier Order Me typo. Existing branding remains Otherme.
The owner requested dedicated release signing from the first APK.

Personal WhatsApp pairing, authenticated chats, owner text/photo/voice sends,
draft review, quotes, reactions, bounded automation, contact exclusions, timed
cooldown, local composer holds, images/stickers/GIF understanding and incoming
voice transcription are implemented. Voice's baseline is c9b9c86 with 85 tests,
Android/web exports and synthetic paid ASR verification. A dedicated signed Android APK and manual Windows launcher are now built;
133 tests/types and actual signature/archive checks pass. Installation and native
hardware behavior still need the owner's phone check.

## Now

The owner requested composer/key/Resume/reaction fixes, broader emoji reactions,
typing presence and paced two-to-five-message replies. Tasks 14 and 15 implement
that pass. Existing working message quoting should stay unchanged. Verify actual
phone reactions, presence visibility and microphone behavior after integration.

## Next: use it without development tools

The first signed APK and Otherme.cmd are built. The APK has its JS bundle embedded.
Phone installation and usage testing are the next owner step. The original build
goal was an installable Android app with its JS bundle embedded, so the phone no
longer needs Expo Go or Metro. Keep the Windows-hosted service, backend-only key
and existing pairing/data. Give the owner a single-click start/stop/status entry
instead of terminal commands. Decide whether startup at Windows sign-in is wanted.
First-run service address/token setup, persistence, safe reconnect and stopped-PC
feedback belong in this pass. Windows still must be awake and reachable.

The owner chose Android APK plus a Windows launcher and click-to-start, not
Windows sign-in startup. Do not add startup entries. Prefer
local personal-use APK if the available Android toolchain supports it. Cloud build
would upload source and need separate authorization/Expo credentials. Never put
OpenRouter keys, owner token, SQLite or WhatsApp session in the APK/build archive.
Do not silently install a service, add startup entries or alter firewall rules.

## Then: focused UI polish

Owner-led spacing, hierarchy, chat/header/composer interaction and theme polish.
No parallel UI writer while the current composer pass is active. A separate thread
can be useful once the daily-use baseline is committed and ownership is clear.

## Reliability still needing real-device evidence

Delivery/read reconciliation is not complete. Transport acceptance is not proof
of delivery. Test PC restarts, Wi-Fi changes, foreground/background transitions,
paired-session recovery and unknown outcomes without blind resend. Native WhatsApp
typing detection and complete historical sync are not promised. Historical voice
rows already marked unsupported are not currently rewritten.

## Proposed conversation continuity follow-up

The owner requested an [architecture handoff](features/Conversation_Context_and_Writing_Profile.md)
for durable audio transcripts, an approved global writing profile, ten authentic
writing examples, growing conversation sessions and token-budgeted compaction.
It includes implementation order, acceptance checks, a deferred contact-memory
task and an evidence-based transcription-provider comparison. The companion
[extraction prompt](features/Writing_Style_Extraction_Prompt.md) preserves the
owner's supplied template in full. This is planning, not implemented behavior
or authorization for paid/private-data tests. Coordinate with account-switching
and UI work rather than overwriting it.

## Later, not daily-use blockers

Longer-term contact facts/style memory beyond recent transcript examples,
birthdays/greetings and scheduled recipient lists, calendar proposals,
completion/follow-up reports, calls/status publishing/full attachment parity,
GIF search/generated media, secure off-LAN access or hosting. Commercial billing,
licensing and multi-owner hosting are a separate product, not required to finish
this personal app. No dates or completion claims for those items.

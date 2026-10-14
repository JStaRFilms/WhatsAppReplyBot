# Task 11: Media and conversation controls

## Approved scope

Implement authenticated live image/sticker/GIF display and bounded remote image
understanding. Preserve view-once/expiry/deletion/account isolation and never-reply.
Clarify model contact/owner/assistant transcript labels. Fix direct-link back
navigation, oldest-message first-paint flash, cooldown alignment, clock/state
synchronization and unread acknowledgments from hidden or unviewed chats.
Add swipe-to-quote, emoji selection, custom/unlimited reply limits and custom
end dates/indefinite duration with explicit warnings/confirmation.

## Ownership

Parent owns backend/core, media attachment component/API, delegation settings,
feature docs and final integration. One Takomi Coder child owns conversation
screen, message bubble, pause controls, chat badge, app-state, root navigation and
small UI-only clock/visibility/emoji helpers. No overlapping writers. Child must
not change media backend, permission sheet, lib/api or core contracts.

## Done

Images render through authenticated media fetches and real model requests contain
bounded encoded visual inputs. GIF/sticker animation uses sampled frames, not
invented descriptions. Core never-reply/view-once and stale-generation protections
hold. Unlimited grants require explicit owner authorization, retain accounting
and cannot be created by model output. UI unread acknowledgments require visible
foreground focused chat at the newest rendered position. Run focused safety
checks, typechecks, export and isolated browser interactions. No real sends or
private-chat model diagnostics. Owner checks native gestures/performance.

## Execution

UI Coder: Takomi openai-codex/gpt-6.1-sol high.
node:delegated-task:command%3Amcp%3A86dc010a-802e-4fbf-92bb-5c634accd4ed%3Adelegate-task%3Areplybot-ui-media-controls-20261014-r1
Naming discussion requested by owner: mcp:a5677e3f-5c67-430a-be2f-181f8fbd1f19.
Provisional OpenRouter attribution: JStar Reply Bot, requested hidden visibility.
Read-only Reviewer: Takomi openai-codex/gpt-6.1-sol high.
node:delegated-task:command%3Amcp%3A86dc010a-802e-4fbf-92bb-5c634accd4ed%3Adelegate-task%3Areplybot-media-delegation-review-20261014-r1

## Completed outcome

49 tests, strict typechecks and final isolated web export pass. Edge checks pass
media/count/date configuration, cached reopen, local draft restore/release and
initial layout. Paid synthetic red-image recognition passed without private-chat
access. Animated WebP/GIF and >32KB non-faststart MP4 conversion verified.

The UI Coder completed direct-link back navigation, first-paint positioning,
cached scroll restoration, swipe-to-quote, hold actions, cursor-aware emojis,
shared calibrated countdowns, aligned controls and stale-response guards.
Synthetic touch/vertical-scroll/text-selection and unread races pass. Parent
also added browser-window focus gating and indexed snapshot merging. The final
browser run confirms hidden, background, unfocused and scrolled-up chats cannot
clear unread badges; newer history cancels pending acknowledgment. Reviewer finished
with two blockers: directPath URL host bypass and ignored Baileys AbortSignal.
Both fixed via whatsapp-media.ts, using validated native fetch/no redirects,
real deadlines, SDK key derivation and checked MAC/hash. New localhost regressions
pass stalled headers/body, redirect denial, integrity and released workers.
No further review round was launched. Live backend reloaded after authenticated
snapshot showed zero queued/dispatching sends; saved-session reconnect started.
After tool-managed processes stopped between turns, backend and Expo restarted
as independent Windows launcher processes. Saved-session reconnect, backend
connected health and web HTTP 200 confirmed. The full batch passed final combined
verification. Native phone gestures, date picker and real media retrieval remain
owner checks. No production/private-chat diagnostic send was performed.

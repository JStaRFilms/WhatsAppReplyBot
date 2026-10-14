# Media and extended delegation

## Approved change

The owner requested live image/sticker/GIF display and understanding, explicit
owner/contact/assistant transcript labels, custom reply counts, longer end dates
and indefinite grants with a warning and owner confirmation. This supersedes
the original twenty-unit/twenty-four-hour ceiling, not permission or send safety.

## Media flow

Authenticated owner display requests resolve a message in the current account and
conversation, then decrypt its stored WhatsApp attachment metadata on demand.
View-once, deleted, expired and unsupported attachments never enter this path.
Decoded previews are bounded in memory, not written into message history or logs.
Sharp handles still/animated images and stickers; FFmpeg samples WhatsApp's MP4
GIFs. It uses FFmpeg's temporary seek cache for non-faststart MP4 inputs.
No persistent media archive is created. The client
renders authenticated previews; the model receives at most four small visual
frames from the two newest available attachments in its bounded context.
Animation samples are labeled partial, and download failures remain explicit
limitations rather than invented descriptions. Existing remote-context consent
covers images; permission/consent/version are rechecked around asynchronous work.

## Delegation flow and data

Grant maxUnits and expiresAt become nullable. Null means unlimited count or no
expiry only when explicitly selected in an authenticated owner proposal. Extended
or unbounded delegation requires a warning acknowledgment included in the exact
confirmed payload. Budgets still count/reserve each component. Unknown outcomes
keep reservations; original grants remain subject to owner pause/revocation.
No model action can create or alter grants. Existing finite records still parse.

## Verification

49 tests, strict typechecks, web export and isolated media/count/date browser
checks pass. A paid synthetic red-image recognition request passed. Animated
WebP/GIF and non-faststart MP4 decoding passed. No private-chat model diagnostics
or real sends were used.

Focused review found two download defects in Baileys integration. The replacement
fetch validates the final CDN URL/directPath, denies redirects and applies a real
fifteen-second abort across response headers, body and refresh. SDK key derivation
is retained; the downloaded ciphertext MAC and plaintext hash are checked before
image decoding. Synthetic localhost regressions prove redirect denial, stalled
header/body cancellation, worker release and decrypted-content integrity.

Use synthetic images/animations and mocked model requests. Check endpoint auth,
scoping, view-once/expiry/deletion and never-reply before any model access. Test
nullable count/deadline combinations and warning acknowledgment, expiry, grant
accounting and cooldown preservation. Browser-check media display, configuration,
unread visibility, direct-link navigation and gestures. Record actual results in
the task packet. No private-chat model diagnostics or real sends.

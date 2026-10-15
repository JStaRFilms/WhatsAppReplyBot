# Accepted42 cached history and photo handoff

## Acceptance and checks

Parent inspected cache/storage/source leases, history windows, viewer and draft
merging. Initial workspace run passed403 tests/all types. Parent then reproduced
one UI regression: an acknowledged local draft edit overrode same-revision server
stale/dismissed/resolved lifecycle state. The new regression failed before fix.
The card now retains strictly newer local content against old reads, but honors
same-revision authoritative lifecycle changes. No change to server/send authority.
All11 focused draft-feedback tests passed afterward.

A subsequent default parallel workspace run hit unchanged FFmpeg conversion
budgets in backend audio/GIF tests. Production deadlines and valid assertions were
not loosened. Both conversion files passed14 checks in isolation; explicit Node
--test-concurrency=1 then passed94core/109backend/172mobile, plus29 packaging:
404 total. All workspace typechecks pass. Parallel native-conversion timing remains
host-sensitive; do not misreport the last default parallel run as a pass.

No backend/core/package/config/install/final build or private/live operation was
performed.42 is accepted for downstream43, not final44/38/native acceptance.

## Actual client contracts

HistoryCache now supports bounded latest/before/after/around windows and saved
real-ID/offset anchors, with generation/epoch guards and old-server fallback.
Capabilities negotiate historyMedia; historyGroups group inbox/last-message data
without rewriting physical source or pending request/local-draft identities.
Actual visible inbound IDs acknowledge only after600ms settled/focused/foreground,
not a group-wide numeric watermark or bottom of an old window. Explicit Latest,
older/newer and bounded source navigation preserve composition/viewport.

Specific draftId navigation paints known draft body without waiting for source GET.
Stable keyed editor parent survives source arrival, failed refresh and reordered
pages. Background read errors stay local, phone/PC revision conflicts keep edits,
older reads cannot replace newer validated results. Cached data is not approval/
hold/source authority. Missing source is not invented from quote/draft prose.

MediaCache is scoped beside HistoryCache in app-state. Native uses private hashed
File/Directory cache records with checksum, web IndexedDB Blobs/memory fallback.
Persistent files survive ordinary navigation; actual OS/native behavior not proven.
Source metadata validates before display/reuse, cache hit avoids binary fetch,
30-second max positive lease/15-second foreground validation and known source
revocation invalidate handles before purge. Budgets/pins/global counters and pending
purge stop unbounded writes; composer upload leases remain independent.

One source-anchored MediaViewer has contain/zoom/reset/bounded pan, Close/back/web
Escape and existing safe areas/theme. Parent synchronously blocks viewer during
recording/preparation/picker/stop work, stops hidden starts via existing guards,
preserves local clips/drafts and clears viewed timers for the overlay. No gallery,
external viewer, source export, model work or native permission was used.

## Exact43 integration API

mediaCache.acquire(reference,'video','viewer',signal) returns a handle:
uri,mime,size,sourceVersion,expiresAt,getSnapshot(),subscribe(),revalidate(),release().
revalidate returns false on failed fresh playback authorization. release is
idempotent.43 must PAUSE/DETACH native/browser player before releasing the handle.
Video is not imported/played/installed yet. Extend existing media-viewer.tsx and
parent onOpenMedia entry, don't fork a second modal or bypass this cache.

VoiceComposerHandle exposes synchronous isBusy() and setViewerBlocked(). Preserve
those early guards plus audio-lane and existing layout-before-release safety.
Settings existing consent copy now says Whisper Large V3 Turbo, Luna replies.

## Next

43 owns the already-approved exact Expo Video57.0.5 install and explicit-only
foreground player in the existing modal, no background/PiP including library
activity manifest override. Keep cache interfaces stable; report a real contract
blocker instead of altering41 backend. Then44 validates a frozen integrated preview,
38 reviews combined scope once and33 builds actual verified signed artifacts.

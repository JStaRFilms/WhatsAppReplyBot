# Accepted43 foreground video handoff

## Source acceptance

Parent inspected native/web ownership, lifecycle and source replacement, exact
package/lock delta, disabled-background/PiP plugin output/tests and ownership scope.
No parent code correction was needed. Serialized full suites pass94core/109backend/
203mobile plus29packaging,435 total. All workspace typechecks pass. The prior
parallel FFmpeg timing limitation remains; no production deadlines were loosened.

Exact expo-video57.0.5 is installed. Only its importer/package/peer snapshot entries
were added to root lock; existing pins unchanged. App remains0.1.2/code3 until
parent final freeze. No C:/Otherme-build access/refresh, SDK/toolchain install,
actual media/model/phone/service operation or final artifact was performed.

## Viewer behavior

Use existing source-anchored modal. Explicit Open video requests bounded current
MP4 cache handle and loads paused; only Play revalidates and claims the shared
audio lane. Native uses expo-video private file URI/useCaching false; web uses
Blob URI with builtin video and controls disabled. Own Play/Pause, bounded10-second
seek, elapsed/duration and Close/back. No autoplay/native fullscreen/PiP/background,
lock-screen controls, remote URL, poster/model prefetch, streaming/range/resume,
video sending/AI/ASR or export/share behavior.

Cleanup pauses and null-replaces/detaches source before cache-handle release and
SharedObject disposal. Background/route/profile/source invalidation stops playback
and does not resume. Replace/status/playing/time callbacks and explicit controls
have alive/epoch/source/lease guards. Recording/preparation/picker/stop work blocks
viewer/play synchronously; beginning recording claims the same playback lane.
A stale cleanup cannot stop a newer owner. Legacy video.media.access unsupported
is not a blanket owner-view denial; descriptor is current viewing authority.

## Actual native configuration

Config plugin supportsBackgroundPlayback false/supportsPictureInPicture false.
Existing release plugin forces Android MainActivity and
expo.modules.video.FullscreenPlayerActivity PiP false with merger tools:replace.
Both foreground service permission variants are blocked; active
ExpoVideoPlaybackService/permissions in plugin input reject. In-memory actual
plugin-chain test preserves READ_CONTACTS, blocks WRITE_CONTACTS, keeps no-backup/
HTTP/signing/version constraints and asserts idempotent result. Library fullscreen
is never opened. Real merged/signed manifest verification is still33, not proved
by an in-memory plugin test or app.json alone.

## Validation and remaining gates

43 reported74 focused tests and203 mobile/types/29packaging. Packaging's attempted
exclusion did not skip a synthetic prepare-copy fixture; it ran solely in test
managed temp data, never the approved physical build copy. Parent complete serial
suites/types passed as above. No native codecs/audio-interruption/hardware proof.

44 now gets a frozen integrated source and fresh isolated ui-task44 preview; use
current source interfaces, not39's69f01fd evidence. Exercise cached known draft
before delayed history with stable edit, paging/unread/anchors, source/cache hit/
revocation/profile and photo/video explicit-play lifecycle plus retained pending
send/Drafting/receipts/settings behavior. Only fake APIs/synthetic media. Then38
performs the combined source review;33 stays held on parent version/verifier/input
freeze and artifact permission/privacy/signature verification. Owner physical
checks and coordinated service/app update remain final handoff, not agent actions.

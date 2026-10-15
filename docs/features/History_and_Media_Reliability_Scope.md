# Owner-approved history and media reliability scope

## Authority and timing

After task35's report, the owner said to fix the identified issues entirely. Include
verified LID/phone history and quote resolution, blank/full recovery, and paging
older messages already stored locally. The owner also asked for downloaded pictures
to remain available after leaving/returning and for tappable full-screen picture/
video viewing. This extends the release gate; original69f01fd browser39 remains
useful baseline evidence, not acceptance of the new work.

No live DB repair, private-data inspection, forced WhatsApp history sync, reset,
relink, model/media request, phone action or service control is authorized during
implementation. Keep the same repository/session/signing/build-copy constraints.
The actual cause of the owner's incident is still unproven.

## History outcomes

- Join only verified same-account LID/phone identities. Existing incoming and owner
  replies must be visible together. Resolve quote references across that verified
  identity without inventing embedded quoted messages as genuine history.
- Prefer logical reads over destructive physical record migration. Preserve message,
  request, draft, outbox/component IDs, provenance, timestamps, tombstones, grants,
  holds and unknown accounting. Same-ID duplicates/conflicts need conservative,
  explicit handling. No suffix/country/global identity guesses or weaker socket gates.
- Alias reads/export must not broaden never-reply/excluded/no-AI authority. Preserve
  effective permissions and source expiry even when history has multiple identity
  rows. Existing pending client intent and outbox correlation must not be rebound.
- Recover meaningful full content after a verified bodyless/blank placeholder without
  duplicate records, overriding a deletion/view-once restriction or treating recovery
  as fresh owner activity or historical AI generation/send. Keep actual sources real.
- Add scoped, bounded local keyset paging so stored message101 and earlier can be
  reached. This does not enable full WhatsApp sync or promise unavailable history.
  Preserve scroll position, source-anchored drafts/quotes, Latest and unsent typing.
  Bottom of an old page cannot acknowledge newer unseen messages. New incoming data
  must not replace an older reading position or jump the user unexpectedly.
- Keep the current bounded model context; loading old UI pages does not export a
  whole history to AI. Metadata/cache invalidation must reflect joined-source changes.

## Media outcomes and privacy

Cache media already downloaded through Otherme, not files from original WhatsApp,
private gallery storage or other apps. Reuse verified bytes across navigation and
foreground return rather than re-downloading them. Recheck lightweight source/access
metadata when needed. Do not promise zero network checks or permanent retention.

Use bounded device-private persistent storage with service/profile/account/chat/
message/source-variant identity, deduplicated in-flight reads and explicit resource
ownership. Protect against stale cross-profile callbacks, path traversal, content
revision mismatch and unbounded memory/disk. No tokens, media keys, raw URLs or full
private data in public cache paths/logs. No public static-host cache endpoint.

Known deletion, expiry, view-once, denied source or profile revocation must prevent
rendering/playback and invalidate cached data. Cached bytes are not authorization.
Document revalidation/offline behavior and physical purge timing honestly; an OS or
closed app cannot promise immediate secure erasure. No view-once retention or expired
media resurrection, even if a file remains on disk. Preserve authenticated MAC/hash/
URL/size and source-identity checks. Do not claim app sandboxing is encryption.

Tapping a valid picture opens a source-anchored full-screen viewer with close/back,
readable safe-area controls and appropriate fit/zoom using existing supported UI.
Viewer state is scoped; it must not hide a continuing microphone recording or carry
media into another account. Keep draft/pending-send state intact.

Ordinary video viewing/playback is requested, not video sending, video-to-AI
understanding or background playback. Prefer bounded authenticated local download
and playback over a new streaming/range/resume service. Enforce explicit supported
format/size limits and honest unsupported states. Stop/pause on background, scope/
route change, expiry/deletion and close; coordinate the existing audio lane. No
hidden autoplay, picture-in-picture or background service behavior.

Installed Expo57 nominates expo-video ~57.0.5; it is not installed. Existing
expo-image/file-system/Reanimated are available; gesture-handler is not a direct
mobile dependency. Architecture must verify actual public APIs and exact video
version/permissions before proposing an install. Prior authorization covered Expo
Contacts only. Any necessary Expo Video install requires separate exact-target
approval, no toolchain upgrade or silent second dependency.

## Later cached-first opening requirement

Owner added Cached_Chat_and_Draft_Opening.md while40 was running. It is part of42
and44 acceptance: known chat/draft bodies paint before background source reads,
without losing edits or weakening source/scope/server revision checks. Reuse
bounded session caches, no persistent full-history mirror or model warming.
Parent accepted40 with these corrections: verified derived LID unknown-kind is not
a permanent AI veto after explicit canonical Resume; explicit privacy/hold/unknown
restrictions remain. Old-mapping read upgrade preserves existing manual work.
Full-image variant uses bounded JPEG85 rather than oversized PNG. No source is
implemented yet by these planning changes.

## Planning, ownership and release

40 authors the bounded implementation/data/API/cache policy plan and41+ packets,
with one core/backend writer and one mobile writer after finalized contracts.
Prefer existing utilities and minimal schema/API additions, not a generic new data
or streaming framework. Do not include contact insights/cost logs, full Batch2,
ordinary message-edit parity, schedules, cloud hosting or a new visual language.

Synthetic checks must cover alias/quote/ACL/source preservation, partial recovery,
pagination/unread/scroll, cache hit without binary refetch, stale source/expiry/
delete/profile invalidation, viewer lifecycle and bounded video handling. Existing
send/draft/receipt/name/prompt safety remains. Revalidate integrated browser UI and
one focused source review38 before33 artifacts. Real phone/media/mic/keyboard/
receipt behavior remains owner acceptance, not mock or web proof.

## Proposed implementation handoff40

[History_and_Media_Implementation_Plan.md](History_and_Media_Implementation_Plan.md)
is the executable proposal, not implemented behavior. Pending41 owns verified
logical reads/recovery/paging and owner-display source/content contracts.42 owns
mobile paging, exact-visible unread, private cache and full-screen photos.43 is a
serial video continuation after42 and separate exact Expo Video approval.44
validates the integrated browser candidate. No task was launched by40.

The plan keeps physical record/request/outbox IDs and restrictive alias policy,
uses fenced keyset pages plus source epochs, and separates owner bytes from AI
frames. Private download storage is capped at100MiB/200 entries across namespaces,
with current-source leases, expiry/purge and honest offline/OS limits. Proposed
expo-video57.0.5 public APIs/package integrity were checked without installation.
Its library fullscreen activity declares PiP independently of the app plugin, so
43 includes a narrow manifest override and33 must verify the merged artifact.

Acceptance of40 and completion of39's frozen-source export both precede any new
product writer. Existing38 receives the plan's combined review supplement and
41..44 evidence; its original packet/status are unchanged.33 remains held. Parent
records execution IDs, decisions and commits. All prior authored future context/
style and pending-send/draft/receipt/name/prompt handoffs remain in force.

# Photo visibility after history reflow

## Confirmed blocker

Task 44 round 1 is partial and not accepted. It tested frozen source `4f2b428`.
The synthetic evidence is in `.runtime/ui-task44/handoff.md`, `results.json` and
`photo-preview-blocker.png`. Several required browser cases remain untested.
Nothing in this run authorizes release or acceptance by review 38.

The parent reproduced the failure with a diagnostic added only to
`.runtime/ui-task44/parent-photo-diagnostic.cjs`. After paging and Latest, the photo
turn was at viewport y 134, height 245. The history viewport also began at y 134,
with scrollTop 4496. The app still recorded the photo's content position as 2087.
Its scroll state correctly recorded offset 4496 and viewport height 609.

After another two seconds, there were still zero Open image controls. Preview
metadata and valid PNG bytes had been requested. This is not a missing mock,
invalid image, permission failure or a short test wait. All data was invented.
The diagnostic deliberately stops after this measurement and closes its browser.

## Shared cause and boundaries

History uses the same row coordinates for visible media and inbound viewed IDs.
It relies on per-row `onLayout` events. In RN web, a keyed row can move after
prepend or replacement without another notification when its size is unchanged.
The saved coordinates then describe the previous page layout.

Do not fix this by loading all mounted media or marking all mounted messages seen.
Native behavior also needs preservation. This browser result does not establish
that native layout events behave identically or explain an owner's real incident.

## Correction 47

Measure the actual bounded current rows after content or viewport reflow. Use
supported native and web refs with current chat, client, page and scroll guards.
Prefer measured viewport-relative coordinates plus current scroll offset over a
guessed prepend-height delta. Avoid a DOM-only framework or controller remount.

Cancel viewed work and suspend stale visibility while a measurement is pending.
Accept only a coherent current batch. Old callbacks cannot publish into another
route, profile, page or scroll position. Preserve source ID and offset anchors,
existing draft editor and input identity, keyboard intent and truthful Latest.
Keep cache authority, source expiry, deletion, view-once rules, leases and caps.

A regression must fail before the correction when an unchanged-size keyed row
moves from content y 2087 to 4496 without a new per-row layout event. It must pass
afterward and reject stale measurements. Check media visibility and actual visible
inbound IDs, then run the existing mobile tests and typechecks.

## Source correction accepted

The parent accepted correction `eb8a242009af59230c50108529f960db5c549196` after
inspecting the diff and rerunning checks. Stable turn and source refs use supported
RN `measureInWindow` methods relative to the measured scroll viewport. A coherent
batch refreshes source navigation coordinates and visible rows. Pending geometry
suspends visibility and viewed acknowledgment. Current page, client, offset and
layout checks reject old callbacks; retries are bounded.

The parent independently loaded the previous hook from Git into the new regression
without changing working source. It failed with `old-coordinate` instead of `photo`.
The corrected full serialized suites passed 94 core, 109 backend and 208 mobile
tests. Packaging passed 29 tests. All three workspace typechecks and diff checks
passed. Total source and packaging acceptance is 440 tests.

The fixture changes make `HistoryCache.get` snapshots stable, as production and
`useSyncExternalStore` require. They do not relax assertions or production rules.
No dependency, cache, backend, native setting or version changed.

This accepts source correction 47, not browser task 44. Round 2 must export this
new candidate and finish every remaining browser case. The existing combined
review 38 and artifact task 33 stay held. Native acceptance remains separate.

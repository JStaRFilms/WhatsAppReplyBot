# Photo visibility after history reflow

## Confirmed blocker and evidence

44 r1 on frozen4f2b428 is partial and NOT accepted. See synthetic
.runtime/ui-task44/handoff.md/results.json/photo-preview-blocker.png. Known draft
paint/edit, some paging/exact-ID, video and geometry cases ran, but many required
cases remain uncovered. No release or38 launch is authorized by that partial pass.

Parent independently reran the isolated harness with a diagnostic added only to
.runtime/ui-task44/parent-photo-diagnostic.cjs. After paging then Latest, the visible
photo turn was at viewport y134 with height245. History viewport also began y134
and scrollTop4496. React's actual hook maps still recorded turn/source y2087. The
scroll state correctly had offset4496/height609. After another2seconds there were
still zero Open image controls. This is not a missing mock, invalid PNG, permission
or simple400ms wait issue. All data is invented and no real API/media was used.

History derives both visible-media gating and inbound viewed IDs from stored row
coordinates. It relies on onLayout for position updates; RN-web can move an
unchanged-size keyed row after prepend/replacement without another per-row size
notification. Keeping old positions causes wrong visibility. Do not fix by loading
all media or treating all mounted rows as seen. Native behavior needs preservation,
not an unverified claim that its layout events are identical.

## Required correction47

Refresh actual bounded current-row geometry after page content/reflow/viewport
changes, with stable native/web refs and current source/chat/client/read-generation
and scroll-offset guards. Prefer supported RN measurement relative to the actual
viewport plus current content offset, not a guessed prepend-height delta. No new
DOM-only data framework, route/controller remount or arbitrary whole-history scan.

Mark geometry pending and cancel viewed work until a current coherent measurement
batch is accepted. Stale callbacks cannot publish into another route/profile or
measure a different page. Preserve ID/offset anchors, existing typed text/draft
editor identity/focus and truthful Latest. Only actual currently visible rows can
acquire media; only actual inbound visible rows may be acknowledged after delay.
No relaxation of cached-file authority, expiry/delete/view-once, leases or caps.

Use focused failing-before/passing-after tests with keyed rows moving without
individual layout events, plus stale measurement/profile/scroll/page race and
actual unread/media visibility assertions. Then existing mobile tests/types.
No backend/cache API/schema/config/dependency/version changes, live/device actions
or generic review.47 is a targeted implementation correction;44 r2 must re-export
new source and complete the remaining checks, then existing38 reviews combined
source once. No accepted browser counts may be invented from the partial run.

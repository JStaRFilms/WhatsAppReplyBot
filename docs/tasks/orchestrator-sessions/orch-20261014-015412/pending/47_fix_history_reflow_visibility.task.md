# Task47: Refresh real row geometry after history reflow

## Setup and authority

Takomi coder, Sol High, Build, requiredCapabilities=[write-code]. Canonical root
C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot.
All commands explicitly cd there, use unslop and scoped engineering rules. Read
Photo_Visibility_After_History_Reflow.md, Cached_History_and_Photo_Handoff.md,
Foreground_Video_Handoff.md, completed42/43,44 r1 synthetic handoff and actual
conversation-scroll/conversation code/tests. Parent owns tracking/docs/commits.

44 r1 is terminal partial/blocked, no other source writer. Product baseline4f2b428
had435 serialized-suite/packaging tests/all types passing, but browser revealed
this concrete integration defect. Owner explicitly directs full-round completion
and confirmed scoped fixes, no routine approval question.

## Objective and source scope

Fix stale keyed-row visibility coordinates after paging/prepend/tail replacement/
layout changes. Native/web must use coherent actual measurements, not rely only
on unchanged-size rows firing onLayout again. Keep actual visible unread/media,
source anchors, stable editor/input identity, viewport and privacy boundaries.

Exclusive ownership: apps/mobile/lib/conversation-scroll.ts,
app/conversation/[id].tsx, focused test/keyboard-scroll.test.cjs,
history-paging.test.cjs and/or one focused visibility regression test. A minimal
fixture adjustment for those tests is allowed. No backend/cache/viewer/API/config/
package/lock/native/version/docs/status/board/master writes or other refactoring.
Do not bypass visibility flags in MediaAttachment or download all mounted media.

## Evidence and implementation constraints

Parent diagnostic on synthetic m156: viewport photo y134/height245, scrollviewport
y134, scrollTop4496, yet turns/sourceMaps y2087 and hook position offset4496.
Open image count0 even2seconds later. It previously requested valid preview bytes.
ReactNativeWeb resize-driven row events miss position-only movement on a prepend/
replacement. See ignored parent-photo-diagnostic.cjs, no private runtime reads.

Use bounded supported RN refs/measurement relative to current viewport/content
position, e.g. measureInWindow child minus scrollviewport plus captured offset
with race guards, if actual installed types support it. Choose minimal correct
approach, not a forced wrapper/style redesign or approximate total-height shift.
Rows are bounded300/window. Coalesce after-layout work. Mark measurement pending,
clear/suspend stale visible IDs and cancel acknowledgment until a coherent current
batch completes. No old offset/page/client callback may publish. Layout races,
scroll while measuring, missing ref/unmount and source/page epoch changes must
fail safe/retry a bounded current read, not permanent invisibility or busy loops.
Keep source/draft layout anchors and explicit Latest, composer focus/manual keyboard
intent, photo/video/recording guards and current cache leases/caps unchanged.

## Completion criteria and tests

Add regression that fails before fix: keyed row source y2087 moves to actual4496
without height/onLayout change. Actual viewport at4496 must make that row visible
and unrelated old-coordinate rows invisible. Before consistent measurement, no
viewed acknowledgment. Cover old callback after page/scroll/profile change, page
prepend/tail replacement/resize and preserved anchor/editor. Reuse render/lifecycle
fixtures rather than introduce a framework. Existing mobile paging/media/viewer/
video/pending/keyboard tests remain. Run focused first, all mobile tests/types.
Do not edit valid tests to excuse a regression or increase production deadlines.

Return exact implementation/changed paths, failing-before and passing-after checks,
command counts and remaining limitations. Parent reruns/commits then44 r2 exports
new candidate and finishes required browser checks. No extra generic review or
agent launches. Native/hardware proof remains owner-owned. Do not stage/commit/push.

## Safety

No actual runtime/.env/DB/auth/token/key/contact/message/media/log/billing reads,
paid/model/WA/API/media requests, real recorder/gallery/permissions/phone/service/
viewer operations, production3210/8081/8083, installs/SDK/toolchain/weights, outside
writes or final web/APK builds. Read only documented synthetic ui31/ui37/ui44 and
public source, test-managed fake/temp data. Do not overwrite44 results/screenshots
or run its entire browser harness; parent/next44 handles controlled re-export.

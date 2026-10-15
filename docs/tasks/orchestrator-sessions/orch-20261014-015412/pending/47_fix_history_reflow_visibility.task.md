# Task 47: Refresh real row geometry after history reflow

## Agent setup

Takomi Coder, Sol High, Build. Required capability is `write-code`.
Canonical root is
`C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`.
Every command must explicitly use that root. Read its coding guidelines and use
unslop. The parent owns documentation, tracking, commits and release metadata.

Read these before implementation:
- `docs/issues/Photo_Visibility_After_History_Reflow.md`
- `docs/features/Cached_History_and_Photo_Handoff.md`
- `docs/features/Foreground_Video_Handoff.md`
- Completed packets 42 and 43, and the partial synthetic 44 handoff.
- The actual scroll hook, conversation screen, relevant tests and installed RN types.

The owner directs completion of the whole approved round and scoped corrections.
No routine approval question is needed. Round 1 of 44 is terminal and partial.
There is no competing source writer. Product baseline `4f2b428` passed 435 serialized
source and packaging tests and all types, but those checks missed this UI defect.

## Objective

Fix stale keyed-row coordinates after history prepend, page replacement and layout
changes. Keep actual visible media and unread detection, source anchors, stable
editor identity and privacy rules. This must work through native and web APIs.

## Source scope

Exclusive ownership is limited to:
- `apps/mobile/lib/conversation-scroll.ts`
- `apps/mobile/app/conversation/[id].tsx`
- Focused files under `apps/mobile/test/`, including a new regression if useful.

A minimal test fixture adjustment is allowed. Do not change the backend, cache,
viewer, API, configuration, dependencies, lockfile, native settings or version.
Do not write docs, board state or Git metadata. No stage, commit, push or agents.
Do not bypass `MediaAttachment` visibility or download all mounted media.

## Evidence and implementation constraints

Parent's independent synthetic repro measured photo m156 at viewport y 134 with
height 245. The viewport also began at 134, with scrollTop 4496. The app's turn and
source maps still recorded y 2087. Open image count stayed zero after two seconds.
Valid preview bytes had been requested. RN web can miss position-only movement
when keyed rows keep the same dimensions. Confirm the mechanism in current code.

Use supported refs and bounded actual measurements. For example, child and scroll
viewport `measureInWindow` coordinates plus a captured current offset may avoid a
new wrapper, if the installed types support it. Choose the smallest correct
approach. Do not force that API if its real contract differs. No guessed height
shift, DOM-only framework, controller remount or unlimited history scan.

Coalesce after-layout reads. Mark geometry pending, suspend stale visible IDs and
cancel acknowledgment until a coherent current batch completes. Guard page,
client, route, profile and scroll changes. Missing refs or old callbacks must not
publish wrong coordinates or leave a permanent invisible state. No busy loops.

Rows are bounded by the existing 300-message window. Preserve source and draft
anchors, explicit Latest, accepted-send jump, composer and draft editor identity,
focus and manual keyboard intent. Keep current media leases, caps, privacy,
recording and playback ownership unchanged. This shared calculation controls both
media acquisition and the delayed inbound viewed-ID request.

## Definition of done and verification

Add a regression that fails before the fix. An unchanged-size keyed row moves
from content y 2087 to actual y 4496 without another per-row layout event. With
viewport offset 4496, that row must be visible and old-coordinate rows must not.
No viewed request may use an incomplete measurement batch.

Cover stale callback rejection after page, scroll or scope changes. Exercise page
prepend and replacement, resize and preserved anchor or editor behavior. Reuse the
existing render and lifecycle fixtures. Do not add a testing framework or weaken
valid assertions and deadlines.

Run focused regressions first, then all mobile tests and typechecks. Parent handles
browser re-export and full serialized integration. Do not overwrite 44 evidence or
run its whole browser script. Return changed paths, exact commands and results,
failing-before evidence and remaining limitations. Do not claim hardware proof.

## Execution

Running Takomi Sol High as sole source writer after terminal partial 44 round 1.
T3 task ID is
`node:delegated-task:command%3Amcp%3A1c6c025d-2faf-4900-bd5c-76e24d154f69%3Adelegate-task%3Aotherme-history-geometry-fix-20261015-r1`.
Client request ID is `otherme-history-geometry-fix-20261015-r1`.
No browser worker, final review or release build is active. After parent acceptance,
44 round 2 exports the corrected source and finishes the required browser cases.
The existing combined review 38 and signed artifact task 33 follow.

## Safety

No real runtime, environment, database, auth, token, signing, contact, message,
media, log or billing reads. No paid calls, live API, model, WhatsApp or account
operations. No real recording, gallery, permissions, phone, service or OS viewer
operations. No production ports 3210, 8081 or 8083. No dependency, SDK, toolchain,
license or model-weight downloads. No outside writes or final builds.

Use public source and test-managed fakes or temporary files. Only documented
synthetic ui-task31, ui-task37 and ui-task44 may be read under runtime. Do not
change their results. Explicit Node is required for tests, since a sandbox's own
process executable may be Bun. No backend decoder suites are needed here.

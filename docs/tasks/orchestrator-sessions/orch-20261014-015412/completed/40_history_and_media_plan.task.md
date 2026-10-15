# Task40: Plan verified history repair and cached media viewing

## Agent setup

Persona architect, Sol High, docs-only Build planning. requiredCapabilities=[write-docs].
Canonical root C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot.
Every shell command explicitly cd there. Use unslop and scoped repo instructions.
Read History_and_Media_Reliability_Scope.md, issues/Incoming_Message_Gaps_Investigation,
Project_Requirements, current feature/contract docs, completed35/36 and pending37–39.
Inspect actual source/types/tests before designing interfaces or API changes.

## Objective and scope

Author the minimum executable plan for three owner-approved history fixes plus
Otherme-private media reuse and full-screen image/video viewing. Source69f01fd is
frozen for browser39. No product-code writer may start until this plan is accepted
and that export has finished. No code changes or installation in this task.

Trace exact alias/store/raw-message/quote/permission/model/context/history cursor
paths. Prefer source-preserving logical reads; do not rename/copy/delete records,
reset grants, weaken never-reply or rebind pending request/outbox identities. Map
partial recovery without tombstone/view-once resurrection or historical send.
Design bounded older-page/cache and viewport behavior with true newest-visible
unread, source suggestions and no surprise jump on incoming updates.

Inspect MediaAttachment, ApiClient.media, backend media/whatsapp-media and source
checks. Current client gets data URIs per request, cachePolicy none, no click viewer;
server previews are bounded PNG/GIF while ordinary video is unsupported. Separate
owner display from AI visual sampling. Plan private persistent byte reuse with
lightweight current-source validation and bounded disk/memory, no token URL or
cross-account cache. Define fingerprints, source variants, expiry/delete handling,
cache leases, failure/offline behavior and actual purge limits. No full book or
model context data in logs, and no automatic gallery/WhatsApp storage access.

Use existing UI for a safe full-screen photo viewer. Ordinary video display/explicit
playback only, no video sending/AI/background/PiP. Expo SDK manifest nominates
expo-video ~57.0.5, not installed. Verify exact public package/API/config if needed,
report its target/permission implications, but do not install or add another module.
Owner consent for Contacts does not silently authorize Video. Parent handles a
specific dependency decision before that install; other work must remain separable.

## Definition of done

Plan states concrete source/client/server components, minimum schema/DTO/API and
compatibility changes, effective alias permissions, stable identifiers, paging/
scroll/unread behavior, cache/revalidation policy and bounded foreground viewer/
playback lifecycle. New41+ packets have exact file ownership, dependencies, tests,
completion criteria and handoffs. Use existing38 for the eventual combined review,
not a separate generic review loop.33 remains held on all new integration/review.

## Expected artifacts

Write docs/features/History_and_Media_Implementation_Plan.md and meaningful pending
implementation packets41 onward. Update the scope/technical feature docs as needed,
with clear proposed versus implemented status. Do not edit master_plan, board,
existing packet status, product source/packages/config/lock/version or root docs
outside allowed feature/requirements updates. Parent records IDs and commits.

## Constraints and verification

No real DB/auth/.env/token/key/book/message/log/media reads, live APIs, real
WhatsApp download/sync, paid models, SDK/toolchain/dependency installs, device/
viewer/service control, outside-project writes or final web/APK build. Read only
public source and documented synthetic ui-task31/ui-task37 artifacts if useful.
Normal synthetic test temp data allowed, no production3210/8081/8083. Do not
launch agents or stage/commit/push. Preserve all prior authored context/style
handoffs and current pending-send/draft/receipt/name/prompt constraints.

## Dependencies and execution

Owner explicitly approved fixing the identified issues in full and requested
cached/tappable picture/video viewing. Current browser39 validates unchanged69f01fd
in parallel; its source/preview must not be altered. This task is docs-only. Exact
delegation completed docs-only on Takomi Sol High.
T3 task ID: node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-history-media-plan-20261015-r1.
Client request ID: otherme-history-media-plan-20261015-r1.
No implementation, installation or live action has begun.

## Later owner addendum, recorded after launch

Read docs/features/Cached_Chat_and_Draft_Opening.md before final acceptance and
implementation42. Owner requires cached-first opening of known chats and existing
draft bodies with background refresh, preserved edits and multi-client revision
safety. Parent recorded this while40 was running; its initial prompt did not carry
this later request. Parent folded it into the accepted plan and42/44 in30f4f15 before launching41.
Parent also corrected permanent derived-unknown LID veto, preserved manual work
on old-mapping read upgrade and chose bounded JPEG85 full photos.39 independently
passed36 checks/18 screenshots after a harness-only race correction.40's original
checks were26 local links/eight-file packet whitespace/git diff check, not new
implementation tests.41 launched after all planning and39 export gates completed.
43 still requires exact Video approval;38/33 remain held on new source.

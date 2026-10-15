# Task44: Validate integrated history and media browser behavior

## Agent setup and status

Persona worker, Takomi Luna High, Build validation. requiredCapabilities=[write-code] only for ignored synthetic harness/artifacts, product source read-only. Pending authored packet, no launch or execution ID assigned. Canonical root is `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`. Every command explicitly cd there or use absolute project paths. Use unslop/scoped instructions. Parent owns task records/status, source fixes, commits and release. No agent launches.

Read docs/Coding_Guidelines.md, History_and_Media_Reliability_Scope, History_and_Media_Implementation_Plan, original37/38/39 and accepted41/42/43 handoffs/source/types/tests. Read only documented synthetic ui-task31/ui-task37 harnesses if useful. Do not treat39's unchanged69f01fd results as coverage of this new source.

## Objective and dependencies

Provide a reproducible isolated preview and focused browser geometry/interaction evidence for paged history, exact visible unread, private cache reuse, source invalidation and full-screen image/video display. This is validation, not a new source-review loop. Existing38 performs the eventual combined source review.

Parent supplies frozen integrated commit after41/42 and approved43. No active product writer while export/checks run. If43 is still gated, parent may request a clearly labeled partial41/42 check, but it cannot satisfy complete video acceptance or release33. Source changes after this export require parent to decide which evidence is stale.

## Exclusive artifact ownership

Write only ignored `.runtime/ui-task44/verify.cjs`, preview assets under `.runtime/ui-task44/web/`, structured results and a few representative screenshots in that same subtree. Do not edit product/test source, packages/config/lock/version, docs/master/board/status or prior ui-task31/ui-task37/browser39 output. Read public source only outside those documented synthetic directories. No final apps/mobile/dist or Android export.

Reuse installed Node/pnpm/Playwright and headless Edge. Use the existing credential-isolating mobile-node wrapper and public EXPO_PUBLIC_DESKTOP=1 for preview export. No browser/toolchain/dependency install. Serve synthetic preview via listen(0) loopback, not3210/8081/8083. Fresh browser storage and invented service/profile/account/transport IDs/token only. Intercept all APIs, block outside origins and fail any unexpected call. Never fall through to a real backend, media host or model.

## Required checks

- At least151 synthetic messages with equal timestamp ties and multiple pages. Load older/newer, hold responses, then inject a newest incoming/version update while reading old content. Measure first visible row/offset through prepend, eviction, image height and resize. No jump or lost composer/input identity. Latest explicitly loads current tail; old-window bottom leaves newest unread.
- Record viewed-messages request IDs. Only actually visible inbound rows after settled focused/foreground delay are acknowledged, never all mounted rows or background/viewer-covered newest content. No WhatsApp read endpoint. Draft View and quote-source navigation fetch a bounded around page and locate the real source/card; missing source is honest.
- Synthetic verified phone/LID group shows incoming and owner reply once while retaining original IDs. Retired-alias navigation is read-only and does not rebind pending intent/draft. Unknown/member holds and restrictive policy remain visible. UI cannot claim backend merge safety from browser fixtures;41's source tests own it.
- Load one preview/image, leave/reopen and foreground. Source metadata revalidates while binary fetch count stays unchanged. Reload with synthetic IndexedDB entry, then repeat. Source-version change fetches only current bytes. Simulate deletion/expiry/view-once/denial/profile/service namespace change and offline validation failure, including delayed stale completion. No stale image/player or cross-account object URL remains in view.
- Open picture by tap, inspect contain fit, safe Close/back/Escape, accessible zoom/reset and return anchor. Compose newer text/quote with a pending send and slow refresh, close viewer and confirm it survives. Stub recorder busy/preparation and prove viewer cannot hide it. No real mic/contacts/camera/gallery access.
- Open synthetic MP4 from local fixture bytes or an in-page generated Blob, paused until explicit Play. Close/background/source invalidation stops playback and detaches source. Reopen uses cached bytes with validation and no autoplay. Audio-lane transition and unsupported video feedback stay honest. Browser native codec support is not Android proof. Do not use real media, external fixtures, installed OS viewer or video AI/send requests.
- Retain representative37 checks for pending send/Drafting/View, accepted versus receipt evidence, no replay after reload, latest local text preservation and read-error recovery. Do not rerun a huge redundant matrix. Check320/360/390 and1280 widths, selected dark/light and large-text states with no body overflow, clipped controls, duplicate provider/conversation or page errors.

Also read docs/features/Cached_Chat_and_Draft_Opening.md. With history held, open a
specific draft whose full body is already in snapshot. Verify genuinely visible,
usable body before the read resolves, not opacity-zero DOM presence. Edit it, then
release source/page data and prove same editor/local text remains without duplicate
card or focus/scroll reset. Warm cached chat stays painted through refresh; failed
source read retains body with honest context status. Mock two-client revision and
late older reads without erasing current local edits/newer validated data. Record
one delayed-history screenshot. No model/mutation warming or cached send authority.

## Completion criteria and handoff

Export and focused deterministic checks pass, or return exact confirmed blockers without editing product source or weakening valid assertions. Write structured counts, API/binary/validation-call evidence, geometry and selected screenshots. Close temporary browser/server in finally; no watchers remain. Report exact source commit, commands, actual results and browser codec/native limits. Do not claim real WhatsApp recovery, secure erase, Android mic/keyboard/audio/codec or actual merged-manifest success.

Parent supplies this report plus41..43 tests/contracts,39 baseline evidence and original38 packet/findings/responses to existing38. No generic review45.33 remains held on integrated source review, parent workspace tests/types/packaging, dependency approval and final build-copy targets. Parent records IDs/outcomes and commits; no task status edits here.

## Execution

Round1 returned PARTIAL/BLOCKED, not accepted. It ran Takomi Luna High preview-only
on product
4f2b42880ad5a62f93846f956e85266e22cd10f8. Parent435 serialized-suite/packaging tests
and all workspace types pass, no active product writer. Doc-only HEAD changes are
not source drift. Read Foreground_Video_Handoff.md and current41/42/46 handoffs.
T3 task ID node:delegated-task:command%3Amcp%3A1c6c025d-2faf-4900-bd5c-76e24d154f69%3Adelegate-task%3Aotherme-integrated-history-media-browser-20261015-r1.
Client request ID otherme-integrated-history-media-browser-20261015-r1.
Only ignored ui-task44 writes, fresh invented API/session/media, no paid/live/phone
or source change. R1 covered18 named partial checks/92 mocked APIs/zero unexpected
calls/page/console errors,59 focused source tests, but failed photo opening and
left several required cases untested. No full44 acceptance count.
Parent independent diagnostic confirmed source layout maps2087 versus actual4496
content position for the visible photo.47 now fixes the bounded shared geometry;
R1 freeze ends only for that confirmed correction. See `docs/issues/Photo_Visibility_After_History_Reflow.md`.38/33 stay held. After47 acceptance, delegate a fresh44 r2 with
original brief, R1 findings, actual47 response and all remaining coverage; new
clientRequestId/taskId, never send to old childThread. No r2 launched yet.

## Safety limits

No real DB/auth/.env/token/key/book/message/log/media/runtime reads, live API/model/WhatsApp/profile/download/history actions, original gallery/private-phone storage, paid/image quota, device/service/OS viewer control, production3210/8081/8083, installation/SDK/toolchain work, outside-project writes, final desktop/APK build or stage/commit/push. Only the explicitly documented synthetic directories and normal synthetic test temp data are permitted. No source fixes or other agent launches.

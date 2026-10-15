# Task44: Validate integrated history and media browser behavior

## Agent setup and status

Persona worker, Takomi Sol High for round 2, Build validation. Required capability is write-code only for ignored synthetic artifacts. Product source is read-only. Round 1 was Luna High and partial. The follow-up uses Sol High for the remaining stateful browser cases. Canonical root is `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`. Every command explicitly cd there or use absolute project paths. Use unslop/scoped instructions. Parent owns task records/status, source fixes, commits and release. No agent launches.

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
R1 freeze ends only for that confirmed correction. See `docs/issues/Photo_Visibility_After_History_Reflow.md`.38/33 stay held. Correction 47 is accepted as `eb8a242009af59230c50108529f960db5c549196`.
Parent independently confirmed the old-hook regression failure and passed all
440 source/packaging tests and workspace types. Round 2 uses a fresh delegated
task with this original brief, R1 findings, the actual 47 response and every
remaining case. Do not send to the previous child thread.

## Round 2 instructions

Running Takomi Sol High on frozen product
`eb8a242009af59230c50108529f960db5c549196`. No source writer.
Round 2 T3 task ID is
`node:delegated-task:command%3Amcp%3A1c6c025d-2faf-4900-bd5c-76e24d154f69%3Adelegate-task%3Aotherme-integrated-history-media-browser-20261015-r2`.
Client request ID is `otherme-integrated-history-media-browser-20261015-r2`.
Use `.runtime/ui-task44/r2/` for the harness, export, results and handoff. Preserve
all round 1 and parent diagnostic artifacts. Export from apps/mobile with
`EXPO_PUBLIC_DESKTOP=1 node ../../scripts/mobile-node.cjs node_modules/expo/bin/cli export --platform web --output-dir ../../.runtime/ui-task44/r2/web --max-workers 2`.
Adjust harness module paths from the actual r2 directory, not guessed old paths.

Do not stop after the photo retry. Map every required bullet above to concrete
assertions and evidence, or report the exact remaining blocker. Partial counts do
not accept 44. Assert actual viewport-intersecting source rows at viewed POST time,
not merely that posted IDs are inbound or fewer than mounted rows. At least one
photo must move without a per-row size change after paging. Check real rectangles
and offset deltas, retained editor/input nodes, held source registration and current
geometry after prepend/replacement/resize. No new acknowledgment from old geometry,
old-window bottom, viewer or background. Keep unseen newest unread.

Complete omitted R1 cases: quote and Draft View bounded around-source navigation,
missing source, verified alias UI and retired-alias read-only behavior, held refresh
with injected newest data and anchor measurement, pending send plus newer text and
quote, receipt truth and reload no-replay, two-client revision and late read safety,
photo reopen/foreground/reload byte reuse, current-version-only bytes, image denial,
deletion, expiry, view-once, offline lease, namespace/profile change and stale delayed
completion. Exercise video close/background/invalidation and audio ownership.
A busy/preparing recorder can be stubbed through the synthetic public handle. Do
not call any real microphone, camera, gallery or contacts API. Do not claim these
stubs establish native recording behavior. Keep genuine unsupported codec results.

Use route-handler registration promises before releasing held requests. A request
event alone is not proof the resolver exists. Wait for meaningful readiness, not
an arbitrary short count. Do not weaken a valid assertion to avoid a product bug.
Return reproducible commands, exact candidate/export input hashes, named coverage,
API and byte/metadata counts, geometry, selected screenshots, errors and limits.
All networks stay intercepted and outside origins blocked. Close owned browser
and ephemeral server in finally. No background watchers, paid/live calls, final
build or source changes. 38 and 33 remain held until parent acceptance.

## Round 2 outcome and correction hold

Round 2 is terminal partial and not accepted. Its original handoff and evidence
summary report 69 primary passing checks, seven supplemental checks and five
blocked scenarios on eb8a242. There were no unexpected network or browser errors.
Four normal-use failures require correction: warm reopening used off-screen viewed
IDs and hid the photo; source arrival moved the cached editor out of view; clean
responsive resize lost the source offset; foreground photo recovery needed Retry.
The separate forced CSS-height stress is diagnostic, not itself a release blocker.

The parent independently reproduced all four. See
`docs/issues/History_and_Foreground_Reopen_Blockers.md` and packet 48. Correction 48
is now the sole source writer, so the r2 freeze no longer applies to current work.
After parent source acceptance, fresh r3 must rerun affected and unfinished cases,
including the photo plus pending-send/newer-text/quote combination. No r3 is launched.
38 and 33 remain held. Do not confuse source-only 440 tests with browser acceptance.

Evidence integrity note: the parent's first two reproductions accidentally replaced
r2/results.json and same-named case screenshots. The original full raw bytes are
lost. Original handoff, browser.log, evidence-summary.json, supplements and old hash
manifest remain. Current results.json is not the original 69-check result and does
not match its old hash. Further reproductions have separate output paths. New
acceptance requires a fresh complete result and hashes, not a relabeled old file.

## Round 3 brief

Running Takomi Sol High on new frozen product
`35cba0ce1a0ecda1af056d8f872feed87ea94f9b`, correction 48 accepted. No source writer.
T3 task ID is
`node:delegated-task:command%3Amcp%3A73c03ce5-b336-44e9-b7ac-b1c24f448a93%3Adelegate-task%3Aotherme-integrated-history-media-browser-20261015-r3`.
Client request ID is `otherme-integrated-history-media-browser-20261015-r3`. All 449 serialized workspace and packaging tests and
workspace types passed. Parent independently reran the four corrected browser cases,
27 checks passed with no failures or unexpected calls/errors. Details and actual
causes are in `docs/issues/History_and_Foreground_Reopen_Blockers.md` and completed48.
These isolated cases do not replace this full integrated acceptance.

Use Takomi Sol High and only `.runtime/ui-task44/r3/` for a fresh full preview,
harnesses, results, screenshots and input hashes. Preserve every r1/r2/fix48 artifact.
Export from apps/mobile using the credential-isolating wrapper to
`../../.runtime/ui-task44/r3/web`, desktop mode and max-workers2. Do not assume the
fix48 partial source manifest covers every full export input. Collect current public
input and export hashes, runner and evidence hashes after the full pass. Never rerun
into the same output directory without retaining its prior result and attribution.

Carry forward this entire original required-case contract. Reuse the strong r2
fixture and fix48 assertions, not their stale bundles. Keep actual source rectangles
captured synchronously at fetch for every viewed POST. Do not weaken the set
assertion, deadlines, editor3px or anchor3px checks. Verify warm reopen without
corrective scroll and three foreground recoveries without Retry or a new image
binary. Keep pending measurement, background and viewer cancellation covered.

Complete the previously unaccepted combination of photo viewer with a pending
immutable send, newer local text and quote, slow refresh, then close and prove node,
text, quote and anchor survive. Retain ordinary paging/eviction/newest-injection,
Draft/quote around-source, cache concurrency/error/CAS, retired alias no-rebind,
persistent reuse, source/version/namespace/privacy/stale-completion and video/audio
ownership cases. Run the all-variant source-state, visibility-cancellation and valid
unsupported-codec supplements on this same fresh export. Do not borrow their old
counts. Native and backend merge correctness remain separate proof.

The forced CSS-height stress is a diagnostic, not normal component behavior. Keep
it in an isolated explicitly diagnostic case, separate from accepted counts and
normal history flow. It must not abort remaining ordinary checks or contaminate
the following resize state. Preserve its result honestly; a failure there alone
is not a release blocker without a normal-use reproduction. Actual preview arrival
has a fixed box and must retain its real source offset. Clean responsive checks
must use unmodified component styles. This does not permit relaxing actual UI bugs.

Return one fresh coherent full result, all required cases mapped to assertions,
API/bytes/metadata/actual viewed-ID counts, representative screenshots, source and
export hashes and limitations. Report any confirmed normal-use blocker without
product writes or another generic review. Parent accepts 44 then launches the one
combined 38, final metadata and 33. No review or final build is launched yet.

## Round 3 outcome

Terminal partial, not accepted. Designated primary replay passed88 assertions;
supplements passed seven required assertions but recorded a normal thumbnail
cancellation availability failure. All15 viewed POSTs matched synchronous visible
inbound source rectangles. Geometry/editor/pending-photo and previous fixes passed.
A second recorded thumbnail failure occurred before recorder stubs in run-004.
Both stayed on Retry despite visible correct geometry and available replacement
source/bytes. Later passing runs do not erase these observations.

Read `docs/issues/Thumbnail_Cancellation_Availability.md`. Correction49 now diagnoses
the exact rejection or invalid handle cause before any source change. No new44
round, review38 or build33 is active. Parent found a separate fixture overclaim:
a new valid handle may have a different Blob URI, so URI inequality alone is not
stale publication. Diagnostic-only parent probes distinguish it from actual Retry.
Original r3 failure and hash evidence is preserved. Source is still35cba0c until
49 proves and returns a correction. No blanket retry/limit increase is authorized.

## Final parent acceptance after49

Accepted on `24539121aabb37fd9c1bd2df78a74890c76da1d7`. Earlier partial rounds remain
partial. Parent accepted the two proven49 fixes, verified all186 public inputs,
28 export files and160 sealed artifacts and independently reran the full primary
and all supplements. Primary91 and supplements17 assertions pass,14 exact actual
viewed sets, zero failures/unexpected/browser/device errors. Every ordinary recorded
anchor delta is0px. All452 serialized source/packaging tests and workspace types pass.

Authoritative report is `docs/features/Integrated_Release_Browser_Acceptance.md`.
Evidence is fix49/hash-final-002.json and independent
fix49/parent-full-1792101595016-primary/ and -supplements/. The same final export
matches committed inputs. This is not a relabeling of r3 or lost r2 raw data and
not123 independent requirements. Parent full replay avoids another redundant44
worker round. Source writer is done. One combined38 review follows, then final
source/version/verifier freeze and33 artifacts. All native/hardware limits remain.

## Safety limits

No real DB/auth/.env/token/key/book/message/log/media/runtime reads, live API/model/WhatsApp/profile/download/history actions, original gallery/private-phone storage, paid/image quota, device/service/OS viewer control, production3210/8081/8083, installation/SDK/toolchain work, outside-project writes, final desktop/APK build or stage/commit/push. Only the explicitly documented synthetic directories and normal synthetic test temp data are permitted. No source fixes or other agent launches.

# Orchestrator Master Plan

## Overview

- Session: orch-20261014-015412
- Product: personal WhatsApp assistant and messaging client
- Checkout: C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot
- Mission: build reliable owner-controlled messaging assistance without changing
  the old app or the existing CreativeOS application.
- Current phase: Build, offline demo and verification. The owner accepted V2
  light/dark UI and authorized implementation without further questions.

## Context Intake

The source of truth is `docs/Approved_Brief.md` and the
user's approvals in this T3 thread. The owner wants Expo, Windows-hosted Node,
SQLite, OpenRouter GPT-6 Luna, selected-contact automation, latest-ten drafts,
media-aware conversation, reactions and an assistant command conversation.

All work stays within this independent project checkout. Do not edit the old
JStarReplyBot or the parent CreativeOS repository. Its four unrelated egg-info
changes remain untouched. The owner requested direct docs/ organization; the
three unchanged Genesis placeholders were replaced by authored foundation docs.
Product docs belong in `docs/`; an isolated engineering
spike belongs in `prototypes/whatsapp-assistant/`. These paths avoid mixing two
products in one dependency graph.

No live WhatsApp session, private chat retrieval, real sends, read receipts or
OpenRouter requests without a deliberate later test step. No deployment.
History and status context are capability questions, not verified promises.

## Skills Registry

| Overlay | Use |
| --- | --- |
| unslop | Plain, specific requirements and handoffs |
| Takomi personas and routing | Architect for foundation, coder for engineering spike, reviewer for acceptance |
| Scoped commit discipline | Conventional commits and preservation of unrelated work |

## Workflows Registry

Genesis owns requirements, architecture, schemas, API contracts, FR issue
mapping, verification planning and controlled technical feasibility checks.
The engineering spike is not a product implementation pass. It may create
offline tests and an opt-in read-only adapter probe, but no UI or live automation.

Design means UI/UX. The owner has now approved Paper design and offline
implementation. The first three mobile screens are complete; add a WhatsApp-like
second direction beneath them without modifying the originals. Follow the latest
palette clarification: familiar interaction and density, not copied green branding.
Review remains a focused acceptance pass, not an endless cleanup loop. Live
account access, provider requests, real sends and deployment remain gated.

## Task Table

| Task | Subtask | Role | Workflow | Dependency | Status |
| --- | --- | --- | --- | --- | --- |
| 01 | Author the scoped foundation and FR issue pack | architect | vibe-genesis | approved brief | completed |
| 02 | Review foundation against approved scope | reviewer | Genesis acceptance | 01 | completed, direct parent review |
| 03 | Validate durable permission and cancellation behavior offline | coder | Genesis technical feasibility | accepted foundation | planned |
| 04 | Validate WhatsApp normalization and prepare a read-only probe | coder | Genesis technical feasibility | accepted spike contracts | planned |
| 05 | Review prototype, record evidence and hand off | reviewer/orchestrator | Genesis acceptance | 03, 04 | planned |
| D01 | Author Paper mobile direction and exact exports | designer | vibe-design | accepted foundation | completed |
| D02 | Add WhatsApp-like second direction below originals | designer | vibe-design | D01, user reference | accepted, completed locally after Paper quota stop |
| B01 | Implement durable core and authenticated demo service | coder | vibe-build | accepted foundation | completed, 26 focused safety checks pass |
| B02 | Implement V2 mobile-size client and themes | coder | vibe-build | D02, B01 | completed, web interaction checks and export pass |
| B03 | Wire opt-in OpenRouter text drafting and consent | coder | vibe-build | B01 | completed with mock verification, paid calls untested |
| B04 | Verify native device and live connection | coder/reviewer | controlled verification | owner pairing and device | pending owner scan and physical-phone checks |
| B05 | Implement WhatsApp adapter, AI and Wi-Fi access | coder | vibe-build | owner authorization and private key | completed, 28 safety checks and browser pairing UI pass |
| 13 | Record, play and transcribe voice notes | coder/reviewer | vibe-build | owner voice approval, task 12 | completed, native teardown fixed; 85 tests, exports and synthetic ASR pass; backend reloaded; phone checks remain owner-tested |
| 14 | Fix composer keys/mic, Resume and reaction display | coder | vibe-build | task13, owner bug report | completed; combined121tests, exports and focused review fix |
| 15 | Native reaction sync, emoji, typing and paced replies | coder | vibe-build | task14 shared contract | completed; per-part safety and guarded presence tested; live reloaded |
| 16 | Signed Android APK and click-to-start Windows launcher | coder | vibe-build | 14/15, owner approval | completed, signed ARM64/x86_64 APK verified,133tests/types and launcher lifecycle pass; physical-phone checks remain |
| 17 | Otherme UI designer handoff brief | worker | design handoff | owner final name clarification | completed, delivered docs/design/Otherme_UI_Brief.md |
| 18 | Review daily-use signing and launcher | reviewer | vibe-build | 16 | completed, QR shutdown and checkout/instance blockers fixed with regressions |
| 19 | Plan separate-account switching and same-owner repair | architect | vibe-build | owner approval | completed, immutable runtime plus verified launcher restart |
| 20 | Android tab insets and contact-only inbox filtering | coder | vibe-build | owner screenshots | completed in signed0.1.1; syntheticinset/contacttests pass |
| 21 | Profile registry/scope and safe backend restart | coder | vibe-build | 19 | completed, separateDBs and failclosedrequests |
| 22 | Mobile profile controls/client revocation | coder | vibe-build | 19sharedcontract | completed,45mobiletests; localdraft/mediaisolation |
| 23 | Astra logo exploration and voting image | designer | logo exploration | owner image request | delivered, A isfrontrunner, iconunchanged |
| 24 | Focused profile integration review | reviewer | vibe-build | 20/21/22 | completed, discoveryrevisionP1fixed;177checks/typespass |
| 25 | Signed profile update0.1.1/code2 | worker | vibe-build | 24 | completed, actualAPKverified withsamecert, originalliveaccountunswitched |
| 26 | Keyboard, smart chat scrolling and microphone retry | coder / reviewer / worker | vibe-build | owner usability reports | Completed, 190 tests/types and web export pass; actual signed 0.1.2/code3 independently verified, owner hardware checks remain |
| 27 | Reconcile design/context references and plan the next batch | architect / designer | vibe-genesis | owner requested plan only | Completed and owner-approved with foreground sync, persistent keyboard and browser-desktop additions |
| 28 | Mic cancellation and persistent chat keyboard | coder | vibe-build | approved contract | Source handoff accepted, parent41 focused tests/types pass; physical acceptance remains |
| 29 | Launcher lifecycle, explicit PC QR and browser host | coder | vibe-build | approved contract | Source accepted, parent70 backend/29 packaging tests/types pass; encoded-API auth regression fixed |
| 30 | Foreground sync and profile/service UX | coder | vibe-build | approved contract, optional29 fields | Source handoff accepted; parent87 mobile/60 core tests/types pass; capability opt-in integrated |
| 31 | Approved native/browser visual integration | coder | vibe-build | 28/30 functional handoff | Source accepted; parent250 workspace tests/types and132 synthetic browser checks pass |
| 32 | Focused integrated safety and regression review | reviewer | vibe-build | 28–31 | Review returned P2 Assistant read feedback; parent reproduced/fixed,93 mobile tests/types pass; extension review still required |
| 33 | Build desktop assets and signed Android update | worker | vibe-build |38/50 resolved,645f569 app/2c8d658 verifier | Complete0.1.3/code4, signed APK and production desktop verified; old artifacts preserved, hardware/live rollout owner-owned |
| 34 | Plan added send/receipt/contact/prompt gate | architect | vibe-build | owner choices recorded | Accepted docs; single atomic name import and approved build target clarified |
| 35 | Diagnose missing incoming messages | architect | read-only research | synthetic/source evidence | Investigation complete; owner approved all three history fixes, now scoped by40 |
| 36 | Implement extension backend/core | coder | vibe-build | 34 accepted | Source accepted, parent282 tests/types pass; non-direct name regression fixed |
| 37 | Implement pending send UX and controls | coder | vibe-build | 36 handoff, native API/target verification | Complete69f01fd;39 baseline and accepted44 final browser evidence; source38/hardware separate |
| 38 | Review combined extended release | reviewer | vibe-build |36/37/41–50 integrated and44 accepted | Complete, parent verified both50 responses;464 tests/types and fresh108 browser checks, no generic second audit |
| 39 | Validate extended browser UI | worker | vibe-build | Frozen37 source | Complete; parent36 checks/18 screenshots pass after fixture wait correction;69f01fd baseline only |
| 40 | Plan history repair and cached media/viewers | architect | vibe-build | owner approved history/media scope | Complete; parent accepted with cached-first/policy/manual-work/JPEG corrections in30f4f15 |
| 41 | Implement verified history repair and media contracts | coder | vibe-build |40 accepted,39 complete | Complete, source32fe269; parent22 focused/342 workspace tests and all types pass |
| 42 | Paged/cache-first chats, private media reuse and photo viewer | coder | vibe-build |41 and46 accepted contracts | Complete061c4d7; parent404 serialized-suite/packaging tests, all types, local ack lifecycle regression fixed |
| 43 | Foreground video player and disabled-background/PiP config | coder | vibe-build |42 accepted, exact module approved | Complete4f2b428; parent435 serialized-suite/packaging tests and all types pass |
| 44 | Validate integrated history/cache/media browser | worker | vibe-build |41–43/46 plus47/48/49 corrections | Complete on2453912, independent parent full91+17 browser checks, all14 actual viewed sets exact |
| 45 | Audit ASR prices/routes and repeat paid work | architect | vibe-build | read-only frozen69f01fd | Complete; selected WhisperTurbo via same OpenRouter key,7 fake assertions, parent public catalog check |
| 46 | Dedicated economical STT and durable reuse/attempt protection | coder | vibe-build |41 accepted,45 findings | Complete, source402e804; parent363 workspace tests/all types pass, no paid/live change |
| 47 | Correct bounded actual row visibility after history reflow | coder | vibe-build |44 R1 confirmed blocker | Complete eb8a242, source440 tests/types pass; r2 exposes additional warm/resize/editor failures assigned48 |
| 48 | Correct warm geometry, focused editor anchors and foreground photo recovery | coder | vibe-build |47 plus44 r2 confirmed failures | Complete35cba0c; parent449 tests/types and27 isolated browser checks pass |
| 49 | Diagnose and correct thumbnail cancellation availability | coder | vibe-build |48 plus44 r3 recorded failures | Complete2453912, deterministic purge/ownership red-green; parent452 tests/types and full browser acceptance |
| 50 | Correct two confirmed review38 blockers | coder | vibe-build |38 r1 confirmed findings,49 accepted | Completef32808b, parent red-green reproductions and full tests; final metadata645f569 accepted |
| 56 | Fix native media opening and picker cancellation | coder | vibe-build | owner correction contract | source integrated, review60 pending |
| 57 | Fix Latest, reaction feedback and pending conversation rendering | coder | vibe-build | owner correction contract | source integrated, review60 pending |
| 58 | Replace technical UI clutter with compact messaging controls | coder | vibe-build | owner correction contract | source integrated, review60 pending |
| 59 | Trace voice-note context failures and real send delays | coder | vibe-build | owner correction contract | source integrated, review60 pending |
| 60 | Review the combined messaging correction once | reviewer | vibe-build | 56,57,58,59 | accepted source review |
| 61 | Verify and package the corrected native and browser clients | orchestrator | vibe-build | 60 | in-progress |
| 62 | Verify corrected browser interactions on fresh export | worker | vibe-build | 60, parent61 freeze | pending |
| Gate | Owner approval for design and offline build | orchestrator | Design gate | user message | granted |

Task 01 delivered the foundation. Task 02 was accepted after a focused direct
review and removal of the never-reply AI exception. The T3 thread still inherits
the parent root, so direct single-writer execution is used in this exact project
instead of launching a child in the wrong checkout. Later packets have scope and acceptance
before registration or launch. Tasks run sequentially when
they write to this checkout. Read-only review may run while the parent inspects,
but only one writer owns a file at a time.

## Progress Checklist

- [x] Capture approved product scope and operating choices.
- [x] Confirm checkout and inspect repository instructions.
- [x] Identify unrelated modified files and exclude them from commits.
- [x] Author requirements, architecture, schemas and APIs.
- [x] Verify 12 MUS requirements and matching issues align one-to-one.
- [x] Complete a focused foundation review.
- [x] Commit reviewed foundation as b158cdc.
- [x] Author and visually review three Paper mobile screens.
- [x] Complete and review the accepted local V2 design direction.
- [x] Prove local permission, cancellation and replay invariants offline.
- [x] Run workspace typechecks, Expo web export and browser interaction checks.
- [ ] Verify native keyboard/background behavior on an owner device.
- [ ] Document actual adapter capabilities and untested live behavior.
- [ ] Commit verified prototype changes in separate reviewable batches.
- [x] Receive explicit owner approval for Paper design and offline build.

## Notes

Owner explicitly directs continuation through the entire approved round, not a
stop after46 voice transcription. Advance46 acceptance ->42 cached-first chats/
drafts/photos ->43 approved foreground video ->44 integrated browser ->38 combined
source review -> parent source/version/verifier freeze ->33 browser/same-key APK
artifacts and final handoff. Fix confirmed scoped blockers and keep work single-
writer. Do not ask routine technical/dependency approvals or wait for a fresh
'continue' after each result. Use T3 completion notifications, not polling/watchers.
No contact-insights/full Batch2 expansion, live account/data/service operations or
phone actions are authorized by this sequencing directive. Final handoff includes
owner-only device checks; synthetic/build success is not hardware acceptance.

Use T3-owned delegation with the explicitly selected Takomi provider.
Architect route is openai-codex/gpt-6.1-sol with medium thinking. Coding route is
Sol high for safety-sensitive state and delivery work; bounded normalizations
may use Luna high. Review uses Sol medium or high based on risk.
Do not launch top-level threads or worktrees; the user requested this checkout.

The parent owns Git staging and commits. Agents must not stage, commit, push or
rewrite history. Use exact path lists and inspect the staged diff before each
commit. Commit the session/brief first, foundation next, then cohesive prototype
slices. Never stage the whole repository.

App model `openai/gpt-6-luna` on OpenRouter is distinct from the agent model.
Persist authorship and outbound IDs rather than guessing from short timers.
Fail closed when a permission or send outcome is uncertain.

## Post-release PC investigation

The owner reports repeated launcher service-identity failures, Q timing out before
any stop acknowledgment, and the built browser looping on connecting to the PC.
The deleted file was `launcher.lock`, not a log. The actual child exit and current
live service state are unverified. Do not delete another lock, rotate tokens,
re-link, restart or probe the real service as part of source-only diagnosis.

1. Task51, architect, complete: reproduced CPU-bound history starvation with fake
   HTTP/IPC. Parent independently confirmed the underlying no-I/O loop and query
   scan/sort. The owner's actual historical cause remains unproven.
2. Task52, coder, complete: bounded cooperative history/contact processing and
   existing paging-index correction. Parent original source17/19 failures versus
   corrected19/19 pass; full484 tests and workspace types pass. A stale platform
   test's0.1.2/code3 expectation was updated to existing0.1.3/code4, with its first
   failed run preserved. No app version/native code changed.
3. Parent focused review and fake HTTP/IPC acceptance complete: identity48ms,
   graceful stop42ms, gated at10/500 items, normal child exit. Existing built
   browser connects/reloads against200000 invented messages,5 checks/8 successful
   API responses. Existing font-route404s were reported separately, not fixed by
   expanding this patch. Current actual service still needs normal verified Q
   shutdown/relaunch. No actual rollout, account, token, icon or APK change.

The board tool is currently bound to the parent checkout and reports no session.
The parent maintains this existing project's canonical board JSON directly rather
than creating a duplicate parent-root session. Task51 packet is under
`completed/51_trace_post_release_pc_unresponsiveness.task.md`. Task52 was authored
before dispatch and is now under `completed/52_fix_backend_history_responsiveness.task.md`.
The owner expressly directs no more routine approval prompts during testing.
Proceed with necessary narrow diagnosis and compatible fixes, preserve secret
redaction and target/unknown-outcome safety, and avoid unrelated destructive,
paid, real-send or account-relink operations.

The owner reports continued failure after52. Task53 is now source-complete, scoped by
`completed/53_fix_sparse_profile_refresh.task.md`. The current listener started
after52's commit, so do not assume the owner omitted restart. Actual read-only
aggregate shape is3437 conversations/3115 aliases but only1657 messages across345
chats, maximum275 per chat, with no duplicate transport IDs. The previous dense
100-chat fixture missed this case. Correct the sparse-profile snapshot path with
invented fixtures before claiming the live problem solved. Do not delete old
contact-only rows or hide legitimate state as a performance workaround.

Task54 runs independently on index.ts, desktop.ts and mobile/api.ts plus focused
tests. Its completed source packet is `completed/54_correct_browser_connection_and_assets.task.md`.
It corrects misleading pnpm setup guidance, exact configured LAN-browser Origin
support and the already-confirmed public export font-route defect. It preserves
loopback-only token provisioning and every private-path/auth guard. It must not
edit53's core/workflow/server files, build artifacts or imply that switching IPs
fixes the current freeze. Parent integrates both before validating updated web
assets and any actual rollout. Task54 source has returned and passed parent focused
review plus independent original13/14 failures and corrected14/14 passes. Actual
built Inter assets now load through its corrected fake backend route. Combined
verification and a refreshed web bundle remain pending53. No live/native fix or
rollout is claimed from this partial browser result.

Task53 returned a reproduced125-second sparse snapshot reduced to645ms with
byte-identical output and no persistent cache/schema change. Parent independently
verified original3/3 failing tests and corrected4/4 passes, then replayed only the
selected real profile in a disposable offline backup opened from a read-only
source. It returned200 in2422ms and retained3437 conversations,166 drafts and135
outboxes; no listener/provider/socket was started and the temporary copy was
removed. This is not actual-client acceptance.

Task55 began parent integration under its authored packet and is now operationally blocked as recorded below. It owns full
combined checks, isolated new web export, private-byte scan, actual fake browser
loopback/LAN coverage and preservation/promotion of desktop assets. Keep current
service rollout and phone acceptance distinct, and do not declare the live
problem resolved from those tests alone.

Final parent integration passes101 core/141 backend/230 mobile/34 packaging,
506 total, plus workspace types. Ordinary settings testing additionally required
a derived account/canonical/alias index and removal of redundant alias rewalks
from the two already-account-wide invalidation loops. Four new regressions fail
before and pass after, with unknown/manual work preserved. No stale read-local
cache is carried across mutation writes.

The new28-file/5227143-byte desktop export passed credential-byte/private-path
scans and13 actual Edge/browser fixture checks covering3437 conversations,
loopback/LAN login, explicit Continue, settings toggles, reload/foreground and
fonts, with no provider/device/external/page/asset errors. It is promoted to
apps/mobile/dist; prior28-file/5226702-byte assets are preserved at
.runtime/pc-task55/previous-desktop-1792124977744. APK/build-copy unchanged.

53 and54 are source/artifact accepted. The owner subsequently completed the normal
restart. Parent confirmed the new index, matching token/root/protocol and scoped
HEAD snapshot200 in6995ms without returning its body. The operator restart blocker
is resolved. The owner reports ordinary use and nonblocking composition work so
far, then supplies concrete UI/media/voice defects.55 remains a connection
acceptance record, not proof of complete physical-client stability. Its current
packet is in-progress/55_integrate_and_verify_pc_connection_fixes.task.md.

## Owner-reported messaging correction round

The testing hold now permits only the corrections explicitly reported by the
owner. Follow docs/features/Messaging_Corrections_0.1.4.md. Native media crashes,
picker cancellation, Latest/automatic newer loading, reaction placement/optimism,
compact truthful receipts, pending media continuity, ordinary UI wording and
voice-note context are in scope. Preserve working composing, image sending and
voice playback. No new analytics, icon, context-session or video-send feature.

56-59 are parallel writers with disjoint file ownership authored in their packets.
60 is one focused combined review;61 is parent verification and new same-key
0.1.4/code5 native/browser artifacts, using the existing approved C:/Otherme-build.
No source or fake browser result is physical-device acceptance. No paid retry,
real send, relink, lock deletion, forced restart or data reset is authorized by
this round. Required privacy/AI consent remains clear while optional technical
explanations move out of routine screens. Record each T3 task ID in canonical
project tracking; the harness board tool is bound to parent CreativeOS, so do not
create a duplicate session there.

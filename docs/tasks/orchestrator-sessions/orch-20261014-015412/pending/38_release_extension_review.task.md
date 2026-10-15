# Review the owner-added combined release source

## Agent setup

Persona reviewer, Takomi Sol High, Build review. Read-only, requiredCapabilities=[]. Canonical root `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`. Every shell command explicitly cd there or use absolute project paths. Use unslop. Parent owns review decisions, integration, master plan, board, statuses and commits. Do not launch agents or edit source/docs.

Read scoped instructions, docs/Coding_Guidelines.md, docs/Project_Requirements.md, Release_Gate_Extension.md, Release_Extension_Implementation_Plan.md, Daily_Use_Batch_1_Contract.md, relevant feature contracts, completed28 through32, implementation36/37 handoffs and actual diff/types/tests. The exact frozen range, parent acceptance and running delegation ID are recorded below. Only parent-authorized read-only review is active; no source or artifact writer.

## Original brief and authority

The owner added the next-release requirements while review32 was running. Verify immediate honest pending send feedback and continued composition/history/swipe-to-quote during send/upload, true outgoing WhatsApp receipt ticks, optional WhatsApp-first phone-book display names synchronized to PC/browser, AI prose U+2014 replacement with comma-space before persistence/review/send, and one bounded per-profile About me and reply instructions field. Current permitted recipient name may accompany AI requests. Full/unmatched/unrelated contact-book export remains forbidden. A later explicit
request also requires visible in-chat Drafting feedback, typed outcome/View and
honest unconfirmed timeout handling without automatic paid generation retry.

Review32 covered74f26af, not this extension. Its one P2 withheld acceptance because a background-cancelled Assistant history read became persistent action feedback after successful recovery. Parent reproduced it and fixed dc99aa6 with local read feedback, epoch/cleanup guards and local read-only retry, preserving action/domain/unknown errors. All93 mobile tests/types passed after that fix. Earlier250 workspace tests/types and132 isolated browser checks predate the extension. This review must check the narrow fix and new code, not treat32 as acceptance or repeat its old baseline claims as new evidence.

Other prior resolved findings remain regression checks: optional session `?capabilities=1` discovery and404 classification, strict legacy plain discovery response, encoded static API GET/HEAD auth/profile protection, no released native recorder access, manual keyboard-hide/profile/focus guards. Physical mic cancellation has no proven device root cause. Real native keyboard, Windows QR/browser and actual WhatsApp receipt/contact behavior remain unverified.

35 completed read-only investigation and reproduced verified LID/phone history and
quote splitting, conditional blank/full recovery loss and a newest100 local display
window. Parent independently reproduced the alias-store split. Actual incident
cause remains unproven. Owner subsequently approved all three local fixes plus
cached/tappable image/video viewing. Read History_and_Media_Reliability_Scope.md,
40's finalized implementation plan and41+ handoffs. Those integrated fixes now join
this gate. No live diagnosis/repair/full WhatsApp sync is authorized; do not infer
the owner's actual cause from a synthetic reproduction.

## Objective

Accept or reject the combined source against the owner-added requirements,
with evidence for confirmed blockers and explicit limits on hardware claims.

Parent36 acceptance found a name resolution regression: setting/import loops renamed
group/status/unknown/unresolved labels. Parent reproduced it before the fix and
restricted resolution to canonical direct phone chats. Keep this test and ensure
new name UI does not bypass it. Parent282 tests/types passed after the correction.

## Scope

One focused integrated correctness/security/requirement review of36/37, the
owner-approved40/41+ history/media work and retained baseline safety. Not a style,
Batch2 or unrelated cleanup review. Parent must supply actual finalized contracts/dependency resolution and synthetic checks. Read product source but no private runtime/credentials/book data.

Check these boundaries:

- Original gesture captures immutable text/quote/media/revision/scope/request IDs before awaits. Rapid duplicate tap does not enqueue twice, deliberate identical send does. Journal failure/full state preserves owner content. Media ownership survives pending work. Later gestures cannot overtake slow upload in one conversation, and route/remount/restart never replays a mutation.
- Preparing/uploading/pending/accepted/unknown/partial/failed states tell the truth. Input/history/selection/swipe/next composition remain usable during send/upload/refresh. Old completion never erases newer text/quote/media or false-empty composer occupancy. Acknowledged holds, actual-visible unread and keyboard/mic lifecycle remain intact.
- `perform` returns mutation data without waiting on refresh; all existing callers tolerate that sequencing. Read recovery never hides domain/unknown errors or promotes cancellation to persistent action feedback. Lost HTTP response reconciles by scoped request/outbox identity, not content, and missing status proves nothing. Unknown retains reservations and stops automatic client successors without a blind retry.
- Draft reply shows immediate local progress and a validated result/View, silence,
  handover, stale or actionable failure state. Unacknowledged timeouts stay
  unconfirmed; no automatic paid retry, invented progress or snapshot-dependent
  request spinner. Late profile/chat/request completions cannot replace current
  feedback or erase newer composition. View opens the actual source card.
- One/double/blue ticks require verified sent/delivered/read evidence, not HTTP/sendMessage acceptance, local echo or app viewed state. Match profile/current socket/direct canonical chat/outgoing transport/component IDs, including early receipt before Message creation. Max-rank update survives duplicate/out-of-order events/restart. Different account/chat and own-device/read-self events cannot paint recipient reads. No group/status claim, readMessages call, second grant charge/refund or whole-sequence status inferred from one part.
- Names are optional/default off, WhatsApp saved before phone matched before push/verified/number. Partial contact updates preserve absent fields; push cannot replace saved. No chat creation from imports. Existing legacy name is not confirmed model identity. Native explicit permission/action only, no web import, background read or WRITE_CONTACTS. Exact international match only, no suffix/country/LID guess or ambiguous pick. One bounded import is atomic; hash replay/conflict, count/body bounds and off/scope/revision failure cannot partially replace/expose names. Exact lastPhoneImportRequestId, not a timestamp or missing row, reconciles an unacknowledged import. No staged/chunked protocol is required. Off deletes active saved-book/phone aliases and recomputes fallback.
- The only current eligible recipient name reaches model context, after consent/aiAccess. Full book/unmatched/other-contact names and raw phone-import IDs never do. Owner instructions are one explicit PC-saved plain-text field per profile with byte/code-point limits, CAS conflicts and no auto extraction/import/demographic form. No cross-profile editor/DB context or sensitive logs/discovery.
- Editable preferences/name cannot override backend policy. Every async generation stage uses captured instruction/name/workflow revisions, including both context builds, dedupe/reuse and final save. Old pending/edited drafts stale and queued AI components cancel without mutating approved text, granting authority, revoking unrelated grants or refunding dispatching/unknown work. No model call triggered merely by a name/prompt save.
- One generated Action normalization boundary covers text/reaction_plus_text/each sequence component and generated reasons before draft persistence/hash. U+2014 replacement handles adjacent horizontal spaces/repeats/newlines, revalidates expanded text/reason/sequence bounds and leaves owner manual/edit/instructions, source/ASR/quotes/IDs/emoji unchanged. No send-only rewrite. Legacy pending/queued AI upgrade is once-only, conservatively invalidated, with no history rewrite/resend/refund.
- Actual constructed provider text/roles/schema/owner/name fields are budgeted, not merely the old context JSON. Mandatory overflow rejects before fake fetch; output cap and image uncertainty remain explicit. No extra model call, tokenizer dependency or Batch2 context expansion.
- Additive settings/tables reopen safely with defaults, API headers/auth/no-store/origin/static checks apply, protocol2 plain discovery stays compatible and missing capabilities disable new controls honestly. Pinned Expo Contacts and target authorization were verified before any install, with no other dependency/toolchain drift.

Read docs/features/Cached_Chat_and_Draft_Opening.md as a later explicit requirement.
Known chat/draft bodies paint before delayed history; refresh/source arrival cannot
blank them, duplicate/unmount an active editor or overwrite local work. Cached data
cannot bypass server revision/source/scope gates or trigger generation/replay. Test
out-of-order reads and multi-client conflicts, with genuine visible paint rather
than an opacity-zero DOM node. Missing context must not hide an already-known draft.

Additional history/media boundaries from the owner's later approval:

- Verified same-account alias reads join existing history/raw/quotes/context without
  record deletion/renumbering, invented quoted originals, ACL/source weakening or
  rebind of client intents, requests, outboxes, holds, grants and unknown accounting.
- Partial/full recovery cannot override tombstones/view-once, duplicate events or
  trigger historical generation/send. Old and newly learned mappings are covered.
- Scoped local paging reaches older stored rows, preserves viewport/typing/source
  anchors and Latest, and never acknowledges newer unseen messages from an old
  page's bottom. Incoming revisions do not replace an older reading position.
- Private bounded cached bytes require current source authority, stable variant/
  content identity, exact scope and correct expiry/delete/view-once invalidation.
  Cache hits avoid binary re-download; stale reads and profile changes cannot
  display another account. No secret URL/public cache or unsupported erase/offline
  guarantee. Human viewing does not expand AI visual inputs or context budget.
- Image viewer is genuinely tappable, closable and scoped. Ordinary video is
  explicit foreground playback only, not sending/AI/background/PiP. Close/route/
  profile/background/deletion/expiry stops media and coordinates audio/recording.
  Exact native dependency, file limits and actual artifact permissions must be
  approved/verified, not assumed. No hidden microphone or spontaneous focus resume.

41 parent acceptance added a regression for the same verified physical event
arriving live versus replay/backfill on aliases. It failed first as a conflict,
then exposed replay incorrectly treated as read. Source32fe269 keeps known arrival
classes equivalent while unknown/actor differences remain strict, preserves both
physical source labels, and deduplicates unread by actual acknowledgment.22 focused
and342 workspace tests/all types pass after correction. Keep this in the combined
review; this is not an actual live-incident/root-cause claim or separate review loop.

42 parent acceptance found local acknowledged draft edits overriding equal-revision
server stale/dismissed/resolved state. A new regression failed first. Source061c4d7
keeps strictly newer local content against older reads but honors same-revision
terminal lifecycle, with11 focused checks passing. Serialized94core/109backend/
172mobile plus29packaging pass,404 total, all workspace types pass. Initial403
parallel passed; later default parallel run hit unchanged FFmpeg audio/GIF deadlines.
Isolated14 conversion checks and full serialized suites passed, no production
budget or test assertion loosened. Carry that timing limit honestly into review.
See Cached_History_and_Photo_Handoff.md for exact cache/player contract.

## Later economical ASR requirement

Read ASR_Cost_Review.md, completed45 and accepted46 handoff. Owner selected exact
openai/whisper-large-v3-turbo through OpenRouter /audio/transcriptions with existing
key, JSON MP3/verbose_json and no forced language/chat prompt/schema parser. Verify
both legacy defaults/settings no longer route to Gemini, unsupported overrides fail
before export, no expensive fallback or paid automatic retry. Missing confidence
is uncertain, no fabricated speech/identity/quality claim.

Completed eligible text must reuse across byte TTL/eviction/restart/default-model
change, before downloading/paying. Physical actor/source/content and current noAI/
profile/expiry/delete/view-once guards remain. Stable content fingerprint protects
byte reuse too. Durable attempt reservation/CAS/unknown recovery must prevent
implicit paid resubmission after crash/timeout/malformed response/new context.
Retention/capacity/cleared text cannot evict suppression and silently pay again.
No source/hash becomes authorization, no raw private logs or full Batch2/cost UI.
Review fake HTTP/reopen/source-revocation tests. No tests prove actual note count,
prior duplicate bills, future exact broker costs or accent/silence quality.

## Definition of done

Return evidence-backed confirmed blockers with path/line/scenario/severity and a focused reproduction or reasoning trace, or accept source with explicit hardware limits. Review findings are recommendations; parent decides fixes. Do not expand into abstractions, cleanup, speculative edge cases, new UI or unrelated ingestion.

Run relevant synthetic existing/focused tests and typechecks where safe, using fake models/transports, disposable DBs/ports and invented contact numbers/names. Inspect final diff for only approved paths. Parent should have run full workspace tests/types and packaging regressions plus isolated browser narrow/wide dark/light/large-font interaction checks. If evidence is missing, say exactly which check is missing; never fabricate a pass. A review pass does not prove real phone permission/keyboard/mic, actual receipt delivery/read privacy or Windows behavior.

## Expected artifacts

Read-only report naming reviewed baseline/range, actual checks/results, confirmed blockers or source acceptance, and hardware/privacy/dependency limitations. Parent records exact delegated review ID and outcome in task records. For another review round parent must use a new T3 task with original brief, findings, responses and unresolved objections, not send to the child backing thread. No recursive review-until-clean loop.

43 parent accepted source4f2b42880ad5a62f93846f956e85266e22cd10f8 after native/web
cleanup/source/audio ownership and exact dependency/config review. Serialized
94core/109backend/203mobile/29packaging pass,435 total, all types. Exact Video57.0.5
is the only new pin. In-memory plugin chain tests disable both PiP activities and
block background service/permissions, preserving READ-only Contacts. This is NOT
actual merged/signed APK proof;33 must verify. Cached/player/public codec limits
are in Foreground_Video_Handoff.md.44 now validates this frozen integrated product
source; no code writer during its export. Parent supplies actual44 results at launch.

## Integrated geometry and foreground corrections

Include accepted47 and48 in the single combined review. These are confirmed
browser defects, not a request for another generic review loop. Parent supplies
fresh accepted44 r3 evidence before dispatch. Product candidate is currently
35cba0ce1a0ecda1af056d8f872feed87ea94f9b, not the earlier4f2b428 export.

47 added coherent measured rows after unchanged-size keyed paging. Its first unit
regression failed against old source. Broader44 r2 then exposed warm saved-offset
double counting and off-screen viewed IDs, a cached editor going below the viewport,
clean responsive anchor drift and foreground photo recovery needing Retry. Parent
independently reproduced all four and scoped48. Review these actual boundaries:

- Content-relative coordinates come from measured content and viewport, not a saved
  or requested offset. Pending/stale/page/profile/scroll callbacks cannot publish
  or acknowledge rows. Actual source-child intersections, not full draft wrappers
  or mounted rows, control inbound viewed IDs. Measurement retries/cleanup stay bounded.
- Source restoration keeps the last coherent ID/offset across ordinary reflow and
  native scroll adjustments. Active cached editors retain their node, focus, local
  work and viewport position after source arrival. Measured trailing room is only
  for a focused editor and clears on exit. No hidden focus or keyboard resumption.
- Foreground recovery cannot join old canceled metadata/download tasks. Late cleanup
  cannot delete a newer entry, and an old denial cannot revoke a new current handle.
  The provider cancels old reads before current media recovery. Current authority,
  source expiry/delete/view-once, namespace/profile scope and no-auto-play remain.

48 source acceptance is35cba0c. Parent independently passed94core/109backend/
217mobile/29packaging,449 total, all types and diff checks. Parent verified eight
changed source/test and28 export hashes against fix48 manifest, then independently
passed27 isolated Edge checks with exact warm visible IDs, editor y350, zero clean
resize deltas and three automatic foreground recoveries, one full-image binary.
These are not full44 acceptance. Actual44 r3 result must be supplied at launch.

Explicitly approved synthetic review inputs are ui-task44/r3 plus fix48 verification
and parent case evidence, and the older named ui-task31/ui-task37 baseline artifacts.
The r2 raw results were accidentally overwritten by parent reproduction. Its handoff,
evidence-summary/browser log and supplements remain, but the current raw file does
not contain the original69-check run or match its old manifest. Do not rely on that
raw result/hash or silently repair it. Use fresh44 r3 for integrated acceptance.

## Final browser acceptance and49 correction

Parent now accepts44 on24539121aabb37fd9c1bd2df78a74890c76da1d7. Read
`docs/features/Integrated_Release_Browser_Acceptance.md` and
`docs/issues/Thumbnail_Cancellation_Availability.md` before reviewing this layer.
The r3 Retry failures remain historical partial evidence, not silently erased.
Controlled real IndexedDB write/cancel timing reproduced a matching12second Retry.
Canceling an old successful write marked the pinned shared key pendingPurge and
rejected an uncanceled current handle. Local cancellation now leaves authorized
bytes cached. Actual expiry/revoke/source guards still purge. A separate uncommitted
thumbnail-handle leak exhausted four slots; acquiring effects now own handles that
never reach layout commit, while committed detach-before-release ownership stays.
No automatic retry, cap increase, API/provider/geometry/dependency/native change.

Parent452 serialized tests and all types pass. Parent verified186 public inputs,
28 export files and160 sealed artifacts, then independently passed full primary91
and supplements17 browser assertions on the same export, all14 viewed sets exact,
zero unexpected/errors/device calls and zero ordinary anchor deltas. Evidence is
explicitly approved under ui-task44/fix49, including verification.json,
hash-final-002.json and parent-full-1792101595016-primary/ plus -supplements/.
Do not add the delegate's extra15 isolated repetitions as independent requirements.
Do not claim historical original Retry stack recovery, phone/native proof or release.

Review49's cancellation versus source-revocation distinction and committed versus
uncommitted ownership with retained current-source/cap/lease constraints. This is
part of the one combined source review, not a new generic review round.

Final requested range is released399cc99 through24539121aabb37fd9c1bd2df78a74890c76da1d7,
focused on approved28–31/36/37/41/42/43/46/47/48/49 and32's narrow response. Docs-only
HEAD may advance; product is frozen, no source writer.33/version/verifier artifact
metadata is still held until this review and confirmed corrections are resolved.

## Dependencies and release gate

36/37 and all owner-approved40/41+ history/media implementation must be integrated,
with exact dependency approval/handoff, parent validation and updated isolated
browser evidence before this review.39 on69f01fd is baseline evidence only. No active shared-file writer during review. Review32 is prior context only.33 remains held until confirmed blockers are resolved, source accepted/frozen and exact final build-copy/dependency targets confirmed. Hardware checks are owner-owned and must remain explicit in release handoff; no final exports/builds or device actions here.

## Execution

Running Takomi Sol High, read-only, no concurrent source writer. Frozen reviewed
range is399cc99 through24539121aabb37fd9c1bd2df78a74890c76da1d7. Docs-only HEAD
changes do not extend product scope. Parent452 tests/types and accepted44 independent
full browser evidence are supplied. No source/version/verifier/artifact change
while this review runs. Only confirmed blocking issues warrant scoped fixes.

T3 task ID is
`node:delegated-task:command%3Amcp%3A73c03ce5-b336-44e9-b7ac-b1c24f448a93%3Adelegate-task%3Aotherme-combined-release-review38-20261015-r1`.
Client request ID is `otherme-combined-release-review38-20261015-r1`.
Final artifact33 remains held. Parent resumes from the completion notification.

## Round1 result and confirmed response

Terminal review result withheld acceptance for exactly two confirmed P2 blockers.
MediaViewer loses a returned handle when closed before React state commits, leaking
the sole viewer slot. Contact-only paired phone/LID identifiers call canonical()
and materialize unrelated inbox conversations before name eligibility, even off.
Parent independently reproduced both on unchanged source, releases0 versus1 and
savedNames=false/conversations1 versus0. See Release_Review_38_Findings.md.

Reviewer independently passed73 focused core/backend tests,145 mobile, all types,
diff checks and both inline reproductions. It verified186 public inputs,28 export
and160 sealed artifacts, and inspected parent91+17 browser evidence, not a replay.
No other confirmed blocker was reported. Native/artifact limits remain as supplied.

Task50 now fixes only these defects with red-to-green regressions. Source acceptance
stays withheld and33 held until parent verifies the exact responses and relevant
checks. No second generic review is authorized. Any needed narrow follow-up must
use a new task with this brief, findings, responses and actual unresolved objection.
The completed44 evidence remains attributed to2453912; affected new-source checks
must be added after50 rather than silently relabeling those old outputs.

## Limits

No source/docs/status/board/master-plan writes, package/version/lock changes, installs, actual DB/migration/.env/auth/token/signing/runtime/book reads, model/image quota, live backend/WhatsApp/profile/API actions, services/viewers/phone input or final web/APK build. Only documented synthetic `.runtime/ui-task31` and `.runtime/ui-task37` artifacts,
plus a parent-explicitly approved integrated synthetic handoff, may be inspected. Tests use isolated temporary data/ports, not3210/8081/8083. No Git stage/commit/push or outside-project writes. Preserve full future context/style guidance and parent source work.

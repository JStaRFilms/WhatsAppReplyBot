# Review the owner-added combined release source

## Agent setup

Persona reviewer, Takomi Sol High, Build review. Read-only, requiredCapabilities=[]. Canonical root `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`. Every shell command explicitly cd there or use absolute project paths. Use unslop. Parent owns review decisions, integration, master plan, board, statuses and commits. Do not launch agents or edit source/docs.

Read scoped instructions, docs/Coding_Guidelines.md, docs/Project_Requirements.md, Release_Gate_Extension.md, Release_Extension_Implementation_Plan.md, Daily_Use_Batch_1_Contract.md, relevant feature contracts, completed28 through32, implementation36/37 handoffs and actual diff/types/tests. Parent supplies exact integrated commit range and test results at launch. No launch is authorized by this authored packet and no delegation ID is assigned yet.

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

## Definition of done

Return evidence-backed confirmed blockers with path/line/scenario/severity and a focused reproduction or reasoning trace, or accept source with explicit hardware limits. Review findings are recommendations; parent decides fixes. Do not expand into abstractions, cleanup, speculative edge cases, new UI or unrelated ingestion.

Run relevant synthetic existing/focused tests and typechecks where safe, using fake models/transports, disposable DBs/ports and invented contact numbers/names. Inspect final diff for only approved paths. Parent should have run full workspace tests/types and packaging regressions plus isolated browser narrow/wide dark/light/large-font interaction checks. If evidence is missing, say exactly which check is missing; never fabricate a pass. A review pass does not prove real phone permission/keyboard/mic, actual receipt delivery/read privacy or Windows behavior.

## Expected artifacts

Read-only report naming reviewed baseline/range, actual checks/results, confirmed blockers or source acceptance, and hardware/privacy/dependency limitations. Parent records exact delegated review ID and outcome in task records. For another review round parent must use a new T3 task with original brief, findings, responses and unresolved objections, not send to the child backing thread. No recursive review-until-clean loop.

## Dependencies and release gate

36/37 and all owner-approved40/41+ history/media implementation must be integrated,
with exact dependency approval/handoff, parent validation and updated isolated
browser evidence before this review.39 on69f01fd is baseline evidence only. No active shared-file writer during review. Review32 is prior context only.33 remains held until confirmed blockers are resolved, source accepted/frozen and exact final build-copy/dependency targets confirmed. Hardware checks are owner-owned and must remain explicit in release handoff; no final exports/builds or device actions here.

## Limits

No source/docs/status/board/master-plan writes, package/version/lock changes, installs, actual DB/migration/.env/auth/token/signing/runtime/book reads, model/image quota, live backend/WhatsApp/profile/API actions, services/viewers/phone input or final web/APK build. Only documented synthetic `.runtime/ui-task31` and `.runtime/ui-task37` artifacts,
plus a parent-explicitly approved integrated synthetic handoff, may be inspected. Tests use isolated temporary data/ports, not3210/8081/8083. No Git stage/commit/push or outside-project writes. Preserve full future context/style guidance and parent source work.

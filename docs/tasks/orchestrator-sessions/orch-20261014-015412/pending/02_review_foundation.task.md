# Task 02: Review the WhatsApp foundation against approved scope

## 🔧 Agent Setup (DO THIS FIRST)

### Workflow to Follow

Takomi Reviewer persona. Perform one focused Genesis acceptance review.
Read-only task with requiredCapabilities=[].

### Prime Agent Context

1. `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot/docs/Approved_Brief.md`
2. `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot/docs/Project_Requirements.md`
3. `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot/docs/features/Assistant_Architecture.md`
4. `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot/docs/Verification_Plan.md`
5. `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot/docs/Coding_Guidelines.md`
6. `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot/docs/Builder_Prompt.md`
7. `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot/docs/issues/FR-001.md` through FR-012.md.
8. `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot/docs/tasks/orchestrator-sessions/orch-20261014-015412/master_plan.md`

### Optional Skill / Context Overlays

| Overlay | Reason |
| --- | --- |
| unslop | Specific findings and concise handoff |
| Genesis acceptance | Scope, contracts and testable completion |

## Objective

Decide whether the architect's foundation can guide the approved offline
feasibility prototype without contradicting the user or introducing a blocking
permission, privacy, state or contract defect.

## Scope

Read only the foundation and session docs. Validate PRD-to-issue alignment and
local links. Review concrete schema/API semantics across owner vs AI authorship,
identity aliases, latest-ten default modes, contact exclusions, quiet hours,
delegation/reaction accounting, takeover/no implicit resume, stale approvals,
dispatch uncertainty and backfill isolation.

Check media/GIF/status-reply boundaries and honest unsupported behavior.
Check bounded per-contact memory/style and source deletion, untrusted incoming
content, explicit confirmation for owner-command sends/permission changes, and
read-receipt/live-operation safety. Confirm no UI design has been authored and
the user approval gate remains explicit.

## Context

The architect created 17 new files, covering 12 MUS requirements and 12 matching
issue packets. Parent checks passed the documented Python validator, all local
links, all markdown trailing-whitespace checks and git diff --check.
Approved_Brief.md is byte-identical to relocated planning commit a48f5d1.

Architect taskId:
node:delegated-task:command%3Amcp%3Adedd9718-f392-418c-a3ff-3b9259dec611%3Adelegate-task%3Awhatsapp-orch-20261014-015412-foundation-r1

No previous independent findings or unresolved review objections exist.
Remaining real-device questions are intentionally unresolved, not claims of
successful live tests.

## Definition Of Done

- Return ACCEPT or CHANGES REQUIRED.
- Only confirmed correctness/security defects or explicit approved requirement
  violations block acceptance. Do not expand scope through stylistic criticism,
  speculative cases, extra abstractions or future customer infrastructure.
- Every blocking finding names exact file/line evidence, the conflicting
  requirement or contract, and the smallest corrective action.
- Separately label nonblocking capability questions and optional observations.
- State exactly which checks you actually ran. Do not claim live verification.
- No edits, staged files, commits, external private data or nested agents.

## Expected Artifacts

A review result delivered to the parent with verdict, findings, verification
evidence and the next engineering-spike acceptance boundary. No files written.

## Constraints

Work in C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot only. Preserve the old app and unrelated CreativeOS work.
Do not design UI, connect WhatsApp, request secrets, make model calls or send
messages/read receipts. No Git write operations. No broad repo audit.

## Dependencies

Task 01 delivered the foundation and parent structural checks passed.

## Verification and review checkpoint

Run the documented structural validator. Trace draft approval and reaction
authorization through the actual documented contracts, not just matching words.
One focused pass is sufficient. Report uncertainty; do not invent deficiencies.

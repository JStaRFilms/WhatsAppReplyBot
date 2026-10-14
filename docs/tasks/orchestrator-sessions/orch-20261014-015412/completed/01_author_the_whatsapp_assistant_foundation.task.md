# Task 01: Author the WhatsApp assistant foundation

## 🔧 Agent Setup (DO THIS FIRST)

### Workflow to Follow

Takomi Architect persona, Vibe Genesis. This is requirements and technical
planning only. Do not design UI or implement product code.

### Prime Agent Context

1. `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot/docs/whatsapp-assistant/Approved_Brief.md`
2. `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot/docs/tasks/orchestrator-sessions/orch-20261014-015412/master_plan.md`
3. the injected engineering instructions and scoped conventional-commit discipline
4. Global engineering instructions already injected by the harness.

Verify your inherited working directory is C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot. Do not change checkout
or use the old JStarReplyBot as your working directory.

### Optional Skill / Context Overlays

| Overlay | Reason |
| --- | --- |
| unslop | Required plain-language documentation |
| vibe-genesis | Requirements, architecture, data/API contracts and handoff |

## Objective

Produce a buildable, internally consistent foundation for the approved personal
WhatsApp assistant. Separate the future product from the pre-design feasibility
spike and preserve the UI approval gate.

## Scope

Write only within `docs/whatsapp-assistant/`, except the Approved_Brief.md is
parent-owned and must not be changed. Create Project_Requirements.md,
Coding_Guidelines.md, Builder_Prompt.md, features/Assistant_Architecture.md,
issues/FR-XXX.md for every MUS requirement, and Verification_Plan.md.
Use a focused number of meaningful requirements, about 10 to 14 MUS features;
do not turn every acceptance check into its own feature. Future requirements
stay in the PRD without issue files.

Document:
- Expo/Windows Node/SQLite/OpenRouter boundaries and isolated prototype setup.
- Durable state, tables, identity aliases and authorship; owner takeover,
  latest-ten ranking, delegation expiry/limits, hard policy gates and stale drafts.
- API/event contracts for manual send, approvals, confirmed assistant actions,
  resume/pause acknowledgments and delivery outcomes. No screen/UI designs.
- Context budgets, source-linked memory, image/sticker/GIF limits, status reply
  vs broadcast, missing media fallback, reactions and their authorization.
- Data privacy, safe logs, excluded contacts, session storage, retention and
  disappearing/view-once media. An excluded contact's AI access is off.
- Live event/backfill separation, replay/reconnect, unknown send outcomes and
  limits of cancellation. Avoid claims of guaranteed exactly-once delivery.
- Offline feasibility acceptance, opted-in live read-only checks, and the point
  at which to ask the user before UI design.

## Context

The brief contains all approved product choices. They are requirements, not
suggestions to redesign. Use SQLite and lightweight local retrieval first.
Baileys remains a candidate until verified. The old app is reference only;
there is no need to re-scan its code. Research specific public API details only
when a claim needs verification. Do not fetch private data or secrets.

## Definition Of Done

- Every approved v1 feature appears in a testable MUS requirement and matching
  issue file; MUS and issue IDs align one-to-one.
- Future features are explicitly deferred.
- Schema and API contracts are concrete enough to implement without guessing
  who may send, how manual takeover pauses, or which message history is live.
- A delegated reaction cannot evade reply limits or no-reply modes.
- UI design is a user approval gate, not an automatically dispatched task.
- The verification plan names what offline tests can prove and what requires
  real-device evidence. No live capability is claimed as verified.
- All paths and code commands are scoped to this checkout.
- No implementation, mockup, UI design, credentials, private data or unrelated
  file changes. No commits by the child agent.

## Expected Artifacts

The named markdown files and MUS issues under docs/whatsapp-assistant/, plus a
short final report with FR counts, coverage, design-gate status and unresolved
capability questions.

## Constraints

Read Approved_Brief.md completely. Preserve the latest-ten semantics and explicit
mode precedence. No billing, catalogs, framework sprawl, vector-store requirement,
customer infrastructure or generalized plugin platform. Maintain a small bounded
model context. Never silently resume manual takeover. Apply automatic-action
rules equally to messages and reactions. Do not alter CreativeOS source,
dependencies or the old app. Do not stage, commit or push.

## Dependencies

Approved brief and parent-authored session plan are ready. No other child writes
are active.

## Verification and review checkpoint

Self-check FR-to-issue alignment and quote the exact validation command/result.
Report missing facts instead of inventing API guarantees. The parent will run
a focused independent review before accepting and committing the foundation.

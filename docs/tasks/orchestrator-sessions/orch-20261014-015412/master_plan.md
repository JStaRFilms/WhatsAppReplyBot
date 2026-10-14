# Orchestrator Master Plan

## Overview

- Session: orch-20261014-015412
- Product: personal WhatsApp assistant and messaging client
- Checkout: C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot
- Mission: build reliable owner-controlled messaging assistance without changing
  the old app or the existing CreativeOS application.
- Current phase: Genesis. UI/UX Design is explicitly gated by the user.

## Context Intake

The source of truth is `docs/whatsapp-assistant/Approved_Brief.md` and the
user's approvals in this T3 thread. The owner wants Expo, Windows-hosted Node,
SQLite, OpenRouter GPT-6 Luna, selected-contact automation, latest-ten drafts,
media-aware conversation, reactions and an assistant command conversation.

All work stays within this independent project checkout. Do not edit the old
JStarReplyBot or the parent CreativeOS repository. Its four unrelated egg-info
changes remain untouched. Preserve the project's existing Genesis placeholders.
Product docs belong in `docs/whatsapp-assistant/`; an isolated engineering
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

Design means UI/UX. Stop and notify the owner before any design task, mockup,
visual direction, screen layout or Expo UI. Build of the production application
follows approved design. Review is a focused acceptance pass, not an endless
cleanup loop.

## Task Table

| Task | Subtask | Role | Workflow | Dependency | Status |
| --- | --- | --- | --- | --- | --- |
| 01 | Author the scoped foundation and FR issue pack | architect | vibe-genesis | approved brief | pending |
| 02 | Review foundation against approved scope | reviewer | Genesis acceptance | 01 | planned |
| 03 | Validate durable permission and cancellation behavior offline | coder | Genesis technical feasibility | accepted foundation | planned |
| 04 | Validate WhatsApp normalization and prepare a read-only probe | coder | Genesis technical feasibility | accepted spike contracts | planned |
| 05 | Review prototype, record evidence and hand off | reviewer/orchestrator | Genesis acceptance | 03, 04 | planned |
| Gate | Request owner approval for UI/UX Design | orchestrator | Design gate | verified Genesis work | blocked until handoff |

Only task 01 is initialized now. Later packets will be authored with concrete
scope and acceptance before registration or launch. Tasks run sequentially when
they write to this checkout. Read-only review may run while the parent inspects,
but only one writer owns a file at a time.

## Progress Checklist

- [x] Capture approved product scope and operating choices.
- [x] Confirm checkout and inspect repository instructions.
- [x] Identify unrelated modified files and exclude them from commits.
- [ ] Author requirements, architecture, schemas and APIs.
- [ ] Verify MUS requirements and issues align one-to-one.
- [ ] Complete a focused foundation review.
- [ ] Commit reviewed foundation as a scoped batch.
- [ ] Prove local permission, cancellation and replay invariants offline.
- [ ] Document actual adapter capabilities and untested live behavior.
- [ ] Commit verified prototype changes in separate reviewable batches.
- [ ] Notify the user that UI design is next; wait for approval.

## Notes

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

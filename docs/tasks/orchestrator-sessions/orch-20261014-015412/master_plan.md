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
| B04 | Verify native device and live adapter | coder/reviewer | controlled verification | owner keys and device | blocked, native ANR and live integration unfinished |
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

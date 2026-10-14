# Builder handoff

## Current authorization

Work in the independent WhatsAppReplyBot repository, never the old app or the
parent CreativeOS checkout. Read Approved_Brief.md, Project_Requirements.md,
Coding_Guidelines.md, features/Assistant_Architecture.md, Verification_Plan.md
and the relevant FR issues before implementation.

The owner now authorizes Paper UI/UX design and offline implementation without
further questions while unavailable. No API keys or device tests are available.
No live WhatsApp connection, read receipts, real send, paid model request or
deployment is permitted. Do not enable live behavior from ambient credentials.

The existing T3 chat is still parent-project-bound. Run file/Git/package commands
with this project's explicit working directory. Do not launch a child inheriting
the wrong root. Direct work is appropriate until workspace-bound delegation is
available; record execution evidence in this session's markdown.

## Implementation boundaries

Use a project-local pnpm workspace with a strict TypeScript shared core, Windows
Node/SQLite backend and Expo mobile client. No Python dependencies, vector store,
licensing server, product catalog or agent swarm. Use Node 24 for node:sqlite.
Keep reusable policy out of the client; the backend owns permissions and outbox.

The first runnable app uses invented demo conversations and a fake model and
transport. Show a persistent demo label and distinguish simulated delivery from
WhatsApp receipts. No real-account pairing is part of this build. Implement live
provider code only behind an explicit disabled boundary, validate its contract
with mock HTTP responses, and never call it in this session.

## Invariants

- Excluded and never-reply contacts never enter AI drafts, memory or prompts.
  Owner manual messaging remains available.
- Explicit modes are removed before choosing the latest ten unconfigured direct
  chats. Ranking uses human activity, not assistant output. Defaults draft only.
- Persist versions, dedupe, outbox intent and manual control. Stale model results,
  approvals and dispatches cannot send. No automatic resumption after takeover.
- Owner commands propose actions; confirm exact targets and versions before
  sending or changing permissions. Incoming contact content cannot grant access.
- Bound grants by one conversation, expiry and twenty outbound units at most.
  Reactions and split bubbles count; unknown results retain reservations.
- Retain uncertain handoffs and never blindly retry them after restart.
- Build bounded same-account/contact context with source-linked memory and
  verified owner style examples. Missing media/status context stays missing.
- Keep history/backfill distinct from live triggers. Review history read-only.
- Preserve GIF/sticker/image display and context boundaries without adding media
  generation, scheduling, birthdays, calendar writes or commercial features.

## Verification and commits

Run focused tests, strict type checks and a web export of the Expo client. Use a
browser for interaction checks when available. Report which tests actually ran;
a synthetic fixture never proves a WhatsApp capability. Native-phone checks are
pending until the owner can test.

Use small conventional commits for foundation, design, core, backend and client
slices. Stage exact paths, inspect the staged diff, and preserve all unrelated
repositories. Keep secrets, runtime databases and session state ignored.

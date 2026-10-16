# Task 51: Trace post-release PC unresponsiveness

## Agent setup

### Workflow to follow
Build-stage diagnosis only. Persona: architect. Route: Takomi, openai-codex/gpt-6.1-sol, high thinking. Read-only repository investigation, no product edits. This extends the existing completed release session rather than restarting Genesis or reopening old release evidence.

### Prime agent context
Working checkout: `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`. The delegation tool starts elsewhere, so every command must explicitly use this absolute checkout. Read `docs/features/Release_0.1.3_Handoff.md`, this packet, and the relevant public source/tests. Start with `scripts/start-otherme.mjs`, `scripts/launcher-service.mjs`, `services/backend/src/index.ts`, `launcher-startup.ts`, `server.ts`, `whatsapp.ts`, and `packages/core/src/store.ts` and `workflow.ts`.

### Optional overlays
Apply unslop to the written findings. No other skill is required.

## Objective
Explain the code paths that could produce the owner's simultaneous service-identity failures, unacknowledged graceful stop and browser connecting-to-PC loop. Return a demonstrated source defect or a precise boundary on what source-only inspection can establish.

## Scope
- Inspect launcher ownership, direct fork/IPC and shutdown acknowledgments, token lifecycle and service identity.
- Inspect whether restored pairing/history, recurring snapshot/timer work or promise-only event processing can starve HTTP and IPC at realistic synthetic history/contact sizes.
- Compare release changes against `399cc99` where useful. Distinguish regressions from older limitations and hypotheses from demonstrated defects.
- Examine existing focused tests and propose the smallest failing-before regression and correction.
- If needed, use invented fixtures, temporary SQLite, fake sockets/models and ephemeral localhost ports only. In-memory scripts and tool-managed temporary files are allowed for isolated experiments. Do not add repository files in this research pass.

## Context
Release 0.1.3/code4 was accepted with465 tests, types,108 fake-network browser assertions and verified artifacts. The owner now reports the old running version stopped easily, but after launching the new version the console repeatedly printed `Service identity check failed. Nothing was stopped.` Q then printed `Backend exit timed out while waiting for stop acknowledgement. Nothing was forcibly stopped.` and `Backend exit was not verified. Launcher lock retained.` D could open the browser, which looped on connecting to the PC even after entering a service token. The owner explicitly clarified that they deleted `launcher.lock`, not a log. Removing the lock did not prove the child exited. Current actual process/account state is unknown.

Source inspection already established: index.ts creates `.runtime/owner-token.txt` only if absent, then reads it. The launcher re-reads that file. Deleting launcher.lock alone does not rotate the token. The launcher directly forks index.ts through tsx with IPC. Backend manageServer registers IPC before listen. `stop acknowledgement` means no matching shutdown phase was observed, not proven waiting on transport drain. Authentication mismatch alone should not prevent the independent owned-child IPC gate from acknowledging. A blocked event loop is one hypothesis, not an accepted diagnosis. History set iterates contact mappings synchronously, then awaits receive per message without an explicit I/O yield. Look for expensive repeated group/history projections too. Do not anchor exclusively on this hypothesis.

## Definition of done
- Return exact file/line references and at least one synthetic repro if a defect is asserted.
- Explain whether the demonstrated path accounts for HTTP failure, IPC failure, or only one symptom.
- Give a narrowly scoped fix recommendation and regression design, not an unrequested framework/refactor.
- Identify any minimal redacted observation or explicit authorization needed to diagnose the owner's actual running instance.
- Do not claim source-only evidence proves the actual incident cause.

## Expected artifacts
A final task report containing source findings, synthetic commands/results, limitations and proposed next action. The parent will persist the report and own any later task packet, source integration and review.

## Constraints
No actual `.env`, owner token, signing credentials, WhatsApp auth, profile databases, private message/media, billing or general `.runtime` reads. Public task/release documentation is allowed. Do not launch real backend index.ts or the real launcher, contact WhatsApp/OpenRouter, send anything, restart/probe existing ports3210/8081/8083, inspect unrelated processes, install tools or download anything. Do not rotate credentials, delete locks, repair accounts, change scopes, force-stop anything or touch `C:/Otherme-build` and release artifacts. No commits, staging, pushing, nested agents or tracking edits. Preserve no-AI/consent/privacy/alias identity, unknown sends and paid-attempt holds.

## Dependencies and verification
Depends on completed release33 and the new owner report, not on re-running the prior release round. Parent independently checks any claimed reproduction before approving an implementation packet. No second generic review of the old release.

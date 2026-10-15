# Launcher lifecycle, explicit PC QR and browser hosting

## Agent setup

Persona: coder, Takomi Sol High. Stage: Build of the owner-approved plan.
Canonical root: C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot. All commands explicitly cd there or use absolute paths.
Read docs/features/Daily_Use_Batch_1_Contract.md, Daily_Use_UX_and_Continuity_Plan.md,
Coding_Guidelines.md, selected design/state handoffs and current source/types/tests.
Use unslop for human-facing copy. Do not modify code before understanding its path.

## Objective

Reproduce early-stop/slow-start/drain issues before fixing. Retain ownership/unknown accounting. Implement explicit scoped Link-to-PC QR intent/ack/dedup via existing IPC with P fallback. Add secure static production browser serving and D launcher action, same service, no Metro in daily use.

## Scope and ownership

scripts/start-otherme.mjs, launcher-service.mjs, new focused scripts/helpers/tests, services/backend/src/index.ts/server.ts/launcher-startup.ts, minimal core API metadata if needed, root package scripts. Only this slice owns these files while parallel work runs. Do not edit
other slices, docs or release version files. New helpers/tests only when cohesive.
No git commit/stage/push; parent integrates and commits reasonable chunks.

## Definition of done

Disposable fake lifecycle and temporary static-asset tests prove clean/abnormal/early stop, blocked drain, scope/nonce isolation, no duplicate connect/popup, QR cleanup and public-only static routes/traversal rejection. Backend/packaging/types pass. Record finalized capability/pcDisplay contract and desktop build command. Do not build final web assets or run real launcher.

## Expected artifacts

Narrow owned source/test diff, focused test evidence and final handoff with paths,
interface changes, any blockers and unverified owner-device behavior. No private
runtime evidence, credentials or content copied into tests/logs.

## Constraints

The shared contract is authoritative. No live API/services/accounts/model/phone
operations, actual recording/sending, private DB/auth/key reads, SDK/dependency
installs or outside-project writes. Normal test-managed temporary/cache files are
allowed; use isolated ports and synthetic IDs. Preserve unrelated/concurrent work.
Do not retry blocked/cancelled launches or force recovery. No broad cleanup.

## Dependencies and review

28/29/30 may run in parallel with this exclusive ownership. Contract changes in29
must be reported before frontend integration; 30 consumes optional fields safely.
31 visual integration follows owned functional changes. One focused parent review
checks confirmed correctness/security/requirement blockers, then source freeze and
one desktop/APK release. Do not claim success from mocks as hardware proof.

## Execution

Running as a T3-owned task with Takomi Sol High.
Task ID: `node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-launcher-desktop-batch1-20261015-r1`.
Source implementation accepted after parent validation. Parent reran70 backend
tests,29 packaging tests, backend/core typechecks and all four changed launcher/
build-helper syntax checks successfully. No live runtime, account, service, viewer,
phone, recording or send was used.

Parent confirmed and repaired one security regression before accepting the source.
The new public-static exemption used a raw API-prefix test, while Fastify's router
decodes literal segments. Encoded API GET/HEAD could therefore bypass auth and
profile guards. The exemption now checks the matched route as well. A regression
failed before the fix and passes after it, including missing/stale scope and
unchanged access to the public root. Final integrated review must retain it.

Final contract: GET /v1/session?capabilities=1 opts into optional pcQrDisplay and
desktopBrowser metadata; plain discovery remains byte-shape compatible with strict
older clients. The parent integrated the client query and additive core DTOs in
9da586d. Optional displayOnPc/pcDisplay and nonce-bound IPC match the contract.
Browser export is pnpm desktop:build through mobile-node, output apps/mobile/dist;
D opens the token-free loopback root after a verified identity/capability read.

Synthetic evidence covers retained early-stop intent, blocked drain reporting and
idle keep-alive shutdown. The original intermittent owner incident remains
unreproduced. Physical Windows viewer/browser and phone acceptance remain pending.
External rendered QR pixels cannot be revoked by deleting their source file;
OS-locked cleanup failures report manual cleanup. Production export remains33's
work after31 and32. No release version, keys or actual APK were changed.

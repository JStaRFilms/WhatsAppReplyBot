# Task 54: Correct LAN browser setup and public asset delivery

## Agent setup
Build stage, coder persona, Takomi openai-codex/gpt-6.1-sol high. Required capability write-code. Every command must explicitly use `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`. Apply unslop to the handoff. Read this packet, current relevant source/tests and `docs/issues/PC_Connection_and_Shutdown_0.1.3.md` first.

## Objective
Correct the independently confirmed browser delivery/setup defects without confusing them with task53's current backend freeze. The owner reports a misleading pnpm instruction at the LAN URL and both desktop/native failures. No new approval polling for routine work.

## Scope and evidence
You own only `services/backend/src/index.ts`, `services/backend/src/desktop.ts`, `apps/mobile/lib/api.ts` and focused new/existing tests for those paths. Task53 concurrently owns core store/workflow and server.ts. Do NOT edit its files or build anything while it works.

1. The frozen browser is at a LAN origin with no saved token and shows `Local connection failed. Start pnpm backend on this computer, or enter its service token.` The error comes from ApiClient.provision. Loopback-only automatic token provisioning is intentional and must remain so. Make blank-token LAN setup give direct service-token guidance, not a developer command, and bound any actual provisioning request. Preserve explicit profile Continue and saved credentials; no automatic account binding or mutation retry. Do not require new protocol/native dependencies.
2. index.ts currently allows private LAN origins only on legacy Metro8081, not the actual hosted browser3210. Allow exact configured local adapter browser origins at3210 while retaining8081 compatibility. Do not use a wildcard, trust arbitrary Host/Origin, allow unconfigured addresses or disclose owner token to LAN clients. All protected requests still require the owner token and scoped headers. Loopback token provisioning remains unavailable to every LAN request even if its browser Origin is approved.
3. Actual desktop.ts rejects exported Inter fonts under `/assets/__node_modules/.pnpm/...` because every dot-prefixed segment is blocked. Parent's actual built-browser test recorded four font404s per load. Restore only the known public export namespace needed for legitimate fonts/images. Do not broadly expose hidden files, source, metadata, dependencies, env, runtime, symlinks, traversal or encoded API prefixes. This restores approved existing Inter styling, not a new design, logo or icon. No downloads.

## Completion criteria
- Add focused failing-before tests for LAN setup guidance/request bounds, authenticated LAN browser Origin behavior and continued remote provisioning denial.
- Add route tests for legitimate exported public .pnpm assets and unchanged traversal/private/encoded API/symlink protections. Prefer existing public assets or invented fixtures; no real account files.
- Keep source changes small and typed. No generic origin/config framework or retry machinery.
- Run relevant backend/mobile tests and types. Existing scope/auth/desktop tests must pass.
- Return exact paths, original/corrected test results and `.runtime/pc-task54/handoff.md`. Parent independently checks original-source behavior, integrates with53, builds/validates browser assets and owns any later APK/release decision.

## Constraints and dependencies
Use fake models/transports, invented credentials, temporary fixtures and ephemeral listeners only. No actual token/env/auth/profile DB/chat/media/runtime reads or live3210/8081/8083 probes, restarts, account operations, sends, paid calls, data cleanup, locks, force-kills, downloads, versions, Android build-copy/APK changes, commits/staging/push, nested agents or tracking edits. No actual index.ts/launcher startup. Source53 is independent; preserve its work. Only your new `.runtime/pc-task54/` artifacts may be read. Fixing this setup path alone must not be claimed to resolve task53 or the owner's actual phone refresh failure.

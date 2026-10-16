# PC connection and shutdown report after 0.1.3

## Owner report

The previous running version stopped through Q. After starting the updated version, the launcher repeatedly printed `Service identity check failed. Nothing was stopped.` Q then printed `Backend exit timed out while waiting for stop acknowledgement. Nothing was forcibly stopped.` and `Backend exit was not verified. Launcher lock retained.` The browser opened through D but appeared to loop on connecting to the PC, including after a service token was entered.

The owner clarified that the deleted file was `launcher.lock`, not a log. This removes an ownership guard. It does not stop a child or prove the port is free. The screenshot does not establish an authentication failure or which request/phase failed. No cause for the actual shutdown incident is accepted yet.

## Token lifecycle confirmed from source

`services/backend/src/index.ts` creates `.runtime/owner-token.txt` only when absent and otherwise reuses it. `scripts/start-otherme.mjs` reads that same file. Deleting launcher.lock alone does not rotate the token. The release did not intentionally rotate it. No token was reset, changed, displayed or included in this report.

## Narrow read-only observation

The owner expressly approved three local GET checks using the existing owner token privately. No other live reads or operations were authorized by that approval. The parent made these requests only to `http://127.0.0.1:3210`, with bounded3500ms deadlines and redacted output:

| Check | Result | Time |
| --- | --- | --- |
| `/v1/health` | HTTP200, ready live service, WhatsApp disconnected |31ms |
| `/v1/launcher` | HTTP200, Otherme protocol2, canonical root matched, instance and profile scope present |29ms |
| `/v1/session?capabilities=1&historyMedia=1` | HTTP200, protocol2 and scope present, desktop browser/history paging supported, transition completed |29ms |

This confirms that the saved project token was accepted and that these endpoints were responsive at the observation time. It does not prove the earlier process was responsive, that an earlier launcher still owns this instance, that the browser uses the same origin/token, that snapshot retrieval succeeds, or why the earlier Q received no stop-phase acknowledgment. WhatsApp connectivity and PC authentication are separate states.

The checks read no conversations, profile databases, account auth files, messages or media. They did not restart anything, link WhatsApp, generate AI, send a message, remove a lock or force-stop a process. Token bytes remained inside the diagnostic subprocess and were never returned to the agent.

## Current investigation

Task51 completed with a controlled reproduction of history-batch event-loop starvation. A real adapter history callback, fake socket, in-memory SQLite, actual app/lifecycle and owned synthetic subprocess reproduced both HTTP identity timeout at2507ms and stop acknowledgment timeout at15003ms. The500-message batch over1000 invented stored messages finished at27625ms, after which queued I/O and shutdown phases ran and the child exited0 normally. This is a demonstrated source defect, not proof of the owner's historical incident cause.

A separate100-conversation/1000-message-per-conversation synthetic snapshot took9625ms. The research query-only experiment forcing the existing paging index reduced a10000-message last-message query28.53ms to0.35ms with identical output. Those are diagnostic observations, not a validated patch or release thresholds.

The parent independently ran `.runtime/pc-task51/parent-source-repro.mjs` on unchanged7301e4b. A100-message direct awaited receive loop over1000 invented messages took3853ms and starved queued I/O until completion. The member history query selected messages_conversation rather than message_paging and sorted before limiting. This diagnostic calls receive directly. A correction that yields in the outer listener must be verified through the actual-listener test, not incorrectly assessed using the direct loop.

The owner's subsequent screenshot shows127.0.0.1:3210/settings, a discovered Second account/completed transition, refresh failure and connecting feedback, but no loaded snapshot. Discovery succeeded at least once. The later snapshot/refresh stage remains implicated, not independently observed live. No actual snapshot/chat read is authorized.

Task52 scopes a narrow cooperative-yield and existing-index correction, with original-source red/green tests and fake HTTP/IPC validation. No timeout extension, guard removal, token reset, automatic replay, mobile/icon change or APK rebuild is authorized by that task. The owner subsequently approved a second, status-only diagnostic. Session metadata returned200 in18ms, a scoped HEAD /v1/snapshot timed out after12249ms without returning a chat body, and the public health check started200ms into that request also timed out after3519ms. This directly observes current snapshot-related service unresponsiveness, but does not retroactively prove the earlier shutdown cause or isolate the exact SQL statement on the real instance.

The owner then explicitly directed the agent to stop asking approval questions for routine testing and fixes, stating this is a test application and the data is not sensitive for this investigation. Proceed autonomously with necessary, narrow app diagnostics and compatible corrections. Do not repeatedly ask for metadata/status checks. Keep credentials out of outputs and avoid unnecessary private content even though the owner has removed routine privacy gates. This instruction does not require or justify unrelated system changes, paid calls, real sends, account relinking, destructive data cleanup, blind retries or force-killing unverified processes. Preserve exact target verification and unknown-outcome safety. No live mutation has occurred yet.

## Accepted source correction

Task52 is accepted after one focused parent review and independent verification. History/contact/message batching now yields real I/O after32 items or8ms at an item boundary, with current socket, verified socket, generation, stopped and sealed checks. Limited history member reads use the existing message_paging index. No schema, new cache, timeout change, weakened identity guard or automatic replay was introduced.

The parent's final19 regressions fail17/19 on original7301e4b source and pass19/19 on corrected source. Full serialized verification passes96 core,130 backend,224 mobile and34 packaging tests,484 total, with all workspace typechecks. An initial223/224 mobile run exposed a stale0.1.2/code3 assertion despite the existing0.1.3/code4 app configuration. Only that expected version/code was corrected; the original failure log is retained. No native version or application UI changed.

Independent fake HTTP/IPC acceptance: identity48ms, shutdown gate after10/500 history messages, normal stop42ms and child exit0. A query-only synthetic100000-message snapshot comparison improved7196.708ms to1465.336ms with identical output. These are controlled observations, not real-device thresholds.

The existing built desktop client, served by actual corrected createApp with200000 invented messages across100 conversations, reached authenticated/online/fresh state in3204ms, rendered inbox rows and restored after reload. All8 app API responses were200, with no external requests, mutations, device calls or page errors. Report: `.runtime/pc-task52/parent-acceptance.md`.

## Remaining operational step and separate finding

At the task52 handoff, the running backend had not been restarted and still had the old code in memory. Close Otherme clients first to stop repeated slow reads, let outstanding work drain, use Q for a verified shutdown, then relaunch the canonical Otherme.cmd. No new APK installation or desktop rebuild is needed for this backend-only correction. An unverified stop is not permission to delete the lock or force-kill a process. No token reset, data cleanup or relinking is needed for this correction.

The actual static desktop route rejects all four exported Inter font URLs beneath assets/__node_modules/.pnpm. Parent browser validation recorded four404s per load, matching the fallback serif appearance in the owner's screenshot. This separate existing font-serving issue does not prevent the now-successful synthetic PC connection and was reported without expanding the connection/shutdown patch. Do not claim an asset-error-free browser run. Actual owner restart and device acceptance had not yet been performed at that handoff.

## Continued failure after52

The owner now reports desktop and phone initially showing connected, then refresh failures, followed by neither address loading reliably. The new screenshot uses192.168.100.5:3210 with no saved browser token and the misleading client fallback `Start pnpm backend on this computer`. They explicitly reject further address-swapping as a diagnostic loop. Do not frame this as the owner's setup error or ask more routine approval questions.

The listener on3210 was identified as a Node process started2026-10-16T03:22:24.847Z, aftercae2642 was committed03:18:39Z. Fresh authenticated loopback session and LAN health requests each timed out after4seconds. Do not simply assume the owner omitted the restart or that LAN provisioning explains both clients failing. The earlier correction fixed demonstrated defects but did not resolve the live incident.

Under the owner's explicit routine-testing authorization, the parent opened only the selected profile SQLite file in read-only mode and derived aggregate counts, with no message/contact names, identifiers, auth or token values returned. Shape:3437 conversations,3115 aliases,1657 messages across345 conversations, maximum275 per conversation,135 outboxes,166 drafts, and zero duplicate transport IDs. No database writes or data deletion occurred. The prior dense100-conversation benchmark did not represent this sparse many-contact shape.

Task53 now reproduces and corrects this remaining snapshot/startup path using invented fixtures at the observed scale. Core store/workflow/server ownership is exclusive to that worker. Parent performs live diagnostics and independent acceptance. No deleting legacy contact-only rows, truncating legitimate state, new authority cache, larger timeout or blind restart workaround.

Task54 independently corrects the false developer-command guidance, configured LAN browser3210 Origin support and the known public .pnpm font asset rejection. Its separate index/desktop/api source ownership does not overlap53. Automatic token disclosure remains loopback-only; all LAN protected actions still require token and profile scope. A LAN browser has separate origin storage, but this is a distinct setup issue, not an explanation for the current loopback/native hang. Parent integrates and validates both, without claiming fake evidence alone fixes the actual running service.

## Combined correction and current rollout boundary

Task53 reproduced an uncapped sparse snapshot at125154ms with2371131 SQL preparations. Read-local bulk/group reuse reduced it to645ms/2696 preparations with byte-identical sparse and dense outputs. Parent original-source regressions fail3/3, corrected4/4 pass. The parent's disposable offline backup of the selected actual profile returned200 in2422ms, retaining3437 physical conversations,166 drafts and135 outboxes. Its344 logical latest messages/3435 groups reflect verified aliases, not dropped physical records. The original connection was read-only, no listener/provider/socket started, and the temporary copy was removed.

Normal settings integration additionally found saved-name enablement exceeding11seconds and an index-only consent repeat at10.4seconds. Parent added the derived account/canonical/alias covering index and replaced the two global consent/instruction group rewalks with physical invalidation, since their account-wide list already includes all aliases. Four new plan/upgrade/physical-once regressions fail before and pass after. No mapping data, policy veto, unknown manual work or grant accounting is discarded. See `docs/features/PC_Refresh_Performance.md`.

Final serialized parent suites pass101 core,141 backend,230 mobile and34 packaging tests,506 total, plus all workspace typechecks. Actual owned fake sparse lifecycle returned metadata at514ms, snapshot517ms and graceful stop496ms/exit0. The fresh production web export passed private-path/credential-byte scans,28 files/5227143bytes. Thirteen actual browser assertions passed using the sparse fixture, including explicit profile Continue, loopback setup, saved-token reload, LAN token guidance, authenticated LAN settings writes, instructions/consent/names toggles, foreground recovery and all four fonts. No provider, device, external, page or asset error occurred. This is not native hardware acceptance.

The new desktop output is promoted to `apps/mobile/dist`, byte-verified against the accepted preview. The prior28-file/5226702-byte desktop output is retained at `.runtime/pc-task55/previous-desktop-1792124977744`. The APK is not rebuilt or replaced; installed native wording remains its old compiled text. Backend fixes do not require an APK reinstall, IP/token changes or account relinking.

A final read-only check of the current actual service still accepts the saved token and matches the canonical root/protocol2. Health/launcher/session returned200 in86/13/80ms, but the scoped HEAD snapshot timed out at8007ms. The selected actual database does not yet have the new canonical index, confirming the new initialization has not been applied there. No live mutation, restart, index creation, send or model call was performed by the parent. The old service still needs a normal stop and canonical relaunch after current work drains. Do not mistake promoted web files or passing offline tests for that rollout. If the owning console is not safely controllable by the agent, the owner must use its normal Q control; no debugger, parallel backend, blind PID kill or lock deletion is a substitute.

# Task39: Validate the extended browser UI in isolation

## Agent setup

Persona worker, Build validation, read-only product source. Required capability is
write-code only for ignored synthetic harness/artifacts. Canonical root:
C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot.
Every command explicitly cd there or use absolute paths. Use unslop. Read37/38,
Release_Extension_Implementation_Plan, actual new mobile source/types and the
existing synthetic `.runtime/ui-task31/verify.cjs` before tests. Do not launch agents.

## Objective and scope

Create a preview-only export and reproducible isolated browser tests of the new
pending send/draft feedback, receipt status and owner/name settings, retaining
selected narrow/wide dark/light layout. No product, package, test-source, version,
doc or final production build changes. Parent freezes the current source first.
Write harness/results/screenshots only under ignored `.runtime/ui-task37/`.

Reuse installed Node/pnpm/Playwright and headless Edge. No browser/tool installs.
Export with the existing credential-isolating mobile-node wrapper and public
EXPO_PUBLIC_DESKTOP=1 to `.runtime/ui-task37/web`, never apps/mobile/dist. Treat all
server/provider/signing/owner secrets as inaccessible; no .env/actual runtime reads.

## Synthetic fixtures and checks

Serve only preview assets from a temporary loopback port listen(0), excluding
3210/8081/8083. Use fresh browser storage, invented profile/account/phone IDs and
names, fake token, no real cookies. Intercept every API request; outside origins
must be blocked. Never fall through to an actual backend. Track unexpected calls
as failures. Read only documented synthetic ui-task31 artifacts if reusing them.

- Check320/360/390 and1280 browser widths, dark/light, large text and system theme
where relevant. Inputs and primary controls remain reachable with no body overflow,
console/page errors or duplicated conversation/provider. Keep input identity/local
text across responsive resizing and source-anchored draft layout.
- Defer a synthetic manual-send response. Press Send and verify immediate local
pending feedback, composition becomes available, newer text and quote can be
prepared, history remains interactive. Fulfill accepted evidence while holding
snapshot refresh; do not show false failed/delivered/read or erase newer work.
- Simulate an unacknowledged send and verify uncertainty is visible with no blind
retry or automatic successor submission. Reopen/reload with pending journal and
prove reads only, no resumed POST. Keep these scenarios bounded and deterministic.
- Draft reply shows immediate Drafting feedback and typed success/View, with slow
snapshot independent. Cover silence/handover and error/unconfirmed feedback where
practical. View locates the actual source card. Never call a model or auto-send.
- Render sent/delivered/read evidence and absent/simulated/unknown states. Verify
accessible labels and no tick inferred from plain acceptance; no WhatsApp read API.
- New settings use opt-in capability flags. Test owner instructions explicit save,
conflict preserving unsaved text, and contact-name toggle/read-only import status.
The browser never reads contacts or claims native sync; never call permission APIs.
- Keep local image preview/removal without upload until explicit Send where useful.
Never access real microphone, camera, filesystem photos or contact data.

## Definition of done

Preview export and deterministic synthetic browser checks pass, or return exact
confirmed blockers/reproductions without editing product code or weakening valid
assertions. Screenshots show representative new states, not a massive redundant
matrix. State exact commands, counts/results and geometry findings. No claim of
native mic/keyboard/permission/contact/receipt or Windows service acceptance.
Close browser/server in finally; no persistent preview watchers or live services.

## Expected artifacts and handoff

`.runtime/ui-task37/verify.cjs`, structured results, selected screenshots and a
concise handoff naming source baseline/checks/limitations. Do not stage/commit,
read private runtime, install dependencies, change canonical tests/source, run
final desktop/APK export, manipulate services/viewers/devices or fix unrelated35.
38 waits for this evidence and parent validation;33 remains held.

## Execution

Pending, parent supplies source freeze commit and exact delegated ID at launch.

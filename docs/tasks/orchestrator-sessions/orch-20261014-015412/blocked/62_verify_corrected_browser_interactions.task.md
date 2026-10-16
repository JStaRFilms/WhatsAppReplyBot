# Task62: Verify the corrected browser with actual interactions

## Agent setup
Canonical Takomi worker, Build verification. Every command must explicitly cd to C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot. This is a child of parent integration61, not a new project or review round.
Read docs/features/Messaging_Corrections_0.1.4.md, .runtime/ui-task60/review.md, .runtime/ui-task61/parent-integration.md and all56-59 handoffs including58/r2. Load unslop and unslop-gpt-ui/examples for interpreting copy, not to edit it.
Prime runner: .runtime/ui-task44/fix50/verify-browser.cjs plus its probe/storage/media fixture helpers; .runtime/pc-task55/build-preview.mjs shows isolated production-export override. Follow existing Playwright1.64/owned Edge patterns. Do not touch old artifacts.

## Objective
Verify the owner's reported corrections in a freshly exported0.1.4 browser client, including real viewport behavior and network races, not only source/mock assertions.

## Scope
Write only under .runtime/ui-task62/. Build a fresh production desktop export there using scripts/build-desktop.mjs with its run override to change output-dir. Do not promote dist. Copy/adapt the old runner and synthetic media/probes to new paths and fix their relative imports/candidate/output locations. Use public source/fixture modules read-only. Parent will freeze source hashes before dispatch. Verify .runtime/releases/Otherme-0.1.4-inputs.json before/after; do not edit any public source, tests, version, lock, tracking, docs or approved native copy.
The previous runner has obsolete copy/manual-newer assertions and a text-only makeOutbox fixture. Update fixture behavior for actual reaction/audio/image components and new icons, while retaining meaningful assertions, no fake success.
No nested agents.

## Required coverage
- Narrow390px and wide1280px real browser screens, dark/light selected UI, status icons beside timestamp with stable ordinary bounds, truthful clock/sent/delivered/read and genuine unknown/failed warning behavior. Status details are browser dialogs; handle them deliberately without blocking the run.
- Warm known-tail Latest moves the actual visible viewport before a held GET resolves; same-height replacement race; cold missing tail remains honest. Old/around reads cannot beat latest intent.
- Newer loads near the actual visible end without a manual Load newer button, one bounded request per cursor and no errors/unchanged-cursor loop.
- Actual reaction picker gesture paints target feedback before a held manual-send result, without extra pending chat bubble. Verify accepted target observation, failure rollback, unknown/no replay, newer gesture, later owner removal and profile/scope isolation. Count fake POSTs, not merely emoji text.
- Pending text/photo/voice body appears once with recognizable bounded placeholders, exact scoped echoes replace only matching components. Existing input node/focus/text/quote and newer composition remain while sends/reads wait.
- Known draft body/editor shows before held source read, stays editable, source/revision send/save gates remain, arriving source/conflict preserves edits. No cached-authority/routine transport paragraphs.
- Actual photo/sticker/video open/Close/Escape, loading/error/revocation/background, lease/byte validation and shared audio exclusion using invented media. Voice playback where fixtures permit. Browser does not certify Android codecs/picker/recording.
- Keep the synchronous exact actually-visible inbound-ID comparison at each viewed POST. No invisible/unseen/window-bottom shortcut, no source visibility during overlay/background/stale geometry. Ordinary anchor/editor/resize drift must remain within existing meaningful tolerances.
- Settings/provider mention only where relevant to consent, categories/costs explicit before Enable AI, absent status not Local preview. Browser cannot read native contacts.
- Recording-incapable browser has the existing Choose audio file action instead of permanent HTTPS paragraph. Do not open a real camera/mic/contact/gallery/permission prompt; capability/source fixtures may establish the state, but clearly label any simulated picker evidence.

## Safety and stopping
Invented accounts/messages/media/token only. Own fake ephemeral localhost servers/contexts and close them in finally. Never real3210/8081/8083, actual service/private DB/env/auth/media, account/link/send/model/provider/payment/device API, source/build-copy/native operation, stage/commit/push or dependency install.
Register held routes before checking held-state behavior, retain bounded waits and distinguish fixture races from product defects. No timeout increases, weakened geometry/privacy checks, endless retries or arbitrary CSS-height stress counted as ordinary acceptance. If a product regression is demonstrated, preserve the failure and report precise repro/evidence; do not patch the app. Preserve every earlier failed artifact and use unique output directories per attempt.

## Definition of done
Fresh candidate export and meaningful independent browser interactions pass with screenshots, actual row/editor/status bounds, exact viewed sets, POST counts and zero unexpected external/device/provider/unintended mutations/page/asset errors. Verify source manifest unchanged, all owned processes closed, and do not label old baseline checks as current. If blocked, give exact failures and remaining coverage, never a partial-green release claim.

## Expected artifacts and handoff
.runtime/ui-task62/web, uniquely named runners/results/screenshots/logs, and .runtime/ui-task62/handoff.md summarizing command/results, independent checks versus deliberate repeats, source/fixture changes, failure attribution and browser/native/provider limits. Parent owns private-byte scan, source integration, native build, promotion and acceptance.

## Dependencies
60 source review accepted. Parent61 supplied0.1.4/code5 and freeze manifest. No artifact/real-provider/physical acceptance follows from source review alone.

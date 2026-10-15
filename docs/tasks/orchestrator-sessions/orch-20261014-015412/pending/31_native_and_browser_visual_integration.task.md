# Apply the selected native and browser UI

## Agent setup

Persona coder, Takomi Sol High. Stage Build, after functional slices28/30 and
backend contract29 are integrated. Canonical root: C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot.
Read Daily_Use_Batch_1_Contract.md, Daily_Use_UX_and_Continuity_Plan.md, full
Otherme_UI_Brief.md / Otherme_UI_States.md and approved otherme-*.html boards.
Use frontend-ui building-native-ui and unslop. Do not invent another visual direction.

## Objective

Apply the approved charcoal/blue and light-theme WhatsApp-led whole-screen geometry
to Chats, Conversation, Review, Assistant, Settings and the requested wide browser
view. Retain all functional changes from28–30 and existing domain semantics.

## Scope and ownership

Own mobile visual/navigation/shared components after prior writers finish. Reuse
existing theme/primitives. Desktop-wide layout uses a real chat list/navigation
pane and actual selected conversation, not a screenshot or duplicate controllers.
Keep one scoped AppProvider/LocalDraftProvider; existing navigation, transcript,
source-anchored suggestions and true visible-unread logic remain authoritative.
Narrow native/browser views still work; no fake controls/data or new dependencies.
No backend/scripts/core mutation. Root release version is parent-owned.

## Definition of done

All five screens match the selected main direction at320/360/390 widths and wide
browser viewport, dark/light/system and large fonts. Use accessible touch targets,
labels and non-colour status. Safe-area and keyboard inset have one owner. Keep
keyboard through Send/scroll/quote and preserve mic/foreground/profile guards.
Source drafts, authorship, filter dots/avatar unread, media local preview, unknown
outcomes and permission acknowledgments cannot be replaced by simpler mockups.
No Unread filter, pin, receipt tick, unsupported call/status action or glass theme
merely because a study contains it. Settings setup/PC/profile/WhatsApp/AI states
must stay distinct and grouped, with explicit create/switch/link/relink paths.
Focused tests/types and synthetic browser screenshots/interactions pass. No actual
phone behavior claimed from web geometry. Parent reviews and owns scoped commits.

## Expected artifacts

Owned UI diff and focused tests; synthetic screenshot paths under ignored runtime;
exact checks, remaining hardware acceptance and any contract blockers in handoff.
No private data from real runtime/browser sessions in fixtures or screenshots.

## Dependencies and constraints

28/30 complete and29 contract known before launch. No competing writers. Tests
use disposable synthetic services/ports, not live3210/8081/8083. No real models,
recordings/sends, keys, account changes, source install/toolchain changes, desktop
terminal automation or image quota. No commit/stage/push. Preserve unrelated work.

## Review checkpoint

One focused integrated correctness/privacy review follows; repair confirmed
regressions, not speculative refactors. Then freeze source for desktop/APK build.

## Execution

Running after accepted28/30 source handoffs.
T3 task ID: `node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-visual-integration-batch1-20261015-r1`.
Provider takomi, model openai-codex/gpt-6.1-sol, thinking high, async implementation.
Client request ID: otherme-visual-integration-batch1-20261015-r1. Lifecycle commit dd49d77
and sync/profile commit9da586d are the functional baseline. Parent has
validated87 mobile tests, mobile types and60 core tests. Final backend29 source
is still owned by its active coder. Its public DTOs are now committed with30,
and its known session contract is `GET /v1/session?capabilities=1`. New client
consumption is already integrated, including404 and missing-metadata fallback.
Do not change those contracts or compete with backend/scripts/core work.

Parent found no physical reproduction of the mic issue. Keep its lifecycle tests
and candidate permission-query fix intact, and leave device acceptance explicit.
Do not touch app-state/api/voice-recorder logic for styling. If a confirmed
functional blocker requires those changes, report it to parent before editing.

Use only ignored project-local preview output for synthetic browser screenshots.
A preview export is allowed; final production desktop export and APK release are
reserved for33 after review. No Metro or server use on3210/8081/8083. No installs,
private runtime, live profile/WhatsApp actions, phone input, paid model/image calls
or source versions/signing changes. Commit/stage/push remain parent-only.

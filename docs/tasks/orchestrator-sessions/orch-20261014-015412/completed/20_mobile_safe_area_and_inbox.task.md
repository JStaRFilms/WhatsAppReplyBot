# Task20: Android system insets and real-chat inbox

## Completion

Parent integrated the approved fixes. The review's discovery-revision P1 was fixed
with a create/return regression. All 177 tests, typechecks and actual APK signature,
version, embedded-bundle and privacy checks passed for 0.1.1/code2. The original
0.1.0 and private release key are preserved. No live account switch was performed.
Owner updates the APK and restarts the launcher, then confirms the chosen profile.
QR/device verification remains an owner action. Unrelated designer/contact-memory
documents are preserved and excluded from the commit.


## Owner request

Screenshots show Samsung three-button system navigation covering tab labels. The
main Chats list also includes WhatsApp contact-sync entries with No messages even
when the owner never chatted with them. Fix these now, preserve contact discovery
through search. No broad UI redesign, contact deletion or account mixing.

## Scope and ownership

Mobile coder owns apps/mobile/app/(tabs)/_layout.tsx and index.tsx, chat-row.tsx if
required, and a focused new mobile test file. Can inspect root layout/safe-area
provider and helper patterns but coordinate before modifying any unowned code.
Account-switch Architect is read-only; subsequent coder will avoid these owned
files until this task returns. Do not edit backend/core, app-state/voice, manifests,
lockfile, docs, designer assets, signing data or runtime. No commits or live actions.

## Execution

Takomi Coder openai-codex/gpt-6-luna high:
node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-inbox-safearea-20261014-r1

## Implementation result

Coder returned scoped changes: safe bottom insets added to existing base tabbar,
normal inbox includes actual history or explicit local drafts, search still finds
contacts, and contact-only rows say Start conversation. Focused tests cover
36/16/0 insets, filtering and row labels. Mobile26tests and typecheck passed.
No physical-device rendering verification. Parent integrates into signed update.

## Behavior and done

Respect Android bottom safe-area inset in tabbar height/padding, retaining existing
base density without duplicate inset. Check three-button, gesture and zero-inset
cases. Normal empty-query Chats shows conversations with message history and
explicit owner local draft work, not every synced contact row. Existing filters
remain meaningful. Search can reveal matching contact-only entries to start a
conversation; label them honestly, not as nonexistent messages. Preserve source
contacts, exclusions and permissions; don't delete rows or change policy. Do not
hide real chats just because the latest message has empty text, media only or is
deleted. Use existing snapshot.lastMessages rather than full-history fetches.

Deliver narrow mobile changes plus focused synthetic render tests, relevant mobile
typecheck/tests. Report exactfiles/interfaces/checks and any real blocker. Parent
integrates once with account switch and builds signed update. Native screenshot
verification remains owner-device unless a controlled emulator is available.

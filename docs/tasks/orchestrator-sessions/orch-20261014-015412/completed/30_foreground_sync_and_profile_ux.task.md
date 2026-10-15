# Foreground resync and clear service/profile/linking flow

## Agent setup

Persona: coder, Takomi Sol High. Stage: Build of the owner-approved plan.
Canonical root: C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot. All commands explicitly cd there or use absolute paths.
Read docs/features/Daily_Use_Batch_1_Contract.md, Daily_Use_UX_and_Continuity_Plan.md,
Coding_Guidelines.md, selected design/state handoffs and current source/types/tests.
Use unslop for human-facing copy. Do not modify code before understanding its path.

## Objective

Immediately revalidate/read on foreground, bounded retry and deduplicated reads, keep valid cached/local data, separate authenticated PC state from accepted profile/WA/AI state. Connected button/status and saved token must be truthful. Simplify Create/Switch/Link/Relink flow, wire explicit desktop QR intent only when supported, respect external Continue and same-owner relink.

## Scope and ownership

apps/mobile/lib/app-state.tsx, lib/api.ts, components/profile-controls.tsx, whatsapp-connection.tsx, app/(tabs)/settings.tsx, components/ui.tsx, and focused tests. Only this slice owns these files while parallel work runs. Do not edit
other slices, docs or release version files. New helpers/tests only when cohesive.
No git commit/stage/push; parent integrates and commits reasonable chunks.

## Definition of done

Deferred tests cover resume with stale/out-of-order/aborted reads, read timeout recovery, auth failure, no mutation retry, cross-profile late response isolation, initial authenticated-but-not-accepted state and truthful connected labels. Profile create/switch/link/repair/QR and offline local drafts preserved. Desktop EXPO_PUBLIC_DESKTOP build selects window origin without changing native API default. Mobile tests/types pass.

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
Task ID: `node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-sync-profile-batch1-20261015-r1`.
Source handoff accepted for integration. Parent independently reran all87 mobile
tests and mobile typecheck successfully. Core60 tests also pass with the
transformation-enabled Node runner. A strip-only invocation rejected existing
TypeScript parameter properties before running the tests; that was a runner error,
not an application failure.

Parent found and fixed one concrete cross-slice contract mismatch. Backend29
requires `?capabilities=1` to preserve the exact legacy session response. The
client now opts in and still classifies session404 as upgrade-required. The new
regression failed before the fix and passes after it; it also covers a legacy
response without metadata. Additive core PcDisplay/discovery DTOs are committed
with this client dependency. Backend use of those DTOs remains owned by29.

Read recovery, cached-state labels, saved credentials, profile isolation and
confirmed create/switch/link/relink are covered synthetically. No live actions,
real credentials, phone or production ports were used. Hardware resume, pairing
and viewer behavior remain owner acceptance checks. Parent owns scoped commit.

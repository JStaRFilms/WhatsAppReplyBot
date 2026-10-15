# Account switching implementation plan

## Recommendation

Extend the existing launcher's fork/IPC lifecycle with a controlled backend restart. Keep each `createApp` bound to one immutable store, account and profile scope.

This is smaller and safer than hot-swapping captured dependencies. A verified child-process exit also gives same-owner repair a clear boundary after which the old socket cannot write credentials. No new daemon.

## Runtime and storage

All paths below are project-relative.

| Profile | Account ID | SQLite | Authentication |
|---|---|---|---|
| Original | `whatsapp-owner` | `.runtime/whatsapp.sqlite` | `.runtime/whatsapp-auth/` |
| New | `whatsapp-<uuid>` | `.runtime/profiles/<uuid>/whatsapp.sqlite` | `.runtime/profiles/<uuid>/whatsapp-auth/` |

Add `.runtime/profiles.json` containing:

- Schema version, active profile ID and monotonically increasing revision.
- Profile descriptors with immutable ID, account ID, owner-facing label and storage kind.
- A durable transition record with request ID, source scope, target, action, phase and result.

Derive paths from validated IDs. Never accept filesystem paths through the API.

Without a registry, resolve the original profile in place. Do not relocate its database/authentication, rewrite account IDs or copy private data automatically. Create the registry on the first confirmed lifecycle operation.

Use separate databases. Current tables have globally unique IDs, including conversation IDs. Sharing one database would require unnecessary schema migration to support overlapping JIDs.

Service token, signing configuration and model credentials remain service-owned. New profiles inherit no database content, uploads, aliases, grants, contact policies or model consent.

## Scope and API contract

Define:

```ts
type ProfileScope = {
  profileId: string;
  accountId: string;
  revision: number;
};
```

Require bearer authentication **and** these headers on every profile-bound route:

```text
X-Otherme-Profile: <profileId>
X-Otherme-Revision: <revision>
```

This includes snapshot, history, media, binary uploads, composer/viewed updates, consent, proposals, drafts, assistant and WhatsApp connection routes. Check scope before body processing or account access.

- Missing scope: `426 client_upgrade_required`.
- Mismatched scope: `409 profile_scope_changed`.
- Transition underway: `409 profile_transition_in_progress`.
- Never retry a rejected mutation using a freshly discovered scope.

Add authenticated, account-data-free discovery and operation status:

- `GET /v1/session`: current scope, label, protocol and transition status.
- `GET /v1/profile-operations/:requestId`: durable operation result.

Add minimal profile controls:

- `GET /v1/profiles`: preserved profile descriptors.
- `POST /v1/profile-transitions`: strict discriminated actions `create`, `activate`, `repair`, with `requestId`, `confirm:true` and current scope headers. Activation identifies an existing target; repair always targets the current profile.

Return `202` with the operation ID, not a claim that switching succeeded. Reusing an ID with identical input returns its recorded operation; conflicting input fails.

Include `profileScope` in snapshots and scope headers on account responses. Advance revision for lifecycle invalidation, including return to the original profile and repair. An A → B → A transition must invalidate the first A session.

Upgrade launcher identity to protocol 2. Retain root and instance verification; replace the hard-coded `whatsapp-owner` assertion with validated profile scope and expected transition result.

## Transition sequence

1. Confirm the source, destination and consequences in Settings. Provide “Use another number”, “Return to preserved profile” and “Repair this number”, not an account dashboard.
2. Atomically acquire the transition gate before checking active work. Block new account requests, socket ingestion and automatic scheduling.
3. **Refuse while a transport handoff is executing.** Return a clear busy result; do not classify an executing send as cancelled. Existing settled `unknown` outcomes may remain preserved.
4. Suspend the source transactionally:
   - Disable model consent.
   - Advance conversation workflow versions and stale pending drafts.
   - Cancel queued components from **all origins**, including owner-manual sends.
   - Release only cancelled reservations. Preserve accepted/unknown accounting and unresolved owner handovers.
   - Clear catch-up, typing/composer and timed-resume state; leave conversations paused.
5. Clear reply windows and presence, invalidate generation guards, disable reconnect and stop the socket. Drain pending starts, event/auth writes, model/catch-up jobs and admitted HTTP/upload/media work.
6. Persist the quiesced phase. After the initiating HTTP response finishes, notify the owning launcher through IPC.
7. Launcher requests graceful shutdown and waits for the verified child to exit. Only then start the replacement backend for that recorded operation.
8. Replacement opens the target, applies its activation safety reset and publishes the completed operation and new scope. Target starts disconnected with AI off, including when returning to the original. Connecting WhatsApp and enabling AI remain explicit actions.

Use bounded acknowledgement, drain and exit deadlines. On timeout, **do not activate, force-kill or start another backend**. Keep the operation blocked/failed with a truthful status.

A crash or incomplete operation must boot into recovery without restoring a socket automatically. Never silently roll back into an active original session. Normal saved-pairing restoration may inspect only the selected active profile.

## Same-owner repair

After confirmed quiescence **and verified process exit**:

1. Archive the selected auth directory beside itself, for example `whatsapp-auth.archived-<operationId>`.
2. Create a clean auth directory carrying the unchanged `owner-identity.json`.
3. Keep the original database and account ID.
4. Pair only after the owner's explicit action.

Missing or malformed owner locks block repair. Do not reconstruct them from an arbitrary scanned number.

Preserve the adapter's owner verification before contacts, aliases, history, messages or media enter storage. Wrong-owner scans must remain unverified and stop without ingestion. Never solve repair by deleting the identity file.

## Mobile contract

`AppProvider` must revoke the old client and increment `sessionEpoch` **before** accepting any new profile scope, including changes discovered during polling.

Each accepted scope gets a new immutable `ApiClient`, `HistoryCache`, composer queue and clock. All API methods, including raw upload/media/audio fetches, send scope headers and reject results from revoked clients.

On scope mismatch:

- Clear the displayed snapshot immediately.
- Stop accepting old responses and queued actions.
- Discover the new descriptor without fetching its history.
- Require owner acknowledgement before binding it.

Key the `LocalDraftProvider` and navigation subtree by accepted client scope/session epoch. This remounts conversation, permission, picker, recording and playback state even when the JID matches. Reuse existing unmount cleanup, and explicitly stop the shared playback lane.

Keep persistent text drafts keyed by URL/account ID as today. Unique new account IDs already isolate them and preserve original drafts for return. Do not migrate them into the new profile. Test delayed draft loads/disposals as well as network responses.

## File ownership

Assign one backend/core owner and one mobile owner. Do not split concurrent edits within these groups.

**Backend/core/launcher**

- New `services/backend/src/profiles.ts`: registry, validated paths, durable operation state and offline repair.
- `services/backend/src/index.ts`: selected-profile startup, explicit account injection, IPC completion/recovery.
- `services/backend/src/server.ts`: scope gate, lifecycle endpoints and quiescence.
- `services/backend/src/whatsapp.ts`: stop/start race handling, reconnect suppression and complete shutdown acknowledgement.
- `services/backend/src/launcher-startup.ts`: selected-profile pairing checks.
- `packages/core/src/api.ts`: scope and lifecycle schemas.
- `packages/core/src/workflow.ts`: account suspension and cancellation accounting.
- `packages/core/src/store.ts`: narrow account-scoped composer cleanup.
- `scripts/start-otherme.mjs`, `scripts/launcher-service.mjs`: verified restart and bounded acknowledgements.

**Mobile/release**

- `apps/mobile/lib/api.ts`, `lib/app-state.tsx`.
- `apps/mobile/app/_layout.tsx`.
- `apps/mobile/components/whatsapp-connection.tsx`.
- `apps/mobile/app/(tabs)/settings.tsx`.
- `apps/mobile/app.json`: recommend `0.1.1`, versionCode `2`.
- `scripts/build-android.mjs`, `scripts/verify-apk.mjs`: updated artifact name and manifest version assertions.

Keep conversation/media/recorder/history-cache/local-draft implementations unchanged unless focused tests expose cleanup gaps. Root remount plus client revocation should avoid scattered account-reset effects.

## Acceptance checks

Use synthetic owners and temporary fixture storage only:

- A/B profiles with identical JIDs and message IDs remain isolated across history, uploads, policies, grants, assistant state and local drafts.
- Missing/stale headers fail before ingestion or mutation, including old APK requests and binary routes.
- A → B → A rejects first-A requests and confirmations.
- Queued manual and assistant components cancel; unknown reservations survive restart unchanged and never retry.
- Active handoff blocks transition; late model, upload, picker and recording completions cannot populate the target.
- Inactive profiles never connect, reconnect, generate or send.
- Wrong-owner repair events ingest nothing; correct-owner repair preserves history and the lock.
- Lost acknowledgements, drain/exit timeouts, failed startup and interrupted registry writes never create two runtimes or silently activate a profile.
- Updated APK retains package/certificate, increases versionCode and passes existing packaging checks.

Run focused tests and typecheck, then one review. Reuse the existing dedicated signing key for the signed update. No agent installs, scans, real sends or paid model calls.

## Remaining decisions

- This recommendation allows lifecycle transitions only when the backend has a verified owning launcher. A directly started backend should return `launcher_restart_required`; supporting autonomous direct-process switching would add scope.
- The parent still needs separate owner authorization for the immediate one-time repair. This plan performs none.

Research was read-only. No live files, credentials, private history, HTTP/service operations, SQL writes or tests were accessed or executed.
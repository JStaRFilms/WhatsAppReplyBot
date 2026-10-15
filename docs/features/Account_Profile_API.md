# Account profile contract for implementation

## Shared DTO exports in @replybot/core/api

Backend coder owns these Zod schemas and matching inferred types. Mobile coder
consumes these names and shapes without casts or a second set of schemas.

- ProfileScope: {profileId:string,accountId:string,revision:nonnegative integer}.
  Original ID original/account whatsapp-owner; new IDs UUID/account whatsapp-UUID.
- ProfileDescriptor: {profileId,accountId,label:string,active:boolean}.
- ProfileOperation: {requestId:string,kind:create|activate|repair,
  state:pending|quiescing|restarting|completed|failed,sourceScope:ProfileScope,
  targetProfileId:string|null,resultScope:ProfileScope|null,error:string|null}.
- SessionDiscovery: {protocol:2,scope:ProfileScope,label:string,
  transition:ProfileOperation|null}.
- ProfileList: {profiles:ProfileDescriptor[]}.
- ProfileTransitionInput: discriminated union, all with requestId and confirm:true.
  create adds kind:create,label:string 1..80. activate adds kind:activate,profileId.
  repair adds kind:repair only. No filesystem paths or phone IDs supplied by client.
- ProfileTransitionResult: {operation:ProfileOperation}.
- ClientSnapshot adds profileScope. Use optional/default compatibility only for
  isolated legacy test factories; actual runtime always publishes valid scope.

## Routes and headers

Authenticated data-free GET /v1/session -> SessionDiscovery.
Authenticated GET /v1/profile-operations/:requestId -> ProfileOperation.
Scoped GET /v1/profiles -> ProfileList.
Scoped POST /v1/profile-transitions ->202 ProfileTransitionResult.
All account-bound snapshot/history/media/upload/composer/consent/WhatsApp/AI/control
routes require X-Otherme-Profile and X-Otherme-Revision. Missing426 upgrade required,
stale409 profile_scope_changed, transition409 profile_transition_in_progress.
Discovery/operation polling and launcher identity remain account-data-free and
authenticated; health remains minimal. Don't retry failed mutations on a new scope.
Recorded operation retries with original source scope may return the same recorded
result but cannot cause another transition. Bind exact body/hash/request/scope.

Launcher protocol2 retains rootId/instanceId and publishes profileScope. It validates
scope consistency with top-level accountId, not hard-coded whatsapp-owner alone.
Each child gets immutable scope and store. Only verified launcher owns switching;
direct backend without owning restart IPC returns launcher_restart_required.

## Lifecycle and client

Use full plan Account_Switching_Plan.md. Transition gate closes before work checks;
active handoff blocks transition. Cancel queued all-origin components and preserve
unknown reservations. SuspendAI and invalidate source beforedrain; do not activate
newprofile untiloldchild'sverifiedexit. Persistglobalmonotonicrevision anddurableop.
New/returning target startsdisconnected/AIoff. Crash/timeouts stayblocked, noforced
kill/implicitrollback/autoconnect. Repair archivesauth onlyafterexit, sameownerlock.

App discovers descriptor before data, creates immutable scopedApiClient. On changed
scope revokeoldclient/callbacks first, clearoldscreen/history/attachments, stopshared
playback and remountLocalDraftProvider/navigation keyedbyscope+epoch. Storetextdrafts
stayURL/accountIdscoped. Explicitlyconfirm owncreate/activate/repair; thatcounts as
acknowledgment to bind its matching completed operation. A scope change from another
client requires visible owner Continue, no automatic history fetch. Reconnect can
restore same persisted scope normally. Only readonly discovery/op poll mayretry.

## Ownership

Backend/core/launcher coder owns packages/core, services/backend,
scripts/start-otherme.mjs, launcher-service.mjs and their focusedtests/fakebackend.
Mobile coder owns app-state/API/rootlayout/WhatsAppsettings/profile UI and its tests,
app.json version0.1.1/code2. Existingtabs/inbox/chatrowTask20changes staypreserved.
Parent owns docs/Git/runtime/signing/build-android/verify-apk artifactupdates. No
agentmayreadorwrite livecredentials/profile registry/DB ormanipulateliveservices.
Synthetictemp fixtures only; signingkeyunchanged. Designerworkoutofscope.

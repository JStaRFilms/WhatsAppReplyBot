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

## Proposed owner-added release APIs

[Release_Extension_Implementation_Plan.md](Release_Extension_Implementation_Plan.md)
is authoritative for the narrow extension proposals. They are not implemented by
this documentation.36 owns shared DTOs/backend before37 consumes them. All new
routes use the existing account/profile/revision headers, owner authentication,
transition admission/drain, body limits and no-store/privacy rules.

- GET/POST `/v1/owner-instructions` uses `{text,revision}`; POST strict input is
  `{requestId,expectedRevision,text}`. Empty clears; max2,000 code points/4,000
  UTF-8 bytes, no silent truncation. Conflict409 owner_instructions_changed.
- GET/POST `/v1/contact-names` uses
  `{enabled,revision,lastPhoneSyncAt,lastPhoneImportRequestId}`; POST is
  `{requestId,expectedRevision,enabled}`. Default off, conflict contact_names_changed.
- POST `/v1/contact-names/import` takes `{requestId,expectedRevision,entries}`.
  Each entry is `{conversationId,name}`. One atomic replacement, max500 matches,
  ID max128 characters, name max120 code points/512 UTF-8 bytes. Only this scoped
  route allows512KiB; all other owner body limits stay unchanged. Return `{settings}`
  with lastPhoneImportRequestId for exact read-only lost-response reconciliation.
  No chunks/staging/TTL, names in ack cache/logs or automatic mutation retry.
  Revision/off/scope conflict rejects the whole input, retaining prior rows.
  No real book reads/imports during development.

Optional ownerInstructions/contactBookNames capability flags appear only on
`GET /v1/session?capabilities=1`. Preserve plain protocol2 discovery exactly.
Missing flags mean unavailable controls. Optional sourced name/revision fields and
Message/Component receipt projections do not change send body or outbox accounting
enums. Existing snapshot request IDs suffice for read-only send reconciliation.

Instructions/name revisions are data revisions, not ProfileScope revision. Saving
them never transitions an account or resumes AI. They invalidate affected workflow
versions and unsent AI work while preserving grants, sources and unknown/handoff
accounting. Name/prompt/source text never belongs in discovery/launcher identity.
No owner-field or name alias may be shared across profiles.

## Ownership

Backend/core/launcher coder owns packages/core, services/backend,
scripts/start-otherme.mjs, launcher-service.mjs and their focusedtests/fakebackend.
Mobile coder owns app-state/API/rootlayout/WhatsAppsettings/profile UI and its tests,
app.json version0.1.1/code2. Existingtabs/inbox/chatrowTask20changes staypreserved.
Parent owns docs/Git/runtime/signing/build-android/verify-apk artifactupdates. No
agentmayreadorwrite livecredentials/profile registry/DB ormanipulateliveservices.
Synthetictemp fixtures only; signingkeyunchanged. Designerworkoutofscope.

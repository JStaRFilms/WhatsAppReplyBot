# Task 12: Reply window, draft history and owner images

## Approved scope

Phone regressions fixed separately in bf7ae51. User now requests drafts stay at
their source turn instead of floating forever, one suggestion rather than
duplicate generation, a five-second quiet window to collect multi-message input,
intelligent quoted replies, natural nonliteral sticker responses and context
about owner/AI/contact reactions. User explicitly selected gallery and camera
image uploads, with local preview/caption and transmission only after Send.

## Architecture and data

Owner-only image actions extend manual outbox transport, not model Action powers.
Authenticated staged uploads are normalized and account/chat-scoped, persisted
until terminal send or safe cleanup. Unknown image handoffs never automatically
retry. Image plus caption is one transport component. Successful owner image
send starts the existing five-minute cooldown and resolves old handovers.

The reply window resets per conversation on each verified live inbound message;
backfill/replay never starts it. Owner holds/consent/grants/version are rechecked
at generation and send. Quoted IDs must be in the same conversation. Model input
includes labeled reaction actors/targets, but contact content remains untrusted.

## Writer ownership

Parent owns conversation integration/draft anchoring, API client, backend server,
model context/OpenRouter, draft generator, reply-window scheduler, docs and final
verification. Coder child owns core contracts/store/workflow, WhatsApp transport,
new image upload helper, picker component, mobile dependency manifest/lockfile,
and focused core/image tests. No overlapping file writes.

## Interfaces for child implementation

OwnerImageAction: {kind:'image',uploadId:string,caption:string,reason:string}.
OwnerAction schema is Action or OwnerImageAction; model Action remains text-only.
Text and reaction_plus_text Action accept optional nullable quotedMessageId.
Components gain image kind and optional uploadId. Core manualSend accepts
OwnerAction, permits same-chat quotes and rejects image actions outside owner
origin. Accepted image creates an outgoing Message with image metadata.

Message.observedReactions is optional, actor-labeled observations. Coder implements
live reaction ingestion and Workflow.observeReaction safely so model context can
consume it. Keep legacy reaction display field. App reactions update the same
observations; known assistant reaction echoes never become owner intervention.

New registerImageUploads(app,flow) helper registers authenticated POST
/v1/conversations/:id/uploads with application/octet-stream, X-Request-Id header,
10MB limit, normalized JPEG output and response {id,mime,width,height}. Bytes are
stored scoped to account/conversation; no public file paths. Shared existing auth
hook applies. Parent imports and calls helper. Coder may not modify server.ts.

AttachmentPicker exports PickedImage {uri,base64,width,height,mimeType?} and accepts
{disabled,onPick:(image:PickedImage)=>void,onBusyChange:(busy:boolean)=>void,
beforePick:()=>Promise<void>}. beforePick must acknowledge owner compositor hold
before launch. Camera permission only on camera action; gallery and camera use
images only, one image and base64:true. Menu is compact. Parent adds preview,
remove, caption composer and explicit Send. Coder may not modify conversation.

## Execution

Core/image Coder: Takomi openai-codex/gpt-6.1-sol high.
node:delegated-task:command%3Amcp%3Ab9dc6976-6663-41a1-b188-a6ba995dfb36%3Adelegate-task%3Aotherme-owner-images-20261014-r1

Read-only review: Takomi openai-codex/gpt-6.1-sol high.
node:delegated-task:command%3Amcp%3Ab9dc6976-6663-41a1-b188-a6ba995dfb36%3Adelegate-task%3Aotherme-image-window-review-20261014-r1

## Completed outcome

Gallery/camera selector, local preview/caption and explicit owner image send are
integrated. Staged image bytes are scoped, normalized and retained for uncertain
work. Legacy raw tombstones also gate staged previews; delete-before-accept stores
only a deleted placeholder. Owner and assistant share one account reaction slot.
Cards remain at source turns, stale cards dismiss, requests coalesce by workflow.
Five-second quiet windows and validated intelligent quotes are implemented.

68 tests, strict typechecks and Android/web exports pass. LAN browser verifies
select-before-upload privacy, exactly one image/caption send, guarded preview and
cooldown, local text/send UUIDs, history cards and established gesture/visibility
behavior. No real WhatsApp send or private-chat model request.

Review's two blockers fixed: all socket loss clears timers/work tokens, and send
completion cannot overwrite a newer owner reaction. No recursive review pass.
Physical phone camera permissions and capture remain owner tested.

## Done and verification

Synthetic tests cover image upload scope/size, no model image-send action,
idempotency, quote validation, unknown image outcome, cooldown, reaction actor
and echo identity, removals and replay safety. Parent checks batching, duplicate
requests and timeline ordering; browser tests cover picking/preview/send and
insecure LAN HTTP. Native permission/camera UI remains owner tested. No agent
real WhatsApp send or private-chat model request. New changes remain independent
of earlier paired-account credentials. Review only confirmed safety/correctness
regressions; do not expand into unrelated cleanup.

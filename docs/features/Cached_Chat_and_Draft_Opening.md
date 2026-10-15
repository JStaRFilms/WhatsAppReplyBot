# Cached-first chat and draft opening

## Owner request and authority

Owner explicitly added this to the current release after40 launched. Opening a
chat or a draft whose content is already fetched should show it immediately, not
wait behind another server read. Refresh happens in the background. Owner may use
PC and phone concurrently; responsiveness must not remove server conflict checks.
Parent must fold this addendum into40's accepted plan and42 before implementation.
No competing packet writer or live diagnostics are needed.

## Current source evidence

69f01fd already has a bounded20-conversation in-memory HistoryCache, direct cached
history rendering and immediate pending sends/typed new-draft results. Do not
claim those mechanisms are missing or replace them with a new state framework.

The conversation mounts a refresh because its loadedVersion starts empty. More
importantly, existing snapshot Draft bodies are rendered only inside the loaded
source message loop. A known draft can therefore be present in Review/snapshot
but absent in the opened chat while history is pending. Review navigation starts
a history read without awaiting it; it already owns the full Draft object.

## Required behavior

- Render known scoped conversation/history/draft content immediately. Background
  refresh must not blank usable cached content, reset viewport/focus/composition or
  hide a known draft body. Separate source/history loading from the draft body.
- Opening a specific existing draft identifies that draft and shows it immediately,
  even if its trigger/context is not loaded. Do not invent a missing source message
  from embedded quotes or the draft prose. Locate genuine context when available.
- An incoming source/page response must not unmount/reset an active draft editor
  or overwrite local edits, quote, selection or composer. Avoid duplicate cards.
- Keep existing bounded session history/page storage; do not prefetch all chats,
  build a new offline mirror or persist a full private snapshot merely to fix this
  path. A truly cold missing page still needs a read, with honest local loading.
  Device-private persistent media reuse is separately approved by40's scope.
- Cached content is not current send/approval/hold/source authority. Preserve
  profile/epoch/source/expiry/deletion gates, server revisions and stale/conflict
  outcomes. Known stale drafts cannot be presented as newly approved. Do not
  auto-send/generate/retry/resume a mutation from cache or to warm an opening.
- Phone and PC changes remain server-serialized. Late older reads cannot overwrite
  newer validated mutation data or local edits. A conflict preserves local work and
  exposes current server state without a blind retry. UI pending is not sent.
- Refresh failures stay local/read-only and retain available content. They must
  not clear or replace unrelated domain/unknown-mutation feedback. No keyboard or
  microphone activation merely from cached opening/foreground recovery.
- Cached source text/media must respect known deletion/expiry and name permission
  changes. No old host/profile/account records flash during a scope transition.
  Draft-only rendering cannot acknowledge newer unseen history as viewed.

## Verification and data flow

Known accepted-session snapshot Drafts and history cache feed immediate paint.
Scoped background GETs revalidate and update only matching epochs/revisions.
Explicit mutation gestures keep their current request IDs, immutable captures,
revision checks and honest pending/unknown behavior. No new paid call, schema,
permission, persistent full-history DB or server authority is implied.

Add focused delayed-history tests: known draft body is visibly present and usable
before the GET resolves; warm chat stays painted during a forced refresh; editing
survives source arrival; out-of-order/cross-scope reads cannot replace current work;
source failure keeps the body with honest context status; two-client revision
conflict preserves local text; no model/mutation warming. Include a representative
browser screenshot with history held, and inspect opacity/hidden ancestors rather
than counting an invisible DOM node as successful paint. Existing paging/unread,
pending journal, source-linked View and narrow/wide behavior remain required.

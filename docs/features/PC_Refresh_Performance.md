# PC refresh performance

## Goal and authority

Resolve the owner's post-0.1.3 desktop/phone refresh failures without dropping chats, resetting accounts or replaying uncertain actions. The owner authorizes routine local test-app diagnosis and compatible fixes without repeated approval prompts. Real sends, paid model calls, relinking, destructive cleanup and unverified force-kills remain outside this work.

## Client and server components

The existing Android/browser client discovers the current profile, accepts it explicitly when needed, then reads `/v1/snapshot`. Its10-second read deadline is unchanged. Windows owns SQLite, profile policy and source authority. HTTP and owned-child shutdown share the Node event loop.

History/contact/message batches yield real I/O after32 items or8ms at an item boundary and recheck socket/generation/stop/seal ownership. Small history windows use the existing message_paging index.

Snapshot assembly creates a synchronous request-local HistoryRead from bulk conversation, alias, revision and populated-history reads. It reuses group membership/latest rows and reads physical outboxes once for effective-policy listing. The object is discarded before any write or await. Standalone mutation/source checks remain fresh. There is no persistent or cross-request authority cache.

## Data flow

Owner credentials and immutable profile headers still gate discovery and data. Snapshot assembly preserves all physical conversations, drafts and outboxes, derives verified same-account logical groups, then projects source restrictions and latest messages through the existing history resolver. Expiry, view-once/deletion, alias-policy restrictions, manual work and unknown outcomes are unchanged. No row cleanup or contact hiding is a performance shortcut.

The initial dense100-chat fixture missed the owner's3437-conversation/3115-alias sparse shape. The corrected invented sparse snapshot is byte-identical to its original result while avoiding repeated all-account scans/outbox projections. A parent-only disposable offline backup test used an original read-only connection, no listener/provider/socket, returned200 with all physical counts retained, and removed the backup. It is not a physical-phone or running-service acceptance claim.

## Database schema

Add the derived covering index during normal SqliteStore initialization:

```sql
CREATE INDEX IF NOT EXISTS wa_aliases_canonical
ON wa_aliases(account_id, canonical, alias);
```

The existing primary key remains `(account_id, alias)`. The new index serves the existing `WHERE account_id=? AND canonical=? ORDER BY alias` membership lookup. It changes no mapping values, identities, grants, requests, records or query semantics. Existing stores receive it on the next normal startup. There is no destructive migration or new table.

This index is needed beyond the read-only snapshot path. Integration testing at the sparse scale found that ordinary saved-name enablement still exceeded the client's10-second budget. An in-memory query-plan experiment let the same operation complete in about5.9seconds without changing its writes; consent and instruction changes also completed. The correction adds the index rather than reusing stale HistoryRead authority across mutations. An index-only repeat still took10.4seconds for consent under load. Account-wide consent/instruction changes now invalidate each physical conversation once instead of revisiting alias groups even though every member is already in the account-wide list. This also avoids duplicate workflow-version increments while preserving unknown manual work. Final isolated observations were2.2seconds for consent,1.9seconds for instructions and3.7seconds for names. Timings are local observations, not guarantees.

## Browser delivery

Exact configured private IPv4 browser origins at3210 are allowed alongside legacy8081. Protected requests retain token/profile checks. Automatic token provisioning remains loopback-only. LAN blank-token setup gives token guidance, and actual provisioning has one bounded deadline without a retry. Public exported font/image files under the known `.pnpm` export namespace are served without allowing other hidden files, source, traversal or symlinks.

## Verification and limits

Focused regressions demonstrate original failures and corrected SQL-work/index plans, alias/source-policy equivalence, unknown/manual preservation, exact Origin/auth checks and provisioning deadlines. Full combined suites, types, fresh browser export/credential-byte scans and actual-service observations are recorded in the orchestration and issue handoffs. Keep source checks, offline real-data replay, synthetic browser/lifecycle checks, current service rollout and native hardware acceptance distinct.

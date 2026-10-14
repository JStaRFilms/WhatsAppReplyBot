# Task 10: Owner controls, local drafts and history efficiency

## Scope and approval

User approved five-minute owner-send cooldown, draft-only backlog at expiry,
prior mode thereafter with remaining allowance, ten-second empty-composer hold,
inline resume/extend/indefinite controls, local Your draft support, countdown pills,
unread avatar counters and cached history without draft-first layout jumps.
Media remains a separate subsequent slice.

## Outcome

Implemented layered persisted holds and draft-only catch-up jobs. Temporary holds
keep original grant IDs/deadlines/units; indefinite/handover protections remain.
Local drafts use device AsyncStorage. Only boolean occupancy crosses the service
boundary. Composer device identity persists with drafts and aggregate holds do
not let one device clear another. API-client epoch guards discard stale session
responses. SQLite indexes/revisions/watermarks support history windows and app
unread counts without WhatsApp read receipts. History cache holds twenty recent
chats per authenticated client. First-load drafts wait for history.

## Verification

39 tests, strict typechecks and web export pass. Isolated Edge checks pass cache
reopen, first-load layout, local restore/clear, empty-composer release, occupancy
privacy, combined settings and loading/duplicate protection. Local snapshot
samples measured 726ms before and263ms after, not a controlled benchmark. No paid
model request, agent-initiated real send or private media access was used.

## Review record

Takomi Reviewer openai-codex/gpt-6.1-sol high found six confirmed issues. All were
fixed: occupancy retry/empty reconciliation; persistent browser identity; epoch
checks on async session updates; generation-scoped catch-up request IDs;
acceptance side effects applied once atomically; and revision/watermark handling
for old-timestamp arrivals. Regression checks cover duplicate acceptance,
aggregate holds and chronology/watermarks. Existing tests and browser checks pass.
Review task:
node:delegated-task:command%3Amcp%3A86dc010a-802e-4fbf-92bb-5c634accd4ed%3Adelegate-task%3Areplybot-cooldown-cache-review-20261014-r1

Native Expo Go storage and minute-countdown behavior await owner feedback.

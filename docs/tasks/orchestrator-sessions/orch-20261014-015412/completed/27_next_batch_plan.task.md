# Plan the approved daily-use batch and continuity follow-up

- Status: completed, planning only; implementation awaits owner approval.
- Stage: Genesis reconciliation, with read-only Architect and Designer research.
- Baseline: 399cc99, signed 0.1.2/code3 installed by owner after resending.
- Current defect: owner still gets microphone setup cancellation after permission.

## Objective

Reconcile the two attached reference threads, current source/tests, approved
WhatsApp-led visual direction and owner feedback into a practical sequenced plan.
Return the plan for approval. Do not implement the next batch yet.

## Scope

- Daily use first: simple Create/Switch profile and Link/Relink flow; clear PC vs
  WhatsApp connection states; private PC QR shown by explicit Link; startup/stop
  reliability; confirmed microphone cancellation; apply approved compact UI.
- Design reference: thread d6ca507d-123f-4f9c-a8c4-98c9ee362e6e and existing
  Otherme_UI_Brief.md / Otherme_UI_States.md / local HTML boards. Main charcoal and
  light themes are the reference. Glass is only a comparison, not a redesign brief.
- Continuity reference: thread a375214a-d789-4e2b-a838-94277ff3c2c5 and complete
  Conversation_Context_and_Writing_Profile.md / Writing_Style_Extraction_Prompt.md.
  Preserve exact owner template. Separate agreed direction from open budgets,
  provider choice and paid/private tests. Stage transcripts, profile/examples,
  growing sessions, compaction. Persistent contact facts and schedules come later.
- Read only source and synthetic tests. No private DB/auth/keys, live APIs,
  microphone, phone, service/process actions, model calls, artwork generation,
  dependency/toolchain changes, source edits or builds. Do not message references.

## Definition of done

- Both attached histories read fully, including the long storage-note item.
- Current behavior separated from stale docs, proposals and owner-device evidence.
- Plan names files/components, sequencing, ownership, regression/acceptance checks,
  risks, open decisions, release boundaries and explicit non-goals.
- Existing account isolation, consent, never-reply, holds, uncertain-send accounting,
  local media and actual-visible unread semantics remain mandatory.
- A written plan is returned to the owner before implementation.

## Expected artifacts

- docs/features/Daily_Use_UX_and_Continuity_Plan.md.
- This task packet with read-only delegated task IDs and findings.
- Concise owner-facing plan and recommendation, with exact unresolved choices.

## Execution

Parent read both supplied histories, recovered the truncated storage message, and
read current requirements/hand-offs. UI brief baseline4fe50d7 is behind profiles,
keyboard/Latest and release changes. APK installation now works; physical mic
cancellation is still confirmed, so the prior synthetic fixes are not closure.

Read-only UI research task, Takomi Sol Medium:
`node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-daily-use-ui-plan-20261015-r1`

Read-only lifecycle/mic research task, Takomi Sol Medium:
`node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-lifecycle-mic-plan-20261015-r1`

Both completed without source edits or live operations. UI report maps the
selected design to current semantics and scoped frontend ownership. Lifecycle
report identifies the permission-request/active-epoch candidate and concrete
late-stop/late-gate/observability gaps, without pretending the physical cause or
old hang is proven. Twenty mobile and two mocked pairing tests passed in isolation.

Parent reconciled one recommendation conflict: P remains fallback, rather than
mandatory, by adding explicit PC-display intent over existing scoped connect/IPC.
No blind auto-popup based only on QR polling. The full plan is authored at
`docs/features/Daily_Use_UX_and_Continuity_Plan.md`.

The plan prioritizes mic and lifecycle evidence, simple profile/linking journeys,
then the selected compact visual implementation. Continuity follows in transcript,
approved style/examples, growing session and budgeted-compaction stages. Provider
comparison is documentation-first with paid/private tests still gated. Later facts,
schedules/calendar/off-LAN/commercial work remains separate.

Both reference histories were read fully, including the long original style prompt.
No thread messages or mutations were sent. Original handoffs and unrelated design/
context changes remain intact. Local links and scoped whitespace checks pass;
application source is unchanged from399cc99. User receives the plan before coding.

# Verification plan

## Evidence rules

No live WhatsApp or model capability is verified in this foundation. Offline
checks can prove local logic against stated adapter contracts. They cannot
prove that Baileys supplies those observations, that WhatsApp will accept an
action, or that an account avoids restriction. Record each result as offline
verified, device observed, provider observed, unsupported or unverified.

Documentation validation belongs to this task. Implementation tests belong to
later approved packets under `C:/CreativeOS/prototypes/whatsapp-assistant/`.
No tests below authorize a live connection, private data, sending, read receipts,
paid model requests or deployment. The owner now explicitly authorizes Paper
UI/UX design and offline implementation, without live account/provider testing.

## Foundation self-check

Run from `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot` using Python's standard library. This reads product
docs and does not modify them. It checks exact MUS/issue alignment, issue
structure and local Markdown links. Semantic checks still require the focused
review below.

```bash
python - <<'PY'
from pathlib import Path
import re
root = Path('docs/whatsapp-assistant')
prd = (root / 'Project_Requirements.md').read_text(encoding='utf-8')
ids = re.findall(r'^\| (FR-\d{3}) \|', prd, re.M)
files = sorted(p.stem for p in (root / 'issues').glob('FR-*.md'))
assert len(ids) == len(set(ids)) == 12
assert sorted(ids) == files, (ids, files)
required = ['Project_Requirements.md', 'Coding_Guidelines.md',
            'Builder_Prompt.md', 'features/Assistant_Architecture.md',
            'Verification_Plan.md']
assert all((root / p).is_file() for p in required)
for issue in files:
    text = (root / 'issues' / (issue + '.md')).read_text(encoding='utf-8')
    assert text.startswith('# ' + issue + ':')
    for heading in ['## Requirement', '## Acceptance',
                    '## Contracts', '## Verification', '## Out of scope']:
        assert heading in text, (issue, heading)
for path in root.rglob('*.md'):
    text = path.read_text(encoding='utf-8')
    for target in re.findall(r'\]\(([^)]+)\)', text):
        if '://' not in target and not target.startswith('#'):
            assert (path.parent / target.split('#')[0]).exists(), (path, target)
print('PASS: 12 unique MUS IDs, 12 matching issues, required artifacts and local links')
PY
```

Inspect `git status --short` and `git diff --check` afterward. Verify no writes
outside product docs and that Approved_Brief.md remains unchanged. Preserve the
four pre-existing egg-info changes and parent-owned task-session changes.

## Foundation validation result

Task 01 ran the exact Python block above from `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`. It returned
`PASS: 12 unique MUS IDs, 12 matching issues, required artifacts and local links`.
`git diff --check` passed. The following check passed with no changes:

```bash
git diff --exit-code -- docs/whatsapp-assistant/Approved_Brief.md
```
 Git status
showed only the new product docs in addition to the existing egg-info and
parent task-session changes. No prototype or live test has run.

## Offline feasibility matrix

Use synthetic identifiers and fake model/transport behavior. SQLite tests must
reopen the same test database after simulated crashes, not merely inspect
in-memory objects. The later spike defines its scoped runner, expected as
`npm --prefix prototypes/whatsapp-assistant/ run test:offline`. That command is
a planned contract, not an existing or executed test in this documentation task.

| Requirement | Offline acceptance cases | Proof boundary |
| --- | --- | --- |
| FR-001 | Reject missing/revoked owner credential and cross-account IDs; round-trip text/quotes/media/reactions and distinct queued/accepted/delivered/read states | API behavior and normalization only, no Expo implementation or WhatsApp parity |
| FR-002 | Ambiguous contact names require selection; inbound prompt injection cannot confirm a proposal; stale/hash-mismatched/expired/reused confirmations fail | Local owner-action separation, not model judgment quality |
| FR-003 | At least 15 synthetic direct chats with explicit modes and exclusions; select ten only after filtering; human recency/ties; drafts never sends; leaving ten keeps drafts; quiet-hour invalid timezone fails closed | Deterministic policy, not device history completeness |
| FR-004 | Approve/edit/dismiss/needs-owner/follow-up; revision/version mismatch; never-reply denial; follow-up requires confirmed auto-mode grant | Approval authorization, not client interaction design |
| FR-005 | Limits at 1 and 20 units; reaction-plus-text needs two; split bubbles count; concurrent reservations; expiry, early completion, unknown reservations and positive acceptance counted once | Local bounded accounting, not receipt delivery guarantees |
| FR-006 | Pause acknowledgment after commit; disconnect lacks acknowledgment; manual send cancels queued work; assistant echo differs from unmatched owner send; reopen DB stays manual; explicit resume leaves grant revoked | Durable takeover given normalized evidence, not native typing detection |
| FR-007 | Crash before/after dispatch intent; handoff timeout; same request ID same/different payload; unknown no retry; partial reaction/text result; pause before/after handoff | Local outbox recovery and honest uncertainty, not exactly-once network delivery |
| FR-008 | Backfill/replay/unknown never auto-send or auto-draft old messages; duplicate live event no-op; sync boundary loss blocks automation; digest uses source IDs and missing-history flags | Recovery logic and read-only review, not adapter event completeness |
| FR-009 | Different account/contact never retrieved; owner/AI/edited/unknown authorship; global examples opt-in; input budget overflow; deleted sources invalidate derived memory | Provenance and bounded retrieval, not actual tokenizer/model fidelity |
| FR-010 | Image/static sticker/bounded animated frames; unsupported or missing media; status DM versus broadcast; expired original not invented; view-once excluded | Payload handling and fallback, not real media availability or playback |
| FR-011 | No consent means no model calls; exclusions cancel AI work; deletion cascades; expiry purges media; content-free unresolved outbox evidence; logs contain no fixture content/secrets | Local privacy rules, not provider retention or Windows disk security |
| FR-012 | Disconnected/degraded Windows service state; fake capabilities; no public listener; restart restores versions/control/grants; live mode not activated by ambient env vars | Fail-closed operation, not real Windows uptime or linked-device stability |

### Required semantic review

Trace one live inbound event through identity, policy, ranking, context, draft,
approval, grant reservation, pause race and dispatch. Then trace the same event
as replay. Replay must stop before automatic work. Trace a reaction-plus-text
bundle through success, failure and unknown results; no component can bypass
accounting. Check that all API fields use the table enums and versions, and that
owner-edit provenance cannot become unedited AI style training.

Review exclusions against explicit drafting and attention review. Check direct
status replies against missing originals. Confirm no requirement adds schedules,
commercial infrastructure, private data collection or UI work to Genesis.
One focused review is sufficient unless a confirmed blocking defect remains.

## Separate opt-in read-only device probe

Before any pairing, obtain approval naming the account and disposable test
contacts, permitted observations, storage/deletion rules and duration. Explain
unofficial account risk and that connection/sync may have side effects. Inspect
adapter behavior for read receipts before starting. Abort if it cannot meet the
approved restrictions. Do not reuse old sessions or copy private production
history as fixtures. Do not authorize outbound automation in a read-only probe.

| Question | Evidence needed | What remains outside read-only proof |
| --- | --- | --- |
| Account/contact aliases and authorship | Observe controlled owner sends from ordinary WhatsApp and linked clients, alias metadata and outbound IDs | Assistant-send echo attribution needs a later authorized send test |
| Live versus history/replay | Observe initial sync, reconnect and restart with synthetic test conversations; compare event source and stable IDs | Complete history is never guaranteed; a missing live boundary blocks automation |
| Unread behavior | Observe test recipient unread state before/after connection and retrieval with read receipts disabled | Any explicit read-receipt test needs its own authorization |
| Direct status replies | Test owner-created status and contact DM reply through native clients; inspect quote/status reference while available and after expiry | Sending a status or reply through this service is not authorized |
| Media and expiry | Observe accessible synthetic image, sticker, animated sticker, GIF and missing/view-once/disappearing metadata | Model understanding and in-app playback need separate later evidence |
| Incoming reactions | Observe native-client reactions, removals and target IDs | Outbound reaction acceptance, limits and delivery need authorized sending tests |
| Recovery state | Disconnect/reconnect and inspect repeated IDs, cursor behavior and normalization | Unknown outbound reconciliation cannot be proven without controlled sends |

Record adapter version, Windows/Node versions, setup restrictions, timestamps,
synthetic fixture references, observed fields and unsupported/unverified gaps.
Do not publish account IDs, session files, QR codes or private content. A device
observation demonstrates that scenario, not a permanent WhatsApp guarantee.

## Later paid model and send tests

These are not part of the offline spike or read-only probe. Obtain separate
approval for model costs and privacy consent. Check the current OpenRouter
catalog for `openai/gpt-6-luna`, limits, image input, structured output and price.
Send only approved synthetic content. Verify validation rejects malformed or
permission-seeking model output; no output can confirm an owner action.

Obtain separate sending authorization naming recipients and exact actions.
Use a small controlled exchange to check outbound IDs, acknowledgments, echoes,
reactions, partial/unknown reconciliation and takeover observed from another
client. Do not induce risky repeated sends to chase an exactly-once claim.
Account restriction risk remains even if every test passes.

## Genesis exit and design gate

Exit requires accepted foundation, exact issue alignment, passing nominated
offline invariants, one focused review and an evidence report separating local
proof from device/provider questions. Unverified adapter behavior must be listed,
not silently marked supported. Required live capabilities block production
activation until checked. Native owner typing is optional; the app pause path
is required.

The owner now authorizes Paper design and offline Expo/backend implementation.
Record design and executable evidence separately. Offline success does not grant
permission for account pairing, paid requests, real sends or deployment.

# Combined release review38

## Decision

The single combined Sol High review withheld source acceptance for two confirmed
P2 blockers in399cc99..24539121aabb37fd9c1bd2df78a74890c76da1d7. No source files
changed during review. This is not a request for another generic review loop.

T3 review ID is
`node:delegated-task:command%3Amcp%3A73c03ce5-b336-44e9-b7ac-b1c24f448a93%3Adelegate-task%3Aotherme-combined-release-review38-20261015-r1`.

## P2: Returned but uncommitted photo viewer handle leaks

MediaViewer queues the acquired handle into React state. Closing before that state
commits leaves layout cleanup holding undefined, while passive cleanup only aborts.
The returned handle loses its owner. The sole global viewer slot remains reserved,
so subsequent photo or video opening fails with Close other media before opening
this item. Relevant source is media-viewer.tsx28–36.

Reviewer reproduced zero releases with the lifecycle harness and slots1 with the
real MediaCache plus synthetic storage. Parent independently reproduced zero versus
one expected release with the unchanged component. Repro is
`.runtime/ui-task44/fix50/parent-viewer-red.cjs`, run with Node test name pattern
`review38 viewer acquired`. Exit1 is the expected pre-fix assertion failure.

Apply the proven uncommitted ownership discipline used for thumbnails in49, only
to the viewer acquisition. Committed pixels/player cleanup still precedes release;
late scope/route completion cannot publish, and every lease releases idempotently.
No video-player refactor, global retry or capacity increase is authorized.

## P2: Paired contact metadata creates inbox conversations

Contact upsert/update/history-contact and mapping handlers call canonical(). For a
phone/LID pair it unconditionally materializes the phone conversation before name
eligibility. This bypasses the existing name-only no-inbox rule even with names off.
Relevant source is whatsapp.ts118/125/130/222–229. The old no-chat test omits paired
identifiers. The approved implementation plan explicitly forbids this creation.

Reviewer reproduced an empty store becoming one conversation from contact-only
paired identifiers. Parent independently confirmed names=false, conversations1
and the remembered canonical mapping, with no message or socket operation. Repro is
`.runtime/ui-task44/fix50/parent-contact-red.mjs`, run using node --import tsx.

Remember exact trusted mappings without materializing unrelated inbox chats. Preserve
normal message-driven creation and existing LID-history joining, source epochs,
manual/unknown accounting, explicit policy holds and no automatic resume/send.
Existing wa_aliases supports identities without a conversation row. verifyAlias()
requires a canonical conversation when an original alias conversation exists, so
handle that legitimate historical case rather than simply deleting a necessary
materialization everywhere. No new schema, cleanup of existing data or guessed map.

## Verification and next step

Reviewer independently passed73 focused core/backend tests,145 focused mobile tests,
all workspace types, range diff checks and both reproductions. It verified186 public
inputs,28 export files and160 sealed artifacts without mismatch, and inspected the
stored parent91+17 browser result. It did not rerun the browser. These checks do
not negate the uncovered paths. The parent accepts both findings as scoped defects.

Task50 is the sole implementer for these two blockers. Focused regressions must fail
before and pass after. Parent then reviews the diff and reruns relevant/full checks,
records each response and resolves acceptance without another broad audit. Only an
unresolved actual objection justifies a focused follow-up. Artifact33 stays held
until both are resolved and source/version/verifier inputs are frozen.

Native mic/keyboard/contacts/codec/audio, actual receipts/privacy, Windows operation,
ASR quality/cost and actual merged/signed permissions remain separate acceptance.
No live/private data, service or release action was used in review or parent repro.

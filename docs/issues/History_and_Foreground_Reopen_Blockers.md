# History and foreground reopen blockers

## Browser gate remains blocked

Task 44 round 2 tested frozen source `eb8a242`. It returned partial results, not
release acceptance. Its original handoff and evidence summary are under
`.runtime/ui-task44/r2/`. There were 69 primary checks and seven supplemental
checks, with five blocked scenarios. No unexpected network or browser errors.
The passing original photo prepend path does not establish warm-reopen safety.

## Confirmed normal-use failures

1. Warm chat reopening produced a wrong viewed request and lost its photo control.
   The actual visible inbound sources were 357, 358 and 359, but the request named
   310, 311, 313, 314 and 315. Source 310 was at viewport y -4304. The visible photo
   was at y 134 in the viewport, content y 4502, but saved geometry recorded 9004.
   This is a visibility correctness blocker, not just a cache performance problem.
2. Opening a known cached draft with both source requests held showed its usable
   body. After editing and source arrival, the same focused editor and local text
   survived, but its y moved from 350 to 908, below the viewport ending at 743.
3. Clean responsive resizing lost the source offset. At 360 to 1280, source 314
   moved from offset -50 to 22. Back at 390, source 313 moved from -47 to -191 and
   was no longer visible. This test makes no artificial CSS height change.
4. Background and foreground could leave the photo on Retry attachment. Explicit
   Retry revalidated and reused the existing bytes. Automatic display recovery
   failed, including in the parent's reproduction. This permits automatic scoped
   read recovery only, not any mutation, paid request or media authorization bypass.

The parent independently reproduced warm-photo failure plus wrong viewed IDs,
clean responsive failure, cached-editor y 350 to 908, and foreground needing Retry.
The latter two isolated runs are in `r2/parent-repro/`. All data was invented.
No source change or real account operation occurred during these checks.

The saved scroll offset currently initializes Position.offset as though it were an
observed offset. The warm geometry equals twice the actual offset. This is a strong
lead, not proof of the complete timing cause. Check actual mounted viewport and
content measurements, native event timing and programmatic scrolling. A requested
or saved position is not proof that it has been displayed.

For resize, preserve the last coherent source ID and offset before any mixture of
old row coordinates and new scroll or layout values. For cached drafts, preserve
the actual focused editor position when its placeholder gains source history.
Investigate foreground activity, aborted read coalescing and handle publication
before changing cache or provider code. Keep leases, scope and invalidation strict.

## Correction 48 and acceptance

One source writer will correct these verified failures and add focused red-to-green
regressions. Primary scope is conversation scroll, conversation screen and tests.
The media component, cache or provider may change only for a diagnosed foreground
read race, with a matching regression. No backend, API, policy, schema, dependency,
version, native configuration, new layout design or unrelated refactor.

Use isolated browser reproductions after source edits as well as fake-unit checks.
Do not weaken the actual viewport viewed-ID assertion. A body-presence or source
row anchor check does not replace the focused editor's viewport check. Ordinary
photo arrival uses a fixed box. The separate forced CSS-height stress is diagnostic
only and is not itself a release blocker unless the same fault affects real layout.

After correction, the parent accepts source and freezes a new candidate. A fresh
44 round 3 finishes affected and uncompleted browser combinations. Existing review
38 then reviews the combined source once, followed by final metadata and artifacts
33. No release, source review acceptance or native hardware proof exists yet.

## Correction 48 accepted at source

The parent accepted `35cba0ce1a0ecda1af056d8f872feed87ea94f9b` after diff inspection
and independent verification. Warm measurements now use a measured content origin,
not a saved or requested scroll offset. Reflow retains the last coherent anchor.
Editor focus callbacks stay stable across page changes. Measured trailing space
allows a last-row editor to keep its viewport offset without bottom clamping.

Foreground transitions retire old pending metadata and downloads. Cleanup compares
task identity before deleting a pending entry. A canceled old denial cannot revoke
a new current handle. The provider aborts old reads before starting media recovery.
No dependency, backend, API, native configuration or version changed.

Parent serialized tests passed 94 core, 109 backend, 217 mobile and 29 packaging,
total 449. All workspace types and diff checks passed. The parent checked hashes
for all eight changed source/test files and 28 exported files against the delegate's
verification manifest, with no mismatch.

The parent reran all four isolated Edge cases with separate output directories in
`.runtime/ui-task44/fix48/parent-1792098080207-*`. All 27 checks passed, no failures,
unexpected calls or browser errors. Warm viewed IDs exactly matched 357/358/359.
The cached editor kept its node, focus, text and y350. All clean resize deltas were
0px. Three foreground transitions recovered without Retry; image binary count
stayed one with fresh metadata. Existing r2 artifacts were not overwritten again.

This accepts correction 48, not full 44 or release. A fresh frozen-source round 3
must finish integrated history, privacy, pending-photo and supplemental cases.
Review 38 and artifacts 33 remain held. No native hardware acceptance is claimed.

## Evidence handling note

The first two parent reruns accidentally used the original runner's output paths.
They overwrote `r2/results.json` and corresponding same-named case screenshots.
The original full raw result bytes cannot be recovered. The original handoff,
`browser.log`, `evidence-summary.json`, supplements and old hash manifest remain.
Do not claim the current raw file contains the original 69-check run or matches its
original hash. Further parent runs use a separate-output clone. New acceptance must
produce fresh attributed results and hashes, not silently repair this discrepancy.

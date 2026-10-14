# Task 09: Handover lifecycle, activity dots and typing

## Scope

Remove stale Needs you cards after actual owner replies or explicit resumption.
Keep manual control until explicitly resumed. Speak to the owner in handover
reasons, show unseen activity on filters and reduce typing lag. Media is deferred.

## Changes and verification

Added resolved state and optional handoverAt. Accepted manual text and verified
live WhatsApp owner text resolve the card; uncertain send, typing and backfill do
not. Recovery repairs previously answered cards. Handled dismisses the warning.
Needs me lists unresolved handovers instead of all manually paused chats.

Filter dots clear on a focused visit and return with new activity. Input avoids
per-keystroke rebuilding of rows, bubbles and Intl formatters. 3,200 synthetic
chats measured mean input paint 69ms before and 28ms after. Browser checks prove
filter visit/new activity and answered handover behavior. 33 safety tests and
workspace typechecks pass. Native timing still needs owner feedback.

## Review

Takomi Reviewer, openai-codex/gpt-6.1-sol medium, found two confirmed defects:
recovery needed the live-source guard and edited handovers needed their own start
timestamp. Both were fixed and a regression check covers both reproductions.
No additional review round was needed. Execution ID:
node:delegated-task:command%3Amcp%3A86dc010a-802e-4fbf-92bb-5c634accd4ed%3Adelegate-task%3Areplybot-handover-perf-review-20261014-r1

# Build the integrated browser and Android release

## Agent setup

Persona worker, Takomi Luna High, artifact-only after source freeze and extension review38.
Canonical root: C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot. Approved physical Android build copy
C:/Otherme-build only. Read Daily_Use_Batch_1_Contract.md, Release_Extension_Implementation_Plan.md,
36/37 dependency/API handoffs,38 findings/responses and current build tooling.
Parent supplies final version/source hash after review; do not choose or edit it.

## Objective

Produce compiled desktop web assets usable through Otherme.cmd D without Metro,
and the actual signed Android update with the same package/certificate. No app-data
reset, signing-key replacement or blind live backend restart. New service/desktop
features require explicit coordinated owner rollout instructions.

## Scope and artifacts

Only credential-isolated web export under canonical ignored runtime, allowlisted
inputs/generated build files/cache in approved C:/Otherme-build and canonical
ignored release APK/report/log. No canonical source/docs/env/auth/key/DB edits.
Preserve all previous releases byte-for-byte and original signing material.
Do not rerun exclusive prepare-copy over an existing destination; verify then sync
its allowlist only, preserving short pnpm store/codegen fixes and native cache.
Sign using original env privately; never put keys/env/session into build copy or
print credentials. No SDK/toolchain installs, licenses, firewall/services or cloud build. Only a
parent-confirmed frozen dependency refresh in the existing approved short copy is
allowed for the exact frozen approved native pins, including Contacts and only
separately owner-approved Expo Video if present. No worker package choice/install
outside that confirmed refresh. Read40's accepted plan and41+ dependency handoffs.

## Definition of done

Actual desktop production export and signed APK verified, matching frozen source.
Single approved signer, package/version, non-debuggable, LANHTTP/no-backup/permissions,
embedded bundle/native resize and private-file/real credential-byte scan pass.
If Expo Contacts is used, assert READ_CONTACTS present and WRITE_CONTACTS absent in
the actual merged/signed artifact, not just app.json. Retain mic/camera safeguards.
Desktop assets contain no secrets and can only expose public bundle/static files.
Source input hashes and previous APK hashes remain unchanged. Exact bytes/hash,
redacted evidence and errors are reported. No physical microphone/phone install or
live desktop service/account action is claimed tested from a build. No real sends,
recordings, models or private content diagnostics. No debug APK fallback.

## Dependencies and review checkpoint

36 and37 integrated,38's confirmed blockers resolved, parent validation accepted,
parent-owned version/config/defaults and final source snapshot frozen. Original32
alone is insufficient. Owner-added send/receipt/name/prompt/punctuation gate must
be complete. The later owner-approved history and cached/full-screen image/video
work from40/41+ and updated integrated browser evidence must also be accepted by38.
39's69f01fd baseline alone cannot authorize this build. If Video is included, verify
actual foreground-only/native permission/plugin configuration and explicit module
approval. No source changes or new dependency choices in this artifact task.
Preserve existing C:/Otherme-build caches/path fixes and refresh only
the verified credential-free allowlist; do not run prepare-copy into it again.
Worker does not commit/push or alter scopes. Parent independently verifies final
artifacts, commits exact owned changes and guides owner install/service update.

## Execution

Not launched yet. Version and artifact names will be supplied after source freeze.

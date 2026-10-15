# Build the integrated browser and Android release

## Agent setup

Persona worker, Takomi Luna High, artifact-only after source freeze and task32.
Canonical root: C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot. Approved physical Android build copy
C:/Otherme-build only. Read Daily_Use_Batch_1_Contract.md and current build tooling.
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
print credentials. No install/licenses/firewall/services/cloud build.

## Definition of done

Actual desktop production export and signed APK verified, matching frozen source.
Single approved signer, package/version, non-debuggable, LANHTTP/no-backup/permissions,
embedded bundle/native resize and private-file/real credential-byte scan pass.
Desktop assets contain no secrets and can only expose public bundle/static files.
Source input hashes and previous APK hashes remain unchanged. Exact bytes/hash,
redacted evidence and errors are reported. No physical microphone/phone install or
live desktop service/account action is claimed tested from a build. No real sends,
recordings, models or private content diagnostics. No debug APK fallback.

## Dependencies and review checkpoint

32 accepted, parent-owned version/config/defaults and final source snapshot frozen.
Worker does not commit/push or alter scopes. Parent independently verifies final
artifacts, commits exact owned changes and guides owner install/service update.

## Execution

Not launched yet. Version and artifact names will be supplied after source freeze.

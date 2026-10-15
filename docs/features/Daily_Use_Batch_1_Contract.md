# Daily-use batch 1: approved scope and handoffs

## Authority

Owner approved implementation after plan11af3a2 and added foreground sync, keyboard
persistence and a browser desktop app. Current code baseline399cc99; selected
reference design and continuity handoff are committed as b0648a9 and39f9001. No
Batch2 context/storage implementation or schema migration is authorized in this
batch. Follow Daily_Use_UX_and_Continuity_Plan.md and the selected design/state maps.

## Client and server responsibilities

Windows remains the independent worker while the phone/browser is closed. Client
foregrounding triggers immediate read-only session/snapshot refresh, with bounded
retry/backoff and current-scope invalidation. Cached content stays available but is
not presented as fresh. Never retry mutations or send/approval work on reconnect.

PC authentication/reachability, accepted profile binding, WhatsApp pairing and AI
consent are separate states. Successful service authentication must not show simply
Offline while waiting for Continue or WhatsApp Link. Connect to PC shows pending,
Connected to PC or actionable reconnect/auth failure. Saved token entry is one-time;
never reveal it or ask for provider keys on the phone. Reconnect to the same saved
service must reuse its credential when the input is blank, not call native local
provisioning or force re-entry. Never send a saved token to a newly entered host;
new-host credentials and confirmation are separate. Clear obsolete transient
read errors after a successful refresh, not uncertain-send or domain failures.

## Keyboard and microphone

Permission is already granted on the owner's Android. Setup still cancels. Treat
repeat permission requests as a candidate, not the proven device cause. Check
permission before requesting; keep real route/profile/background/unmount guards,
source-only diagnostics and explicit local preview/Send. Do not weaken shared
foreground semantics or record automatically after returning from background.

Do not close the keyboard after Send, taps in history, scrolling or swipe-to-quote.
Open it for explicit composition/quote actions. A fresh chat does not autofocus.
Returning to the same chat after app backgrounding may restore an unfinished,
previously focused composer; manual keyboard dismissal must be respected. Never
restore focus into another profile/chat. Do not disable/recreate the text input
merely because a text send is pending. If further typing is allowed while sending,
capture the composer revision at the original send gesture before upload/awaits;
accepted completion must not erase newer text, quotes or attachments. Keep duplicate
send locks, request IDs and unknown-outcome protection. Explicit owner keyboard
hide and leaving the chat still dismiss it. Preserve actual-visible unread logic.

## Profile and PC QR contract

Create profile, Switch profile, Link WhatsApp and Relink this profile are distinct.
Keep consequences confirmation, saved-auth reuse, same-owner relink enforcement,
separate DB/auth and AI-off activation. External profile changes still require
Continue; self-confirmed operation completion must match source/result revision.

Use existing scoped GET/POST /v1/whatsapp. Add optional `displayOnPc:boolean` to
POST/connect with existing requestId/confirm. Old clients omitting it remain valid.
GET/connect response may add optional `pcDisplay:{requestId,state}` where state is
requested, ready, unavailable or expired. Ready means a private file was prepared
and the OS launch request succeeded, not proof pixels were seen. Scope headers
apply. No QR bytes in IPC/logs. Existing owning launcher receives explicit display
intent with request/root/instance/profile identity, reads scoped status, deduplicates
per request and never issues a second connect mutation. Cancel/cleanup on scope
change, expiry, error or exit. P remains manual fallback. Settings polling alone
must not cause popups. Browser may render QR locally without requesting a second
viewer. Shared DTO changes, if needed, are owned by backend slice only.

Optional session discovery capability metadata may advertise `pcQrDisplay` and
`desktopBrowser` booleans while protocol2 remains backward compatible. Capability
absence means use honest fallback, not optimistic success. UI slice must not edit
core DTOs concurrently. Backend author records any finalized shape deviation here
or in its handoff before integration.

## Browser desktop delivery

Deliver compiled web assets with the existing PC service, preferably at its local
root URL http://127.0.0.1:3210, and D in Otherme.cmd opens it. No Electron/native
installer, Metro, second persistent service, cloud hosting, firewall changes or
Windows auto-start. Add documented `pnpm desktop:build` for an explicit rebuild;
release preparation supplies the built assets so ordinary D needs no command.

Static serving is restricted to the built public web directory and known SPA
routes/assets. Never serve source/runtime/auth/env/signing files; reject traversal,
dotfiles, API fallback and unsafe symlinks. API authentication, local-only token
provisioning, profile scope and LAN protections remain unchanged. Use the existing
credential-isolated mobile-node wrapper for web export. Compiled assets contain no
server/provider secrets. Desktop uses same-origin backend discovery when built as
the desktop client, rather than a baked DHCP Wi-Fi address. Mobile native defaults
remain separate. The desktop build can use a public `EXPO_PUBLIC_DESKTOP=1` flag;
client slice owns default URL selection, server slice owns build invocation.

Apply the approved desktop-wide composition as well as phone layouts. Reuse actual
chat/controller/draft behavior, one scoped provider, and existing navigation; do
not mount competing conversation controllers or duplicate mark-viewed work. The
same app should work at narrow browser widths. No new cloud or multi-owner model.

## Ownership and sequencing

28: Native mic + chat keyboard lifecycle. Own voice-recorder, voice-composer,
conversation/[id], conversation-scroll, draft-card and focused tests. No ui.tsx,
app-state/api/profile/settings/core/server/script edits.

29: Launcher startup/stop, explicit PC QR and built browser hosting. Own scripts,
backend index/server/launcher-startup plus minimal public DTOs and focused backend/
packaging tests, root package scripts if needed. No mobile components/controllers,
app config or theme edits. Do not export the final browser build until UI integration.

30: Foreground sync + service/profile/linking UX. Own app-state/api, profile-controls,
whatsapp-connection, Settings, ui.tsx status/keyboard wrapper and focused tests.
No conversation/voice/draft/theme/core/backend/script edits. Read contract fields;
coordinate with29 if backend work has not landed yet.

31: Visual/native/browser integration follows28/30. One UI writer may then touch
those files, implement approved five-screen and wide composition, with no safety
regression. 32: focused integration review. 33: production desktop export and signed
APK, same key/package, next version after source freeze. Parent owns docs, scoped
commits, review decisions and release metadata. Children do not commit or push.

All tests use synthetic data/disposable ports, not live3210/8081/8083 or real runtime.
No live service stop/start/profile change, phone recording/interaction, real send,
private-message model test, key replacement, dependency/toolchain install or quota
image generation. Preserve owner data. Owner handles real-device acceptance later.

# WhatsAppReplyBot

WhatsApp-like Expo client, Windows Node backend, SQLite and OpenRouter GPT-6 Luna.

## Live connection

Use Node 24 and pnpm 10. Keep the PC awake and on the same trusted Wi-Fi as your
phone. The backend key belongs in the ignored `.env`, not the mobile app.

```sh
pnpm install
pnpm backend:live
```

In another terminal:

```sh
pnpm mobile:web
```

1. Open http://localhost:8081/settings on the PC and select **Connect**.
2. Select **Connect WhatsApp**. On your phone, open WhatsApp → Linked devices →
   Link a device and scan the QR on the PC.
3. Select **Enable AI** to permit paid OpenRouter drafting with selected chat
   context. Default eligible chats draft only. Automatic sends need an explicit
   contact mode and an active confirmed delegation limit.

Pairing uses unofficial Baileys and carries the previously accepted account risk.
History availability depends on WhatsApp. It is not a full-history guarantee.

## Android over Wi-Fi

Run `pnpm mobile` for Expo Go SDK 57, or connect Expo Go to the existing Metro
server. Settings defaults to the development host's address.

Use the **WiFi** service address printed by the backend, not a virtual adapter.
For this PC the address is `http://192.168.100.65:3210`; it can change with DHCP.
Enter the service token from `.runtime/owner-token.txt` in phone Settings and
select **Connect**. Keep the token private. It is not your OpenRouter key.

The phone browser can also use http://192.168.100.65:8081/settings. Native Expo Go
behavior still needs owner-device testing. Windows Firewall may require allowing
Node on the private network. No firewall settings were changed automatically.
Do not expose these HTTP development servers to the internet.

## Sending and control

**Send reply** approves and sends a draft. Your sent messages start a five-minute
cooldown, reset by each new send. At expiry, unanswered backlog gets a draft only;
later incoming messages follow the previous mode and original remaining limit.
Resume now skips the timer. The menu extends it or pauses indefinitely.

A nonempty composer holds AI. Clearing it releases only the typing hold after ten
seconds. Your unsent text stays on this device and appears as Your draft. Only
composer occupancy goes to the backend. Typing in original WhatsApp remains
unobservable; an owner send starts the cooldown when its event reaches us.

A Needs you card clears after your accepted reply or explicit resumption. Typing
alone does not clear it. Handled dismisses a card without resuming automation.
Filter dots show new activity since your last visit. Avatar counters show unread
messages in Reply without sending WhatsApp read receipts. Recently opened chats
use cached history; initial draft cards wait for their history to avoid jumps.

Accepted transport handoff is not a delivery or read receipt. Unknown outcomes
are not retried. Never-reply contacts cannot be passed to AI. Historical sync
never triggers replies. The assistant supports review, drafting, contact-mode
changes and resumption commands; it is not a general-purpose tool planner yet.

Live media understanding is pending. Images, stickers, GIFs and unsupported
attachments are identified, but remote generation rejects context containing
media until encoding is implemented. View-once content is not cached.

## Offline preview

Stop the live backend, then use `pnpm backend` and `pnpm mobile:web`.
Preview data and live WhatsApp use separate SQLite files. The default preview
needs no API key and sends no real messages.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm --filter @replybot/mobile exec expo export --platform web
```

39 focused safety tests, strict typechecks and web export pass. Browser checks
verified live Settings, authenticated connection and pairing QR rendering with
no page errors. The live backend is ready on the LAN. Owner pairing and a paid synthetic model response are verified. Real-device
sends and reply quality on actual conversations still need owner verification.

See `docs/features/Live_Integration.md` for implementation and review evidence.
Runtime data, WhatsApp credentials, tokens and `.env` remain ignored.

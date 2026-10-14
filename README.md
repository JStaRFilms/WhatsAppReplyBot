# Otherme

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

If ports 3210 and 8081 are already in use, the services may already be running.
Open http://localhost:8081 instead of starting a second copy. Port 8081 is the app;
3210 is its backend. http://localhost:3210/v1/health checks backend availability.

## Android over Wi-Fi

Run `pnpm mobile` for Expo Go SDK 57, or connect Expo Go to the existing Metro
server. Settings defaults to the development host's address.

Use the **WiFi** service address printed by the backend, not a virtual adapter.
The address is `http://<PC-Wi-Fi-IP>:3210` and can change with DHCP. Check the
Wi-Fi IPv4 address with `ipconfig` if an old saved address stops working.
Enter the service token from `.runtime/owner-token.txt` in phone Settings and
select **Connect**. Keep the token private. It is not your OpenRouter key.

The phone browser can also use `http://<PC-Wi-Fi-IP>:8081/settings`. For Expo Go,
open `exp://<PC-Wi-Fi-IP>:8081`. Native behavior still needs owner-device testing. Windows Firewall may require allowing
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
use cached history; initial history waits for bottom positioning. Swipe right to
quote, or hold to react. The composer emoji button opens a picker. A chat is marked
viewed only while visible, focused and at its newest messages.

Accepted transport handoff is not a delivery or read receipt. Unknown outcomes
are not retried. Never-reply contacts cannot be passed to AI. Historical sync
never triggers replies. The assistant supports review, drafting, contact-mode
changes and resumption commands; it is not a general-purpose tool planner yet.

Images, stickers and GIFs now have authenticated previews and model image input.
Animation uses sampled frames, not full-video understanding. View-once, deleted
and expired media are excluded. Old or expired WhatsApp download links can still
be unavailable. GIF decoding needs FFmpeg on the Windows PATH.

Contact settings accept a custom reply count, 24/48-hour runs, an exact end date
or no expiry. Unlimited actions and extended runs require a risk acknowledgment
and exact confirmation. Reactions still consume units. You can pause at any time.

OpenRouter attribution defaults to Otherme with a local app URL and a
hidden-visibility request. Set OPENROUTER_APP_NAME and OPENROUTER_APP_URL in the
backend environment to change attribution. This does not publish the app.

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

51 focused safety tests, strict typechecks and web export pass. Browser checks
verified live Settings, authenticated connection and pairing QR rendering with
no page errors. Owner pairing, synthetic text generation and a paid synthetic
image-recognition request are verified. Browser checks cover live-preview
rendering and custom/unlimited/date-based grant confirmation. Real-device
gestures, image downloads and reply quality still need owner verification.

See `docs/features/Live_Integration.md` for implementation and review evidence.
Runtime data, WhatsApp credentials, tokens and `.env` remain ignored.

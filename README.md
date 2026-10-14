# WhatsAppReplyBot

A WhatsApp-like Expo client with a Windows-hosted assistant service.
The current app runs with synthetic chats. It does not pair with WhatsApp or
send real messages.

## Run the demo

Use Node 24 and pnpm 10. From this repository:

```sh
pnpm install
pnpm backend
```

In a second terminal:

```sh
pnpm mobile:web
```

Open http://localhost:8081 and select **Connect local demo**. The backend listens
on http://127.0.0.1:3210. Chats, Review, Assistant and Settings work in light
and dark mode. Approval and manual sending use a simulated transport.

Typing requests a server-acknowledged AI pause. Manual control stays active
until you explicitly resume it. Contact permissions and delegation require
confirmation. Never-reply contacts cannot be passed to the assistant.

The assistant supports commands such as "review the past five hours",
"draft for Kemi", "never reply to Tolu" and "resume David". It does not yet have
a general-purpose natural-language tool planner.

## Optional OpenRouter text drafts

No key is needed for the default demo. To try paid GPT-6 Luna requests later:

1. Copy `.env.example` to `.env` and enter your OpenRouter key privately.
   Never place it in the mobile app or an `EXPO_PUBLIC` variable.
2. Stop the default backend and run `pnpm backend:openrouter`.
3. Reconnect the client. In Settings, select **Allow OpenRouter text drafts**.
4. Request a new draft in a synthetic text-only chat, such as Maya.

The key alone does not enable calls. The explicit startup command and owner
consent are both required. Turning consent off invalidates pending drafts and
revokes delegation. Drafts created earlier by the demo model remain demo output.
Context containing media rejects remote generation until media encoding exists.
No live OpenRouter request has been verified.

## Phone testing

Run `pnpm mobile` for Expo Go SDK 57. Native device behavior is unverified.
The service binds only to computer loopback, so a phone cannot reach it over
ordinary Wi-Fi. USB development can use `adb reverse tcp:3210 tcp:3210`.
Enter the service token from `.runtime/owner-token.txt` in Settings if needed.
This token is not the model key. Do not expose the HTTP service to the internet.

## Checks

```sh
pnpm typecheck
pnpm test
pnpm --filter @replybot/mobile exec expo export --platform web
```

26 focused safety tests and the workspace typecheck pass. The web export passes.
Browser interaction checks covered connection, dark mode, draft approval,
acknowledged pause, manual send, confirmed resumption and assistant review.
Android testing was blocked by an emulator System UI failure.

See [implementation evidence](docs/features/Offline_Implementation.md) and the
[accepted design](docs/design/Accepted_Direction.md). Live WhatsApp integration,
media understanding, history sync and real-device delivery verification remain
unfinished.

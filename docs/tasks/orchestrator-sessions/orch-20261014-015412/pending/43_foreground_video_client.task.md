# Task43: Add separately approved foreground video playback

## Agent setup and status

Persona coder, Takomi Sol High, Build. requiredCapabilities=[write-code]. Running after parent accepted42 source061c4d7; exact dependency approval recorded, no other writer. Canonical root is `C:/CreativeOS/01_Projects/Code/Personal_Stuff/WhatsAPP autoreply/2026-10-14_WhatsAppReplyBot`. Every shell command explicitly cd there or use absolute project paths. Use unslop, scoped instructions and existing UI. Parent owns status, board/master plan, docs, commits and release. Do not launch agents.

Read docs/Coding_Guidelines.md, Project_Requirements, History_and_Media_Reliability_Scope, History_and_Media_Implementation_Plan, Voice_Notes, Account_Profile_API,37/38 and accepted41/42 source/types/tests/handoffs. Preserve all previous pending-send, mic/keyboard, source/permission, receipt/name/prompt and future context/style constraints.

## Objective and dependencies

Display and explicitly play one eligible ordinary video in Otherme's existing full-screen modal from one bounded authenticated local download/cache hit. No video sending, AI analysis, background/PiP, streaming/range/resume or export/share.

41 and42 must be integrated/accepted,39's old export finished, and no other mobile writer active. Owner has explicitly approved exact expo-video57.0.5 through the Video module
question. Approval covers canonical apps/mobile/package.json, root pnpm-lock.yaml,
existing app/plugin configuration to disable background/PiP, and normal module
native dependency refresh in approved C:/Otherme-build only after source freeze.
No SDK/toolchain upgrade, gallery permission or additional npm module is approved. This packet does not authorize an installation by itself. If approval is absent or a launch/install is blocked, stop and report; do not retry or choose another version/module.41/42 remain separable but the full requested release is still held.

Installation is authorized only when this43 task launches after accepted42 and
no mobile writer is active. No installation occurred at approval time. Preserve
the existing build copy/caches; this is not authority to recreate it or run
prepare-copy. Parent records installed-version/lock/config evidence before release.

## Exclusive ownership

- New `apps/mobile/components/video-playback.tsx` and `.web.tsx` for native hook and browser video element respectively.
- Existing `components/media-viewer.tsx` and optional `.web.tsx`, `media-attachment.tsx`, `message-bubble.tsx`, `app/conversation/[id].tsx` only to expose the video entry and lifecycle guards.
- `apps/mobile/lib/audio-lane.ts`, `components/voice-composer.tsx` only if needed to coordinate video with the existing recording/audio lane.
- Focused `apps/mobile/test/video-playback.test.cjs`, `media-viewer.test.cjs`, `platform.test.cjs` and existing audio/interaction tests.
- Only after explicit approval, `apps/mobile/package.json`, root `pnpm-lock.yaml`, `apps/mobile/app.json`, `apps/mobile/plugins/with-otherme-release.cjs` and focused plugin tests for this exact module and disabled background/PiP config.

Do not edit core/backend/API/cache contracts.42 hands off a lease-bearing local video cache handle; raise a contract blocker to parent rather than modifying shared cache scope. No generated android/ native source edits, release version/package/signing or toolchain changes. No docs/status/board/master-plan writes.

## Exact dependency proposal and public evidence

Task40 inspected installed Expo57.0.28 bundled manifest, which nominates expo-video~57.0.5. Public npm exact57.0.5 exists with no npm dependencies and peer expo/react/react-native `*`. Task40 verified its tarball SHA512 entirely in memory,10,167,541 compressed bytes, declared10,887,445 unpacked bytes. Public types/plugin/source are linked in the implementation plan. No package installation happened during planning.

Approval target is only canonical apps/mobile/package.json and root pnpm-lock.yaml, plus explicit disabled-background/PiP app.json and existing plugin edits. After parent authorization only, proposed command from root is `pnpm --filter @replybot/mobile add --save-exact expo-video@57.0.5 --ignore-scripts`. Inspect installed public types/source before use. Stop on package mismatch, unrelated lock drift or failure; no automatic alternative/install retry. No SDK/React Native/toolchain update, second npm module or native bridge.

Public APIs verified at57.0.5 are useVideoPlayer, replaceAsync, play/pause/currentTime/status/errors, VideoView contentFit/nativeControls/fullscreenOptions/PiP/playsInline/video-frame-analysis controls. Use useVideoPlayer's automatic disposal and layout cleanup before SharedObject release. A source replacement completion must check epoch/alive/scope/lease before use. No double release or calls after disposal.

Use player staysActiveInBackground=false, showNowPlayingNotification=false, audioMixingMode=doNotMix, and source `{uri:privateFileUri,useCaching:false}`. VideoView has nativeControls=false, contentFit=contain, fullscreenOptions={enable:false}, allowsPictureInPicture=false, startsPictureInPictureAutomatically=false, allowsVideoFrameAnalysis=false and playsInline=true. Provide existing-UI explicit controls. Web may use a native video element with controls disabled, disablePictureInPicture/playsInline and the same ownership guards. Never pass a remote/token URL to either player.

Add config plugin entry expo-video with supportsBackgroundPlayback=false and supportsPictureInPicture=false. Default Android library adds INTERNET only; it does not need gallery/camera/mic permission for local playback. Background true would add FOREGROUND_SERVICE, FOREGROUND_SERVICE_MEDIA_PLAYBACK and ExpoVideoPlaybackService, all forbidden. False does not clean a previously introduced service, so verify absence explicitly.

Important public-manifest finding: library `expo.modules.video.FullscreenPlayerActivity` declares supportsPictureInPicture=true independently of the plugin's main-activity setting. Extend existing with-otherme-release.cjs with a narrow merger override setting that activity false, with tools:replace as required; never launch native fullscreen. Test the config in memory.33 later checks the actual merged/signed manifest for disabled PiP and absence of video background service/permissions. app.json alone is not proof. Preserve Contacts READ-only and all existing blocked permission entries.

Native Android dependencies bring Media3 1.9.0 and AndroidX Fragment1.8.9 through normal Gradle resolution, not a second npm module. Apple pod minimum is iOS/tvOS16.4 and Swift5.9, no Apple build work authorized. This source/API evidence does not establish actual phone codecs, audio interruptions or manifest merge success.

## Required behavior

1. Only an explicit Open video tap requests41's source descriptor/content video variant. No list prefetch, autoplay poster generation, model frame preparation or original WhatsApp/gallery lookup. Source descriptor permits old supported raw ordinary-video rows without pretending their legacy AI Media.access changed.
2. Consume42's current authenticated local-cache lease. Reuse bytes without a second binary fetch after source revalidation. Retain10MiB/300-second/declared1920x1080 MP4 limits, MIME/ftyp/current-source checks and explicit unsupported/decoder-error state. Target H.264/AAC MP4, do not promise all MP4 codecs or install transcoding tools. No token URL/Range/resume or second player cache.
3. Opening loads paused. Only explicit Play claims audio-lane and starts playback. Provide Play/Pause, elapsed/duration, accessible bounded seek and Close/back in the app modal. No native fullscreen, PiP, notifications or lock-screen controls. No automatic resume after foreground, expiry/revalidation or errors.
4. Revalidate source before Play and every15 seconds while foreground viewing, never outlive30-second positive lease/source expiry. Source denial/version/profile change or offline lease expiry stops/detaches/unmounts before purge. Known delete/view-once/expiry cannot play a retained file. Report unavailable/read failure honestly with explicit retry only.
5. One current playback lane covers voice notes and video. Every Play stops previous playback first. Refuse open/play during recorder preparation/recording/picker/stop work with synchronous guards. Recording startup stops video, never hides a continuing recording or allows a stale async play after background/profile/route change.
6. On close/route/client/profile/background/unmount, pause, detach player source, unsubscribe events and release cache/audio ownership before native disposal. Use stable cleanup identities so a late previous cleanup cannot stop a newer player. Retain prior history anchor, manual keyboard intent, text/quote/attachments and uncertain pending sends. Viewer overlay never acknowledges unread content behind it.
7. AI Action/Component send kinds remain unchanged, no video in visual/audio model selection, no changed consent or broader send authority. Missing module/native support stays visibly unavailable, not simulated successful playback.

## Tests and completion criteria

Use mocked Expo SharedObject/player plus browser media events and synthetic file/blob handles. Cover explicit open versus Play, one binary download/cache hit, competing audio claims, recording-start race, source replacement pending at background/unmount/scope change, status/error callbacks after disposal, pause/detach/release ordering, repeated close and no auto-resume. Source denied/deleted/expired/view-once/version change/offline lease expiry must remove pixels/sound and release exactly once.

Test config plugin output in memory for both activities' disabled PiP, no ExpoVideoPlaybackService or foreground media permissions, preserved Contacts READ-only/blocked permissions and existing package/version/signing values. No generated native build here. Keep viewer/pending/composer/keyboard/audio tests passing. Backend41 already owns video-byte/AI isolation tests; do not claim mock player success as codec/device proof.

Run focused tests, `pnpm --filter @replybot/mobile test`, `pnpm --filter @replybot/mobile typecheck` and relevant existing packaging/plugin tests from root. Report exact approved dependency diff and commands/results. Done requires approved exact module/config, required foreground ownership, scoped diff and passing checks, not merely a mocked UI around an absent native dependency. Return significant blockers to parent.44 validates browser integration next; existing38 performs combined source review.33 stays held until source/validation/review/final-target gates, and actual merged manifest/playback remain later release/device checks.

## Execution

T3 task ID node:delegated-task:command%3Amcp%3A1c6c025d-2faf-4900-bd5c-76e24d154f69%3Adelegate-task%3Aotherme-foreground-video-client-20261015-r1.
Client request ID otherme-foreground-video-client-20261015-r1. Note the MCP instance
prefix changed; use this exact returned ID. Parent42 handoff is
 docs/features/Cached_History_and_Photo_Handoff.md.404 tests pass across serialized
suites/packaging, all types pass. Default parallel backend conversion timing had
failed in unchanged FFmpeg checks, isolated14 passed, no deadlines loosened.
Sole mobile/config writer, approved exact Video install allowed here only. No
C:/Otherme-build writes or actual APK/desktop build before later33/source freeze.

## Safety limits

No actual DB/auth/.env/token/key/book/message/log/media reads, live WhatsApp/API/download/model requests, original phone/gallery access, mic/camera/contacts permission calls, phone/device/service/viewer control, production3210/8081/8083, paid/image quota, outside-project writes, final web/APK build, stage/commit/push or unapproved install. Exact conditional Expo Video installation is the only possible exception after separate parent/user approval. Normal synthetic temp data is allowed. Do not alter39's output or existing task statuses.

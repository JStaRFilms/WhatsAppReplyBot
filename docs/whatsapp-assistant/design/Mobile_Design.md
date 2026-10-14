# Mobile design

## Authorization and source

The owner explicitly approved Paper design and offline implementation while
unavailable. The earlier stop-before-design gate is lifted. Device pairing,
private data, paid model calls, real sends and deployment remain disabled.

Paper file: https://app.paper.design/file/01M4W0R9BVS1D5GG5NRQ9NY3JS/p-1-0

Three 390px mobile artboards cover Chats, Conversation with inline draft, and
Assistant review. Exact Paper inline-style JSX exports are in paper/*.jsx.txt.
The file was new and empty; no unrelated user artboards were modified.

## Direction and tokens

Mineral light mode. Limestone background #F6F7F4, ink #1E2927, slate #576C65,
dividers #DBE2DC, copper-green primary #226D5F and light green #E8F2EC.
Inter was confirmed available in Paper. Use 28px screen headings, 18px contact
headings, 15–17px body/messages, and 13px labels. Reduce repeated row padding
rather than overlap the bottom navigation. React Native uses the same explicit
values with native font fallback where local font assets are unavailable.

## Navigation and behavior

Use Chats, Review, Assistant and Settings tabs. Open contact conversations on a
stack. A global demo/connection strip separates simulated state from WhatsApp
connection. Every screen must preserve the actual offline/error state.

Chats shows recent conversations, search, draft/needs-owner filters, mode labels
and the latest-ten rule. Explicit modes do not occupy default-draft slots.

Conversation includes quotes/media, manual composer, inline pending drafts,
approve/edit/dismiss and bounded follow-up. Starting composition requests a
pause; show success only after backend acknowledgment. Draft approval does not
silently resume manual control. A never-reply contact has no AI controls.

Review is a separate list of draft actions and needs-owner work. The owner can
inspect exact text/reaction targets and stale-version reasons. A simulated send
must be labeled simulated, never delivered or read on WhatsApp.

Assistant chat returns a read-only digest or an exact proposed action. Confirm
before sends, mode changes, delegation or resumption. Resolve ambiguous names;
no hidden permission escalation. Keep errors visible and retryable without
blindly repeating an unknown send.

Settings exposes server connection, contact permissions, demo status and the
model/privacy boundary. Never request or embed an OpenRouter key in the mobile
bundle. Live connection controls remain unavailable in this offline build.

## Evidence and limitations

Paper nodes, Inter availability, JSX exports and computed styles were checked.
Mandatory screenshot checkpoints were attempted repeatedly. The adapter first
returned black frames, then frames containing only the status bar, despite
source nodes and styles being present. Do not claim pixel-level Paper acceptance.
Verify final legibility, alignment and interaction in the implemented Expo web
client; native-phone and Paper desktop visual checks remain outstanding.

All example people, messages and media are synthetic. No generated-image quota
was used. Status/media missing-context states must remain honest rather than
invent content. No calls, status publishing, GIF search or autonomous media
sending is added by this design.

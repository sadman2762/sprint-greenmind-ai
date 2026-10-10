# Voice control with GPT-Live 1 on Azure

Voice controls the existing map and planner using an allowlisted command registry. It does not replace the placement algorithm or invent sensor data. The **Voice** button in the header opens a compact conversation panel; the map remains usable during the session. **End voice** remains visible even if the panel is collapsed.

## Local configuration

Set these in ignored `backend/.env` and restart the backend. The key never enters frontend code or git.

```dotenv
VOICE_AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.services.ai.azure.com
VOICE_AZURE_OPENAI_DEPLOYMENT=gpt-live-1
VOICE_AZURE_OPENAI_REASONING_DEPLOYMENT=YOUR-TEXT-MODEL-DEPLOYMENT
VOICE_AZURE_OPENAI_API_KEY=YOUR-LOCAL-AZURE-KEY
```

Both models must be deployed and accessible to the Azure resource. GPT-Live 1 is the voice model. Its Responses delegation uses a separate text-model deployment to select tools. The app does not silently substitute another voice model or guess the reasoning deployment.

`GET /api/voice/status` reports missing configuration and local-only mode without exposing the key. Configuration present does not guarantee deployment access; Azure verifies that during session creation.

`GREENMIND_LOCAL_ONLY=true` on the backend blocks external voice creation even if a key is configured. The panel also offers a persistent device-level local-only switch, which ends an active conversation. The microphone starts only after **Start voice control** and the browser's microphone permission. Audio and relevant map context are sent to Azure while connected. Transcript/action history stays in the page and is capped; there is no application audio recording or transcript persistence.

## Connection and tool protocol

The browser connects to the same-origin `/api/voice/stream` WebSocket. The backend authenticates the Azure `/openai/v1/live/sessions` WebSocket and sends `session.start` with fixed instructions and the `control_map` tool. The Azure key stays on the server. The relay checks browser origins, limits incoming message sizes and rejects client session configuration. Vite proxies WebSocket upgrades; production reverse proxies must do the same.

Microphone audio uses an AudioWorklet, mono PCM16 at 24 kHz. `session.input_audio.append` carries input and `session.output_audio.delta` carries playback. Playback respects server audio timestamps. Transcripts use `session.input_transcript.delta` / `session.output_transcript.delta`. End stops microphone tracks, queued audio and pending commands, then closes both sockets. The older `/api/voice/session` SDP route remains available, but the UI no longer depends on WebRTC.

Delegated function calls are collected from nested `response.output_item.done` events inside `response.event`; `response.completed` signals processing the collected calls. Azure continuation responses can start with `response.in_progress` without `response.created`; both initialize tracking without resetting collected calls. Every tool result is returned using `response.item.create`, then `response.create` continues the backend.

Calls execute serially against the latest mounted workspace handlers. Call IDs are deduplicated for the life of a voice session. A new delegation supersedes pending work; End aborts in-flight generation/evaluation and prevents queued mutations. The application reports a mutation only after its handler succeeds. Actions already completed before interruption remain in the plan; interruption is not undo.

## Supported commands

- Read current sensors, proposals, coordinates, radii and returned coverage metrics.
- Show Air, Water, Noise or all networks; toggle stations, monitoring coverage, outlines, historical transit and live transit.
- Set category, individual, new-suggestion or manual-placement radii (0.05–10 km).
- Suggest 1, 2 or 3 sensors using existing Air/Noise planning; apply or discard suggestions.
- Add a manual sensor at explicit coordinates or an OpenStreetMap search result; move chosen sensors or still-purple proposals; remove chosen sensors.
- Focus a sensor/proposal, zoom, reset the view, open the relationship graph and location basket.
- Show before/after/Original/both views, select a placement step, download the placement plan.

Examples: “Show water sensors”, “Suggest three air sensors”, “Use a 500 metre radius for new suggestions”, “Apply these suggestions”, “Show the first suggestion”, “Show connections for [sensor name]”. Russian and Hungarian instructions are included alongside English support. Ambiguous sensor references and addresses require clarification by the voice agent.

Runtime checks reject unknown fields/actions, invalid radii and coordinates, unavailable steps, moving installed stations, and removing installed stations. Automatic water planning remains unavailable. OpenStreetMap search returns at most five results inside the existing Debrecen study boundary, sharing the reverse-geocoder's rate limiter. Search results do not establish installation feasibility.

## Verification

Synthetic browser tests exercise the real map handlers through documented GPT-Live event envelopes, including duplicate calls, network switching, placement radius, protected installed stations, before/after, applying suggestions and stopping the microphone. Backend tests check server-only credentials, fixed session configuration, local-only enforcement and request validation. These tests do not establish speech recognition quality, microphone playback, or access to the user's Azure deployments.

Live verification on 2026-10-09: a fresh Edge browser sent a prerecorded “Show water sensors” through the actual Azure GPT-Live 1 session, received get_context and set_network tool calls, and switched the real app to Water. A second live spoken request, “Show air sensors and suggest two new sensor locations”, successfully generated two unapplied proposals using the real planner. These verify the audio → Azure → tool → UI path for both network switching and planning. It does not establish recognition accuracy for every language or microphone environment. Browser regression tests include continuation events without response.created. Backend tests cover the WebSocket relay, origin rejection, PCM validation, local-only mode and upstream cleanup.

## Official protocol references

- https://developers.openai.com/api/docs/models/gpt-live-1
- https://developers.openai.com/api/docs/guides/live-delegation
- https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/gpt-live
- https://learn.microsoft.com/en-us/azure/foundry/openai/gpt-live-reference

## Switching between VPN and ordinary internet

Voice uses browser → same-origin backend → Azure over secure WebSockets. Users do not need a browser connection directly to Azure. All browser API services now use same-origin paths; the development Vite proxy handles both HTTP and WebSocket upgrades.

The backend supports these optional values in ignored `backend/.env`:

- `GREENMIND_NETWORK_MODE=auto` (default): use the configured/system HTTP(S) proxy, respecting `NO_PROXY`. If it cannot establish a connection, try direct access. This handles stale corporate proxy settings after leaving a VPN.
- `GREENMIND_NETWORK_MODE=direct`: use ordinary direct internet, ignoring inherited proxy settings for voice, geocoding and GTFS requests.
- `GREENMIND_NETWORK_MODE=proxy`: require a proxy; never fall back to direct access.
- `GREENMIND_PROXY_URL`: optional explicit HTTP(S) proxy URL. Otherwise the backend uses environment/system proxy settings. Keep credentials, if any, in the ignored environment only.

A session already in progress is never replayed after a disconnect. Reconnect from the Voice panel after changing networks. HTTP rejections, proxy authentication failures and TLS certificate failures are not retried through another route. TLS verification remains enabled. No OS, VPN, firewall or certificate settings are changed.

These options cover voice, geocoding and live GTFS upstream connections; the legacy text Copilot SDK retains its own environment-based proxy behavior. The local placement algorithm itself does not require Azure or a VPN.

On the development Mac, an authenticated Azure voice session was verified through the configured proxy. Direct Azure TLS timed out on that network. Tests cover a dead proxy followed by working direct access, but this does not prove that the current network permits Azure with VPN disabled. If both direct access and the permitted proxy fail, the backend needs a network that can reach Azure, or deployment to an accessible HTTPS host with WebSocket support. A static-only/serverless frontend deployment is insufficient for the persistent voice relay.

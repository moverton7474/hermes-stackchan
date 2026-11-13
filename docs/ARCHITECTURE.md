# Hermes StackChan Architecture

## System Architecture

### Design Decision: Bridge Server (Not Direct Firmware Mod)

After researching all major StackChan firmware projects, we chose the **bridge server** approach for these reasons:

1. **No firmware compilation needed** — The stock xiaozhi-esp32 firmware already supports WebSocket audio streaming with configurable server URLs
2. **Proven pattern** — Both `stackchan-ai-server` and `warble` use this exact approach successfully
3. **All intelligence is server-side** — The ESP32-S3 can't run models; it only captures/plays audio and renders faces
4. **Easy iteration** — Changing the AI backend only requires server code changes, no reflash
5. **Hermes tools work automatically** — OpenAI Realtime executes tools server-side; the robot just speaks the results

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    HERMES BRIDGE SERVER                          │
│                    (Node.js / TypeScript)                        │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │ OTA Handler  │   │ WS Session   │   │ Token Manager    │    │
│  │              │   │ Manager      │   │                  │    │
│  │ POST         │   │              │   │ Mints ephemeral  │    │
│  │ /xiaozhi/ota │   │ Manages      │   │ OpenAI Realtime  │    │
│  │              │   │ per-device   │   │ tokens via GVC   │    │
│  │ Returns:     │   │ sessions     │   │ Hermes endpoint  │    │
│  │ - WS URL     │   │              │   │                  │    │
│  │ - Clock sync │   │ Tracks state │   │ Caches tokens    │    │
│  │ - No FW OTA  │   │ machine      │   │ (60s TTL)        │    │
│  └──────────────┘   └──────┬───────┘   └────────┬─────────┘    │
│                            │                     │              │
│  ┌─────────────────────────▼─────────────────────▼──────────┐  │
│  │                    AUDIO PIPELINE                         │  │
│  │                                                           │  │
│  │  Device OPUS (16kHz) ──► libopus decode ──► PCM int16     │  │
│  │                                                │          │  │
│  │                                    base64 encode│          │  │
│  │                                                ▼          │  │
│  │                              OpenAI Realtime WS           │  │
│  │                              input_audio_buffer.append    │  │
│  │                                                           │  │
│  │  Device OPUS (24kHz) ◄── libopus encode ◄── PCM int16    │  │
│  │                                                ▲          │  │
│  │                                    base64 decode│          │  │
│  │                                                │          │  │
│  │                              OpenAI Realtime WS           │  │
│  │                              response.audio.delta         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    EMOTION MAPPER                         │  │
│  │                                                           │  │
│  │  Analyzes response text for emotion cues                  │  │
│  │  Maps to device-supported emotions:                       │  │
│  │    neutral, happy, sad, angry, surprised, confused        │  │
│  │  Sends LLM emotion tag to device for face rendering       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    AUDIO PACER                            │  │
│  │                                                           │  │
│  │  Prebuffer: send first 5 frames immediately (300ms)       │  │
│  │  Pacing: wall-clock aligned frame delivery                │  │
│  │  Drain: wait for playback + 420ms slack before tts:stop   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Sequence Diagrams

### Boot Sequence

```
StackChan Robot              Bridge Server              GVC Hermes
     │                            │                         │
     │  1. WiFi connect           │                         │
     │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─►│                         │
     │                            │                         │
     │  2. POST /xiaozhi/ota/     │                         │
     │  {version, language, ...}  │                         │
     │ ──────────────────────────►│                         │
     │                            │                         │
     │  3. OTA response           │                         │
     │  {ws_url, server_time}     │                         │
     │ ◄──────────────────────────│                         │
     │                            │                         │
     │  4. WS connect             │                         │
     │  ws://bridge:8000/         │                         │
     │  xiaozhi/v1/               │                         │
     │ ──────────────────────────►│                         │
     │                            │  5. POST /api/realtime/ │
     │  6. {type: hello,          │     hermes              │
     │      audio_params: ...}    │  {get ephemeral token}  │
     │ ──────────────────────────►│ ────────────────────────►│
     │                            │                         │
     │                            │  7. {token, url}        │
     │                            │ ◄────────────────────────│
     │                            │                         │
     │                            │  8. WS connect to       │
     │                            │     OpenAI Realtime     │
     │                            │     (with token)        │
     │                            │ ────────────────────────►│
     │                            │                         │
     │  9. {type: hello,          │                         │
     │      session_id: uuid,     │                         │
     │      audio_params:         │                         │
     │        {24kHz, 60ms}}      │                         │
     │ ◄──────────────────────────│                         │
     │                            │                         │
     │  [READY — robot idle]      │                         │
```

### Voice Conversation Turn

```
StackChan Robot              Bridge Server           OpenAI Realtime
     │                            │                         │
     │  1. User says wake word    │                         │
     │     or presses button      │                         │
     │                            │                         │
     │  2. {type: listen,         │                         │
     │      state: start,         │                         │
     │      mode: auto}           │                         │
     │ ──────────────────────────►│                         │
     │                            │                         │
     │  3. OPUS audio frames      │                         │
     │     (binary, 60ms each,    │  4. Decode OPUS → PCM   │
     │      16kHz mono)           │     base64 encode       │
     │ ══════════════════════════►│     input_audio_buffer  │
     │  ...streaming...           │     .append             │
     │ ══════════════════════════►│ ════════════════════════►│
     │                            │                         │
     │  5. {type: listen,         │                         │
     │      state: stop}          │  6. input_audio_buffer  │
     │ ──────────────────────────►│     .commit             │
     │                            │ ────────────────────────►│
     │                            │                         │
     │                            │  7. response.created    │
     │                            │ ◄────────────────────────│
     │                            │                         │
     │  8. {type: stt,            │  9. conversation.item   │
     │      text: "transcript"}   │     .input_audio_       │
     │ ◄──────────────────────────│     transcription       │
     │                            │ ◄────────────────────────│
     │                            │                         │
     │  10. {type: llm,           │                         │
     │       emotion: "happy"}    │  [Hermes processes      │
     │ ◄──────────────────────────│   with 40+ tools —      │
     │                            │   calendar, email,      │
     │  11. {type: tts,           │   goals, team dispatch] │
     │       state: start}        │                         │
     │ ◄──────────────────────────│                         │
     │                            │  12. response.audio     │
     │  13. {type: tts,           │      .delta (PCM)       │
     │       state: sentence_     │ ◄════════════════════════│
     │       start,               │                         │
     │       text: "Sure, I..."}  │  14. Decode base64 →    │
     │ ◄──────────────────────────│      PCM → OPUS encode  │
     │                            │                         │
     │  15. OPUS audio frames     │                         │
     │      (24kHz, paced)        │                         │
     │ ◄══════════════════════════│                         │
     │  ...streaming...           │                         │
     │ ◄══════════════════════════│                         │
     │                            │  16. response.done      │
     │  17. {type: tts,           │ ◄────────────────────────│
     │       state: stop}         │                         │
     │ ◄──────────────────────────│                         │
     │                            │                         │
     │  [Robot returns to         │                         │
     │   listening mode]          │                         │
```

### Tool Execution (Transparent to Robot)

```
StackChan Robot              Bridge Server           OpenAI Realtime
     │                            │                         │
     │  User: "What's on my       │                         │
     │  calendar today?"          │                         │
     │ ══════════════════════════►│ ════════════════════════►│
     │                            │                         │
     │                            │  response.function_call │
     │                            │  {name: "check_calendar"│
     │                            │   args: {date: "today"}}│
     │                            │ ◄────────────────────────│
     │                            │                         │
     │                            │  [Hermes executes tool  │
     │                            │   server-side via the   │
     │                            │   Realtime API — the    │
     │                            │   bridge does NOT need  │
     │                            │   to handle this]       │
     │                            │                         │
     │                            │  response.audio.delta   │
     │                            │  "You have 3 meetings   │
     │  OPUS audio response       │   today..."             │
     │ ◄══════════════════════════│ ◄════════════════════════│
     │                            │                         │
```

## Xiaozhi Wire Protocol Summary

The robot uses the **xiaozhi-esp32 v2.2.4** WebSocket protocol. Key points:

### Transport
- **OTA Bootstrap**: HTTP POST to `/xiaozhi/ota/` — returns WebSocket URL + clock sync
- **Audio Session**: WebSocket at `/xiaozhi/v1/` — OPUS audio + JSON control

### Audio Format
- **Upstream** (robot → server): OPUS, 16kHz, mono, 60ms frames, ~120 bytes each
- **Downstream** (server → robot): OPUS, 24kHz, mono, 60ms frames
- **Binary framing**: Version 1 (raw OPUS, no header) — default when NVS key absent

### Message Types

| Direction | Type | Purpose |
|-----------|------|---------|
| C→S | `hello` | Session init with audio params |
| S→C | `hello` | Reply with session_id + audio params |
| C→S | `listen` | State: start/stop/detect |
| C→S | `abort` | User interrupted playback |
| S→C | `stt` | User transcript |
| S→C | `llm` | Emotion tag for face |
| S→C | `tts` | State: start/sentence_start/stop |
| S→C | `alert` | Error popup |
| Both | binary | OPUS audio frames |

### Timing Constraints
- Hello reply must arrive within **10 seconds**
- Idle timeout: **120 seconds** (both sides)
- Audio pacing: prebuffer 5 frames (300ms), then wall-clock aligned

## Token Authentication Flow

The bridge server authenticates with GVC Hermes to obtain ephemeral OpenAI Realtime tokens:

```
Bridge Server                    GVC Hermes
     │                                │
     │  POST /api/realtime/hermes     │
     │  Cookie: session auth          │
     │  (or API key header)           │
     │ ──────────────────────────────►│
     │                                │
     │  {                             │
     │    client_secret: {            │
     │      value: "ek_...",          │
     │      expires_at: 1234567890    │
     │    }                           │
     │  }                             │
     │ ◄──────────────────────────────│
     │                                │
     │  WS connect to                 │
     │  wss://api.openai.com/         │
     │  v1/realtime?model=            │
     │  gpt-realtime                  │
     │  Authorization: Bearer ek_...  │
     │ ──────────────────────────────►│  OpenAI
     │                                │
```

**Token caching**: Ephemeral tokens are valid for ~60 seconds. The bridge caches and reuses tokens within that window, minting new ones as needed.

**Auth options for the bridge**:
1. **Session cookie** — Extract from browser after logging into voice.visionaryai.marketing
2. **API key** — If/when Hermes exposes a machine-to-machine auth endpoint
3. **Service account** — Long-lived token for the robot's identity

## Emotion/Face Mapping

The device supports these emotions via the `llm` message type:

| Emotion | Face | When Used |
|---------|------|-----------|
| `neutral` | Default calm face | Idle, factual responses |
| `happy` | Smiling, eyes bright | Good news, task completed |
| `sad` | Drooping eyes | Bad news, empathy |
| `angry` | Furrowed brows | Errors, frustrations |
| `surprised` | Wide eyes, O mouth | Unexpected info |
| `confused` | Tilted head, ? eyes | Ambiguous request |

The bridge analyzes response content/context to select appropriate emotions. Phase 1 uses `neutral` as default; Phase 5 adds full emotion detection.

## Configuration

### Environment Variables

```env
# Bridge Server
BRIDGE_PORT=8000
OTA_PORT=8003
BRIDGE_HOST=0.0.0.0

# GVC Hermes Authentication
HERMES_ENDPOINT=https://voice.visionaryai.marketing/api/realtime/hermes
HERMES_AUTH_TOKEN=<session-cookie-or-api-key>

# OpenAI Realtime (configured by Hermes, but overridable)
OPENAI_REALTIME_MODEL=gpt-realtime
OPENAI_REALTIME_VOICE=marin

# Robot Identity
ROBOT_NAME=hermes-stackchan-01
ROBOT_TIMEZONE_OFFSET=-300  # EST in minutes
```

## Development Phases

### Phase 2: Bridge Server Implementation
- [ ] OTA endpoint returning WS URL
- [ ] WebSocket session handler (hello handshake)
- [ ] OPUS decode/encode pipeline (libopus via wasm)
- [ ] OpenAI Realtime WebSocket client
- [ ] Audio pacer (prebuffer + wall-clock pacing)
- [ ] Basic emotion mapping (neutral/happy/sad)
- [ ] Token minting from Hermes endpoint

### Phase 3: Robot Setup
- [ ] Backup stock firmware
- [ ] Flash NVS with WiFi + bridge server URL
- [ ] Verify OTA bootstrap works
- [ ] Test hello handshake

### Phase 4: Integration Testing
- [ ] End-to-end voice conversation
- [ ] Tool execution (calendar, email)
- [ ] Interrupt handling (abort)
- [ ] Reconnection after idle timeout
- [ ] Multi-turn conversation context

### Phase 5: Custom Faces & Personality
- [ ] Hermes-branded face designs
- [ ] Emotion detection from response content
- [ ] Head movement synchronized to speech
- [ ] Custom wake word response
- [ ] LED color coding for state

### Phase 6: AMIE Robot
- [ ] Clone bridge for Vision Board Coach
- [ ] Different system prompt / tools
- [ ] Different face personality
- [ ] Different voice (not marin)

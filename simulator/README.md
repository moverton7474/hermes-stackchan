# StackChan Desktop Simulator

A browser-based desktop simulator for testing StackChan robot interactions before physical hardware arrives.

## Quick Start

1. Open `index.html` in any modern browser (Chrome/Edge recommended for Web Audio API support)
2. Test face expressions using the expression buttons or keyboard shortcuts
3. Type messages in the text box for demo mode (no server needed)
4. Connect to a running stackchan-ai-server for live audio

## Features

- **Robot Face Display** — Animated face with 8 expressions: idle, happy, thinking, concerned, excited, praying, listening, encouraging
- **Push-to-Talk** — Hold Space key or the Talk button to record audio from microphone
- **WebSocket Protocol** — Implements the xiaozhi binary protocol (same as real StackChan hardware)
- **Demo Mode** — Works offline with simulated AMIE coaching responses
- **Session Types** — Switch between all 7 AMIE coaching sessions
- **Expression Detection** — Auto-detects expressions from response text (faith → praying, celebration → excited, etc.)
- **Visionary AI Branding** — Navy #0B1120, Gold #D4A843 color scheme

## Server Dependency

**The stackchan-ai-server must be running for live audio conversations.**

```bash
# Start the server (from stackchan-ai-server repo)
cd stackchan-server/server
go run main.go
# Default: port 12800
```

The simulator connects to: `ws://localhost:12800/xiaozhi/ws`

### Authentication

The stackchan-ai-server requires RSA-encrypted MAC authentication in the Authorization header. For browser-based WebSocket connections (which don't support custom headers), the auth token is passed as a query parameter. You'll need to configure this based on your server setup.

For development/testing, you may need to temporarily disable auth in the server or run a local proxy.

## Binary Protocol

Messages use the format: `[1 byte type][4 bytes big-endian length][payload]`

| Type | Hex  | Direction | Description |
|------|------|-----------|-------------|
| Opus Audio | 0x01 | Both | OPUS-encoded audio frames |
| Avatar Control | 0x03 | Server→Client | Face expression index |
| Motion Control | 0x04 | Server→Client | Head position (x,y) |
| Text Message | 0x07 | Both | UTF-8 text |
| Ping | 0x10 | Client→Server | Heartbeat |
| Pong | 0x11 | Server→Client | Heartbeat response |
| Dance | 0x14 | Server→Client | Trigger celebration |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Space** (hold) | Push-to-talk recording |
| **Enter** (in text box) | Send text message |

## Expression-to-Emotion Mapping

The simulator auto-detects expressions from AMIE's responses:

- **Praying**: pray, scripture, Lord, God, amen, faith
- **Excited**: proud, amazing, great job, celebrate, milestone, 100%
- **Concerned**: missed, behind, struggling, worried
- **Thinking**: think, consider, hmm, let me
- **Encouraging**: believe in you, got this, keep going
- **Happy**: default positive response

## Files

- `index.html` — Self-contained simulator (no dependencies, no build step)
- `README.md` — This file

## Architecture

```
Browser (this simulator)
    ↕ WebSocket (xiaozhi binary protocol)
stackchan-ai-server (Go, port 12800)
    ↕ OpenAI Realtime API / Gemini / etc.
AI Backend (voice processing)
```

## Limitations

- **Audio Encoding**: Browser MediaRecorder produces WebM/Opus containers, while the real StackChan sends raw OPUS frames. The server may need adaptation to accept WebM-wrapped audio from the simulator.
- **No RSA Auth**: Browser WebSocket API can't set custom headers. Auth must be via query param or disabled for testing.
- **No Servo Simulation**: Head movement is simulated as CSS transforms, not physical servo control.
- **Single File**: Intentionally self-contained for simplicity. No npm, no build tools required.

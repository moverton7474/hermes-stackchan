# Hermes StackChan — GVC Hermes Voice Agent in a Desktop Robot

<p align="center">
  <img src="docs/hermes-stackchan-logo.svg" alt="Hermes StackChan" width="200">
</p>

**Turn the $99 M5Stack StackChan AI Desktop Robot into a physical embodiment of GVC Hermes — your AI executive assistant with 40+ tools, voice cloning, and full agent orchestration.**

## What This Is

A bridge server that connects the StackChan robot (ESP32-S3, stock xiaozhi firmware) to [GVC Hermes](https://voice.visionaryai.marketing) via the OpenAI Realtime API. The robot becomes Hermes's physical body — hearing, speaking, and showing emotions through animated faces.

**No firmware modification required.** The stock xiaozhi-esp32 firmware is redirected from the Xiaozhi cloud to our self-hosted bridge server via a simple NVS config change.

## Architecture Overview

```
┌─────────────────────────────────────┐
│  M5Stack StackChan (ESP32-S3)       │
│  Stock xiaozhi-esp32 firmware       │
│  - 2x MEMS microphones             │
│  - Speaker (I2S)                    │
│  - 2" LCD touchscreen              │
│  - Camera (OV2640)                  │
│  - Servo motors (head pan/tilt)     │
│  - Wake word detection (local)      │
└──────────────┬──────────────────────┘
               │ Xiaozhi WebSocket Protocol v1
               │ OPUS audio (16kHz up / 24kHz down)
               │ JSON control messages
               ▼
┌─────────────────────────────────────┐
│  Hermes Bridge Server               │
│  (Node.js, runs on Milton's laptop)  │
│                                     │
│  /xiaozhi/ota/  → OTA bootstrap     │
│  /xiaozhi/v1/   → WebSocket session │
│                                     │
│  ┌───────────────────────────┐      │
│  │ Token Manager             │      │
│  │ POST voice.visionaryai.   │      │
│  │   marketing/api/realtime/ │      │
│  │   hermes                  │      │
│  │ → ephemeral OpenAI token  │      │
│  └───────────┬───────────────┘      │
│              │                      │
│  ┌───────────▼───────────────┐      │
│  │ Audio Pipeline            │      │
│  │ OPUS decode → PCM 16kHz   │      │
│  │ PCM 24kHz → OPUS encode   │      │
│  └───────────┬───────────────┘      │
│              │                      │
│  ┌───────────▼───────────────┐      │
│  │ Emotion Mapper            │      │
│  │ Hermes response → face    │      │
│  │ emotion tags for device   │      │
│  └───────────────────────────┘      │
└──────────────┬──────────────────────┘
               │ OpenAI Realtime WebSocket
               │ (using ephemeral token from Hermes)
               ▼
┌─────────────────────────────────────┐
│  OpenAI Realtime API                │
│  gpt-realtime model                 │
│  Voice: marin                       │
│  System prompt: Hermes v43          │
│  40+ tools (server-side execution)  │
└─────────────────────────────────────┘
```

## Hardware Requirements

| Component | Model | Cost | Notes |
|-----------|-------|------|-------|
| StackChan Robot | M5Stack StackChan AI Desktop Robot Kit | $99 | ESP32-S3, includes servos, case, screen |
| USB-C Cable | Any USB-C data cable | ~$5 | For initial NVS config flash |
| Computer | Any with WiFi | — | Runs the bridge server |

**Total: ~$104**

## Quick Start

### 1. Flash the WiFi/Server Config (one-time)

Connect the robot via USB-C and flash NVS to point at your bridge server:

```bash
# Install esptool
pip install esptool

# Flash NVS config (replaces xiaozhi cloud URL with local bridge)
cd firmware/config
python flash_nvs.py --ssid "YOUR_WIFI" --password "YOUR_PASS" \
  --ota-url "http://YOUR_PC_IP:8003/xiaozhi/ota/"
```

### 2. Start the Bridge Server

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your Hermes auth credentials
npm start
```

### 3. Power On the Robot

The robot connects to WiFi, hits the OTA endpoint, gets the WebSocket URL, and starts talking to Hermes.

## Project Structure

```
hermes-stackchan/
├── README.md                    # This file
├── BUILD-GUIDE.md               # Step-by-step build instructions
├── docs/
│   ├── ARCHITECTURE.md          # Detailed architecture + sequence diagrams
│   ├── PROTOCOL.md              # Xiaozhi wire protocol reference
│   └── FACES.md                 # Face/emotion design spec
├── firmware/
│   └── config/
│       ├── flash_nvs.py         # NVS partition flasher
│       ├── nvs_template.csv     # NVS partition template
│       └── backup_firmware.sh   # Stock firmware backup script
├── server/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.ts             # Entry point
│       ├── ota.ts               # OTA bootstrap endpoint
│       ├── xiaozhi-ws.ts        # Xiaozhi WebSocket handler
│       ├── hermes-token.ts      # Hermes token minting
│       ├── realtime-bridge.ts   # OpenAI Realtime bridge
│       ├── audio.ts             # OPUS encode/decode
│       └── emotion.ts           # Emotion/face mapping
├── faces/
│   └── hermes-faces.md          # Face design specifications
└── .gitignore
```

## How It Works

1. **Robot boots** → connects to WiFi → hits OTA endpoint on bridge server
2. **Bridge returns** WebSocket URL pointing to itself
3. **Robot opens WS** → sends `hello` with audio params (OPUS, 16kHz, mono)
4. **User speaks** → robot sends `listen:start` + OPUS audio frames
5. **Bridge decodes** OPUS → PCM, streams to OpenAI Realtime (with Hermes system prompt + tools)
6. **OpenAI responds** with audio → bridge encodes PCM → OPUS, sends to robot
7. **Robot plays audio** through speaker, shows face expression based on emotion tag
8. **Tools execute server-side** — Hermes handles calendar, email, goals, team dispatch etc.

## Status

🔴 **Phase 1: Research & Architecture** (current) — Design complete, awaiting hardware  
⬜ Phase 2: Bridge Server Implementation  
⬜ Phase 3: Robot Setup & NVS Flash  
⬜ Phase 4: Integration Testing  
⬜ Phase 5: Custom Faces & Personality  
⬜ Phase 6: AMIE Robot (second unit)  

## Credits

- [stack-chan](https://github.com/stack-chan/stack-chan) — Official StackChan firmware
- [stackchan-ai-server](https://github.com/rudyll/stackchan-ai-server) — OpenAI Realtime bridge reference
- [warble](https://github.com/rebelthor/warble) — Fully local voice backend (protocol spec)
- [Mark Kashef's video](https://youtu.be/5cZontQjBH4) — Inspiration for the build

## License

MIT

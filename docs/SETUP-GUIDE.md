# Hermes StackChan Robot — Setup Guide

Step-by-step guide for when the robots arrive.

## Prerequisites

- StackChan robot(s) with stock M5Stack firmware
- Computer with Docker installed (or the Batman VPS)
- WiFi network (2.4 GHz — ESP32 doesn't support 5 GHz)
- OpenAI API key with Realtime API access
- MicroSD card (if configuring via SD card)

## Architecture

```
┌─────────────┐     WiFi/WebSocket      ┌──────────────────────┐     HTTPS     ┌─────────────┐
│  StackChan   │ ──────────────────────► │  stackchan-ai-server │ ────────────► │  OpenAI      │
│  (stock FW)  │ ◄────────────────────── │  (Docker container)  │ ◄──────────── │  Realtime    │
│              │   OPUS audio frames     │                      │   PCM audio   │  API         │
│  16kHz OPUS  │   Xiaozhi WS protocol   │  OPUS ↔ PCM bridge   │               │              │
└─────────────┘                          │  System prompt       │               └─────────────┘
                                         │  Hermes personality  │
                                         └──────────────────────┘
```

The server handles:
- **OPUS codec**: Device sends 16kHz OPUS → server decodes → resamples to 24kHz PCM for OpenAI
- **OpenAI reply**: 24kHz PCM from OpenAI → server encodes to OPUS → sends back to device
- **System prompt**: Hermes personality injected into the OpenAI Realtime session
- **Device profiles**: Per-robot personality overrides (for Robot #2 AMIE)
- **Conversation history**: Remembers context across sessions (optional)

## Step 1: Start the Server

### Option A: Docker (Recommended)

```bash
# 1. Clone the AI server (if not already done)
cd ~/stackchan-research
git clone https://github.com/rudyll/stackchan-ai-server.git

# 2. Set up configuration
cd ~/hermes-stackchan/config
cp env.template .env

# 3. Edit .env — fill in these two REQUIRED values:
#    STACKCHAN_LOCAL_HOST=192.168.1.100  (your server's LAN IP)
#    STACKCHAN_OPENAI_API_KEY=sk-...     (your OpenAI API key)

# 4. Start the server
docker compose -f docker-compose.yml up -d

# 5. Check it's running
docker compose -f docker-compose.yml logs -f
```

### Option B: Direct on VPS

```bash
# SSH into Batman VPS
ssh -i ~/.ssh/batman-mo-vps root@187.77.219.169

# Clone and build
cd /opt
git clone https://github.com/rudyll/stackchan-ai-server.git
cd stackchan-ai-server/stackchan-server

# Copy env template
cp ~/hermes-stackchan/config/env.template .env
# Edit .env with your values

# Run with Docker
docker compose -f docker-compose.standalone.yml up -d
```

## Step 2: Configure the Robot

### Method: Stock Firmware WiFi Setup

The stock M5Stack StackChan firmware has a built-in WiFi configuration mode:

1. **Power on the StackChan** — it should enter setup mode on first boot
2. **Connect to its WiFi AP** — look for an SSID like "StackChan-XXXX"
3. **Configure via the web interface** or M5Stack companion app:
   - WiFi SSID: your 2.4 GHz network name
   - WiFi Password: your network password
   - Server URL: `ws://YOUR_SERVER_LAN_IP:12800`
4. **Save and reboot** — the robot should connect to your WiFi and then to the server

### Alternative: SD Card Configuration

If supported by your firmware version:
1. Copy `config/device-config.json` to a MicroSD card as `config.json`
2. Edit the file — replace placeholders with your actual values
3. Insert the SD card into the StackChan
4. Power on — the robot reads config from SD on boot

## Step 3: Verify Connection

1. **Check server logs** for a new WebSocket connection:
   ```bash
   docker compose -f config/docker-compose.yml logs -f stackchan
   ```
   Look for: `There is a StackChen connected to the service.`

2. **Talk to the robot** — press the button/wake word and say something
   - The face should change to a listening expression
   - After you stop talking, it should show a thinking expression
   - Then it speaks the response and shows a talking expression

3. **Check the settings UI** at `http://localhost:8099`
   - Shows connected devices
   - Allows changing system prompt, voice, and provider settings

## Step 4: Customize (Optional)

### Change the Voice
Edit `.env`:
```
STACKCHAN_OPENAI_TTS_VOICE=marin
```
Available voices: alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar

### Add Robot #2 (AMIE) with Different Personality
Use device profiles in `.env` — keyed by the robot's MAC address:
```
STACKCHAN_DEVICE_PROFILES={"AA:BB:CC:DD:EE:FF":{"system_prompt":"You are AMIE, a warm and encouraging coaching assistant...","openai_tts_voice":"coral"}}
```
Find the MAC address in the server logs when the device connects.

### Use Gemini Instead of OpenAI
```
STACKCHAN_AI_PROVIDER=gemini
STACKCHAN_GEMINI_API_KEY=your-key
STACKCHAN_GEMINI_MODEL=gemini-2.5-flash-native-audio-latest
STACKCHAN_GEMINI_VOICE=Aoede
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Robot won't connect | Check WiFi is 2.4 GHz. Verify server IP is correct. Check firewall allows port 12800. |
| No audio response | Check OpenAI API key is valid and has Realtime access. Check server logs for errors. |
| Audio is distorted | Try adjusting `STACKCHAN_AUDIO_PREBUFFER_MS` (increase to 600). |
| Response too slow | Prebuffer adds latency — decrease `STACKCHAN_AUDIO_PREBUFFER_MS` to 120. |
| Settings UI not accessible | It only binds to 127.0.0.1. Use SSH tunnel: `ssh -L 8099:127.0.0.1:8099 user@server` |

## Reference

- **stackchan-ai-server**: https://github.com/rudyll/stackchan-ai-server
- **Protocol**: Xiaozhi binary WebSocket (OPUS audio frames, 60ms at 16kHz)
- **Ports**: 12800 (WebSocket), 8099 (Settings UI, localhost only)
- **Data directory**: `./data/` (persists settings and conversation history)

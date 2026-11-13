# StackChan Robot Integration — Safe Change Plan (v2)

**Date:** 2026-11-13 (Updated)
**Author:** localagent (Hermes Desktop Agent)
**Objective:** Run Hermes AI personality on StackChan robots using stock firmware
**Risk Level:** LOW — no custom firmware, no production system changes

---

## Executive Summary

**Simplified approach:** Use rudyll/stackchan-ai-server as the bridge server with STOCK M5Stack firmware on the robots. No custom firmware flashing needed.

The server handles everything:
- OPUS codec (16kHz device ↔ 24kHz OpenAI Realtime)
- OpenAI Realtime API connection with Hermes system prompt
- Per-device personality profiles (Hermes vs AMIE)
- Conversation history
- Settings UI for live configuration

**Robot #1** = GVC Hermes (Milton AI assistant)
**Robot #2** = AMIE (Visionary AI Coach)

### Key Repos
| Repo | Purpose | Location |
|------|---------|----------|
| moverton7474/hermes-stackchan | Config, prompts, docs, deployment | ~/hermes-stackchan |
| rudyll/stackchan-ai-server | Bridge server (upstream, used as-is) | ~/stackchan-research/stackchan-ai-server |
| circlemouth/Hermes-StackChan | MCP tool patterns reference only | ~/stackchan-research/hermes-stackchan-ref |
| Adolanium/hermes-gadget-sdk | Future: official Hermes gadget SDK | ~/stackchan-research/hermes-gadget-sdk |

---

## What NOT to Change

- Stock firmware on robots — no custom flashing
- GVC production — no changes needed (direct OpenAI API)
- VIIF — non-negotiable
- Visionary AI Coach production
- Supabase, approval queue, memory system
- Any upstream repos — we use them as-is

---

## Phase 0: Research and Analysis ✅ DONE

- Analyzed stackchan-ai-server architecture (Go server, OPUS, OpenAI Realtime, Gemini Live)
- Analyzed Hermes-StackChan MCP tools (13 robot control tools — reference only)
- Analyzed hermes-gadget-sdk (official Nous Research ESP32 SDK — future path)
- Extracted GVC Hermes system prompt for robot adaptation

### Key Findings: stackchan-ai-server

Architecture: Go server with WebSocket bridge
- Port 12800: Xiaozhi binary WebSocket protocol (device connections)
- Port 8099: Settings UI (web-based, auth-protected)
- OPUS codec: 16kHz mono from device decode resample to 24kHz OpenAI Realtime PCM response PCM encode to OPUS send to device
- 60ms frames: 960 samples at 16kHz, 1440 samples at 24kHz
- Providers: OpenAI Realtime (native WS), Gemini Live, OpenAI-compatible (STT+LLM+TTS pipeline)
- Device profiles: Per-MAC overrides for provider, voice, model, system prompt
- System prompt: Injected via env var STACKCHAN_SYSTEM_PROMPT, base64 encoded in config
- Auth: Device authenticates via RSA-encrypted MAC+timestamp token in WS header
- Standalone mode: Docker container with .env file, no Home Assistant required
- Settings persistence: JSON file in /data/stackchan-settings.json
- OTA: HTTPS intercept at port 443 for api.tenclass.net DNS override
- Server VAD: End-of-speech detection for firmware that never sends listen:stop
- Conversation history: Configurable retention and context window

### Key Findings: Hermes-StackChan MCP Tools (Reference)

13 tools exposed via MCP stdio protocol:
1. stackchan_get_status — battery, WiFi, volume, firmware version
2. stackchan_set_speaker_volume — 0-100, permanent flag
3. stackchan_play_test_tone — diagnostic sine tone
4. stackchan_get_head_angles — current yaw/pitch
5. stackchan_set_head_angles — move head (yaw +/-128, pitch 0-90, speed)
6. stackchan_set_led_color — RGB LED (0-168 per channel)
7. stackchan_power_off — shutdown
8. stackchan_take_photo — camera capture as MCP image
9. stackchan_display_image — show image on screen
10. stackchan_capture_screen — screenshot of device display
11. stackchan_create_reminder — local timer with message
12. stackchan_get_reminders — list active reminders
13. stackchan_stop_reminder — cancel by ID
14. stackchan_ask_hermes_subagent — delegate to background Hermes sub-agent

Note: These require custom firmware. With stock firmware, we get voice-only. MCP tools are a future enhancement path.

### Key Findings: hermes-gadget-sdk

- Official Nous Research SDK for Hermes + ESP32 devices
- Push-to-talk interface, face display, agent tool exposure
- Desktop simulator available (no hardware needed)
- Future path: could build custom Hermes gadget firmware for StackChan

---

## Phase 1: Clone and Analyze ✅ DONE

- Step 1.1: Clone reference repos ✅ (all cloned to ~/stackchan-research/)
- Step 1.2: Deep-read stackchan-ai-server ✅ (documented above)
- Step 1.3: Extract MCP tool patterns ✅ (13 tools documented)
- Step 1.4: Read hermes-gadget-sdk ✅ (evaluated as future path)

---

## Phase 2: Build Hermes Robot Configuration ✅ DONE

- Step 2.1: Extract and adapt GVC Hermes system prompt ✅
  - Extracted HERMES_REALTIME_SYSTEM_BASE from gvc-review route.ts
  - Created condensed robot-mode prompt in prompts/hermes-robot-prompt.md
  - AMIE placeholder at prompts/amie-robot-prompt.md

- Step 2.2: Create deployment config files ✅
  - config/env.template — all stackchan-ai-server env vars with Hermes defaults
  - config/docker-compose.yml — Docker Compose for running the server
  - config/device-config.json — SD card config template for robot WiFi + server URL

- Step 2.3: Create setup guide ✅
  - docs/SETUP-GUIDE.md — step-by-step: start server, configure robot, verify, customize

---

## Phase 3: Physical Setup (WHEN ROBOTS ARRIVE)

- Step 3.1: Unbox and power on — verify stock firmware boots (NONE risk)
- Step 3.2: Start bridge server — copy env.template to .env, fill in API key and LAN IP, docker compose up (NONE risk)
- Step 3.3: Configure robot WiFi + server URL — stock firmware setup mode or SD card (NONE risk)
- Step 3.4: End-to-end voice test — talk to robot, verify Hermes responds (NONE risk)
- Step 3.5: Configure Robot #2 (AMIE) — find MAC, add device profile with AMIE prompt (NONE risk)
- Step 3.6: Record demo video — 60-second video for M5Stack partnership

---

## Phase 4: Production Deployment (REQUIRES MILTON APPROVAL)

- Step 4.1: Deploy bridge server to Batman VPS — Docker container for any-WiFi access
- Step 4.2: GVC integration (optional) — add robot as agent in GVC fleet
- Step 4.3: MCP tool integration (optional) — requires custom firmware

---

## Decision Log

| Decision | Chosen | Reason |
|----------|--------|--------|
| Custom firmware vs stock | Stock firmware | Eliminates risk, robots work out of box |
| Bridge server | rudyll/stackchan-ai-server | Production Go server, OPUS, Docker-ready |
| Auth strategy | Direct OpenAI API | No GVC changes needed |
| Robot #1 first | Hermes | Simpler, proves pipeline, then AMIE via profiles |
| Hermes-StackChan MCP tools | Reference only | Require custom firmware, Phase 4 |
| hermes-gadget-sdk | Future path | Official SDK, longer-term |

---

## Open Questions

1. Which OpenAI Realtime voice sounds best through StackChan speaker? (marin vs alloy vs coral)
2. Does stock firmware auto-reconnect when server restarts?
3. Battery life in continuous voice mode?
4. Can the settings UI (port 8099) be exposed securely for remote management?

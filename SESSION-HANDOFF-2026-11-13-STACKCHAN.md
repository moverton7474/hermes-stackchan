# Session Handoff — StackChan Robot Project
**Date:** 2026-11-13 | **Repo:** moverton7474/hermes-stackchan | **Local:** ~/hermes-stackchan

---

## Summary

This session launched the Hermes StackChan robot project — turning a $99 M5Stack StackChan K151 robot (ESP32-S3, WiFi, mic, speaker, camera, touchscreen, servos) into a physical embodiment of GVC Hermes and the AMIE AI Coach. Key discovery: **no firmware modification needed** — stock xiaozhi-esp32 firmware supports configurable server URLs via SD card. We use `rudyll/stackchan-ai-server` as the bridge server (Docker, OPUS codec, OpenAI Realtime + Gemini Live support).

Two robots ordered (arriving via DHL):
- **Robot #1:** Hermes (port 12800, marin voice) — desk assistant
- **Robot #2:** AMIE (port 12801, coral voice) — AI sports/fitness coach

## Architecture

```
StackChan Robot (stock firmware)
  ↕ WebSocket (OPUS audio)
rudyll/stackchan-ai-server (Docker, port 12800/12801)
  ↕ OpenAI Realtime API
OpenAI GPT-4o-realtime
  (with Hermes/AMIE system prompt)
```

Auth strategy: Direct OpenAI Realtime with Hermes system prompt (Option 3 — no GVC prod changes needed). Bridge server handles audio codec conversion (OPUS ↔ PCM), session management, and prompt injection.

## What Was Built This Session

### Research (Phase 0 — COMPLETE)
- Analyzed all 48 Hermes voice tools → 40/48 (83%) mapped as robot-relevant (docs/CAPABILITY-MAP.md)
- Researched hardware expansion: Grove ports for cameras, IMU, heart rate sensors
- Researched M5Stack commercial partnership (ODM/Tailored Solutions tier)
- Created 21KB AMIE analysis from Visionary AI Coach codebase (docs/AMIE-ROBOT-ANALYSIS.md)

### Reference Projects (cloned to ~/stackchan-research/)
- **rudyll/stackchan-ai-server** (25 stars) — Production Docker server with OPUS codec, OpenAI Realtime + Gemini Live. **THIS IS THE BRIDGE SERVER WE USE.**
- **circlemouth/Hermes-StackChan** — StackChan + HermesAgent with ai-server bridge, 13 MCP tools. REFERENCE ONLY.
- **Adolanium/hermes-gadget-sdk** — Official Nous Research ESP32 SDK. Future reference.
- **dax8it/nous-girl-stackchan** — Hermes Agent brain + custom firmware + dance modes.

### Phases 1-2 (COMPLETE)
- Full repo scaffold with configs, prompts, docs, faces, simulator
- Docker configs for both Hermes and AMIE bridge servers
- Device SD card config templates
- Browser-based desktop simulator with push-to-talk

## Files Created

| Path | Description |
|------|-------------|
| `prompts/hermes-robot-prompt.md` | GVC Hermes identity condensed for robot |
| `prompts/amie-robot-prompt.md` | Full AMIE coaching personality (~2800 tokens, 7 session types, 20+ tools) |
| `config/env.template` | stackchan-ai-server config (port 12800, marin voice, OpenAI Realtime) |
| `config/docker-compose.yml` | Docker launch for Hermes bridge server |
| `config/device-config.json` | StackChan SD card WiFi + server URL template |
| `config/amie-env.template` | AMIE server config (port 12801, coral voice) |
| `config/amie-docker-compose.yml` | AMIE Docker alongside Hermes |
| `docs/SETUP-GUIDE.md` | Step-by-step for when robots arrive |
| `docs/DEMO-SCRIPT.md` | 60-second video script for M5Stack partnership |
| `docs/AMIE-ROBOT-ANALYSIS.md` | 21KB comprehensive AMIE analysis |
| `docs/CAPABILITY-MAP.md` | 40/48 Hermes tools mapped to robot capabilities |
| `docs/ARCHITECTURE.md` | Bridge server architecture with diagrams |
| `docs/M5STACK-PARTNERSHIP-INQUIRY.md` | Formal partnership document |
| `docs/m5stack-email-draft.txt` | Email ready to send (AFTER demo video) |
| `faces/hermes-faces-preview.html` | 6 animated face states for Hermes robot |
| `faces/amie-faces-preview.html` | 7 animated face states for AMIE robot |
| `simulator/index.html` | Browser-based desktop simulator with push-to-talk |
| `simulator/README.md` | Simulator docs |
| `SAFE-PLAN.md` | v2 safe change plan (6 phases) |
| `ROADMAP.md` | 5-phase product roadmap (desk robot → AMIE → commercial) |

## Key Decisions

1. **Use rudyll/stackchan-ai-server as bridge** — NOT build from scratch, NOT fork Hermes-StackChan
2. **Keep stock M5Stack firmware** on robots — no custom flashing needed
3. **Auth: Direct OpenAI Realtime** with Hermes system prompt (Option 3 — no GVC prod changes)
4. **Robot #1 = Hermes** (port 12800, marin voice), **Robot #2 = AMIE** (port 12801, coral voice)
5. **Don't send M5Stack partnership email** until working demo video recorded
6. **AMIE platform already supports `deviceType: 'robot'`** — zero code changes for Phase 2

## SAFE-PLAN.md Status

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | ✅ DONE | Research |
| 1 | ✅ DONE | Clone repos + local setup |
| 2 | ✅ DONE | Build bridge config |
| 3 | ⏳ WAITING | Flash + test physical robots (waiting for DHL) |
| 4 | 🔒 BLOCKED | GVC production integration (needs Milton approval) |
| 5 | 📋 PLANNED | AMIE Robot #2 build |
| 6 | 📋 PLANNED | Commercial product prep |

## Next Steps (Priority Order)

1. **When robots arrive from DHL:** execute Phase 3 (flash, configure WiFi, test)
2. **Record 60-second demo video** per `docs/DEMO-SCRIPT.md`
3. **Send M5Stack partnership email** with demo video attached
4. **Draft provisional patent update** with robot embodiment claims (read `~/GF-Accelerate/uspto-filing-assistant` repo)
5. **Build AMIE coaching content** (football/basketball drills, fitness routines)
6. **Product landing page** for AMIE Robot Coach on Vercel

## Open Questions

1. Does stock StackChan K151 firmware support `websocket_url` config via SD card or only BLE?
2. Battery life in continuous voice mode?
3. Which OpenAI Realtime voice sounds best through StackChan speaker?
4. Can bridge server run on laptop or needs VPS for latency?

## Environment

- **OS:** Windows 11, HP OmniBook X Flip (ARM64)
- **Python:** 3.14.9 (`python` command), pip→python3.11
- **Node.js:** available
- **Docker:** needs verification on Windows
- **ESP-IDF:** NOT YET INSTALLED (install when robots arrive)
- **GH CLI:** authenticated as moverton7474
- **Hermes profile:** default
- **uv:** installed

## Credentials & Access

| Resource | Access Method |
|----------|--------------|
| OpenAI API key | Hermes vault (`browser_vault`) |
| Supabase lobby | Project `vjlsjnhacarurcoqcwki`, creds in `~/batmanmo74/.env` |
| GVC Hermes | `voice.visionaryai.marketing` |
| Batman VPS | `ssh -i ~/.ssh/batman-mo-vps root@187.77.219.169` |
| GitHub | `moverton7474` (GH CLI authenticated) |
| Lobby bridge | `cd ~ && python hermes-bridge.py post "MESSAGE"` |

## Reference Repos (cloned to ~/stackchan-research/)

| Repo | Stars | Use |
|------|-------|-----|
| `rudyll/stackchan-ai-server` | 25 | **PRIMARY — bridge server we deploy** |
| `circlemouth/Hermes-StackChan` | — | Reference for MCP tool integration patterns |
| `Adolanium/hermes-gadget-sdk` | — | Official Nous Research ESP32 SDK (future) |
| `dax8it/nous-girl-stackchan` | — | Custom firmware + dance modes reference |

## GVC Hermes Context

- **PR #425 merged:** execution-bias rule, goal dedup, stale localagent fix, prompt v38
- **PR #426 merged:** sanitizeToolJson() server-side at 3 parse boundaries, 10 tests
- GVC repo local: `~/gvc-review` (moverton7474/gemini-voice-center)
- Updated GVC and Visionary AI Coach roadmaps with physical robot strategy

---

*Generated by Hermes Agent session 2026-11-13. Load this file at session start for full continuity.*

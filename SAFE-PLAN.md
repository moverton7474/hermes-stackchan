# StackChan Robot Integration — Safe Change Plan

**Date:** 2026-11-13
**Author:** localagent (Hermes Desktop Agent)
**Objective:** Integrate proven StackChan + Hermes Agent projects into Milton's robot builds
**Risk Level:** LOW — all work is additive, in new repos, no production systems modified until Phase 4

---

## Executive Summary

Three proven open-source projects already solve what we were building from scratch:
1. `circlemouth/Hermes-StackChan` — StackChan firmware + ai-server bridge + Hermes Agent brain + 13 MCP robot tools
2. `rudyll/stackchan-ai-server` — Production Docker server with OPUS codec, OpenAI Realtime + Gemini Live
3. `Adolanium/hermes-gadget-sdk` — Official Nous Research SDK for Hermes + ESP32 devices

**Strategy:** Fork Hermes-StackChan as the foundation, integrate stackchan-ai-server's OPUS pipeline, and connect to GVC Hermes Realtime endpoint for Robot #1 (Hermes) and Visionary AI Coach for Robot #2 (AMIE).

---

## What NOT to Change

- ❌ GVC production (voice.visionaryai.marketing) — no changes until Phase 4
- ❌ VIIF — non-negotiable (rule 6)
- ❌ Visionary AI Coach production app — no changes until Phase 5
- ❌ Existing Hermes voice prompt or tools — robot uses them as-is
- ❌ Supabase RLS, approval queue, memory system
- ❌ Any existing StackChan community firmware — we fork, not modify upstream

---

## Phase 0: Research & Analysis (DONE ✅)

**What was completed this session:**
- Identified 3 proven reference projects
- Analyzed Hermes-StackChan architecture (firmware → ai-server → HermesAgent)
- Analyzed stackchan-ai-server (Docker, OPUS, OpenAI Realtime, Gemini Live)
- Analyzed nous-girl-stackchan (Hermes Agent brain, anime faces, dance modes)
- Analyzed hermes-gadget-sdk (official Nous Research ESP32 SDK)
- Created capability mapping (40/48 Hermes tools are robot-relevant)
- Created 5-phase product roadmap
- Documented face expressions and head choreography specs

---

## Phase 1: Fork & Local Setup (NO SERVER CHANGES)

### Step 1.1: Fork Hermes-StackChan
- **What:** Fork `circlemouth/Hermes-StackChan` to `moverton7474/hermes-stackchan` (update existing repo)
- **Risk:** NONE — new code in our own repo
- **Safety check:** Verify upstream repo is accessible and has the ai-server + firmware
- **Execution:**
  ```bash
  cd ~/stackchan-research
  git clone https://github.com/circlemouth/Hermes-StackChan.git hermes-stackchan-upstream
  # Read the full codebase end-to-end
  # Copy relevant components into ~/hermes-stackchan
  ```
- **Reversible:** Delete the fork
- **Dependencies:** None

### Step 1.2: Clone stackchan-ai-server for OPUS reference
- **What:** Clone the production OPUS codec implementation to use as reference
- **Risk:** NONE — read-only reference
- **Safety check:** Verify it handles 16kHz→24kHz OPUS encode/decode
- **Execution:**
  ```bash
  cd ~/stackchan-research
  git clone https://github.com/rudyll/stackchan-ai-server.git
  # Extract OPUS pipeline code for integration
  ```
- **Reversible:** N/A (read-only)
- **Dependencies:** None

### Step 1.3: Clone hermes-gadget-sdk for ESP32 patterns
- **What:** Clone the official Nous Research SDK for ESP32 + Hermes integration patterns
- **Risk:** NONE — read-only reference
- **Execution:**
  ```bash
  cd ~/stackchan-research
  git clone https://github.com/Adolanium/hermes-gadget-sdk.git
  ```
- **Reversible:** N/A
- **Dependencies:** None

### Step 1.4: Set up local development environment
- **What:** Install ESP-IDF v5.5.4 toolchain for firmware compilation
- **Risk:** LOW — local tooling only
- **Safety check:** Verify ESP-IDF installs without breaking existing Node/Python
- **Execution:**
  ```bash
  cd ~
  git clone -b v5.5.4 --recursive https://github.com/espressif/esp-idf.git esp-idf
  ./esp-idf/install.sh esp32s3
  ```
- **Reversible:** `rm -rf ~/esp-idf`
- **Dependencies:** Python 3.11 (already installed)

---

## Phase 2: Build the Bridge Server (LOCAL ONLY)

### Step 2.1: Integrate OPUS codec from stackchan-ai-server
- **What:** Replace our scaffold `audio.ts` with working OPUS from stackchan-ai-server
- **Risk:** NONE — local code change in our repo
- **Safety check:** Unit test encode/decode round-trip
- **Execution:** Copy OPUS implementation, adapt to our TypeScript types, write tests
- **Reversible:** `git revert`
- **Dependencies:** Step 1.2 complete

### Step 2.2: Integrate ai-server bridge from Hermes-StackChan
- **What:** Adopt the proven ai-server WebSocket bridge pattern, adapt for GVC Hermes Realtime
- **Risk:** NONE — local code
- **Safety check:** Verify xiaozhi protocol v3 compatibility
- **Execution:** Merge ai-server TypeScript code, replace local HermesAgent calls with GVC Hermes token minting + OpenAI Realtime WebSocket
- **Reversible:** `git revert`
- **Dependencies:** Step 1.1 complete

### Step 2.3: Implement GVC Hermes auth strategy
- **What:** Solve the authentication problem — the robot can't log in via browser
- **Risk:** LOW — design decision, no prod changes yet
- **Options (evaluate in order):**
  1. **Service token** — Create a robot-specific long-lived token in GVC (requires GVC change in Phase 4)
  2. **Proxy auth** — Bridge server holds a valid session and proxies robot requests (works without GVC changes)
  3. **Direct OpenAI** — Bridge server mints OpenAI Realtime tokens directly using the OpenAI API key from vault, with Hermes system prompt injected (bypasses GVC auth entirely)
- **Safety check:** Option 3 works without touching GVC production. Start there.
- **Execution:** Implement Option 3 as default, Option 1 as upgrade path
- **Reversible:** Environment variable toggle between options
- **Dependencies:** OpenAI API key from vault

### Step 2.4: Add MCP robot control tools from Hermes-StackChan
- **What:** Integrate the 13 proven MCP tools for robot control (move head, change face, dance, LED)
- **Risk:** NONE — local code
- **Safety check:** Verify tool definitions match our firmware
- **Execution:** Copy MCP tool definitions, adapt to our bridge server
- **Reversible:** `git revert`
- **Dependencies:** Step 2.2 complete

### Step 2.5: Local testing with simulator
- **What:** Use the Hermes-StackChan desktop UI simulator to test without physical robot
- **Risk:** NONE
- **Safety check:** Simulator renders face + responds to WebSocket messages
- **Execution:** Build and run `firmware/tools/ui_sim/`
- **Reversible:** N/A
- **Dependencies:** Step 2.2 complete

---

## Phase 3: Flash & Test Physical Robots (WHEN DHL DELIVERS)

### Step 3.1: Backup stock firmware
- **What:** Read full 16MB flash from both StackChans before any changes
- **Risk:** NONE — read-only
- **Safety check:** Verify backup file size is exactly 16MB (16,777,216 bytes)
- **Execution:**
  ```bash
  esptool --port PORT read-flash 0 0x1000000 stackchan-backup-hermes.bin
  esptool --port PORT read-flash 0 0x1000000 stackchan-backup-amie.bin
  ```
- **Reversible:** `esptool --port PORT write-flash 0 stackchan-backup-hermes.bin`
- **Dependencies:** Robots physically present + USB cable

### Step 3.2: Flash Hermes firmware to Robot #1
- **What:** Build and flash the Hermes-StackChan firmware
- **Risk:** LOW — backup exists for rollback
- **Safety check:** Backup verified, USB connection stable
- **Execution:**
  ```bash
  cd firmware
  source ~/esp-idf/export.sh
  idf.py set-target esp32s3
  python3 ./fetch_repos.py
  idf.py build
  idf.py -p PORT flash
  ```
- **Reversible:** Restore from backup
- **Dependencies:** Step 3.1 complete, Phase 2 complete

### Step 3.3: Configure WiFi + bridge server URL via BLE
- **What:** Use BLE provisioning to set WiFi credentials and bridge server address
- **Risk:** NONE — configuration only
- **Safety check:** Verify robot connects to WiFi (check LED indicator)
- **Execution:** Use StackChan app or BLE config tool
- **Reversible:** Re-provision with different settings
- **Dependencies:** Step 3.2 complete, bridge server running

### Step 3.4: End-to-end voice test (Robot #1 → Bridge → Hermes)
- **What:** Say "Hey Hermes, what's on my calendar?" and verify the full loop works
- **Risk:** NONE — read-only Hermes tools
- **Safety check:** Bridge server logs show connected session, audio flowing
- **Test sequence:**
  1. Wake word → robot face changes to listening
  2. Speak command → audio streams to bridge → bridge sends to OpenAI Realtime
  3. Response received → bridge sends audio back → robot speaks + face animates
  4. Verify: calendar data is correct (matches actual calendar)
- **Reversible:** N/A (testing only)
- **Dependencies:** Steps 3.2 + 3.3 complete

### Step 3.5: Record demo video
- **What:** Record 60-second demo of working Hermes robot for M5Stack partnership email
- **Risk:** NONE
- **Execution:** Phone video of robot conversation + face expressions
- **Dependencies:** Step 3.4 passes

---

## Phase 4: GVC Hermes Production Integration (REQUIRES MILTON APPROVAL)

### Step 4.1: Add robot auth endpoint to GVC
- **What:** Add a `/api/realtime/hermes/robot` endpoint that accepts a robot service token instead of browser session
- **Risk:** MEDIUM — production code change
- **Safety check:** Endpoint is additive, does not modify existing `/api/realtime/hermes`
- **Execution:** PR to `moverton7474/gemini-voice-center`, Milton approves
- **Reversible:** Revert PR
- **Dependencies:** Phase 3 passes, Milton approves

### Step 4.2: Register robot as agent in GVC
- **What:** Add `hermes-robot` as a device identity in the agent fleet (like localagent/batmanmo74)
- **Risk:** LOW — additive to agent presence
- **Safety check:** Does not conflict with existing agent IDs
- **Execution:** PR to GVC, add to AGENTS.md and agent allowlist
- **Reversible:** Remove from allowlist
- **Dependencies:** Step 4.1 complete

### Step 4.3: Deploy bridge server to Batman VPS
- **What:** Run the bridge server as a PM2 process on Batman VPS so robot works from any WiFi
- **Risk:** LOW — new PM2 process, no changes to existing processes
- **Safety check:** Verify VPS has available ports, no conflict with existing services
- **Execution:** `propose_action` with `vps_command` to set up PM2
- **Reversible:** `pm2 delete hermes-stackchan-bridge`
- **Dependencies:** Steps 4.1 + 4.2 complete, VPS SSH working

---

## Phase 5: AMIE Robot Build (Robot #2)

### Step 5.1: Create AMIE bridge server variant
- **What:** Fork the Hermes bridge server, replace GVC Hermes with Visionary AI Coach AMIE
- **Risk:** NONE — separate codebase
- **Safety check:** AMIE Realtime endpoint accessible
- **Execution:** New branch or directory in hermes-stackchan repo
- **Reversible:** Delete branch
- **Dependencies:** Phase 3 proven with Robot #1

### Step 5.2: Flash AMIE firmware to Robot #2
- **What:** Same firmware, different bridge server URL pointing to AMIE
- **Risk:** LOW — backup exists
- **Execution:** Same flash process, different NVS config
- **Dependencies:** Step 5.1 complete

### Step 5.3: AMIE-specific face designs + coaching session types
- **What:** Custom face expressions for coaching (encouraging, celebrating, praying, concerned)
- **Risk:** NONE — asset files
- **Dependencies:** Step 5.2 complete

### Step 5.4: Test AMIE coaching session via robot
- **What:** "Hey AMIE, coach me on my goals" → full coaching conversation
- **Test sequence:**
  1. Morning briefing with goal review
  2. Habit accountability check
  3. Guided prayer session
  4. Goal completion celebration (dance!)
- **Dependencies:** Step 5.3 complete

---

## Phase 6: Commercial Product Preparation

### Step 6.1: Send M5Stack partnership email (WITH demo video)
- **Dependencies:** Phase 3 Step 3.5 (demo video recorded)

### Step 6.2: File updated provisional patent with robot embodiment claims
- **Dependencies:** Working prototype demonstrated

### Step 6.3: Create product landing page for AMIE Robot Coach
- **Dependencies:** Phase 5 complete

---

## Decision Log

| Decision | Chosen | Reason |
|---|---|---|
| Build from scratch vs fork | **Fork Hermes-StackChan** | Saves weeks — OPUS, MCP tools, BLE provisioning, simulator all proven |
| Auth strategy | **Option 3 first** (direct OpenAI with Hermes prompt) | Works without GVC production changes; upgrade to service token later |
| Bridge server location | **Local first**, Batman VPS later | Test locally, deploy to VPS in Phase 4 for any-WiFi access |
| Firmware approach | **ESP-IDF** (not Arduino/PlatformIO) | Official M5Stack firmware uses ESP-IDF; proven working |
| Robot #1 first | **Hermes** | Simpler auth story, proves the pipeline, then adapt for AMIE |

---

## Open Questions (Resolve During Execution)

1. Does the Hermes-StackChan firmware support the stock StackChan K151 hardware exactly, or does it need CoreS3 modifications?
2. What's the battery life of the StackChan in continuous voice mode?
3. Can the bridge server run on Milton-ServerLaptop (local) or does it need VPS for latency?
4. Which OpenAI Realtime voice sounds best through the StackChan speaker? (marin vs alloy vs coral)
5. Can we add the GVC Hermes system prompt to Option 3 auth without the full Milton Context Document?

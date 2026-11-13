# Safe Plan: Offline Mode & Local Model Fallback Integration

**Date:** 2026-11-13
**Author:** localagent (Hermes Desktop Agent)
**Objective:** Enable AMIE Robot Coach to function without WiFi using a local model fallback, with automatic sync on reconnection
**Risk Level:** LOW — all work is additive, no production systems modified

---

## What NOT to Change

- ❌ GVC Hermes production (voice.visionaryai.marketing)
- ❌ Visionary AI Coach production (visionaryai.life)
- ❌ Existing bridge server online mode behavior
- ❌ Supabase RLS policies or schema migrations on production
- ❌ Stock StackChan firmware (offline detection happens on bridge server, not device)

---

## Prerequisites

| Requirement | Status | Notes |
|-------------|--------|-------|
| Bridge server running | ✅ Done | Docker on port 12800 |
| OpenAI API key configured | ✅ Done | In .env |
| Ollama installed on laptop | ❌ Needed | For local model |
| Robot hardware | ⏳ DHL transit | Can build/test without robot using simulator |
| SQLite available | ✅ Built into Python/Go | No install needed |

---

## Phase 0: Install Ollama + Local Model (15 min)

### Step 0.1: Install Ollama
- **What:** Install Ollama on Milton-ServerLaptop for local model inference
- **Risk:** NONE — standalone app, no system changes
- **Execution:**
  ```bash
  winget install Ollama.Ollama
  ```
- **Reversible:** `winget uninstall Ollama.Ollama`
- **Dependencies:** None

### Step 0.2: Pull a small model
- **What:** Download Gemma 2B (1.5GB) as the offline coaching brain
- **Risk:** NONE — disk space only
- **Execution:**
  ```bash
  ollama pull gemma2:2b
  ```
- **Alternatives (if Gemma too large):**
  - `ollama pull phi3:mini` (2.3GB, better reasoning)
  - `ollama pull qwen2.5:1.5b` (1GB, smallest)
- **Reversible:** `ollama rm gemma2:2b`
- **Dependencies:** Step 0.1

### Step 0.3: Test local model
- **What:** Verify Ollama responds on localhost:11434
- **Risk:** NONE
- **Execution:**
  ```bash
  curl http://localhost:11434/api/generate -d '{"model":"gemma2:2b","prompt":"Hello AMIE","stream":false}'
  ```
- **Success criteria:** JSON response with generated text in < 5 seconds
- **Dependencies:** Step 0.2

---

## Phase 1: Offline Detection Service (Bridge Server)

### Step 1.1: Add connectivity monitor to bridge server
- **What:** Background goroutine/interval that pings OpenAI API every 30 seconds
- **Risk:** NONE — additive code, no existing behavior changes
- **Implementation:**
  ```
  Every 30s:
    1. HEAD request to https://api.openai.com/v1/models (timeout 5s)
    2. If success → state = ONLINE
    3. If fail 3 consecutive times → state = OFFLINE
    4. If was OFFLINE and now success → state = RECONNECTED → trigger sync
  ```
- **File:** New `offline-monitor.go` (or TypeScript if we build custom bridge)
- **Reversible:** Remove the file, restart
- **Dependencies:** None

### Step 1.2: Add state broadcast to robot
- **What:** When state changes, send JSON message to robot via WebSocket
- **Risk:** NONE — robot ignores unknown message types
- **Message format:**
  ```json
  {"type": "connectivity", "state": "offline", "message": "I'm switching to offline mode"}
  {"type": "connectivity", "state": "online", "message": "Back online! Syncing your data now."}
  ```
- **Robot behavior:** Face shows WiFi icon with strike-through when offline, sync icon when reconnecting
- **Dependencies:** Step 1.1

---

## Phase 2: Local Model Routing

### Step 2.1: Add Ollama fallback to bridge server
- **What:** When OFFLINE, route audio to local STT → Ollama → local TTS instead of OpenAI Realtime
- **Risk:** LOW — only activates when cloud is unreachable
- **Architecture:**
  ```
  ONLINE:  Robot → Bridge → OpenAI Realtime (voice-to-voice)
  OFFLINE: Robot → Bridge → Whisper.cpp (STT) → Ollama (LLM) → Piper (TTS) → Robot
  ```
- **Components needed:**
  - STT: whisper.cpp or faster-whisper (local, ~400MB model)
  - LLM: Ollama with gemma2:2b (already installed)
  - TTS: Piper (lightweight, runs on CPU, ~50MB voice model)
- **System prompt for offline:**
  ```
  You are AMIE, a warm and motivational AI coach. You are currently in offline mode.
  You can help with: guided breathing, meditation, scripture readings, habit reminders,
  workout timers, rep counting, and encouraging conversation.
  You CANNOT: send texts/emails, check calendar, search knowledge base, or sync goals.
  If asked about unavailable features, say "I'll help with that when we're back online."
  Keep responses under 3 sentences. Be warm, faith-grounded, and encouraging.
  ```
- **Reversible:** Environment variable `OFFLINE_FALLBACK_ENABLED=false`
- **Dependencies:** Phase 0 complete

### Step 2.2: Cache essential data for offline use
- **What:** Bridge server caches user data locally when online for offline access
- **Risk:** NONE — read-only cache, no writes to production
- **Cached data (refreshed every 5 min when online):**
  - Today's habits (from `habits` table)
  - Active goals summary (from `goals` table)
  - 5 recent scripture readings (from `prayer_entries` or knowledge base)
  - User's name and coaching preferences (from `user_profiles`)
  - 3 pre-built workout routines
- **Storage:** JSON files in bridge server `./data/cache/` directory
- **Reversible:** Delete `./data/cache/`
- **Dependencies:** Step 2.1

---

## Phase 3: Offline Conversation Storage

### Step 3.1: Create local SQLite database
- **What:** SQLite database on bridge server stores offline conversations
- **Risk:** NONE — new local file
- **Schema:**
  ```sql
  CREATE TABLE offline_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    user_utterance TEXT,
    amie_response TEXT,
    tools_called TEXT,  -- JSON array
    session_type TEXT,
    emotion_state TEXT,
    synced INTEGER DEFAULT 0
  );

  CREATE TABLE offline_habit_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    synced INTEGER DEFAULT 0
  );

  CREATE TABLE offline_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    synced INTEGER DEFAULT 0
  );
  ```
- **Location:** `./data/offline.db`
- **Encryption:** AES-256 using key derived from device MAC + user token
- **Reversible:** Delete `./data/offline.db`
- **Dependencies:** None

### Step 3.2: Write conversations during offline mode
- **What:** Every offline conversation turn is saved to SQLite
- **Risk:** NONE — local writes only
- **Dependencies:** Steps 2.1 + 3.1

### Step 3.3: Write habit completions during offline mode
- **What:** When user says "I completed my workout" offline, save to `offline_habit_updates`
- **Risk:** NONE — local writes only
- **Dependencies:** Steps 2.2 + 3.1

### Step 3.4: Write "Remember this" captures during offline mode
- **What:** When user says "Remember that..." offline, save to `offline_memories`
- **Risk:** NONE — local writes only
- **Dependencies:** Step 3.1

---

## Phase 4: WiFi Reconnection Sync

### Step 4.1: Sync engine
- **What:** When connectivity state changes from OFFLINE → RECONNECTED, run sync
- **Risk:** LOW — writes to Supabase, but additive only (inserts, not updates/deletes)
- **Sync sequence:**
  ```
  1. Robot face → sync icon + "Syncing your offline data..."
  2. Upload offline_conversations → voice_coach_sessions table
  3. Upload offline_habit_updates → habits table (mark complete)
  4. Upload offline_memories → user_knowledge_sources table
  5. Mark all uploaded rows as synced=1 in local SQLite
  6. Robot face → happy + "All caught up!"
  ```
- **Error handling:**
  - If sync fails: retry at 30s, 60s, 120s with exponential backoff
  - If still failing after 5 retries: robot says "I couldn't sync yet, I'll keep trying"
  - Data is NEVER deleted from local SQLite until confirmed synced
- **Reversible:** Sync can be disabled via `SYNC_ON_RECONNECT=false`
- **Dependencies:** Phase 3 complete, Supabase credentials available

### Step 4.2: Conflict resolution
- **What:** Handle case where user updated same habit/goal on phone while robot was offline
- **Risk:** LOW — additive merge strategy
- **Rules:**
  - Conversations: always insert (no conflict possible — unique session IDs)
  - Habits: merge — if marked complete on both phone and robot, keep earliest timestamp
  - Memories: always insert (no conflict possible — new entries)
  - Goals: skip offline goal updates if server version has newer timestamp
- **Dependencies:** Step 4.1

---

## Phase 5: Testing & Verification

### Step 5.1: Simulator test (no robot needed)
- **What:** Test offline mode using the desktop simulator
- **Test sequence:**
  1. Start bridge server with Ollama running
  2. Open simulator, have a conversation (online mode)
  3. Disconnect WiFi on laptop (or block OpenAI API in firewall)
  4. Continue conversation — verify fallback to local model
  5. Verify "offline mode" announcement
  6. Say "I completed my workout" — verify habit saved locally
  7. Say "Remember I need to call Lisa" — verify memory saved
  8. Reconnect WiFi
  9. Verify sync completes and robot confirms
  10. Check Supabase for synced data
- **Risk:** NONE — testing only
- **Dependencies:** Phases 1-4 complete

### Step 5.2: Physical robot test (when DHL delivers)
- **What:** Same test sequence on physical robot
- **Additional tests:**
  - Walk out of WiFi range → verify offline detection
  - Walk back → verify auto-reconnect and sync
  - Test offline workout timer and rep counting
  - Test offline guided breathing exercise
  - Test offline scripture reading from cache
- **Dependencies:** Step 5.1 passes + robots arrive

---

## Execution Order

| Step | Blocked By | Can Do Now? |
|------|-----------|-------------|
| Phase 0: Install Ollama + model | Nothing | ✅ YES |
| Phase 1: Connectivity monitor | Nothing | ✅ YES |
| Phase 2: Local model routing | Phase 0 | ✅ YES (after Ollama) |
| Phase 3: SQLite offline storage | Nothing | ✅ YES |
| Phase 4: Reconnection sync | Phase 3 + Supabase creds | ✅ YES |
| Phase 5.1: Simulator test | Phases 1-4 | ✅ YES |
| Phase 5.2: Robot test | DHL delivery | ⏳ WAITING |

**Everything except the physical robot test can be built and tested now.**

---

## Decision Log

| Decision | Chosen | Reason |
|----------|--------|--------|
| Offline LLM | Ollama + Gemma 2B | Smallest capable model, runs on laptop CPU, easy install |
| Offline STT | Whisper.cpp / faster-whisper | Proven, runs locally, good accuracy |
| Offline TTS | Piper | Lightweight, CPU-only, natural-sounding voices |
| Storage | SQLite | Zero dependencies, built into everything, encrypted |
| Sync strategy | Additive merge | Safe — never deletes, never overwrites newer server data |
| Detection method | Bridge server ping | Robot doesn't need to know about connectivity — bridge handles everything |

---

## Patent Coverage

PA-12 Claims 18-20 already cover this feature:
- Claim 18: Local model fallback when cloud API is unreachable
- Claim 19: Offline conversation storage with encrypted local database
- Claim 20: Automatic sync on WiFi reconnection with conflict resolution

---

*Safe plan generated November 13, 2026. All phases are additive with no production system modifications.*

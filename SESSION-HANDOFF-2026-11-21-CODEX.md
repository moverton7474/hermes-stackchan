# Session Handoff: Tutor Buddy + StackChan Robot, for Codex (2026-11-21)

**Owner:** Milton Overton (moverton7474@gmail.com). **Child user:** Brad, 5th grade.
**Machine:** Milton-ServerLaptop, Windows 11 ARM64. Use the git-bash shell and `python` (`python3` is not installed).
**Product:** Visionary AI Coach (https://www.visionaryai.life), with Tutor Buddy and AMIE, plus the physical M5Stack StackChan robot that runs the same tutor brain.

> **Codex: read this whole file before doing anything.** Section 2 contains rules from the owner. Treat them as hard rules.

---

## 0. Startup checklist (run first, read-only)

```bash
# Repos and current state
for r in ai-coach-review hermes-stackchan stackchan-research/stackchan-ai-server stackchan-firmware-visionary; do
  echo "== $r"; git -C "C:/Users/mover/$r" branch --show-current; git -C "C:/Users/mover/$r" log --oneline -5; done

# Containers (12800 = Hermes robot bridge, DO NOT TOUCH; 12802 = Tutor Buddy bridge)
docker ps --format '{{.Names}} {{.Status}}' | grep -E "tutor|stackchan"

# Robot reachable? (IP 192.168.1.222; recent pings were 400-500 ms, which means weak Wi-Fi)
ping -n 3 192.168.1.222

# Is a child mid-lesson right now? Must be 0 before any bridge rebuild or restart
docker logs --since 3m stackchan-tutor-buddy 2>&1 | grep -cE 'STT|LLM|tool='

# Recent robot timing (no transcripts are logged)
docker logs --since 2h stackchan-tutor-buddy 2>&1 | grep -E '\[TIMING\]|first audio|1006|API error' | tail -40

# DB read helper (Supabase Management API; prints JSON)
cd ~/hermes-stackchan/scripts && python -c "from supabase_sql import q; print(q('select now()'))"

# Release gate: deployed edge functions must not be older than their code
ls ~/hermes-stackchan/scripts/   # see the verify script added in d0a6fae
```

Skills and notes on this machine (Hermes skills; plain markdown, read them):
- `C:/Users/mover/AppData/Local/hermes/skills/software-development/stackchan-tutor-bridge-ops/SKILL.md`: bridge tests, rebuild, secrets, `[TIMING]` log phases.
- `.../stackchan-firmware-build/SKILL.md`: firmware toolchain, patch workflow, slot/otadata rules, no-reset serial.
- `.../supabase-edge-functions/SKILL.md` and `references/rls-server-only-writes.md`.
- `.../autonomous-ai-agents/computer-use/references/testing-web-apps-in-users-browser.md`: driving Milton's Chrome.

---

## 1. Repositories

| Repo | Local path | Branch | Latest | Purpose |
|---|---|---|---|---|
| moverton7474/AI-Interactive-Vision-Board-2 | `~/ai-coach-review` | main | `4fc3f01` | Web app (Vite/React/TS) and Supabase edge functions (Deno) |
| moverton7474/hermes-stackchan | `~/hermes-stackchan` | main | `d0a6fae` | Robot project docs, plans, scripts, encrypted backups |
| moverton7474/stackchan-ai-server-visionary (private; remote `visionary`) | `~/stackchan-research/stackchan-ai-server` | visionary-tutor | `9b8f6ab` | Go bridge: robot ↔ OpenAI Realtime ↔ Supabase |
| moverton7474/stackchan-firmware-visionary (private) | `~/stackchan-firmware-visionary` | tutor-buddy-1.5.1-tb2 | `22c6cdd` | Robot firmware (xiaozhi-esp32 v2.2.4 based, StackChan 1.5.1) |

Bridge working tree has 3 pre-existing modified files that are not ours: `collect-licenses.sh`, `run.sh`, `standalone.sh`. Leave them.

**Web deploy (Vercel):** the production project is `ai-interactive-vision-board-2`, but `~/ai-coach-review` is linked to `ai-coach-review` by default. To deploy:
```bash
cd ~/ai-coach-review
npx vercel link --yes --project ai-interactive-vision-board-2 && npx vercel deploy --prod --yes
npx vercel link --yes --project ai-coach-review   # relink afterwards
```

**Edge deploy:**
```bash
export SUPABASE_ACCESS_TOKEN=$(grep -o 'sbp_[a-f0-9]*' "$HOME/Dropbox/Finanicals/Milton & Lisa Overton Financials/GF Accelerate LLC/AI Interactive Vision Board/API Keys/New Supabase Access Token 4 17 2026.txt")
npx supabase functions deploy FUNCTION --project-ref edaigbnnofyxcfbpcvct --yes
git checkout -- deno.lock    # never commit deno.lock
```
Supabase project ref: `edaigbnnofyxcfbpcvct`. Supabase CLI 2.109 has no `db query --remote`; use `~/hermes-stackchan/scripts/supabase_sql.py`.

**Bridge rebuild** (only the tutor service):
```bash
cd ~/stackchan-research/stackchan-ai-server/stackchan-server
# 1) busy check must be 0 (see section 0)
docker compose -f docker-compose.tutor-buddy.yml build tutor-buddy
# 2) re-check busy, then:
docker compose -f docker-compose.tutor-buddy.yml up -d --no-deps tutor-buddy     # never --remove-orphans
curl -s -X POST http://localhost:12802/xiaozhi/ota/ -H 'Device-Id: 7c:4f:ad:af:bd:7c' -H 'Content-Type: application/json' -d '{}'
```
Go tests run in Docker; the command is in the bridge-ops skill. A known pre-existing failure is `TestBrandImagesHaveTransparentCornersAndConsistentSizes`.

**Web gates** (all must pass before any deploy):
```bash
npx vitest run src/test/tutor- tests/tutorBoard tests/tutorAudio tests/tutorVision tests/tutorRobot src/test/edge-auth   # 508 pass
npx vitest run amie voice-coach knowledge     # 400 pass
npx tsc --noEmit -p .                         # baseline = exactly 10 errors
npm run build                                 # "[bundle-budget] PASS"
deno check supabase/functions/<fn>/index.ts   # knowledge-ingest has 2 pre-existing implicit-any errors
```

---

## 2. Owner rules (hard)

1. **Never break AMIE.** Do not modify `supabase/functions/amie-*`, `_shared/amie-*`, `voice-coach-session`, `amie-prompt-builder` or `lib/realtime/AmieRealtimeClient.ts`. The one exception was an owner-approved read filter for child knowledge, which is done. Any further AMIE change needs explicit owner approval.
2. **Write a safe plan before any major change** (in `hermes-stackchan/docs/SAFE-PLAN-*.md`), and get the owner's OK.
3. **Do not rotate the OpenAI API key.** The owner declined. Don't push for it.
4. **No home network or router changes.** Changes must not add lag; the target is ≤ 50 ms added. Everything will later move to the Hostinger VPS.
5. **Firmware:** keep changes minimal and reversible. Take an encrypted backup first, read back after writing, and only flash with the owner present and approving. Never erase or overwrite factory ota_0.
6. **Encryption:** any backup or log that holds the Wi-Fi password or child speech must be encrypted immediately (7z AES-256, `-mhe=on`, key file `C:/Users/mover/.secrets/stackchan-backup.key`), with the plaintext deleted. Never put plaintext in Dropbox.
7. **Never print secrets.** `.env.*` and `data-*/` are gitignored, and `.example` files use CHANGE_ME. When inspecting `.env.tutor-buddy`, list names only: `grep -oE '^[A-Z_]+=' .env.tutor-buddy`. A broad prefix grep previously leaked `STACKCHAN_TUTOR_DEVICE_TOKEN_SECRET` (see section 7).
8. **Don't rebuild or restart the bridge while a child is mid-lesson** (busy check above). A rebuild once cut off Brad's live session.
9. **Never log in as Milton.** For live tests, create throwaway parents and children through the Supabase admin API (emails `@*.invalid`) and delete them afterwards. Never run export or delete on Brad's or Milton's data. Don't write test data to Brad.
10. **No hold-to-talk mode.** The owner wants noise suppression and barge-in instead.
11. **Commits:** commit only files you own; never `git add -A` or `git stash`. Run `git pull --rebase --autostash origin main` before pushing.
12. **Ask the owner** which task to start when the next step is ambiguous; he prefers to choose.

**IDs:** Brad = child `4c841cac-80ef-4319-be16-4d4076782acc`; owner uid `bf262cc1-80ec-464a-afc4-b8931eb75506`.
**Robot:** MAC/Device-Id `7c:4f:ad:af:bd:7c`, IP `192.168.1.222`, firmware **1.5.1-tb1** in ota_1, on USB COM3. Bridge LAN IP `192.168.1.189`, port 12802. Wake word: "Hi, Stack Chan" (rhymes with "van").

---

## 3. Credential locations (never print values)

| What | Where |
|---|---|
| Supabase access token | `~/Dropbox/Finanicals/Milton & Lisa Overton Financials/GF Accelerate LLC/AI Interactive Vision Board/API Keys/New Supabase Access Token 4 17 2026.txt` (`grep -o 'sbp_[a-f0-9]*'`) |
| Supabase service key | via Management API `GET /v1/projects/edaigbnnofyxcfbpcvct/api-keys?reveal=true`, loaded into an env var only |
| Bridge env (OpenAI key, robot token, device token secret) | `~/stackchan-research/stackchan-ai-server/stackchan-server/.env.tutor-buddy` |
| Backup encryption key | `C:/Users/mover/.secrets/stackchan-backup.key` (owner still needs to copy it into a password manager) |
| Batman VPS (Hostinger) | `ssh batman` = root@187.77.219.169 with key `~/.ssh/batman-mo-vps` |
| Saved logins | Hermes `browser_vault` (Hermes only) |

---

## 4. What was done this session (2026-11-19 → 21)

### 4a. Robot and tutor features (earlier)
- **Robot:**
  - Faces are pushed as reactions only; the permanent face is the firmware skin (tb1).
  - Stop phrases ("bye", "goodbye", "I'm done"…) end the session deterministically (`tutor_stop.go`).
  - Head and voice control go through the device MCP.
  - The instructions-fetch timeout is 8 s.
- **Web:** an in-app live robot whiteboard with an app-wide banner "Brad's robot lesson started" and a tablet QR code.
- **Teaching rules:** the tutor doesn't give away answers, grades every spoken answer, is honest about what it can see (only a worksheet photo counts), and keeps replies to 2 sentences or fewer.
- **Camera:** parent setting "📷 Robot camera" (on for Brad), limited to lessons only, at least 20 s apart, 10 per session. **The live worksheet-camera test has never succeeded.**
- **AMIE:** a text-only awareness update about Tutor Buddy and the robot (approved).

### 4b. Security Phase 0 (PR #297 F1–F10 addendum)
- **Robot device auth:**
  - Per-device HMAC token in **issue** mode, with an allowlist containing the robot's MAC.
  - Switching to **enforce** is blocked until the robot fetches its token in a session that logs `authenticated`.
- **Robot pairing token:** rotated. The pairing is now labelled "StackChan Tutor Buddy (desk)".
- **Logging:**
  - Transcripts are not logged (`STACKCHAN_LOG_TRANSCRIPTS=false`).
  - Logs rotate at 10 MB × 3.
  - The stall watchdog is on.
- **Backups:** encrypted with 7z AES-256, and the plaintext was deleted from the laptop and Dropbox.

### 4c. Codex audit P0 (your audit: `hermes-stackchan/docs/AUDIT-2026-11-21-CODEX-FULL-STACK.md`)
- **F1, child knowledge reaching AMIE:**
  - Migration `20261121000001` adds `user_knowledge_sources.knowledge_scope ('adult'|'child')` and `child_id`, with a backfill (221 adult sources, 1 child source).
  - Every AMIE and adult read path filters to adult content. A new RPC `search_adult_knowledge` was added; existing RPCs are unchanged.
  - The tutor still sees Brad's 88 chunks.
  - Commit `4ed968b`.
- **F2, weekly-report bulk email:** bulk mode is server-only (service key or `x-scheduler-secret`). Cron job 27 now sends the secret. Commit `068fdfd`.
- **F3/F9, ownership checks:**
  - Bible, flashcards and quiz require a parent JWT that owns the child (shared `_shared/tutor-child-auth.ts`).
  - Quiz retrieval is scoped to the child, which also closed a leak of adult documents into the child's quiz.

### 4d. Codex audit P1
- **F4, lesson lease** (`617bac7`, migration `20261121000020`):
  - New table `tutor_lesson_leases`, issued for both web and robot.
  - It re-checks consent, allowed hours, daily limit and budget during the lesson. Withdrawing consent revokes it through a trigger.
  - Web sends a heartbeat every 60 s. On the robot, the poll injects an "[Session] lesson time is over" message and the model calls `end_session`.
  - Vision, board and usage writes require a valid lease.
  - **Verified live on the robot on 2026-11-21 10:37Z:** the lease was issued, then ended on goodbye, and usage was linked to it.
- **F5, data rights** (`48d03bb`, `20261121000015`):
  - Export and delete cover 27 child tables. Delete is one fail-closed transaction with a recount afterwards and leaves a child-free deletion record.
  - The child knowledge toggle is locked in both the API and a DB trigger.
  - **Rule:** any new child-data table must be added to `tutor-data/inventory.ts` and both SQL functions; a test enforces this.
- **F9, quiz integrity** (`dec1348`, `20261121000003`):
  - Answer keys are server-side only (`quiz_questions`) and grading happens on the server.
  - Session ownership is checked.
  - Answer, complete and FSRS writes are idempotent (`tutor_answer_idempotency`).
- **Server-only quiz_results writes** (`87ef238`, `20261121000030`): client INSERT/UPDATE policies were dropped.
  - **This broke parent-JWT answer writes**, which were fixed in `dbc0fca`: answer and complete now use the admin client after the ownership check.
- **AI answer-key verification** (`4fc3f01`):
  - Exact fraction math checks the AI's keys. A wrong key is re-keyed to the matching choice; if no choice matches, the question is dropped.
  - Grading accepts equivalent forms (7/6 = 1 1/6).
  - Found live: the AI had keyed "5/6 + 1/3" as "1". Brad's record was corrected to 4/5.

### 4e. Production deploy state, verified 2026-11-21 ~11:00Z
- **Migrations live:** 20261121000001, …000003, …000015, …000020, …000030 and 20261121120000.
- **Effects confirmed in the DB:**
  - 0 client write policies on `quiz_results`;
  - the `knowledge_scope` column exists;
  - `search_adult_knowledge` and `delete_child_data` exist;
  - the lease and child-knowledge triggers exist;
  - the 3 new tables exist;
  - cron 27 has the secret.
- **Edge functions:**
  - Every affected function was deployed after its last code commit: tutor-quiz-generate v28 at 09:51Z, and the rest between 03:25Z and 05:04Z.
  - `verify_jwt=false` is intentional for these three, which authenticate in code: `tutor-robot-session` (device token), `tutor-vision-read` and `knowledge-query`.
- **Web:** deployed after P1. The latest web-affecting commits are deployed. `4fc3f01` and `dbc0fca` are edge-only.

### 4f. P2 robot reliability
- **Bridge `9b8f6ab`** (env flags, all default on, rollback by env):

  | Flag | Effect |
  |---|---|
  | `STACKCHAN_TUTOR_TIMING_LOGS` | Per-phase `[TIMING]` log lines |
  | `STACKCHAN_TUTOR_NOISE_REDUCTION=far_field` | Realtime `session.audio.input.noise_reduction`, verified live |
  | `STACKCHAN_TUTOR_CANCEL_GUARD` | Cancel only an active response |
  | `STACKCHAN_TUTOR_DROP_CANCELLED_AUDIO` | Discard audio of cancelled responses |
  | `STACKCHAN_TUTOR_SKIP_EMPTY_TTS` | No empty tts start/stop sent to the robot |
  | `STACKCHAN_TUTOR_AUDIO_TAIL_FADE_MS=8` | Fade the end of each reply |
  | `STACKCHAN_TUTOR_EARLY_HELLO` | Answer hello immediately and buffer mic up to 15 s |
  | `STACKCHAN_TUTOR_VAD_INTERRUPT_RESPONSE` | Optional, unset |

  Turn detection is `semantic_vad`, eagerness high.
- **Before and after:**
  - The 01:58Z wake took 106 s to first reply. That was a 1006 EOF plus reconnect (about 19 s) and room noise held as "speech" for 27 s and 36 s.
  - The 10:37Z wake took 5.8 s from WS connect to first audio, with no reconnect, speech turns of 0.7–2.7 s, 7 empty tts skipped and a clean goodbye.
- **Firmware 1.5.1-tb2 `22c6cdd` (BUILT, NOT FLASHED):**
  - Root cause in code: the main task is the only sender of mic audio, and it also does all display updates, every MCP tool call and blocking websocket sends. A stall of more than ~2.4 s backs up the encode queue, the AFE fetch blocks forever, and the "Ringbuffer of AFE(FEED) is full" errors leave the robot deaf until reboot.
  - Fixes (Kconfig flags, default on):
    - an AFE watchdog that escalates release → soft reset → idle-only restart, with counters in NVS `tb2diag`;
    - a 30 ms bounded encode-queue wait;
    - display try-lock with a queue;
    - JPEG decode moved outside the LVGL lock;
    - a 03:00 idle restart.
  - Artifact: `dist/tutor-buddy-1.5.1-tb2/stack-chan.bin`, 3,820,736 B, sha256 `4a93ac6b…a334`.
  - Flash plan: `hermes-stackchan/docs/FIRMWARE-TB2-FLASH-PLAN.md` (`eb7741a`). Write over tb1 in ota_1, keep factory ota_0, rewrite otadata so an early crash rolls back. Rollback is `dist/phase3/otadata_device_original.bin` written at 0xd000, then reset.
  - Baseline serial log (encrypted): `hermes-stackchan/backups/stackchan-serial-tb2-baseline-20261121-DELETE-AFTER-20261128.7z`.

---

## 5. OPEN WORK, in priority order (latest owner requests, 2026-11-21)

### 5.1 RELEASE BLOCKER: the 3.1 s first-audio outlier on tool-heavy turns
Owner's target: **≤ 1 s from end of child speech to first audio**. Measured outlier: `[RT] first audio 3106ms after speech end` at 10:38:03.839Z.

**Breakdown, already reconstructed from the bridge log:**

| t (10:38:…) | Event | Segment |
|---|---|---|
| 00.732 | speech ended (semantic VAD) | endpointing: not measured yet (VAD decides the end) |
| 00.742 | response 1 started (bridge sent empty tts start; now skipped) | |
| 01.451 | model emits `board_ask` tool call, **no audio** | model decision **0.71 s** |
| 01.451 → 02.155 | `board_ask` executed via the `tutor-robot-session` edge function | tool round-trip **0.70 s** |
| 02.196 | response 2 started | |
| 02.744 | model emits `board_record_answer`, **no audio** | model decision **0.55 s** |
| 02.744 → 03.497 | `board_record_answer` edge call | tool round-trip **0.75 s** |
| 03.541 | response 3 started | |
| 03.839 | first audio delta | OpenAI first audio **0.30 s** |
| ? | bridge Opus encode, device send, speaker onset | **not instrumented** (needs device telemetry) |

**Root cause:** two sequential tool round-trips run before any speech, for about 2.7 s of model-plus-tool time. The edge-function calls alone cost about 0.7 s each.

**Candidate fixes** (write a SAFE-PLAN first; measure each):
1. Speak first, in parallel: the instructions require a short spoken acknowledgement ("Let me check that…") in the same response as the tool call. Or the bridge plays a tiny local filler earcon/face while tools run.
2. Merge `board_ask` + `board_record_answer` into one tool call, or let the bridge record the answer locally and sync it asynchronously.
3. Make board tools fire-and-forget where the model doesn't need the result: return `{ok:true}` immediately, write in the background, and reconcile errors on the next poll.
4. Cut edge latency: keep-alive HTTP client, batch endpoint, or move board state into the bridge with periodic sync. Check the region round trip from the laptop (and later from the VPS).
5. Add `[TIMING]` phases for `tool_call_emitted`, `tool_exec_ms` per tool, `tool_result_sent`, `first_audio_delta` per response, `opus_encode_ms`, `device_send_ms`. Speaker onset needs firmware telemetry: log when the first decoded frame reaches I2S (tb2 or a later build).

### 5.2 Barge-in: interrupt the robot like AMIE (owner request)
- Today the robot can't be interrupted. The device stops listening while it speaks, and the stop phrase only works between turns.
- AMIE on the web gets barge-in from browser echo cancellation plus Realtime `interrupt_response`.
- **Robot plan to investigate:**
  - xiaozhi supports `kListeningModeRealtime` (keep listening while speaking) when AEC is available. Check whether the CoreS3 board config has the reference-channel input (`AUDIO_INPUT_REFERENCE`) and `CONFIG_USE_DEVICE_AEC`, or use server-side AEC.
  - Bridge side:
    - accept mic audio during TTS;
    - on `input_audio_buffer.speech_started`, cancel the response and send the device a TTS stop/abort;
    - truncate the conversation item (`conversation.item.truncate` with `audio_end_ms`);
    - fade or flush the audio queue.
- **Risks:**
  - The robot hears its own voice (false barge-in), so device AEC and noise reduction are required. Validate with TV noise.
  - Firmware change: put it behind a Kconfig/NVS flag in a tb3 build, or fold it into the tb2 canary only if it's flag-off by default.
- **No hold-to-talk** (owner rule).

### 5.3 Static still present in the robot voice (owner report after P2)
Candidates, in order:
1. **Weak Wi-Fi** (ping 400–500 ms to 192.168.1.222) causing jitter and underruns. Check the `playback_underrun_ticks` counter in the `ws_closed` summary. The owner may move the robot closer to the router; router changes are not allowed.
2. Opus frame boundaries and the 24k → 16k resample in `opus_codec.go`/`realtime_client.go`.
3. Device-side playback buffer or underrun, plus speaker gain clipping (check the volume setting).
4. Interrupted replies click mid-buffer; the bridge can't fade audio it has already encoded.

Capture a session with timing logs and correlate any static the owner hears with underrun counters.

### 5.4 Controlled robot soak test (owner-specified)
- **Script:** 30–50 turns in a quiet room, with deliberate pauses, background TV or noise, barge-ins (once 5.2 exists) and board/tool calls.
- **Track:**
  - p50/p95 wake-to-first-audio and end-of-speech-to-first-audio;
  - cancellations;
  - 1006/EOF closes;
  - AFE warnings (serial);
  - MCP timeouts;
  - reconnects;
  - underruns.
- **Options:**
  - Automate the voice with laptop speakers through Windows SAPI: `powershell.exe -NoProfile -Command "Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Volume=100; $s.Speak('Hi, Stack Chan')"`. Use Volume=12 to simulate a distant TV. TTS may not trigger the wake word reliably; the owner can do the wakes himself.
  - Simulated-device soak with the bridge's `ws_simulator.go` for server-side percentiles.
  - Collect passive serial telemetry at the same time: pyserial COM3 115200 `dtr=False, rts=False`. Opening the port must not reset the device. Encrypt any capture.
- **Output:** a report in `hermes-stackchan/docs/SOAK-YYYY-MM-DD.md` with percentiles and a pass/fail against ≤ 1 s p95 for non-tool turns, plus a defined tool-turn target.

### 5.5 Flash tb2 as a SUPERVISED CANARY only
- **Requirements:**
  - The owner is present.
  - A fresh encrypted full backup.
  - Read-back verification after writing.
  - tb1 can be re-flashed from `dist/tutor-buddy-1.5.1-tb1`.
  - Factory ota_0 is untouched.
  - Serial telemetry captured, `TB2 diag:` lines included.
- **Before tb2 becomes the default:** validate recovery from AFE backpressure and display-lock stress, for example rapid face changes and preview images during listening, and a forced MCP flood. Then soak overnight across 03:00 and check that the robot's time zone isn't GMT0.
- **Device auth:** during the flash session, rotate `STACKCHAN_TUTOR_DEVICE_TOKEN_SECRET` (it leaked into an agent's tool output on this laptop) and get the robot to fetch a fresh token. Then switch `STACKCHAN_TUTOR_DEVICE_AUTH` from issue to enforce once the log shows `authenticated`.

### 5.6 Later (P3 and backlog)
- **P3, VPS move:**
  - The gateway serves wss:// (OTA currently advertises ws://).
  - One-time trusted activation instead of spoofable identity headers.
  - A private bridge listener, signed firmware, and a canary rollout. Plan this in PR #297's doc.
- **Robot:** the worksheet camera live test has never succeeded. The AMIE robot bridge (port 12801) is not running.
- **P1 leftovers:**
  - A tampered web client can keep its own audio open after a lease ends; vision and usage are blocked.
  - The robot and web board don't send `slot` to tutor-student-model yet, so their retries aren't deduped.
  - The `flashcard_responses` table doesn't exist, so flashcard grading is dead code and fails closed.
  - `tutor-homework-help` still uses parent chunks that have no child_id.
- **Brad's data:** his "Adding fractions with unlike denominators" mastery includes two misses from a test quiz on 2026-11-21: one deliberate wrong answer, and the wrongly keyed question, which the review schedule still counts as a miss. The owner hasn't decided whether to remove them.
- **Docs:** `hermes-stackchan/docs/ARCHITECTURE.md` is stale (it describes the old Node bridge). Rewrite it from the runtime.
- **F9-net:** Hermes on 12800 is exposed on the LAN. Track separately and don't touch it.

### 5.7 Owner actions pending
- Request OpenAI **Zero Data Retention** for the tutor's API project (under-13 data).
- Copy the backup key into a password manager.
- Counsel review of the DRAFT parental consent text.
- File the PA-12 patent ($130). Files are under `Dropbox/.../Patent Filings/PA-12-AMIE-Robot-Coach/`.

---

## 6. Architecture (current, runtime-verified)

```
StackChan (ESP32-S3, fw 1.5.1-tb1, wake word on device)
  ── HTTP OTA  POST http://192.168.1.189:12802/xiaozhi/ota/   (Device-Id MAC; returns ws url + device token)
  ── WS        ws://192.168.1.189:12802/xiaozhi/ws            (Opus 16 kHz in/out, JSON control, device MCP)
Go bridge container stackchan-tutor-buddy (12802)
  ├─ OpenAI Realtime (GA API; semantic_vad; noise_reduction far_field; tools = tutor brain)
  ├─ Supabase edge fn tutor-robot-session (device-token auth): instructions, lease, board_* tools,
  │    child_fill, vision upload, poll (lease-end injection), log_session → usage + study_sessions
  └─ device MCP: head gestures, faces (preview_image), volume, LED, camera
Web: visionaryai.life → TutorBuddyDashboard / TutorRealtimeVoice (WebRTC Realtime via tutor-realtime-session,
     lease heartbeat 60 s) → same _shared/tutor-brain.ts rules; live board mirror for robot lessons.
DB: Supabase edaigbnnofyxcfbpcvct (child_profiles, study_sessions, quiz_*, student_models, mastery_scores,
     tutor_review_log, tutor_rewards*, tutor_board_*, tutor_robot_*, tutor_lesson_leases, tutor_usage, …)
Hermes robot bridge stackchan-server-stackchan-1 (12800): separate, unchanged.
```

---

## 7. Known incidents and pitfalls
- **Device token secret leak:** an agent's grep printed `STACKCHAN_TUTOR_DEVICE_TOKEN_SECRET` into its tool output on this laptop. No saved log file contains it (checked). Rotate it during the tb2 flash session (5.5).
- **RLS pitfall:** dropping client write policies silently breaks edge functions that write with the parent's JWT. Test as a real parent JWT, not just the service key.
- **Overwritten deploys:** parallel agents overwrote each other's edge deploys. Commit first, deploy from HEAD, and verify with the release-gate script.
- **Computer-use:** background clicks on some React buttons only hover. Use foreground clicks and verify in the DB.
- **Firmware build:** `scripts/build.sh` once skipped an updated patch silently; it now resets the tree first.
- **The quiz UI swallows server errors** (it returns silently after one retry). Consider showing a "try again" message.
- **Safety filter:** long chained terminal commands can be blocked; split them.

---

## 8. Suggested first moves for Codex
1. Run section 0 and confirm state. Ask the owner which item to start, from 5.1–5.5.
2. Recommended order:
   - 5.1 instrumentation plus a SAFE-PLAN for tool-turn latency;
   - 5.3 underrun correlation (cheap);
   - 5.4 soak on the current build to get a baseline;
   - 5.5 supervised tb2 canary;
   - 5.2 barge-in design (firmware AEC/realtime mode plus bridge truncate), with a SAFE-PLAN first;
   - re-run the soak.

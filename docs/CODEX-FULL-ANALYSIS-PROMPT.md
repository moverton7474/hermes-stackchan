# Codex brief: full read-only analysis of Visionary AI Coach, Tutor Buddy and the StackChan robot

> **READ-ONLY ENGAGEMENT. DO NOT MAKE ANY CHANGES.**
> You are doing a deep analysis and full review only. Do not edit, commit, push, open PRs, deploy, migrate, flash, restart, rotate, delete or reconfigure anything: no code, database, Docker, VPS, firmware, robot, Vercel, Supabase or GitHub changes. If a check would change state, write it down as a recommended step instead of running it. Your only output is a written report, described at the end.

---

## 1. Context

**Owner:** Milton Overton, CEO of Visionary AI Inc.

**Product:** Visionary AI Coach (https://www.visionaryai.life). It includes:
- **AMIE,** an adult voice life coach.
- **Tutor Buddy,** a K-12 voice tutor for kids. The pilot child is "Brad", 5th grade. It offers:
  - a realtime voice tutor with a shared SVG whiteboard;
  - lesson plans, quizzes, FSRS spaced review, rewards (XP, levels, badges) and parent controls (consent, time limits, budget, a "Robot camera" switch);
  - the same tutor brain on a physical **M5Stack StackChan** desk robot.

**Owner priorities:**
1. Reliable, fast, kid-safe tutoring on the robot.
2. Nothing breaks the web app, AMIE, or Tutor Buddy.
3. No changes to the home Wi-Fi or router configuration.
4. Eventually move all robot server configuration from the laptop to a Hostinger VPS.
5. Low latency: median time from the child finishing speaking to the first reply audio must stay at or under about 1.0 s.

---

## 2. What we need from you

A complete, evidence-based review of the **entire stack**:
- web app code and Supabase database (schema, RLS, functions, migrations, data integrity);
- Supabase Edge Functions and every external API call (OpenAI Realtime, Whisper, vision, Gemini where relevant);
- the Go voice bridge (OTA, WebSocket, device MCP, realtime client, tutor brain hooks, camera, auth, logging);
- Docker and laptop environment, and the VPS environments;
- robot hardware and firmware (custom StackChan build on xiaozhi-esp32);
- security and privacy (child data, COPPA posture);
- reliability, latency and cost.

Find root causes for the open issues in section 5 and recommend concrete fixes, each with risk, effort, rollback and verification.

---

## 2a. Where and how you run (Codex Desktop on this computer)

You are running in the **Codex desktop app on the owner's laptop, Milton-ServerLaptop** (Windows 11 ARM64, user `mover`, home `C:\Users\mover`). The robot is plugged into this laptop by USB. The owner has granted the access below **for read-only analysis**.

### Tools you may use
- **Terminal / shell.**
  - **Shell:** git-bash (POSIX syntax) is the default. PowerShell is available for Windows-specific reads (e.g. `Get-PnpDevice`, `Get-WinEvent`, `[System.IO.Ports.SerialPort]::GetPortNames()`).
  - **Paths:** pass Windows-style forward-slash paths to native tools (`C:/Users/mover/...`).
  - **Allowed:** read-only commands, plus running the existing test suites.
- **Computer Use (screen, keyboard, mouse).** Use it to *look*, not to change things:
  - **Chrome** is signed in to https://www.visionaryai.life as the owner (Tutor Buddy → Brad: Skills & Progress, Study Sessions, Needs Review, Robot tab, Settings). Use it to inspect the UI and browser DevTools (Console, Network, WS frames).
  - **Docker Desktop:** inspect containers, logs and settings.
  - **Device Manager / Windows Security / Event Viewer:** inspect the USB serial device and drivers, and protection history.
  - **Supabase dashboard / Vercel dashboard** in the browser, if already signed in: view only.
  - **Never** click actions that change data or state: Start/End session, Talk to Tutor, Revoke, Save settings, toggles, Deploy, Restart, Delete, Pair.
  - If a screen needs a sign-in or an admin (UAC) prompt, stop and ask the owner. Do not enter credentials.

### Credentials ("API vault"): locations you may read, never print
Use these only inside commands that perform **read-only** API calls. Never echo, log, paste or include any secret value in your report: refer to secrets by file path and variable name only.

| Secret | Location | Use |
|---|---|---|
| Supabase Management API token (`sbp_…`) | `C:/Users/mover/Dropbox/Finanicals/Milton & Lisa Overton Financials/GF Accelerate LLC/AI Interactive Vision Board/API Keys/New Supabase Access Token 4 17 2026.txt` | Read-only SQL via `hermes-stackchan/scripts/supabase_sql.py`, Edge Function logs, project metadata. The helper reads the token itself. |
| Other app API keys (OpenAI, etc.) | Same Dropbox `API Keys/` folder | Only if needed to confirm an endpoint is reachable, e.g. a GET to `/v1/models`. No paid generation calls. |
| Robot bridge secrets | `C:/Users/mover/stackchan-research/stackchan-ai-server/stackchan-server/.env.tutor-buddy` | **Read variable names only.** Values include `STACKCHAN_OPENAI_API_KEY`, `STACKCHAN_TUTOR_ROBOT_TOKEN`, `STACKCHAN_TUTOR_DEVICE_TOKEN_SECRET`. Do not use the robot token to call `tutor-robot-session`, because robot actions can reset Brad's board or start sessions. |
| GVC lobby credentials | `C:/Users/mover/batmanmo74/.env` | Out of scope; do not use. |
| Backup encryption key | `C:/Users/mover/.secrets/stackchan-backup.key` | **Do not use.** Backups are not needed for this analysis. |
| SSH keys | `C:/Users/mover/.ssh/` (`batman-mo-vps` via alias `ssh batman`; `robin-vps-main`) | Read-only VPS inspection. |
| GitHub | `gh` CLI, authenticated as `moverton7474` | Read repos, PRs, issues and Actions logs. **No** comments, pushes, PR edits or merges. |
| Vercel | `npx vercel` (authenticated) | `npx vercel ls`, `npx vercel inspect` read-only. **Never** `deploy`, `link`, `env add/rm` or `promote`. Note that `vercel link` changes the local `.vercel` folder, so don't run it. |
| Supabase CLI | `npx supabase` | Read-only commands only. Never `db push`, `functions deploy`, `secrets set` or `migration repair`. |

### Local tools available
- **Languages and runtimes:** `python` (3.14), `uv`, Node/npm/npx, `deno`, Go via Docker (`golang:1.26-alpine3.23`), ESP-IDF via Docker (`espressif/idf:v5.5.4`, `v6.1`).
- **CLIs:** `docker`/`docker compose` (v29), `gh`, `ffmpeg`/`ffprobe`, `7z`, `openssl`, `ssh`.
- **esptool:** `C:/Users/mover/AppData/Roaming/uv/tools/esptool/Scripts/python.exe -m esptool`. It includes pyserial.
- Ollama on 11434.

### Local folders you may read
- `C:/Users/mover/ai-coach-review` (web app + Supabase)
- `C:/Users/mover/stackchan-research/` (bridge fork `stackchan-ai-server`, upstream `m5-StackChan`)
- `C:/Users/mover/stackchan-firmware-visionary` (firmware fork + `dist/` build artifacts)
- `C:/Users/mover/hermes-stackchan` (docs, plans, simulator, faces, scripts, `backups/`: encrypted, do not open)
- `C:/Users/mover/gvc-review` (GVC Hermes, out of scope except shared infra)
- `C:/Users/mover/Dropbox/` (handoffs, the `API Keys/` folder above, `StackChan-Firmware-Backups/`: encrypted)
- Docker volumes `tbfw-work-151` (xiaozhi sources for 1.5.1) and `tbfw-work` (1.6.2). Read with `docker run --rm -v <vol>:/work ...`.
- Hermes skills for this project (useful procedures): `C:/Users/mover/AppData/Local/hermes/skills/software-development/stackchan-firmware-build/SKILL.md`.

### Connecting to the robot (USB, COM3)
The robot is on **USB serial COM3** (115200 baud, ESP32-S3 USB-Serial-JTAG).
- **Allowed without asking (passive, no state change):**
  - Check the port exists: `powershell.exe -NoProfile -Command "[System.IO.Ports.SerialPort]::GetPortNames()"`, and look at Device Manager / `Get-PnpDevice -Class Ports`.
  - **Passively read the robot's log.** Use pyserial with `dtr=False, rts=False` so the chip is **not reset**, and append to a file in `C:/Users/mover/AppData/Local/hermes/cache/scratch/`. Example (run with the esptool Python, which has pyserial):
    ```python
    import serial,time
    s=serial.Serial(); s.port='COM3'; s.baudrate=115200; s.timeout=0.3; s.dtr=False; s.rts=False; s.open()
    out=open(r'C:\Users\mover\AppData\Local\hermes\cache\scratch\codex_serial.txt','ab'); end=time.time()+600
    while time.time()<end:
        d=s.read(8192)
        if d: out.write(d); out.flush()
    s.close(); out.close()
    ```
  - Only one program can hold COM3 at a time. Close your reader when done.
  - Useful log signatures:
    - wake word: `Application: Wake word detected`;
    - states: `StateMachine: State: …`;
    - connection: `WS: Websocket disconnected`;
    - microphone stall: `AFE: Ringbuffer of AFE(FEED) is full`;
    - touch: `FT6336 read failed`;
    - boot: `ota confirm check`.
- **Only with the owner present and explicit approval** (these reboot the robot but write nothing):
  - `esptool --chip esp32s3 --port COM3 --after hard-reset chip-id` (reboots, reads the MAC);
  - `esptool ... read-flash` of specific regions for comparison.
  - After any esptool command the robot sits on the launcher. The owner must tap **AI Agent** for it to reconnect to Wi-Fi and the bridge.
  - Read flash regions **only** to a scratch folder and delete them afterwards: NVS contains the Wi-Fi password.
- **Never:** `write-flash`, `erase-flash`, `erase-region`, `burn-efuse`, any `espefuse` command, `idf.py flash`/`monitor` (monitor resets the chip), changing NVS, or sending MCP commands to the device.
- **Live robot behaviour tests:** do not start robot sessions yourself. A robot session resets Brad's live board and uses paid realtime minutes. Instead, **ask the owner** to do the step (e.g. "say 'Hi, Stack Chan', ask one question, say 'bye'") while you passively capture the serial log and `docker logs -f stackchan-tutor-buddy`. Then analyze both together.
- **Wake phrase:** "Hi, Stack Chan", with "Chan" said like "chahn". Tapping the screen also starts listening.

## 3. Systems, repositories and paths

All paths are on the Windows 11 ARM64 laptop **Milton-ServerLaptop** (user `mover`). The shell is git-bash; use `python`, not `python3`. Docker Desktop v29 is installed. Read files directly or with `git log` and `git show`.

| Component | Local path | GitHub | Branch | Notes |
|---|---|---|---|---|
| Web app + Supabase (Visionary AI Coach, Tutor Buddy, AMIE) | `C:/Users/mover/ai-coach-review` | `moverton7474/AI-Interactive-Vision-Board-2` | `main` | Vite + React + TS + Tailwind; `supabase/functions/*` (Deno Edge Functions); `supabase/migrations/*`. Production Vercel project = **ai-interactive-vision-board-2** (the local `.vercel` link points at `ai-coach-review` by default; that is NOT prod). |
| Go voice bridge (fork of rudyll/stackchan-ai-server) | `C:/Users/mover/stackchan-research/stackchan-ai-server` (service in `stackchan-server/`) | `moverton7474/stackchan-ai-server-visionary` (private; remote name `visionary`) | `visionary-tutor` | Key code in `stackchan-server/server/internal/service/ai/`. |
| Robot firmware (fork of m5stack/StackChan) | `C:/Users/mover/stackchan-firmware-visionary` | `moverton7474/stackchan-firmware-visionary` (private) | `tutor-buddy-skin-1.5.1` (tag `v1.5.1-tb1` = flashed), `tutor-buddy-skin` (1.6.2 base), `main` | ESP-IDF 5.5.4 for the 1.5.1 base. xiaozhi sources are fetched into Docker volume `tbfw-work-151`. Read them with `MSYS_NO_PATHCONV=1 docker run --rm -v tbfw-work-151:/work espressif/idf:v5.5.4 bash -c '...'`, which is read-only use. |
| Upstream firmware reference | `C:/Users/mover/stackchan-research/m5-StackChan` | m5stack/StackChan | | |
| Robot project docs, plans, simulator, faces, scripts | `C:/Users/mover/hermes-stackchan` | `moverton7474/hermes-stackchan` | `main` | `docs/` (FIRMWARE-BUILD-NOTES.md, SAFE-PLAN-*.md, TUTOR-BUDDY-PLAN.md, ARCHITECTURE.md), `ROADMAP.md`, `BUILD-GUIDE.md`, `simulator/index.html` (desktop simulator), `faces/tutor-buddy/`, `scripts/supabase_sql.py`, `firmware/config/*.py` (NVS tools). |
| GVC Hermes (separate system on the same laptop/LAN) | `C:/Users/mover/gvc-review` | `moverton7474/gemini-voice-center` | | Out of scope except where it shares ports, hosts or VPS. |

**Open PRs to read** (in the AI-Interactive-Vision-Board-2 repo):
- **#297** (draft): `docs/SAFE-PLAN-STACKCHAN-VISIONARY-NETWORKING.md`. This is the networking and security plan with findings F1–F10, Phase 0 status and comments.
- **#296:** P0 security hardening.
- **#295:** roadmap v3.89 security-first plus robot cloud gateway.

### Running services on the laptop (inspect only)
| Container / process | Port | Purpose |
|---|---|---|
| `stackchan-tutor-buddy` (compose `stackchan-server/docker-compose.tutor-buddy.yml`, env `.env.tutor-buddy`) | `0.0.0.0:12802 -> 12800`; settings UI `127.0.0.1:8097` | **Tutor Buddy robot bridge.** Robot OTA, WebSocket, faces, camera upload. |
| `stackchan-server-stackchan-1` | `0.0.0.0:12800` (also `[::]`) | Hermes robot personality bridge. **Do not touch.** |
| Ollama | 11434 | Local model (offline experiments). |
| Desktop simulator (`python -m http.server 8780` in `hermes-stackchan/simulator`) | 8780 | Not always running. |

- **Laptop LAN IP:** 192.168.1.189. **Robot:** 192.168.1.222, MAC `7c:4f:ad:af:bd:7c`. The robot is usually on USB serial COM3 at 115200.
- **Read-only inspection commands:**
  - `docker ps`, `docker inspect`, `docker logs stackchan-tutor-buddy`
  - `curl -s -X POST http://localhost:12802/xiaozhi/ota/ -H "Device-Id: 11:22:33:44:55:66"` (shows the OTA reply shape; an unknown device gets no token)
  - `netstat -ano`
- **Note on logs:** transcripts are redacted in bridge logs (`STACKCHAN_LOG_TRANSCRIPTS=false`), so lines show `len=N chars`.
- **Never print secrets.** Show the names of variables in `.env.tutor-buddy`, never their values.

### Supabase
- **Production project ref:** `edaigbnnofyxcfbpcvct` (Visionary AI Coach). A separate GVC lobby project is `vjlsjnhacarurcoqcwki` (out of scope).
- **Read-only SQL:** `cd C:/Users/mover/hermes-stackchan/scripts && python -c "from supabase_sql import q; print(q('SELECT ...'))"`. This uses the Supabase Management API with the access token from the Dropbox `.../GF Accelerate LLC/AI Interactive Vision Board/API Keys/` folder.
- **SELECT only.** No INSERT, UPDATE, DELETE or DDL.
- **Do not dump child content.** Aggregate counts, schemas, policies and metadata are fine. Do not print transcripts, worksheet text or child PII beyond the first name "Brad".
- **Edge Function logs** are readable through the Management API analytics endpoint: `GET https://api.supabase.com/v1/projects/edaigbnnofyxcfbpcvct/analytics/endpoints/logs` with ClickHouse SQL, e.g. `... FROM logs WHERE source='function_edge_logs'`. The old `logs.all` endpoint returns 410.
- **Tutor tables of interest:**
  - learning: `child_profiles` (includes `daily_limit_minutes`, `robot_camera_enabled`), `study_sessions`, `student_models`, `mastery_scores`, `tutor_review_log`, `quiz_results`;
  - robot: `tutor_robot_devices` (token_hash; no revoke column), `tutor_robot_sessions`, `tutor_board_live` (in the Realtime publication), `tutor_board_events`;
  - rewards and usage: `tutor_rewards`, `tutor_reward_events`, `tutor_usage`;
  - policy: `parental_consents`.
- **Tutor Edge Functions:**
  - session: `tutor-realtime-session` (web), `tutor-robot-session` (robot; header `x-robot-token`, sha256 → `token_hash`; verify_jwt=false);
  - learning: `tutor-student-model`, `tutor-rewards`, `tutor-weekly-report`, `tutor-vision-read`, `tutor-quiz-generate`;
  - safety and data: `tutor-session-audit`, `tutor-data`.
- **Shared code:** `supabase/functions/_shared/` (`tutor-brain.ts`, `tutor-plan.ts`, `tutor-policy.ts`, `tutor-safety.ts`, `tutor-vision.ts`, `tutor-student-model-client.ts`, `tutorBoard/*`).
- **AMIE files:** `amie-*`, `_shared/amie-*`, `voice-coach-session`, `lib/realtime/AmieRealtimeClient.ts`. AMIE's prompts got a text-only update on 2026-11-20 describing Tutor Buddy and the robot.

### VPS environments (read-only SSH only)
| Host | Access | Role |
|---|---|---|
| Batman VPS (Hostinger, Boston) | `ssh batman` (root@187.77.219.169, key `~/.ssh/batman-mo-vps`) | GVC Hermes / agent services today. **Planned home of the Tutor Buddy robot gateway.** |
| Robin VPS | `ssh -i ~/.ssh/robin-vps-main root@187.124.68.10` | Infra / KSU agent. |
| voice.visionaryai.marketing | (GVC Hermes) | Orchestrator. |

- **Allowed on the VPSes:** read-only commands only, e.g. `pm2 list`, `docker ps`, `ss -tlnp`, `ufw status`, `crontab -l`, `df -h`, `free -m`, nginx/caddy config reads, `systemctl list-units --type=service --state=running`.
- **Not allowed:** restarts, installs or edits.
- **Deliverables from the VPSes:** an inventory and a fitness assessment for hosting the robot gateway (TLS/DNS, isolation from existing services, resources, firewall, secrets handling).
- **Measured latency:** laptop→OpenAI ~8 ms, laptop→Batman VPS ~30 ms TCP connect, Batman VPS→OpenAI ~2 ms.

### Robot hardware and firmware
- **Device:** M5Stack StackChan, based on the CoreS3 (ESP32-S3, 16 MB flash, PSRAM). It has:
  - a 320×240 ILI9342 LCD with FT6336 touch;
  - a GC0308 0.3 MP camera;
  - an ES7210 microphone ADC in TDM mode (1 mic + playback reference for AEC) and a speaker amp;
  - SCS bus servos (yaw/pitch, calibrated zero positions in NVS);
  - a WS2812 LED ring, BMI270 IMU, proximity/light sensor, 3-zone capacitive head touch, and a battery/PMIC.
- **Partition table:** nvs 0x9000, otadata 0xd000, ota_0 0x20000, ota_1 0x510000 (0x4f0000 each), assets 0xA00000 (4 MB: fonts, WakeNet model `wn9_histackchan_tts3` "Hi, Stack Chan", emoji).
- **Running:** **ota_1 = `1.5.1-tb1`**, the Tutor Buddy avatar skin on the 1.5.1 base, flashed 2026-11-20. **ota_0 = factory 1.5.1**, the rollback.
- **Settings:** NVS `wifi/ota_url = http://192.168.1.189:12802/xiaozhi/ota/` (our bridge). The device uses the xiaozhi v3 WebSocket protocol, device MCP (`self.robot.set_head_angles`, `self.audio_speaker.set_volume`, `self.camera.take_photo`, ...), and OTA auto-update if a newer `firmware.version` is returned (our bridge returns none).
- **Build and flash records:** `hermes-stackchan/docs/FIRMWARE-BUILD-NOTES.md`; `stackchan-firmware-visionary/dist/` (artifacts and phase3 otadata files).
- **Backups** are AES-256 encrypted in `hermes-stackchan/backups/`. Do not decrypt or extract them. They contain the Wi-Fi password.
- **Serial logs:** see section 2a, "Connecting to the robot". Passive reading is allowed anytime. Reboot-causing esptool reads need the owner present and approving. Writes are never allowed.

### Key bridge settings now active (names only; read `.env.tutor-buddy.example` for meanings)
- **Tutor brain:** `STACKCHAN_TUTOR_BRAIN_URL`, `STACKCHAN_TUTOR_ROBOT_TOKEN`, `STACKCHAN_TUTOR_CAMERA=true`, `STACKCHAN_TUTOR_EMOTIONS=true`.
- **Robot body:** `STACKCHAN_TUTOR_HEAD_MOTION=true`, `STACKCHAN_TUTOR_DEVICE_TOOLS=true`, `STACKCHAN_TUTOR_FACES=false` (faces are native in firmware now).
- **Device auth:** `STACKCHAN_TUTOR_DEVICE_AUTH=enforce`, an allowlist pinned to MAC|Client-Id, and an HMAC device token issued via the OTA `websocket.token`.
- **Logging and reliability:** `STACKCHAN_LOG_TRANSCRIPTS=false`, `STACKCHAN_TUTOR_STALL_WATCHDOG=true`, camera limits of 20 s and 10 per session.
- **Turn detection:** `STACKCHAN_TUTOR_TURN_DETECTION=semantic`, `STACKCHAN_TUTOR_VAD_EAGERNESS=high`. The default without these is server_vad 300 ms.
- **MCP start:** device MCP starts 2.5 s after hello (`STACKCHAN_TUTOR_MCP_START_DELAY_MS`), and user-only tools are requested only when picture faces are on.

---

## 4. Do-not-break contract (your recommendations must respect it)

- **Never changed:**
  - AMIE (functions, prompts, realtime client);
  - the production web tutor release;
  - parent dashboards;
  - Supabase RLS, policies and publications (any proposed change must come as a reviewed migration with rollback);
  - the Hermes container on 12800;
  - the home network.
- **Every fix** must be opt-in (flag or env) with one-setting rollback, and must pass:
  - `npx vitest run src/test/tutor- tests/tutorBoard tests/tutorAudio tests/tutorVision tests/tutorRobot`
  - `npx vitest run amie voice-coach`
  - `npx tsc --noEmit -p .` at a baseline of 10 errors
  - `npm run build` bundle budget
  - bridge `go test ./internal/service/ai/` (the known failing test is the logo-asset test)
- **Smoke checks after each fix:**
  1. Web Talk to Tutor plus the board.
  2. The parent views.
  3. A robot lesson: wake, graded spoken answer, faces/nod, "bye" hang-up, session logged.
  4. The live board in the app and via QR.
  5. AMIE navigation to Tutor Buddy.

You may **run** the existing automated test suites, because they are read-only. Do not change files to make tests pass.

---

## 5. Open issues to analyze (with evidence)

All times are UTC.

1. **Slow wake: about 2 minutes from "Hi, Stack Chan" to the first reply** (2026-11-21 01:58–02:00). Once awake, responses are fast: first reply audio median **330 ms** (n=7; 302–383 ms, one 804 ms).
   - **Bridge log sequence:**
     - 01:58:57 auth OK → 01:59:00 hello → 01:59:00.95 `listen start` → **01:59:00.96 `websocket: close 1006 (abnormal closure)`**, an immediate device-side drop.
     - Reconnect at 01:59:16.
     - Then **continuous "speech" for ~27 s (STT 343 chars) and ~35 s (422 chars)**.
     - The first response at 02:00:23.89 was **cancelled 20 ms later** by new "speech".
   - **Hypotheses to test:** background speech or TV picked up by the far-field mic; the robot realtime session has no `input_audio_noise_reduction` (the web tutor has a noise filter); semantic_vad behaviour with continuous audio; device-side echo; the cause of the 1006 drop.
2. **Wake word unreliable.** WakeNet `wn9_histackchan_tts3` (threshold 0.585/0.590). Users say "Stack Chain". In one test there was no detection at all; in another it detected repeatedly. Assess sensitivity settings, the AFE config (`[input] -> AEC(SR_HIGH_PERF) -> VAD(WebRTC) -> WakeNet`), custom wake word options (MultiNet "Hey Tutor Buddy" via `USE_CUSTOM_WAKE_WORD`), and the touch/tap fallback.
3. **Audio front-end stall:** `W AFE: Ringbuffer of AFE(FEED) is full`, flooding right after `StateMachine: connecting -> listening`.
   - The device then sends no audio, ignores MCP (`tools/list timed out`), and the wake word stops working until reboot.
   - Seen at 10:27, 11:36 and 11:42 on 2026-11-20, and at 22:55 (only 11 minutes after a reboot).
   - Coincided with the bridge's MCP `initialize` + `tools/list` (with user tools) at listen start. FT6336 I2C timeouts are also in the logs.
   - **Mitigations deployed:** MCP start delay of 2.5 s and no user tools (bridge commit `fcb492d`). Two clean sessions since. Plus a bridge stall watchdog that ends the session.
   - **Need a root cause in the firmware** (xiaozhi AudioService/AFE tasks, StackChan HAL, our skin's LVGL rendering load, I2C bus contention, MCP handling on the main task) and a durable fix (for example an AFE watchdog or task priorities in a 1.5.1-tb2).
4. **Static and choppy voice.** Responses were cut off within about 20 ms (3 of 11, then 2 of 12) by "speech detected" barge-ins. The robot spoke its own wake word ("say Hi Stack Chan…" in its opening) and aborted itself; the prompt was fixed in web commit `8490825`. Speaker volume was set to 80 earlier. Assess the half-duplex vs AEC design, the opus/resampling path (device 16 kHz in, 24 kHz out), frame pacing in the bridge, and whether partial cancelled responses leak audio.
5. **Lag reported after flashing the custom face firmware.** Assess the CPU and render cost of the `tutor_buddy` skin (blink, lip-sync, breath at LVGL frame rate) versus audio tasks on the ESP32-S3.
6. **Device MCP timeouts at session start** (`tools/list` after `initialize`). The initial 3 s timeout is now 10 s with one retry, plus the delay.
7. **Earlier fixed bugs to verify end-to-end** (check the code and recent data, not just commit messages):
   - robot answers not updating `student_models` / `mastery_scores` (fixed: the robot path's auth to `tutor-student-model`, commit `3b11f43`, plus a backfill);
   - tutor giving away answers and `board_fill` of unsolved slots (`adc6cc6`);
   - camera honesty; board-write loops; spoken-answer grading (`board_record_answer`); stop phrases and the end_session hang-up;
   - the progress panel's stale weekly stats.
8. **Security and privacy.** Review PR #297 findings F1–F10 and the Phase 0 implementation:
   - device auth enforce; token rotation; revoked unused pairing; log rotation and transcript redaction; encrypted backups;
   - the parent camera switch (migration `20261120000001`, `robot_camera_enabled`); camera rate limits; the prompt-injection guardrail; the stall watchdog.
   - Look for remaining gaps: plain-HTTP OTA, camera upload and faces on the LAN; OTA auto-update trust; no `revoked_at`; Hermes 12800 exposure; the service-secret acceptance in `tutor-student-model`; RLS on all tutor tables; Edge Functions with verify_jwt=false; secrets in repos or history; COPPA retention.
9. **Architecture and hosting.** Robot tutoring depends on the laptop being on. Evaluate the move of the bridge/gateway to the Hostinger VPS: TLS/WSS, per-device credentials bound at activation, OTA/firmware signing, egress allowlist, logs, cost and latency (target: add 50 ms or less).
10. **Cost and model routing.** gpt-realtime-mini vs gpt-realtime per mode, the monthly budget (600 min), `tutor_usage` accuracy for robot sessions, and Whisper/vision calls.
11. **Data integrity.** One completed lesson should produce one `study_sessions` row and the matching review, usage and reward events. Check for duplicates and orphans, and check `tutor_robot_sessions` and `tutor_board_live` single-row-per-child semantics (a new robot session resets the board).
12. **Code quality and test coverage gaps** across the web tutor, Edge Functions, bridge and firmware changes made in November 2026 (see `git log --since=2026-11-10` in each repo).

---

## 6. Report format (deliverable)

Write one Markdown report, returned in your reply. **Do not write it into any repo.** Structure:
1. **Executive summary:** the top 5 risks and the top 5 recommended actions.
2. **Architecture map:** components, data flows, every external API call (endpoint, auth, payload class, latency path), trust boundaries.
3. **Findings table:** ID, area, severity (Critical/High/Medium/Low), evidence (file:line, log line, SQL output, command output), impact, root cause (confirmed or suspected, plus confidence).
4. **Root-cause analysis** for each open issue in section 5, with experiments to confirm. Each experiment should be safe, minimal, and runnable later by the owner's team.
5. **Recommendations:** an ordered plan. For each item: change summary, files/components, flag name, risk, effort, rollback, verification (tests, smoke checks, metrics), and do-not-break impact.
6. **Hostinger VPS readiness assessment and migration outline.**
7. **Firmware review:** the 1.5.1-tb1 diff vs upstream, risks, and a proposal for 1.5.1-tb2 (AFE watchdog, wake word, render budget, nightly idle restart, head-pat hint).
8. **Security and privacy review:** COPPA-oriented, with gaps vs PR #297.
9. **Test and observability gaps:** the metrics to add, for example first-audio latency (already logged as `[RT] first audio Nms after speech end`), cut-off response rate, AFE stall count, and wake-to-first-reply time.
10. **Appendix:** commands you ran (all read-only) and anything you could not access.

**Again: analysis only. No changes of any kind.**

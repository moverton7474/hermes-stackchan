# Session Handoff — Tutor Buddy (Visionary AI Coach) — 2026-11-14
**Repos:** moverton7474/AI-Interactive-Vision-Board-2 (`~/ai-coach-review`) · moverton7474/hermes-stackchan (`~/hermes-stackchan`)
**Previous handoffs:** `SESSION-HANDOFF-2026-11-13-STACKCHAN.md`, `SESSION-HANDOFF-2026-11-14.md`

---

## URGENT — still open from earlier handoffs
1. **File PA-12 patent ($130)** at https://patentcenter.uspto.gov. Files are in `~/Dropbox/Finanicals/Milton & Lisa Overton Financials/GF Accelerate LLC/Patent Filings/PA-12-AMIE-Robot-Coach/`
2. OpenAI key rotation: **user declined** ("use existing key, I do not want to rotate"). Don't raise it again unless asked.

---

## NEW SESSION STARTUP INSTRUCTIONS
Run these before doing any work.

### 1. Context
```bash
cat ~/hermes-stackchan/SESSION-HANDOFF-2026-11-14-TUTOR-BUDDY.md
cat ~/hermes-stackchan/docs/TUTOR-BUDDY-PLAN.md
cat ~/hermes-stackchan/docs/SAFE-PLAN-TUTOR-NEXT-GEN.md
cd ~/ai-coach-review && git pull origin main && git log --oneline -15
cd ~/hermes-stackchan && git pull origin main && git log --oneline -5
```

### 2. Services (local)
```bash
docker ps | grep -E "stackchan|tutor"         # stackchan-server-stackchan-1 (12800), stackchan-tutor-buddy (12802)
curl -s http://localhost:12800/xiaozhi/ota | head -c 200
curl -s http://localhost:12802/xiaozhi/ota | head -c 200
curl -s http://localhost:12900/status
ollama list                                     # gemma2:2b
```

### 3. Database (use the Management API; the CLI changed, see Gotchas)
```bash
cd ~/hermes-stackchan/scripts && python supabase_sql.py <file.sql>   # Management API helper; also: python -c "from supabase_sql import q; print(q('SELECT 1'))"
```
Quick health query:
```sql
SELECT count(*) total, count(embedding) embedded FROM user_knowledge_chunks
WHERE metadata->>'child_id' = '4c841cac-80ef-4319-be16-4d4076782acc';   -- expect 88/88
```

### 4. Production
```bash
curl -s https://www.visionaryai.life/ | grep -o 'assets/index-[^"]*\.js'
# Tutor features live in the lazy chunk TutorBuddyDashboard-*.js; grep it for 'tutor-realtime-session'
```

---

## What shipped this session (all on production)

| Feature | Where | Status |
|---|---|---|
| Quiz: 4-option multiple choice, ✅/❌ feedback, score screen | `TutorBuddyDashboard.tsx`, `tutor-quiz-generate` | ✅ tested in browser |
| FSRS-5/6 (21 params, short-term memory, same-day reviews, context lapse) | `tutor-progress-tracker` + migration `20261114_fsrs_v6_upgrade.sql` | ✅ deployed |
| Theory-of-Mind student modeling | table `student_models`, fn `tutor-student-model`; used by homework-help + quiz-generate | ✅ deployed |
| Math Whiteboard (step-by-step reveal, hints) | `TutorWhiteboard.tsx`, fn `tutor-whiteboard-solve` | ✅ tested ("3/4 + 1/2", "5/7") |
| **OpenAI Realtime voice tutor** (same tech as AMIE, voice `shimmer`) | NEW `tutor-realtime-session` fn + NEW `TutorRealtimeVoice.tsx` | ✅ tested: natural voice, greets Brad, offers curriculum topics |
| Classic voice/text tutor kept as fallback | `TutorVoiceAgent.tsx` ("Prefer typing? Use the classic tutor") | ✅ |
| **Curriculum-aware homework help** | `tutor-homework-help` + NEW SQL fn `match_knowledge_chunks` | ✅ tested: vague ask returns real curriculum topics |

### Commits (ai-coach-review, main)
`3f024e6` voice agent (Web Speech) · `39d4111` FSRS-5/6 · `a448a6d` whiteboard · `1fa194e` student modeling · `341c114` Realtime voice tutor · `7d19648` curriculum-aware homework help

### AMIE impact: none
AMIE files (`amie-realtime-session`, `lib/realtime/AmieRealtimeClient.ts`, prompt builder) were **not modified** in this session. The tutor Realtime path is a separate edge function and component that only follows the same pattern. AMIE dashboard verified unchanged after deploy.

---

## Root causes fixed this session (don't re-break)
1. **Tutor said "I can't see your syllabus."**
   - `match_knowledge_chunks` RPC **never existed** in the DB, so vector search always errored silently.
   - Brad's 88 curriculum chunks had **0 embeddings**: they were uploaded before the client-side embed trigger shipped.
   - The keyword fallback ANDed every word of speech ("um & yeah & I & mean…"), so it never matched.
   - Fixes:
     - Created the RPC (SECURITY INVOKER, so RLS applies).
     - Backfilled 88/88 embeddings with `text-embedding-ada-002`, the same model `knowledge-embed` uses.
     - Changed the fallback to an OR of words with 4+ letters.
     - Homework-help now always injects the child's curriculum chapter outline and accepts an optional `history` array.
2. **Robotic tutor voice:** browser `speechSynthesis` was replaced by OpenAI Realtime over WebRTC (ephemeral token minted server-side).
3. **Production deploys weren't landing:** see Gotcha #1.

---

## Gotchas (learned the hard way)
1. **Vercel project mismatch.** `www.visionaryai.life` is served by the Vercel project **`ai-interactive-vision-board-2`**, not `ai-coach-review`. `~/ai-coach-review/.vercel` is linked to `ai-coach-review` by default. To deploy production:
   ```bash
   cd ~/ai-coach-review
   npx vercel link --yes --project ai-interactive-vision-board-2
   npx vercel deploy --prod --yes
   npx vercel link --yes --project ai-coach-review   # relink back
   ```
   Tutor code is in a lazy chunk (`TutorBuddyDashboard-*.js`), so the main `index-*.js` hash may not change. Verify against the lazy chunk.
2. **Supabase CLI changed under npx (v2.109.0).**
   - `db query --remote=<ref>` is now rejected. Use `--linked`, or (more reliable) the Management API: `POST https://api.supabase.com/v1/projects/edaigbnnofyxcfbpcvct/database/query` with header `Authorization: Bearer <sbp token>` and body `{"query": "..."}`.
   - Function deploy: `npx supabase functions deploy <fn> --project-ref edaigbnnofyxcfbpcvct --yes`
   - Token: `grep -o 'sbp_[a-f0-9]*' "…/API Keys/New Supabase Access Token 4 17 2026.txt"`
3. Write queries through the old CLI also needed `--yes`.
4. Bridge `.env` key variable is `STACKCHAN_OPENAI_API_KEY` (not `OPENAI_API_KEY`). After `.env` changes, run `docker compose up -d --force-recreate`; `docker restart` won't reload env.
5. AMIE Realtime prompt loads at session start, so end and restart the AMIE session to pick up prompt changes.
6. computer_use on Milton's Chrome: the page is at **50% zoom**. Click by element index (look it up in the `elements_*.json` file); coordinate clicks miss. If Live Caption steals focus, capture with `pid=61364, window_id=<Chrome HWND>`.

---

## Key IDs
| Item | Value |
|---|---|
| Supabase project | `edaigbnnofyxcfbpcvct` |
| Milton auth uid | `bf262cc1-80ec-464a-afc4-b8931eb75506` |
| Brad child_profile id | `4c841cac-80ef-4319-be16-4d4076782acc` (grade 5, Math) |
| Curriculum source_id | `2f96820e-0ef4-4546-b5d8-662df63ab3fc` (88 chunks, all embedded) |
| Curriculum file | `~/Desktop/5th-Grade-Math-Curriculum-Brad.txt` |
| Tutor Realtime voice/model | env `OPENAI_TUTOR_REALTIME_VOICE` (default `shimmer`) / `OPENAI_REALTIME_MODEL` (default `gpt-realtime`) |

---

## Known caveats / next steps
1. **Voice tutor echo / room audio:** in testing the Realtime tutor responded to ambient audio. Recommend headphones for Brad, or tune `turn_detection.threshold` (currently 0.5) in `tutor-realtime-session` to 0.6–0.7.
2. **Future uploads:** the embedding trigger in `TutorBuddyDashboard.tsx` (calls `knowledge-embed` batch) has not yet been verified with a fresh upload. Upload a small file, then check `count(embedding)` for the new source_id.
3. **Chunks need `metadata.child_id`:** the Realtime tutor and outline only load chunks tagged with `child_id`. `tutor-parse-document` sets it today; older or manual uploads may not have it.
4. **Session logging:** Realtime conversations are not yet written to `study_sessions` or `student_models`. Next build: on End, post the transcript to `tutor-session-logger`, and call `tutor-student-model` per topic.
5. **Robot:** physical StackChan not yet in hand. Tutor Buddy bridge is on port 12802. Same curriculum context could be injected into the bridge prompt later.
6. **Remaining tasks:** File PA-12 · M5Stack partnership email · AMIE content · end-to-end test with Brad (headphones).

---
*To continue: "Read ~/hermes-stackchan/SESSION-HANDOFF-2026-11-14-TUTOR-BUDDY.md and execute the startup instructions before any work."*

---
## UPDATE — 2026-11-14 afternoon (live whiteboard + noise filter)
**Shipped & tested on production:**
- Live math whiteboard (`fbab448`, focus fix `660c656`): tutor draws long division / fractions / multiplication / number line / place value / area-volume while talking; Brad fills answer boxes; she reacts (wrong = hint, right = ✓). Plan: `docs/SAFE-PLAN-TUTOR-LIVE-WHITEBOARD.md`.
- Progress tracking verified: study_sessions row (practice, transcript, board_snapshot, slot_results) + student_models updated ("Long division → partial").
- Not yet tested: pen + "Check my drawing" (image to Realtime), finishing a full problem, fractions on the board.

**IN PROGRESS when WiFi dropped — background-noise filter (user said NO hold-to-talk):**
- Problem: a TV across the room was transcribed as Brad, so the tutor kept getting interrupted.
- Design:
  - RNNoise worklet (`@sapphi-red/web-noise-suppressor`)
  - adaptive ambient-floor level gate (`lib/tutorAudio/*`)
  - stricter VAD per level (standard: threshold 0.65, silence 600, near_field; strong: 0.75, 700)
  - Off/Standard/Strong setting
  - prompt rule to ignore TV/ad content
- A subagent was building it. Check `git status` / `git log` in `~/ai-coach-review` for partial or uncommitted work. Verify with `npm run build` and `npx vitest run`, deploy `tutor-realtime-session`, then deploy to Vercel project ai-interactive-vision-board-2 and browser-test with background audio.
- Also suggest Windows Studio Effects "Voice Focus" on the OmniBook (OS-level).

---
## UPDATE — noise filter SHIPPED (`5967ba2`) and live-tested
- **Filter:** RNNoise + adaptive distance gate + stricter VAD (standard: 0.65 threshold, near_field) + Off/Standard/Strong toggle (default Standard) + prompt rule to ignore TV/ad content. Falls back to the plain mic if the filter fails to load.
- **Live test (Chrome, speakers):**
  - ~15 s of quiet "TV" speech (drug ad + news) was fully ignored: no false transcript, no interruption.
  - Normal-volume request ("show me 1/2 + 1/3 on the whiteboard") was heard and drawn.
- **Fractions template tested:**
  - Wrong LCD 4 → tutor wrote multiples of 2 and 3 on the board.
  - LCD 6 → green ✓ and "Nice work, Brad!"; she filled the new denominators and asked for the new numerator.
- **Saved:** study_sessions row "Adding fractions" 2/1; student_models "Adding fractions with unlike denominators → partial".
- **Focus fix confirmed:** the answer box stays open when the window loses focus.
- **Open items:**
  - Pen + "Check my drawing" image not yet tested.
  - Stray "4" appeared twice in a box on the first attempt during automated testing (likely tool artifact; whenever the box was open, typed digits recorded exactly). Watch for it in real use.
  - Real-TV test by Milton/Brad still pending.
  - Consider Windows Studio Effects Voice Focus.

---
## UPDATE — #4 robot parity + #5 parent progress view SHIPPED
- **#5 (`8cf60a2`, `8a10993`):**
  - Skills & Progress / Study Sessions tabs now use student_models, study_sessions and slot_results.
  - Focus next suggestions.
  - Weekly report button (on-demand `tutor-weekly-report` POST {child_id, days}). The Sunday cron path is kept.
- **#4 (`221ed29` web/edge, bridge `b908f42` on LOCAL branch `visionary-tutor` in ~/stackchan-research/stackchan-ai-server, not pushed):**
  - Shared tutor brain `_shared/tutor-brain.ts`. The board engine now lives in `_shared/tutorBoard/` and `lib/tutorBoard/*` re-exports it.
  - New edge fn `tutor-robot-session` (header `x-robot-token`, verify_jwt=false).
  - New tables tutor_robot_devices, tutor_board_live (realtime), tutor_board_events.
  - The Go bridge fetches instructions per session (3 s fallback to the static prompt), routes search/board tools, polls tablet events and logs sessions.
  - Opt-in env `STACKCHAN_TUTOR_*`, set only in .env.tutor-buddy. Hermes 12800 is unchanged.
  - Brad's robot is paired (token in .env.tutor-buddy only).
- **Wiring (`320d524`):**
  - Dashboard has a "🤖 Robot" tab (pair/revoke robot, mirror link).
  - Tablet mirror route: `https://www.visionaryai.life/?tutorBoard=4c841cac-80ef-4319-be16-4d4076782acc` (parent must be signed in).
- **Verified:**
  - Prod bundles contain the new UI.
  - Bridge log: "fetched tutor instructions for Brad (21210 chars, 9 tools, 88 chunks, board=true)", a board event injected, session logged.
  - Robot fn returns 401 without a token.
- **Not yet clicked through by a human:** Robot tab, mirror on a real tablet, Weekly report button.
- **Limitations:**
  - The robot can't see drawings as an image (uses board_read plus asking Brad to explain).
  - Starting a robot session clears the child's board, so don't run the web board and the robot for the same child at the same time.
  - The bridge logs a session only on close.
  - Don't `git stash` in the stackchan repo: autocrlf converts the shell scripts to CRLF.

---
## UPDATE 2026-11-17 — Improvement plan Waves 1–2 SHIPPED (plan: docs/SAFE-PLAN-TUTOR-BUDDY-IMPROVEMENTS.md; master roadmap v3.87)

**Wave 1**
- **1A quizzes** (`496a06d`): per-answer quiz_results, a session score and completed/abandoned status. Browser-verified: a 4/5 quiz shows "4/5 (80%)".
- **1B camera homework** (`9f01499`, bridge `ca562bd`):
  - New `tutor-vision-read` (gpt-4o-mini; images never stored).
  - Web "📷 Show my worksheet"; robot tool `look_at_worksheet`.
  - Browser-verified: the camera opens and closes. With no worksheet in view, the tutor asks Brad to read a problem instead of inventing one.
- **1C stray digit** (`305e228` + wiring `17134e0`): root cause = a box prefilled with the earlier wrong answer, committed when focus arrived late. Commits now read the DOM value, boxes have no prefill, and each answer records an input_trace.

**Wave 2**
- **2A rewards** (`9034aa3`, UI wiring `fc2ebed`):
  - Tables tutor_rewards / tutor_reward_events.
  - Triggers trg_tutor_rewards_award / _quiz_award / _session_delete. Awarding is idempotent and server-side.
  - 9 badges; level = floor(sqrt(xp/50))+1.
  - Brad: 160 XP, level 2, 🌟 First Problem.
- **2B robot face emotions** (bridge `e17897b`, simulator `c5237a3`; env STACKCHAN_TUTOR_EMOTIONS=true). No head nod yet (motion API unverified).
- **2C sessions** (`e2ee42a`; bridge fix `d9ec399` polls events without the board):
  - child_profiles.session_minutes (10/15/20).
  - Countdown with [Session] cues and a wrap-up ritual; extend_session once.
  - start_teach_back / score_teach_back.
  - Robot timer via tutor_robot_sessions.

**Not yet human-tested**
- Camera with a real worksheet.
- The full 15-minute wrap-up and teach-back by voice.
- Robot emotions on real hardware.

**Known quirks**
- Quiz topics are lowercase while board topics are capitalised, so the same skill can get duplicate student_models rows (fix planned in Wave 3B).
- The robot session timer is shared per child.

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

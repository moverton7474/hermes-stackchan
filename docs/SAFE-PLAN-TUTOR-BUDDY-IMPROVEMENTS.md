# Safe Plan — Tutor Buddy Improvements (Gaps → Engagement → Lesson Planner → Sell-Ready)

**Date:** 2026-11-14 | **Owner:** Milton Overton | **Repos:** `moverton7474/AI-Interactive-Vision-Board-2` (`~/ai-coach-review`), `moverton7474/stackchan-ai-server-visionary` (`~/stackchan-research/stackchan-ai-server`, branch `visionary-tutor`)
**Production:** visionaryai.life = Vercel project `ai-interactive-vision-board-2` · Supabase `edaigbnnofyxcfbpcvct`
**Status:** APPROVED BY MILTON — execute in waves (order below).

---

## 0. Safety rules (apply to every wave)

| Rule | Why |
|---|---|
| **Never touch AMIE**: `supabase/functions/amie-*`, `_shared/amie-*`, `voice-coach-session`, `amie-prompt-builder`, `lib/realtime/AmieRealtimeClient.ts` | AMIE Voice Coach is live with users |
| **Hermes robot (port 12800) unchanged** — all bridge behaviour stays opt-in via `STACKCHAN_TUTOR_*` env | Only the Tutor Buddy container (12802) uses the tutor brain |
| **Additive DB changes only** — new tables/columns with defaults, RLS on every new table, no drops/renames | Rollback = ignore the new columns |
| **Feature flags** — each feature reads a flag from `child_profiles.settings` / env with a safe default; failures fall back to today's behaviour | Bad deploy can be switched off without a redeploy |
| **No raw child images/audio stored** — camera frames are processed in memory and discarded; only the text reading is kept | COPPA |
| **One owner per hot file per wave** (see file-ownership table) | Parallel builders must not clobber each other |
| **Verify before ship** — `npx vitest run` (tutor suites), `npx tsc --noEmit` (no new errors; baseline 10), `npm run build` (bundle budget), Go tests in Docker, live smoke test, then deploy | |
| **Commit only owned files** — never `git add -A`; check `git diff --cached --stat` before commit | Learned: staged renames got swept into another agent's commit |
| **Do not `git stash` in the stackchan repo** (autocrlf flips scripts to CRLF and breaks the Docker build) | |

Rollback for every wave: `git revert <commit>` + redeploy the touched edge functions + `vercel deploy --prod` from the previous commit. New tables can stay (unused).

---

## Wave 1 — Fix the gaps found in testing

### 1A. Quizzes record completion
**Problem:** `study_sessions` row is inserted at quiz *generation* with `questions_correct=0`; nothing is written when the quiz ends; `quiz_results` is empty, so scores never reach progress.
**Fix:**
- On each answer: insert a `quiz_results` row (question, chosen, correct answer, correct?, topic, response time).
- On finish (and on abandon/unmount): update the session row — `questions_correct`, `ended_at`, `duration_minutes`, `topics_covered`; mark `metadata.completed=true` (or `abandoned`).
- Feed each answer to `tutor-student-model` (same API the board uses) so skills update.
- Progress panel: completed quizzes show the score; only truly abandoned ones show "not finished".
**Files:** `components/TutorBuddyDashboard.tsx` (quiz section only), `supabase/functions/tutor-quiz-generate/index.ts` (add `complete` action if server-side write is cleaner).
**Verify:** take a 5-question quiz in prod → `quiz_results` has 5 rows, session row shows the score, Skills panel updates.

### 1B. Camera homework help ("Brad holds up his worksheet")
Builds on `SAFE-PLAN-CAMERA-HOMEWORK.md` Phases 1–3 (simplified: vision model instead of multi-engine OCR).
- **Shared:** new edge function `tutor-vision-read` — input: one JPEG (base64) + mode (`read_problem` | `check_work`); calls a vision model (gpt-4o-mini, `detail: high`) with a strict prompt: transcribe the problems and the child's written answers exactly, flag unreadable parts, **do not solve**. Returns structured JSON `{problems:[{text, child_answer, legible}]}`. Image never stored.
- **Web:** "📷 Show my worksheet" button in the voice tutor → webcam preview → snap → reading is sent to the Realtime tutor as context (`[Camera] Brad's worksheet shows: …`). The tutor then checks answers Socratically (hint, never the answer).
- **Robot:** new tool `look_at_worksheet` in the tutor brain; the Go bridge grabs the latest JPEG frame from the StackChan camera (existing camera subscription in `web_socket.go`), POSTs it to `tutor-robot-session` action `vision`, which calls the same reader. Robot says "Hold it up to my eyes… got it!".
- Optional: the reading can be put on the board (`board_show_problem` from the parsed problem).
**Verify:** web — hold a printed worksheet to the laptop camera, tutor reads both problems and spots a wrong answer; robot — Go unit test with a fixture JPEG + simulator path; no image rows in DB/storage.

### 1C. Stray "4" in answer boxes — instrument + guard
- Commit only the value that is visibly in the input at Enter (read from the DOM input, not stale state); ignore commits when the box was opened < 150 ms ago.
- Record a small `input_trace` on each slot result (keys pressed, open→commit ms; digits only, no other data) so a repeat can be diagnosed from `study_sessions.slot_results`.
- Unit test: open → type → Enter commits exactly the typed value; rapid open/close cannot commit.
**Files:** `components/TutorLiveBoard.tsx`, `lib/tutorBoard/*` (via `_shared/tutorBoard`).

---

## Wave 2 — Keep Brad engaged

### 2A. Rewards: XP, streaks, badges
- Table `tutor_rewards` (child_id PK, xp, level, current_streak, best_streak, last_active_date, badges jsonb) + `tutor_reward_events` (child_id, kind, xp, reason, created_at). RLS parent-read; writes via edge function `tutor-rewards` (service role) so kids can't edit XP.
- XP rules (server-side, idempotent per event id): correct box +10 (first try +15), problem finished +25, session completed +20, teach-back +30, daily streak bonus +10×streak (cap 50).
- Badges: First Problem, 3-Day Streak, 7-Day Streak, Long Division Pro (10 correct), Fraction Finder, Comeback Kid (correct after 2 misses), Teacher (5 teach-backs), Camera Scholar.
- UI: XP bar + level + streak flame in the Tutor header; confetti + "+15 XP" on ✓; badge toast; parent sees badges in Skills & Progress.
- Tutor knows the rewards (prompt line: current streak/level, celebrate new badges out loud).

### 2B. Robot personality (StackChan face)
- Bridge sends xiaozhi `{"type":"llm","emotion":…}` messages: `thinking` while a tool call / vision read runs, `happy` on correct, `confused`→`relaxed` on wrong (encouraging, never sad/angry), `loving` on badge/streak, `sleepy` at session end. Optional head nod on correct (existing motion control).
- Driven by tool results + board events (no extra model calls). Opt-in env `STACKCHAN_TUTOR_EMOTIONS=true`.
- Simulator shows the emotion name so it can be tested without hardware.

### 2C. Short, clear sessions + "teach it back"
- Session length: parent setting `session_minutes` (default 15; 10/15/20). Client timer sends `[Session] 5 minutes left` / `[Session] 1 minute left — start wrapping up` events; at time: tutor does a wrap-up ritual (what we did, XP earned, what's next tomorrow) then the session ends gracefully. Robot: same via bridge timer.
- Teach-back challenge: tool `start_teach_back(step)` → tutor asks Brad to explain a step "like you're teaching me"; tool `score_teach_back({accuracy, completeness, vocabulary})` stores a `teach_back` slot result; +30 XP. Tutor uses it once per session after a correct problem.

---

## Wave 3 — Lesson planner (the tutor runs a guided lesson)

### 3A. Start each session with a plan
- New `_shared/tutor-plan.ts`: builds today's plan from student_models (misconceptions, partial topics), FSRS due reviews (3B), Focus-next (curriculum chapters not started), and session length → e.g. `[{warmup: "quotient estimation", n:2}, {review: "Long division", n:1}, {new: "Chapter 1: Place Value"}]`.
- Instructions get a **Today's plan** block + a scripted opening: *"Last time long division tripped you up when estimating — let's warm up with 2 of those, then start Chapter 1: Place Value. Sound good?"* Brad can say "I have homework" → plan switches to homework mode.
- Tool `plan_step_done(step)` so the plan advances; plan + completion saved on the session row.

### 3B. Spaced review fed by real practice (FSRS)
- Every slot result (web board, robot board, quiz answer, teach-back) → FSRS review on the topic in `mastery_scores` via `tutor-progress-tracker`. Rating map: wrong = Again(1); correct after a hint/second try = Hard(2); correct first try = Good(3); correct first try & fast (< median time) = Easy(4). One review per topic per problem (not per box) to avoid over-counting.
- Done server-side inside `tutor-student-model` `update` so web, robot and quizzes all feed it.
- Review tab lists due topics; the plan (3A) pulls due reviews first.

### 3C. Practice aimed at specific mistakes
- Misconception → drill map in `_shared/tutorBoard/drills.ts`, e.g. `estimating quotient digit` → 3 "How many times does 4 go into 29?" mini-problems; `adding denominators` → "Do the bottoms match? Find the common denominator" drills; `regrouping` → place-value trades.
- Tool `board_show_drill(misconception)` renders a quick drill set; results feed the student model; a misconception is cleared after 3 correct in a row.

### 3D. More whiteboard problem types (curriculum-matched)
New templates in `_shared/tutorBoard/templates.ts` (single source for web + robot), each with answer slots + hints + tests:
- `place_value_chart` (millions → thousandths; "What digit is in the ten-thousands place?", expanded form)
- `multi_digit_multiplication` (standard algorithm with partial products / regrouping boxes)
- `number_line` (whole numbers, fractions, decimals; tap to place)
- `decimal_operation` (add/subtract/compare with aligned decimal points)
- `area_volume_grid` (rectangle area & rectangular prism volume l×w×h with unit cubes)
Board tools list updated; tutor prompt tells her which template fits which chapter.

---

## Wave 4 — Needed to sell to other families

### 4A. Child safety & privacy (COPPA)
> Technical controls only — the consent wording and privacy policy need review by counsel before public launch.
- `parental_consents` table (parent_user_id, child_id, consent_version, method, consented_at, ip_hash, revoked_at). Tutor features for a child are **blocked until the parent consents** (one-time screen when adding a child: what's collected, retention, rights). Brad gets a consent record created by Milton through the same screen.
- Data controls on the Robot/Settings tab: transcript retention (30 / 90 / 365 days, default 90; nightly purge job), "Download my child's data" (JSON export), "Delete all of my child's data".
- Images never stored (already), audio never stored (Realtime streams only).

### 4B. Content guardrails + "guide, don't tell" check
- Child input transcripts run through OpenAI moderation (free) server-side at session save; flagged items → parent alert in the weekly report (+ optional email), tutor prompt has a calm deflection script for off-limits topics.
- Answer-giveaway audit: post-session job (gpt-4o-mini) scores each tutor turn — "did she give the final answer before Brad tried?" — stored on the session; weekly report shows "Tutor guided vs. told: 96% guided"; repeated issues tighten the prompt.

### 4C. Daily time limits
- Parent setting `daily_limit_minutes` (default 45) and allowed hours (e.g. 3–8 pm). Session mint (web + robot) refuses with a friendly line when exceeded ("That's all for today, Brad — great work!"); remaining minutes passed into the session so the timer (2C) respects both.

### 4D. Cost control
- Model routing: `gpt-realtime-mini` for drills/review/flashcards, `gpt-realtime` for new teaching and homework help (chosen from the plan step type). Per-session cap (minutes) + per-family monthly minute budget.
- `tutor_usage` table (child_id, session_id, model, seconds, est_cost_usd) written at session end; admin view of cost per child/month. Env-configurable price table.

### 4E. More subjects
- **Reading fluency:** passage on screen (from uploaded book/curriculum or generated at grade level), Brad reads aloud, the tutor follows along, gently corrects miscues, computes words-correct-per-minute (WCPM) and asks 2 comprehension questions; results to student model ("Reading fluency" topic).
- **Science:** subject-aware prompt + diagram board template (labels to fill) using uploaded science curriculum.
- **Bible Study in voice:** Realtime mode using the existing `tutor-bible-studies` content (KJV/NIV per settings), memory-verse practice.
- **Canvas / Google Classroom import (optional, last):** parent pastes a Canvas access token (or Google OAuth) → import upcoming assignments + materials into the curriculum knowledge base. Behind a flag; read-only scopes.

---

## Execution waves & file ownership

| Wave | Workstream | Owns (exclusive in that wave) |
|---|---|---|
| 1 | 1A Quiz completion | `TutorBuddyDashboard.tsx` (quiz section), `tutor-quiz-generate` |
| 1 | 1B Camera homework | `tutor-vision-read` (new), `TutorRealtimeVoice.tsx`, `tutor-robot-session`, `_shared/tutor-brain.ts`, Go bridge |
| 1 | 1C Stray-4 guard | `TutorLiveBoard.tsx`, `_shared/tutorBoard/boardState.ts` |
| 2 | 2A Rewards | new tables + `tutor-rewards` fn + new `TutorRewardsBar.tsx`; wiring done by orchestrator |
| 2 | 2B Robot face | Go bridge, simulator |
| 2 | 2C Session length + teach-back | `TutorRealtimeVoice.tsx`, `_shared/tutor-brain.ts`, `tutor-robot-session` |
| 3 | 3A+3C Plan + drills | `_shared/tutor-brain.ts`, `_shared/tutor-plan.ts`, `_shared/tutorBoard/drills.ts` |
| 3 | 3B FSRS from practice | `tutor-student-model`, `tutor-progress-tracker`, Review tab component |
| 3 | 3D New templates | `_shared/tutorBoard/templates.ts`, `types.ts`, `TutorLiveBoard.tsx` renderers |
| 4 | 4A+4C+4D Policy (consent, limits, cost) | `_shared/tutor-policy.ts`, session mint paths (`tutor-realtime-session`, `tutor-robot-session`), new settings component |
| 4 | 4B Safety audit | new `tutor-session-audit` fn, `tutor-weekly-report` |
| 4 | 4E Subjects | `_shared/tutor-brain.ts` modes, new reading/science components |

Each wave ends with: orchestrator wiring → full verification → prod deploy → browser test → handoff update.

## Success measures
- Quiz scores appear in Skills & Progress within seconds of finishing.
- Brad's sessions open with a plan, average 10–15 min, end with a recap.
- `mastery_scores` populated; Review tab surfaces due topics on schedule.
- Misconception cleared after targeted drills (tracked in `student_models`).
- Weekly report shows streak/XP, guided-vs-told ≥ 95%, time within limits, est. cost/child.

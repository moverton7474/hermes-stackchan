# Session Handoff — StackChan + Tutor Buddy + AMIE Updates (Session 2)
**Date:** 2026-11-14 | **Session:** ~3 hours | **Repos:** moverton7474/hermes-stackchan, moverton7474/AI-Interactive-Vision-Board-2

---

## What Was Done This Session

### Tutor Buddy — Phases B/C/D Completed
- **8 edge functions built and deployed** to production Supabase (edaigbnnofyxcfbpcvct):
  - `tutor-parse-document` (630 lines) — education-aware file parser
  - `tutor-quiz-generate` (390 lines) — FSRS-aware quiz from coursework
  - `tutor-progress-tracker` (462 lines) — FSRS 4.5 spaced repetition + mastery
  - `tutor-study-session` (292 lines) — session lifecycle
  - `tutor-homework-help` (331 lines) — Socratic RAG teaching
  - `tutor-flashcard-mode` (~350 lines) — flashcard generation
  - `tutor-bible-studies` (~950 lines) — daily verse, stories, quiz, memory verse
  - `tutor-weekly-report` (~350 lines) — automated HTML email digest

### Tutor Buddy Dashboard — Live on visionaryai.life
- **TutorBuddyDashboard.tsx** (34KB) — converted from Next.js to Vite/React/Tailwind
- Navigation wired: 📚 Tutor in desktop nav, More dropdown, mobile menu
- Deep link: `https://www.visionaryai.life/?open=tutor`
- **Bug fixed:** `parent_user_id` FK referenced `user_profiles(id)` instead of `user_profiles(user_id)` — caused silent insert failure
- **Brad (5th grade, Math)** saved to production DB

### AMIE Awareness Updates
- AMIE now knows about Tutor Buddy and AMIE Robot Coach
- Updated 3 prompt surfaces:
  - `amie-realtime-session` (the voice panel — main one)
  - `voice-coach-session` (legacy voice)
  - `amie-prompt-builder` (text chat)
- Added `TUTOR_BUDDY` to `amie-app-destinations.ts` (16 aliases)
- AMIE can describe Tutor Buddy features and navigate users there
- **Note:** Must END and START a new voice session for new prompt to load

### Bridge Server
- OpenAI API key applied to both containers (Hermes 12800 + Tutor Buddy 12802)
- **Critical:** Use `docker compose up --force-recreate` not `docker restart` for .env changes
- Tutor Buddy Docker compose + env template committed to hermes-stackchan repo

### Robot Simulator
- Personality switcher added (Hermes/AMIE/Tutor Buddy buttons)
- Hello handshake + listen:start/stop JSON protocol implemented
- Binary protocol fixed to v3 (4-byte header, type=0x00)
- **Audio codec fix in progress:** Using `opus-recorder` WASM for raw Opus frames

### Weekly Cron
- `tutor-weekly-report` cron job created (Sundays 9 AM UTC, job ID 27)

---

## PRs Merged
| PR | Repo | What |
|----|------|------|
| #293 | AI-Interactive-Vision-Board-2 | 6 edge functions (Phases B/C/D) |
| #294 | AI-Interactive-Vision-Board-2 | Parent dashboard UI + app navigation |

## Direct Commits to Main
| Commit | Repo | What |
|--------|------|------|
| 51471c3 | AI-Interactive-Vision-Board-2 | Fix deprecated [inbucket] in config.toml |
| 72a5cfc | AI-Interactive-Vision-Board-2 | Fix parent_user_id in child insert |
| 06a2797 | AI-Interactive-Vision-Board-2 | FK fix migration (user_profiles.user_id) |
| ec229d2 | AI-Interactive-Vision-Board-2 | AMIE awareness (voice-coach + prompt-builder) |
| 10903e3 | AI-Interactive-Vision-Board-2 | AMIE awareness (amie-realtime-session) |
| 20d7fcb | hermes-stackchan | Tutor Buddy Docker compose + env template |
| dd65adc | hermes-stackchan | Robot behavior mappings + voice switch design |
| 7548ba8 | hermes-stackchan | Simulator personality switcher |
| 7d6b2f7 | hermes-stackchan | AMIE Tutor awareness safe plan |
| f7c215b | hermes-stackchan | Simulator xiaozhi protocol fix |
| 7505158 | hermes-stackchan | Binary protocol v3 fix |

---

## Services Running
| Service | Port | Status |
|---------|------|--------|
| stackchan-ai-server (Hermes) | 12800 | ✅ Running, real API key |
| Tutor Buddy bridge | 12802 | ✅ Running, real API key |
| Offline service | 12900 | ✅ Running |
| Ollama (gemma2:2b) | 11434 | ✅ Running |
| Simulator HTTP server | 8765 | ✅ Running (python http.server) |

## Still Needs Doing
1. **File PA-12 patent** ($130) — https://patentcenter.uspto.gov
2. **Simulator audio codec** — opus-recorder WASM integration (in progress)
3. **Test AMIE navigation** — end current session, start new one, ask "take me to Tutor Buddy"
4. **Physical robots** — test when DHL delivers
5. **Path 3 (future)** — Switch to circlemouth/Hermes-StackChan ai-server for richer Node.js bridge

---

## Key Learnings
1. `docker restart` does NOT reload `.env` files — must use `docker compose up --force-recreate`
2. `user_profiles.id` ≠ `auth.uid()` — the auth user ID is in `user_profiles.user_id`
3. The app has THREE separate AMIE prompt surfaces — `amie-realtime-session` is the one used by the voice panel
4. Browser MediaRecorder produces WebM/Opus containers, not raw Opus frames — need WASM encoder
5. BinaryProtocol3: type byte is `0x00` for Opus (not `0x01`), 4-byte header (not 5)
6. Supabase edge function deploy needs `--yes` flag in agent mode

---

*To continue: "Read ~/hermes-stackchan/SESSION-HANDOFF-2026-11-14.md and execute remaining tasks."*

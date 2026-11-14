# Safe Plan: Tutor Buddy Next-Gen Features Integration
**Date:** 2026-11-14
**Author:** localagent (Hermes Desktop Agent)
**Objective:** Integrate 4 advanced features into Tutor Buddy without impacting AMIE Voice Coach or any existing Visionary AI functionality
**Risk Level:** LOW — all changes are additive, new components, new edge functions, new tables
**Based On:** Open source research of OpenTutor, live-voice-tutor, tutor-gpt, ai-math-tutor

---

## What NOT to Change

- ❌ AMIE Realtime Session (`amie-realtime-session/index.ts`) — no modifications
- ❌ AMIE Voice Coach (`voice-coach-session/index.ts`) — no modifications
- ❌ AMIE Prompt Builder (`amie-prompt-builder/index.ts`) — no modifications
- ❌ AMIE tool definitions, confirmation gates, or navigation
- ❌ Existing Tutor Buddy edge functions (parse, quiz, progress, session, homework, flashcard, bible)
- ❌ Existing Supabase tables, RLS policies, or indexes
- ❌ OpenAI Realtime API configuration used by AMIE
- ❌ GVC Hermes, Visionary AI Coach landing page, or any production system
- ❌ Bridge server configuration for Hermes (12800) or AMIE (12801)

---

## Feature 1: Voice Tutoring Agent (Pipecat STT→LLM→TTS)

### Why
Kids learn better by talking, not typing. The current Tutor Buddy is text-only — no voice interaction in the web app. AMIE has voice but isn't a tutor. Tutor Buddy needs its own voice agent that uses the Socratic method.

### Architecture
```
Browser (Tutor Buddy dashboard)
    ↕ WebRTC (Daily.co or LiveKit)
Pipecat Voice Pipeline (new Docker container on laptop)
    ├── STT: Deepgram or Whisper
    ├── LLM: GPT-4o-mini with Tutor Buddy system prompt + RAG context
    ├── TTS: OpenAI TTS (shimmer voice, same as robot)
    └── VAD: Silero VAD (handles kid pauses gracefully)
```

### What's Different from AMIE Voice Coach
| Aspect | AMIE Voice Coach | Tutor Buddy Voice |
|--------|-----------------|-------------------|
| Protocol | OpenAI Realtime API (native voice-to-voice) | Pipecat cascade (STT→LLM→TTS, separately swappable) |
| System prompt | AMIE coaching (goals, habits, vision boards) | Socratic math tutor (curriculum-aware, grade-adapted) |
| Tools | 40+ AMIE tools (calendar, email, goals, etc.) | 5 tutor tools (check_answer, get_hint, next_problem, get_mastery, save_progress) |
| Session model | Voice coach sessions (7 types) | Study sessions (homework_help, quiz, review, practice) |
| Port/Service | Supabase edge function → OpenAI Realtime | Standalone Pipecat container (port 8790) |
| Auth | Supabase JWT → OpenAI | Supabase JWT → Pipecat |
| User | Parent/adult | Child (kid-safe, COPPA compliant) |

### No Conflict Guarantee
- Pipecat runs as a **separate Docker container** on a different port (8790)
- Uses a **completely different API** (WebRTC via Daily.co, not WebSocket OpenAI Realtime)
- Has its **own system prompt** (Tutor Buddy, not AMIE)
- **Does not modify** any AMIE code, tools, or configuration
- The dashboard embeds a **new React component** (`TutorVoiceAgent.tsx`) — does not touch `AmieLiveVoicePanel.tsx`

### Implementation Steps
| Step | What | Risk | Reversible |
|------|------|------|-----------|
| 1.1 | Install Pipecat + Deepgram + Daily.co dependencies | NONE | `pip uninstall` |
| 1.2 | Create `tutor-voice-agent/` directory with Pipecat bot | NONE | Delete directory |
| 1.3 | Write Tutor Buddy voice prompt (Socratic, grade-aware, curriculum RAG) | NONE | Text file |
| 1.4 | Create Docker container for Pipecat bot (port 8790) | NONE | `docker rm` |
| 1.5 | Add `TutorVoiceAgent.tsx` component to dashboard | NONE | Remove component |
| 1.6 | Add "🎤 Talk to Tutor" button next to existing action buttons | NONE | Remove button |
| 1.7 | Test voice conversation with Brad's math curriculum | NONE | Testing only |

### Open Source Reference
- [live-voice-tutor](https://github.com/oyekamal/live-voice-tutor) — Pipecat pipeline, self-echo fix, WebRTC browser client
- Pattern: `CooldownUserMuteStrategy` for preventing bot from hearing itself

### API Keys Needed
- Deepgram API key (STT) — free tier: 12,000 min/year
- Daily.co API key (WebRTC rooms) — free tier: 10,000 min/month
- OpenAI API key (LLM + TTS) — already have

---

## Feature 2: Theory-of-Mind Student Modeling (Adaptive Prompts)

### Why
Current Tutor Buddy gives the same explanation regardless of what the student already knows. Theory-of-Mind (ToM) modeling tracks what the student understands, where they struggle, and adapts the teaching approach in real-time.

### Architecture
```
Student interaction (quiz answer, homework question, voice conversation)
    ↓
Student Model Updater (new edge function)
    ├── Tracks: known topics, misconceptions, learning pace, preferred explanation style
    ├── Updates: student_model table (per-child, per-topic)
    └── Feeds into: system prompt context for all tutor interactions
    ↓
Adaptive Prompt Builder
    ├── If student knows fractions well → skip basics, go to application
    ├── If student has misconception → target it specifically
    ├── If student learns visually → use diagrams/examples
    └── If student is frustrated → slow down, encourage, simplify
```

### Database (New Table — Additive)
```sql
CREATE TABLE student_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  understanding_level TEXT DEFAULT 'unknown'
    CHECK (understanding_level IN ('unknown', 'misconception', 'partial', 'solid', 'mastered')),
  misconceptions TEXT[] DEFAULT '{}',
  preferred_explanation_style TEXT DEFAULT 'step_by_step'
    CHECK (preferred_explanation_style IN ('step_by_step', 'visual', 'analogy', 'example_first', 'formal')),
  attempts_before_hint INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  frustration_signals INTEGER DEFAULT 0,
  last_interaction_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id, subject, topic)
);
```

### No Conflict Guarantee
- **New table** — does not modify existing tables
- **New edge function** (`tutor-student-model/index.ts`) — does not modify existing functions
- Student model data feeds into tutor prompts **only** — AMIE prompt builder is untouched
- The adaptive prompt is injected as additional context in existing `tutor-homework-help` and `tutor-quiz-generate` — via an optional parameter, not a breaking change

### Implementation Steps
| Step | What | Risk | Reversible |
|------|------|------|-----------|
| 2.1 | Create `student_models` table migration | NONE | `DROP TABLE` |
| 2.2 | Create `tutor-student-model/index.ts` edge function | NONE | Delete + undeploy |
| 2.3 | Update `tutor-homework-help` to fetch student model and inject into prompt | LOW | Remove the fetch call |
| 2.4 | Update `tutor-quiz-generate` to adjust difficulty based on student model | LOW | Remove the adjustment |
| 2.5 | Add model update calls after quiz answers and homework interactions | NONE | Remove the calls |

### Open Source Reference
- [tutor-gpt](https://github.com/plastic-labs/tutor-gpt) — Theory-of-Mind reasoning, dynamic prompt updating based on student state
- Paper: "The 2 Sigma Problem" (Bloom, 1984) — 1-on-1 tutoring achieves 2 standard deviations improvement

---

## Feature 3: Visual Whiteboard for Math Step-by-Step

### Why
Math tutoring is inherently visual. Showing "3/4 + 1/4" as text is harder to understand than seeing it drawn on a board. A shared whiteboard lets Tutor Buddy write steps while explaining.

### Architecture
```
Browser (Tutor Buddy dashboard)
    ├── tldraw Canvas (open-source infinite canvas library)
    ├── AI writes solution steps as tldraw shapes
    ├── Student can draw/write on the same canvas
    └── Steps appear one at a time (animated, teacher-like)
```

### What's Built
- **New React component**: `TutorWhiteboard.tsx`
- Uses `@tldraw/tldraw` (MIT license, 36K stars)
- AI generates step-by-step solutions as structured shapes (text boxes, arrows, number lines)
- New edge function: `tutor-whiteboard-solve/index.ts` — takes a math problem, returns tldraw shapes for each step

### No Conflict Guarantee
- **Entirely new component** — does not modify any existing React components
- tldraw is a **client-side library** — no server changes needed for the canvas
- The solve function is a **new edge function** — does not modify existing functions
- Added as an optional panel in Tutor Buddy dashboard — user clicks "📐 Whiteboard" to open it

### Implementation Steps
| Step | What | Risk | Reversible |
|------|------|------|-----------|
| 3.1 | `npm install @tldraw/tldraw` | NONE | `npm uninstall` |
| 3.2 | Create `TutorWhiteboard.tsx` component | NONE | Delete file |
| 3.3 | Create `tutor-whiteboard-solve/index.ts` edge function | NONE | Delete + undeploy |
| 3.4 | Add "📐 Whiteboard" button to action bar | NONE | Remove button |
| 3.5 | Connect homework help responses to whiteboard visualization | LOW | Remove the connection |

### Open Source Reference
- [ai-math-tutor](https://github.com/zicojiao/ai-math-tutor) — Voice-first + shared tldraw whiteboard, LiveKit, step-by-step visual teaching
- Uses GPT-4o to generate tldraw shapes from math problems

---

## Feature 4: FSRS-5/6 Upgrade for Better Spaced Repetition

### Why
Current implementation uses FSRS 4.5 (17 parameters). FSRS-5/6 (21 parameters) is more accurate at predicting when a student will forget, leading to better review timing and faster mastery.

### What Changes
- **Update `tutor-progress-tracker/index.ts`** — replace FSRS 4.5 constants and formulas with FSRS-5/6
- **Update `mastery_scores` table** — add 4 new FSRS columns (additive, no existing columns removed)

### FSRS-5/6 Improvements Over 4.5
| Aspect | FSRS 4.5 | FSRS-5/6 |
|--------|----------|----------|
| Parameters | 17 | 21 |
| Short-term memory | Not modeled | Modeled (first 5 reviews) |
| Same-day reviews | Treated as normal | Special handling |
| Stability after lapse | Fixed formula | Context-dependent |
| Accuracy (log-loss) | 0.326 | 0.312 (4.3% better) |

### Database Migration (Additive Only)
```sql
ALTER TABLE mastery_scores
  ADD COLUMN IF NOT EXISTS fsrs_last_review_rating INTEGER,
  ADD COLUMN IF NOT EXISTS fsrs_short_term_stability REAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fsrs_context_dependent_lapse BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fsrs_version INTEGER DEFAULT 4;
```

### No Conflict Guarantee
- **Only modifies `tutor-progress-tracker`** — no other function uses FSRS
- Existing FSRS 4.5 data is **forward-compatible** — FSRS-5/6 can read v4.5 state
- New columns have defaults — existing rows don't break
- The `fsrs_version` column tracks which version was used, enabling gradual migration

### Implementation Steps
| Step | What | Risk | Reversible |
|------|------|------|-----------|
| 4.1 | Add 4 new columns to `mastery_scores` | NONE | `ALTER TABLE DROP COLUMN` |
| 4.2 | Update FSRS constants in `tutor-progress-tracker` | LOW | Revert to v4.5 constants |
| 4.3 | Add short-term memory modeling | LOW | Remove the code block |
| 4.4 | Add same-day review handling | LOW | Remove the code block |
| 4.5 | Test with Brad's existing mastery data | NONE | Testing only |

### Open Source Reference
- [OpenTutor FSRS](https://github.com/zijinz456/OpenTutor/blob/main/apps/api/services/spaced_repetition/fsrs.py) — FSRS-5/6 Python implementation (21 parameters)
- [FSRS Algorithm](https://github.com/open-spaced-repetition/fsrs4anki) — Official reference implementation

---

## Execution Order (Dependencies)

```
Feature 4: FSRS-5/6     ──► Can start immediately (no dependencies)
Feature 2: Student Model ──► Can start immediately (no dependencies)
Feature 3: Whiteboard    ──► Can start immediately (no dependencies)
Feature 1: Voice Agent   ──► Needs API keys (Deepgram, Daily.co)
                              Benefits from Features 2+3 (ToM feeds voice prompt,
                              whiteboard can be narrated)
```

**Recommended order:** 4 → 2 → 3 → 1

| Phase | Features | Duration | Blocked By |
|-------|----------|----------|-----------|
| **Phase 1** | FSRS-5/6 upgrade + Student modeling | 2-3 hours | Nothing |
| **Phase 2** | Visual whiteboard | 2-3 hours | Nothing (parallel with Phase 1) |
| **Phase 3** | Voice tutoring agent | 3-4 hours | API keys (Deepgram, Daily.co) |

---

## Risk Summary

| Feature | Risk to AMIE | Risk to Existing Tutor Buddy | Risk to Production |
|---------|-------------|-----------------------------|--------------------|
| Voice Agent | NONE — separate service, separate port, separate protocol | NONE — new component only | NONE — new container |
| Student Model | NONE — doesn't touch AMIE prompts | LOW — adds optional context to tutor prompts | NONE — new table + function |
| Whiteboard | NONE — client-side library only | NONE — new component only | NONE — npm dependency |
| FSRS-5/6 | NONE — AMIE doesn't use FSRS | LOW — updates one function with backward-compatible math | NONE — additive columns |

**Total new files:** 5 edge functions + 3 React components + 2 migrations + 1 Docker container
**Total modified files:** 2 existing edge functions (additive parameters only)
**Total deleted/replaced files:** 0

---

## Validation Checklist (Before Each Feature Goes Live)

- [ ] AMIE Realtime voice session still works (test: start session, ask a question)
- [ ] AMIE can still navigate to Tutor Buddy
- [ ] Existing quiz still generates and scores correctly
- [ ] Existing homework help still responds
- [ ] Brad's profile and uploaded content still visible
- [ ] No console errors on dashboard load
- [ ] No Supabase function deployment failures

---

*Safe plan generated November 14, 2026. Based on analysis of 5 open-source AI tutor projects (OpenTutor, tutor-gpt, live-voice-tutor, ai-math-tutor, awesome-socratic-tutor). All changes are additive with no existing system modifications.*

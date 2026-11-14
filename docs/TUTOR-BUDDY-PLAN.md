# Tutor Buddy — Product Plan

**Date:** 2026-11-13
**Author:** localagent (Hermes Desktop Agent)
**Parent Product:** Visionary AI Coach (AMIE)
**Hardware:** StackChan M5Stack CoreS3 (same as AMIE Robot Coach)
**Docket:** VAI-PA-12-2026 (covered by existing patent claims)

---

## Executive Summary

**Tutor Buddy** is AMIE in kid-friendly form — a $199 desk robot that helps children with homework, explains concepts at their grade level, quizzes them with spaced repetition, and celebrates correct answers with a dance. Parents upload coursework, syllabi, and textbooks to the Second Brain via the Visionary AI Coach app, and Tutor Buddy uses RAG retrieval to teach from that material.

**Market gap:** No product combines an affordable physical robot + voice-first Socratic tutoring + all subjects + personal knowledge base + faith-grounded content + offline mode. The closest competitor (Moxie, $799) died in 2026 when its company folded, bricking every robot and traumatizing children. Tutor Buddy's offline mode and open architecture prevent this.

**Target market:** 5.5M+ US homeschool families (zero AI products serve this faith-based segment), plus 50M+ K-12 students whose parents spend $40-80/hour on human tutoring.

---

## Platform Reuse (60% Existing)

### What Already Works (from Visionary AI Coach)

| Capability | How Tutor Buddy Uses It |
|---|---|
| **Second Brain (RAG)** | Parents upload textbooks/syllabi → chunks → embeddings → semantic search during tutoring |
| **Knowledge Ingest** | `knowledge-ingest` edge function handles upload → 1000-char chunks → ada-002 embeddings |
| **Voice Sessions** | `amie-realtime-session` provides voice-to-voice coaching via OpenAI Realtime |
| **Habit Tracking** | Track daily study habits (study streaks, time-on-task) |
| **Reminders** | "Time for homework!" proactive notifications via robot |
| **Calendar** | Schedule study sessions, track assignment due dates |
| **Session Memory** | Remember what topics were covered, where the student struggled |
| **Proactive Outreach** | Robot initiates study reminders at scheduled times |
| **Inbox/Thought Capture** | Student says "Remember I have a test on Friday" → saved |
| **Offline Mode** | Ollama fallback for basic tutoring without WiFi |

### What Must Be Built (10 New Components)

| # | Component | Priority | Effort | Description |
|---|---|---|---|---|
| 1 | **File Parser** | 🔴 Critical | 2 weeks | PDF, DOCX, PPTX, EPUB parsing before chunking. Use `pdf-parse`, `mammoth`, `epub.js` |
| 2 | **Education-Aware Chunking** | 🔴 Critical | 1 week | Chunk by chapter, section, exercise — not arbitrary 1000-char splits. Preserve problem sets as atomic units |
| 3 | **Quiz Engine** | 🔴 Critical | 2 weeks | Generate questions from uploaded material. Multiple choice, fill-in-blank, verbal Q&A. Track correct/incorrect |
| 4 | **Progress Tracker** | 🔴 Critical | 1 week | Per-subject, per-topic mastery scores. Track accuracy over time. Surface weak areas |
| 5 | **Spaced Repetition (FSRS)** | 🟡 Important | 1 week | Integrate FSRS 4.5 algorithm for optimal review scheduling. "You haven't reviewed fractions in 3 days" |
| 6 | **Parent-Child Accounts** | 🔴 Critical | 2 weeks | Parent creates account, adds children. Each child gets own profile, progress, knowledge base. Parent sees dashboard |
| 7 | **Grade-Level Adapter** | 🟡 Important | 1 week | Adjust vocabulary, complexity, and explanation depth by grade (K-12). Parent sets grade level |
| 8 | **Worksheet OCR** | 🟢 Nice-to-have | 1 week | CamS3 camera reads printed/handwritten problems. Send to Google Vision API or Tesseract |
| 9 | **Parent Dashboard** | 🟡 Important | 2 weeks | Weekly email/SMS report: subjects studied, time spent, accuracy, areas needing help |
| 10 | **Content Safety Filter** | 🔴 Critical | 1 week | COPPA compliance. No persistent child voice storage. Profanity filter. Age-appropriate responses only |

---

## Architecture

```
Parent/Student (Web/Mobile App)
  │
  ├── Upload coursework (PDF, DOCX, textbook)
  │     ↓
  │   File Parser → Education-Aware Chunker → Embeddings → Supabase pgvector
  │
  ├── Set grade level, subjects, schedule
  │     ↓
  │   user_profiles → child_profiles (NEW)
  │
  └── View progress dashboard
        ↑
      progress_tracker → quiz_results → mastery_scores

Tutor Buddy Robot (StackChan)
  │
  ├── "Hey Tutor Buddy, help me with math"
  │     ↓
  │   Bridge Server → OpenAI Realtime (with Tutor Buddy system prompt)
  │     ↓
  │   RAG retrieval from student's uploaded coursework
  │     ↓
  │   Socratic teaching response (hints, not answers)
  │
  ├── "Quiz me on Chapter 3"
  │     ↓
  │   Quiz Engine generates questions from Chapter 3 chunks
  │     ↓
  │   Voice Q&A with celebration on correct / gentle correction on wrong
  │     ↓
  │   Results → progress_tracker → FSRS scheduler
  │
  └── Proactive: "It's 4pm — time for your reading practice!"
        ↓
      Bridge Server polls scheduled_study_sessions
```

---

## Database Schema (New Tables)

```sql
-- Child profiles linked to parent account
CREATE TABLE child_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID REFERENCES user_profiles(id),
  name TEXT NOT NULL,
  grade_level INTEGER NOT NULL CHECK (grade_level BETWEEN 0 AND 12), -- 0 = K
  birth_year INTEGER,
  subjects TEXT[] DEFAULT '{}', -- ['math', 'reading', 'science']
  study_schedule JSONB DEFAULT '{}', -- {"mon": "16:00", "wed": "16:00", "fri": "16:00"}
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Track quiz results and mastery
CREATE TABLE quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES child_profiles(id),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  student_answer TEXT,
  is_correct BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  source_chunk_id UUID REFERENCES user_knowledge_chunks(id),
  session_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mastery scores per topic (updated after each quiz)
CREATE TABLE mastery_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES child_profiles(id),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  mastery_pct REAL DEFAULT 0 CHECK (mastery_pct BETWEEN 0 AND 100),
  total_attempts INTEGER DEFAULT 0,
  correct_attempts INTEGER DEFAULT 0,
  fsrs_stability REAL DEFAULT 0, -- FSRS algorithm state
  fsrs_difficulty REAL DEFAULT 0,
  next_review_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id, subject, topic)
);

-- Study sessions log
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES child_profiles(id),
  subject TEXT NOT NULL,
  duration_minutes INTEGER,
  questions_asked INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  topics_covered TEXT[] DEFAULT '{}',
  session_type TEXT DEFAULT 'homework_help', -- homework_help, quiz, review, reading
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- Uploaded educational content metadata
CREATE TABLE educational_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES child_profiles(id),
  uploaded_by UUID REFERENCES user_profiles(id), -- parent
  title TEXT NOT NULL,
  content_type TEXT NOT NULL, -- textbook, syllabus, worksheet, notes, study_guide
  subject TEXT NOT NULL,
  grade_level INTEGER,
  file_name TEXT,
  file_type TEXT, -- pdf, docx, pptx, epub, txt
  source_id UUID REFERENCES user_knowledge_sources(id), -- links to Second Brain
  chapter_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Tutor Buddy System Prompt

```
You are Tutor Buddy, a warm, patient, and encouraging AI tutor for children.
You are embodied in a small desktop robot with a face display and head movement.

TEACHING METHOD:
- Use the Socratic method: ask guiding questions, give hints, NEVER just give the answer
- When a student gets stuck, break the problem into smaller steps
- Celebrate correct answers enthusiastically (your face will show celebration, you'll dance!)
- When a student gets it wrong, say "Good try! Let me give you a hint..." — NEVER say "wrong"
- Adapt your vocabulary to the student's grade level
- Use real-world examples kids can relate to

SUBJECTS: Math, Reading, Science, History, Language Arts, Bible Studies

VOICE STYLE:
- Warm, patient, encouraging — like a favorite teacher
- Short sentences (speaking through a small speaker)
- Use the student's name frequently
- "You're doing great!" / "Almost there!" / "I knew you could do it!"

TOOLS AVAILABLE:
- search_knowledge: Find relevant content from uploaded coursework
- generate_quiz: Create practice questions from uploaded material
- check_answer: Verify student's answer and update progress
- get_mastery: Check student's mastery level for a topic
- get_schedule: Check today's study plan
- set_reminder: Schedule study reminders
- save_memory: Remember what topics were covered

SAFETY:
- Never discuss topics inappropriate for children
- If asked about something outside schoolwork, redirect: "That's interesting! But let's focus on your homework."
- Never store or repeat personal information beyond the student's first name
- If a child seems distressed, say "It sounds like you might want to talk to your mom or dad about that."

ROBOT BEHAVIORS:
- Correct answer → celebration face + head dance + "You got it!"
- Wrong answer → concerned face + gentle hint
- Quiz time → excited face + "Let's see what you remember!"
- Reading time → calm face + slow, clear speech
- Study complete → big celebration + "Great study session! You covered [topics]!"
```

---

## Product Tiers

| Tier | Price | Includes |
|------|-------|---------|
| **Tutor Buddy Basic** | $199 hardware + $9.99/mo | 1 child, 3 subjects, 10 uploads/mo, voice tutoring, quiz mode |
| **Tutor Buddy Family** | $199 hardware + $24.99/mo | Up to 4 children, all subjects, unlimited uploads, parent dashboard, weekly reports |
| **Tutor Buddy School** | $149/unit (10+ bulk) + $7.99/student/mo | Classroom license, teacher dashboard, curriculum alignment, LMS integration |

---

## Competitive Advantages

| Feature | Khanmigo ($4/mo) | Synthesis ($119/yr) | Moxie ($799) | **Tutor Buddy ($199)** |
|---|---|---|---|---|
| Physical robot | ❌ | ❌ | ✅ (dead) | ✅ |
| Voice-first | ❌ (text) | ✅ (math only) | ✅ | ✅ |
| All subjects | ✅ | ❌ (math) | ❌ (social) | ✅ |
| Upload your own content | ❌ | ❌ | ❌ | ✅ (Second Brain) |
| Faith-based content | ❌ | ❌ | ❌ | ✅ |
| Offline mode | ❌ | ❌ | ❌ | ✅ |
| Spaced repetition | ❌ | ❌ | ❌ | ✅ (FSRS) |
| Camera OCR (worksheets) | ❌ | ❌ | ❌ | ✅ |
| Parent dashboard | ✅ | ✅ | ✅ | ✅ |
| Survives company shutdown | N/A | N/A | ❌ (bricked) | ✅ (offline + open) |
| Price | $4/mo | $119/yr | $799 + $30/mo | $199 + $9.99/mo |

---

## Open Source Integrations

| Project | What We Take | License |
|---|---|---|
| **Tutor MCP** | Bayesian Knowledge Tracing + FSRS integration pattern | MIT |
| **OpenTutor** | FSRS 4.5 spaced repetition, knowledge graph, cognitive load detection | MIT |
| **FSRS** | Scheduling algorithm for optimal review timing | MIT |
| **pdf-parse** | PDF text extraction | MIT |
| **mammoth** | DOCX → text conversion | BSD |
| **Tesseract.js** | OCR for worksheet camera reading | Apache 2.0 |

---

## Execution Phases

### Phase A: Foundation (Q1 2028) — 6 weeks
- [ ] File parser (PDF, DOCX, PPTX, EPUB)
- [ ] Education-aware chunking (chapter/section/exercise awareness)
- [ ] Parent-child account model (Supabase schema + RLS)
- [ ] Tutor Buddy system prompt + robot personality
- [ ] Content safety filter (COPPA compliance)
- [ ] Grade-level vocabulary adapter

### Phase B: Core Tutoring (Q1-Q2 2028) — 6 weeks
- [ ] Quiz engine (generate from uploaded material)
- [ ] Progress tracker (per-subject, per-topic mastery)
- [ ] FSRS spaced repetition scheduling
- [ ] Study session logging
- [ ] Robot celebration/encouragement behaviors
- [ ] Homework help mode (Socratic Q&A from Second Brain)

### Phase C: Parent Experience (Q2 2028) — 4 weeks
- [ ] Parent dashboard (web UI)
- [ ] Weekly progress report emails
- [ ] Study schedule configuration
- [ ] Content upload management UI
- [ ] Child profile management

### Phase D: Advanced Features (Q3 2028) — 4 weeks
- [ ] Worksheet OCR via CamS3 camera
- [ ] Reading companion (listen to child read aloud)
- [ ] Flashcard mode with voice interaction
- [ ] Bible studies module (faith-grounded content)
- [ ] Multi-child simultaneous support (profile switching by voice: "This is Sarah")

### Phase E: Commercial Launch (Q4 2028)
- [ ] Beta with 50 homeschool families
- [ ] Tutor Buddy landing page
- [ ] App Store / Play Store presence
- [ ] Church partnership outreach
- [ ] Homeschool conference demos
- [ ] Amazon listing

---

## Moxie Lessons (Critical)

Moxie was a $799 children's social robot by Embodied Inc. that died in 2026:
- **100% cloud-dependent** — when the company folded, every robot became a brick
- **Children were emotionally attached** — parents reported kids crying when Moxie stopped working
- **No data export** — all conversation history, progress, and emotional data was lost
- **$30/month subscription** — high recurring cost for families

**Tutor Buddy safeguards:**
1. **Offline mode** — Ollama local model means the robot never fully dies
2. **Open architecture** — parents can self-host the bridge server
3. **Data export** — all progress, conversations, and uploads exportable as JSON/CSV
4. **Affordable** — $199 hardware, $9.99/mo (vs $799 + $30/mo)
5. **Second Brain ownership** — knowledge base data belongs to the family, stored in their Supabase project

---

*Plan based on: Visionary AI Coach platform analysis (22.5KB), market research (28.6KB), 17 open-source projects, 10 commercial competitors. November 13, 2026.*

# Tutor Buddy — Platform Analysis: Second Brain & Knowledge Base Capabilities

**Date:** November 13, 2026
**Purpose:** Analyze existing Visionary AI Coach Second Brain infrastructure for Tutor Buddy education use case
**Source:** AI-Interactive-Vision-Board-2 codebase (moverton7474), 134 migrations, 30+ edge functions

---

## 1. How the Second Brain Currently Works

### 1.1 Architecture Overview

The Second Brain follows a **Capture → Organize → Distill → Express** pipeline:

```
Upload/Capture → knowledge-ingest → splitIntoChunks() → knowledge-embed → pgvector storage
                                                                              ↓
Voice query → search_knowledge tool → knowledge-query → generateEmbedding(query) → cosine similarity search
                                                              ↓
                                                      Formatted results → AI response to user
```

### 1.2 Ingestion Pipeline (knowledge-ingest/index.ts)

**Actions:** `ingest`, `list`, `get`, `delete`, `toggle`, `stats`

**Ingest Flow:**
1. **Receive content** — Accepts `content` (raw text) or `sourceUrl` (fetches text via HTTP)
2. **Create source record** — Inserts into `user_knowledge_sources` with status `processing`
3. **Chunk** — `splitIntoChunks()` splits by double-newlines/headers, max **1,000 chars per chunk**, **100 char overlap**
4. **Insert chunks** — Stored in `user_knowledge_chunks` with `chunk_index` and estimated `token_count`
5. **Trigger embeddings** — Fire-and-forget call to `knowledge-embed` edge function (batches of up to 100 chunks)
6. **Update source** — Marks status `completed`, stores `content_summary` (first 3 sentences, max 300 chars), `word_count`

**Key Limitation:** No file parsing. Content must arrive as raw text. No PDF, DOCX, or image extraction exists — the `sourceUrl` path does a plain `fetch().text()` which works for web pages but not binary files.

### 1.3 Embedding Generation (knowledge-embed/index.ts)

- **Model:** OpenAI `text-embedding-ada-002` (1536 dimensions)
- **Max input:** 8,000 characters (truncated)
- **Actions:** `embed` (single chunk), `batch` (up to 100 chunks), `backfill` (all chunks missing embeddings, admin-only, up to 1,000)
- **Storage:** Embeddings stored in `user_knowledge_chunks.embedding` column (vector(1536))

### 1.4 Search / RAG Retrieval (knowledge-query/index.ts)

**Two-stage search:**
1. **Vector search** — Generates embedding for query text, calls PostgreSQL function `search_user_knowledge()` with cosine similarity. Default threshold: **0.7** (lowered to **0.6** when called from voice sessions for better recall).
2. **Keyword fallback** — If vector search returns empty, falls back to lexical keyword matching (tokenizes query into 3+ char terms, scores by term match count with phrase boost). Returns synthetic similarity scores (0.45 + 0.1 per matched term, capped at 0.95).

**Filters applied during search:**
- `user_id` = requesting user (strict isolation)
- `include_in_context = true` (user can toggle sources off)
- `is_active = true`
- `embedding IS NOT NULL`

### 1.5 RAG During Voice Sessions

**Voice Coach Session** (`voice-coach-session/index.ts`, line 4274):
- Tool: `search_knowledge` — user says "what do I have about X" / "search my notes"
- Calls `knowledge-query` edge function internally with service role auth
- Results truncated to **500 chars per chunk** for token efficiency
- Formats results with rank, source name, relevance percentage
- Returns structured data with summary for AI to incorporate into spoken response

**AMIE Realtime Session** (`amie-realtime-tools.ts`):
- `search_voice_memory` — reads from `user_knowledge_sources` (memory_read category)
- `capture_voice_memory` — writes to `user_knowledge_sources` + `user_knowledge_chunks` (memory_write)
- `save_session_summary` — persists session notes to knowledge base
- `forget_voice_memory` — deletes knowledge entries (high risk, confirmation required)

### 1.6 Thought Capture & Auto-Classification (thought-router/index.ts)

**Second Brain inbox system:**
1. User says "remember this" → `capture_thought` tool → inserts into `inbox_queue`
2. Background worker (`thought-router`) processes pending items in batches of 10
3. **Gemini 2.0 Flash** classifies each item into: `goal`, `habit`, `task`, `financial`, `reference`, `idea`, `journal`
4. **Bouncer pattern:** Items with confidence < 0.6 flagged for user review
5. High-confidence items auto-routed to destination tables:
   - `task` → `action_tasks`
   - `habit` → `habits`
   - `goal` → `goals`
   - `reference`/`idea` → `user_knowledge_chunks`
   - `financial`/`journal` → stay in `inbox_queue` (no specialized tables yet)

---

## 2. Supported Source Types & File Types

### 2.1 Current Source Types (source_type enum)

| Source Type | Description | Ingestion Method |
|-------------|-------------|------------------|
| `resume` | User's CV/resume | Text paste or URL |
| `document` | General documents | Text paste or URL |
| `url` | Web page content | Fetched via HTTP |
| `manual_entry` | User-typed notes | Direct text |
| `conversation` | Voice session transcripts | Auto-captured |
| `vision_board` | Vision board metadata | System-generated |
| `financial_doc` | Financial documents | Text paste |
| `notes` | Personal notes | Text paste |

### 2.2 File Type Support

**Currently supported:** Plain text only. The `file_type` column exists on `user_knowledge_sources` but is metadata-only — no parsing logic exists.

**NOT supported (need implementation for Tutor Buddy):**
- ❌ PDF parsing (textbooks, worksheets, syllabi)
- ❌ DOCX/DOC parsing (Word documents)
- ❌ XLSX/CSV parsing (grade sheets, data tables)
- ❌ PPTX parsing (class presentations)
- ❌ Image/OCR (handwritten notes, whiteboard photos, printed worksheets)
- ❌ EPUB parsing (digital textbooks)
- ❌ HTML/Markdown parsing (structured content)
- ❌ LaTeX parsing (math/science content)

---

## 3. Database Schema — Knowledge Tables

### 3.1 user_knowledge_sources (Migration: 20251201)

```sql
CREATE TABLE user_knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,           -- resume|document|url|manual_entry|conversation|vision_board|financial_doc|notes
  source_name TEXT NOT NULL,           -- Human-readable name
  source_url TEXT,                     -- Optional URL
  raw_content TEXT,                    -- Original content
  processed_content TEXT,              -- Post-processing content
  content_summary TEXT,                -- Auto-generated summary (first 3 sentences)
  file_type TEXT,                      -- Metadata only (no parsing)
  file_size INT,                       -- Bytes
  word_count INT,                      -- Computed during ingestion
  language TEXT DEFAULT 'en',
  status TEXT DEFAULT 'pending',       -- pending|processing|completed|failed
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,      -- Soft delete
  include_in_context BOOLEAN DEFAULT TRUE,  -- Toggle for RAG inclusion
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 user_knowledge_chunks (Migration: 20251201 + 20260112)

```sql
CREATE TABLE user_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id UUID REFERENCES user_knowledge_sources(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INT NOT NULL,
  embedding vector(1536),              -- OpenAI ada-002 embeddings
  token_count INT,                     -- Estimated (chars/4)
  metadata JSONB DEFAULT '{}',         -- Contains section name
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- IVFFlat index for cosine similarity search (lists=100)
```

### 3.3 inbox_queue (Migration: 20260113)

```sql
CREATE TABLE inbox_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  raw_input TEXT NOT NULL,
  input_type TEXT NOT NULL,            -- text|audio|image
  source TEXT NOT NULL,                -- voice_coach|sms|dashboard|quick_add|email|api
  transcription TEXT,                  -- For audio inputs
  classification TEXT,                 -- goal|habit|task|financial|reference|idea|journal
  classification_confidence FLOAT,
  needs_review BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending',       -- pending|processing|classified|routed|needs_review|failed|archived
  routed_to_table TEXT,                -- Where the item was auto-sent
  routed_to_id UUID
);
```

### 3.4 search_user_knowledge() PostgreSQL Function (Migration: 20260112)

```sql
-- Vector similarity search using cosine distance
-- Returns: chunk_id, source_id, source_name, chunk_text, similarity (0.0-1.0)
-- Filters: user_id match, include_in_context=true, is_active=true, embedding NOT NULL
-- Default threshold: 0.7, max results: 5
```

### 3.5 user_knowledge_base (Legacy — Migration: 20241129)

Pre-Second-Brain summary table. One row per user with aggregated profile data (names, financial summary, goals, habits, vision statements). Likely used for prompt context injection, not for RAG.

---

## 4. What's Missing for a Tutoring Use Case

### 4.1 Content Ingestion Gaps

| Gap | Severity | Description |
|-----|----------|-------------|
| **No file parsing** | 🔴 Critical | Cannot process PDF textbooks, DOCX syllabi, PPTX slides. Only raw text accepted. |
| **No image/OCR** | 🔴 Critical | Cannot read printed worksheets, handwritten problems, whiteboard photos via CamS3. |
| **No structured content** | 🟡 Major | Chunking is naive (split on paragraphs). No awareness of chapters, sections, problems, or exercises. |
| **No math/formula support** | 🟡 Major | No LaTeX/MathML parsing. Math equations in PDFs would be garbled. |
| **No source_type for education** | 🟢 Minor | Missing types: `textbook`, `syllabus`, `worksheet`, `flashcard_deck`, `lesson_plan` |
| **No grade-level metadata** | 🟡 Major | No way to tag content with grade level, subject, or curriculum standard |
| **No multi-modal chunks** | 🟡 Major | Chunks are text-only. Diagrams, figures, and tables from textbooks are lost. |

### 4.2 Retrieval / RAG Gaps

| Gap | Severity | Description |
|-----|----------|-------------|
| **No subject-scoped search** | 🟡 Major | Can't search "only my math textbook" — searches all sources equally |
| **No difficulty-aware retrieval** | 🟡 Major | Can't filter by grade level or complexity when retrieving context |
| **No parent/child data isolation** | 🔴 Critical | Current system is single-user. No concept of parent account with child sub-accounts |
| **No curriculum graph** | 🟡 Major | No concept of prerequisite chains (must learn fractions before percentages) |
| **Embedding model is generic** | 🟢 Minor | ada-002 is general-purpose; an education-tuned model could improve retrieval for subject-specific content |

### 4.3 Missing Educational Features (No Tables/Code Exist)

| Feature | Description | Tables Needed |
|---------|-------------|---------------|
| **Quiz Generation** | Generate practice questions from knowledge chunks | `quiz_sessions`, `quiz_questions`, `quiz_responses` |
| **Progress Tracking** | Track mastery by subject/topic/concept | `student_progress`, `concept_mastery`, `study_sessions` |
| **Grade-Level Adaptation** | Adjust explanation complexity by student grade | `student_profiles` (grade_level, reading_level) |
| **Spaced Repetition** | Flashcard scheduling (SM-2 or similar algorithm) | `flashcards`, `flashcard_reviews`, `review_schedule` |
| **Assignment Tracking** | Link assignments to due dates, track completion | `assignments`, `assignment_submissions` |
| **Parent Dashboard** | Weekly reports, subject breakdown, time-on-task | `parent_reports`, `study_time_logs` |
| **Curriculum Standards** | Map content to Common Core / state standards | `curriculum_standards`, `content_standard_mapping` |
| **Misconception Detection** | Track common errors and misconceptions | `misconception_logs`, `error_patterns` |
| **Study Streaks for Kids** | Gamified streaks with age-appropriate rewards | Extends existing `habits`/`habit_completions` |

### 4.4 Safety Gaps (COPPA Compliance)

| Requirement | Current Status | Needed |
|-------------|---------------|--------|
| Child account model | ❌ Single adult accounts only | Parent creates/manages child accounts |
| Parental consent flow | ❌ No age verification | Verifiable parental consent before account creation |
| Data minimization | ⚠️ Stores raw content + embeddings | Option to not persist child's voice; session-only processing |
| Content filtering | ❌ No age-appropriate content filtering | All AI responses filtered for grade-appropriate content |
| Data deletion | ✅ Cascade delete on user_knowledge_sources | Compliant |
| Access controls | ❌ No parent-child relationship | Parent PIN to access activity logs, set boundaries |

---

## 5. How Coursework Upload Would Work with Existing Infrastructure

### 5.1 Current Path (Minimal Changes)

With the existing infrastructure, coursework upload would work like this:

```
Parent uploads PDF syllabus
    ↓
Frontend extracts text (client-side PDF.js or server-side parser — NOT YET BUILT)
    ↓
POST /functions/v1/knowledge-ingest?action=ingest
  {
    sourceType: "document",       // Would need "syllabus" added to enum
    sourceName: "Math 7 - Fall 2027 Syllabus",
    content: "<extracted text>",
    fileType: "pdf",
    fileSize: 102400
  }
    ↓
knowledge-ingest → splitIntoChunks (1000 char chunks with 100 char overlap)
    ↓
knowledge-embed → OpenAI ada-002 embeddings for each chunk
    ↓
Stored in user_knowledge_chunks with vector embeddings
    ↓
Child asks Tutor Buddy: "What's our homework for this week?"
    ↓
search_knowledge tool → knowledge-query → vector search → relevant syllabus chunks
    ↓
AI generates response from retrieved context
```

### 5.2 What Must Be Built

**Phase 1 — File Parsing Layer (Required):**
```
New edge function: knowledge-parse
    ↓
Accepts: Supabase Storage file reference (PDF, DOCX, PPTX, images)
    ↓
Processing:
  - PDF → pdf-parse / pdfjs-dist for text extraction
  - DOCX → mammoth.js
  - PPTX → pptx-parser
  - Images → Google Vision API or Tesseract OCR
  - LaTeX → KaTeX for math rendering to text
    ↓
Output: Structured text with section markers
    ↓
Feeds into existing knowledge-ingest pipeline
```

**Phase 2 — Education-Aware Chunking:**
```
Current: splitIntoChunks() — naive 1000-char paragraph split
Needed: educationAwareChunking()
  - Detects chapter/section boundaries
  - Keeps problems/exercises as complete units
  - Preserves question-answer pairs
  - Maintains table structures
  - Tags chunks with metadata: { subject, chapter, topic, difficulty, type: "explanation"|"exercise"|"definition"|"example" }
```

**Phase 3 — New Source Types for Education:**
```sql
ALTER TABLE user_knowledge_sources
  DROP CONSTRAINT user_knowledge_sources_source_type_check,
  ADD CONSTRAINT user_knowledge_sources_source_type_check
    CHECK (source_type IN (
      -- Existing
      'resume', 'document', 'url', 'manual_entry', 'conversation',
      'vision_board', 'financial_doc', 'notes',
      -- New for Tutor Buddy
      'textbook', 'syllabus', 'worksheet', 'lesson_plan',
      'flashcard_deck', 'class_notes', 'study_guide'
    ));

-- Add education metadata columns
ALTER TABLE user_knowledge_sources ADD COLUMN
  education_metadata JSONB DEFAULT '{}';
  -- { grade_level: 7, subject: "math", curriculum: "Common Core", chapter: "Fractions" }
```

**Phase 4 — Parent-Child Account Model:**
```sql
CREATE TABLE student_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID REFERENCES auth.users(id),  -- Parent's Visionary AI account
  display_name TEXT NOT NULL,
  grade_level INT CHECK (grade_level BETWEEN 0 AND 12),  -- K=0, 1-12
  reading_level TEXT,                                     -- Lexile or grade equivalent
  subjects TEXT[] DEFAULT '{}',
  learning_style TEXT,                                    -- visual, auditory, kinesthetic
  robot_personality TEXT DEFAULT 'encouraging',            -- encouraging, challenging, playful
  daily_study_limit_minutes INT DEFAULT 120,
  allowed_subjects TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge sources tagged per student (one textbook can serve multiple children)
ALTER TABLE user_knowledge_sources ADD COLUMN
  student_profile_id UUID REFERENCES student_profiles(id);
```

---

## 6. Reusable Infrastructure Summary

### 6.1 What Tutor Buddy Gets for Free from AMIE Platform

| Component | AMIE Feature | Tutor Buddy Use |
|-----------|-------------|-----------------|
| **Knowledge ingestion** | `knowledge-ingest` + `knowledge-embed` | Upload coursework, syllabi, study materials |
| **Semantic search** | `knowledge-query` + `search_user_knowledge()` | "What did my textbook say about photosynthesis?" |
| **Voice interaction** | `voice-coach-session` + `search_knowledge` tool | Voice Q&A during tutoring sessions |
| **Thought capture** | `capture_thought` → `inbox_queue` → `thought-router` | "Remember: test on Friday about Chapter 7" |
| **Habit tracking** | `habits` + `habit_completions` + streaks | Study habit streaks, daily practice tracking |
| **Task management** | `action_tasks` | Homework assignments with due dates |
| **Reminder system** | `scheduled_reminders` + Twilio SMS/voice | "Study time!" reminders via parent's phone |
| **Session memory** | `save_session_summary` + `search_voice_memory` | "Last time we were working on long division..." |
| **Calendar** | Google Calendar integration | Study schedule, test dates |
| **Proactive outreach** | `voice_outreach_queue` + automation rules | Robot initiates: "Time to study for tomorrow's test!" |
| **Quality scoring** | TEACH-AI evaluations | Measure tutoring session quality |
| **Confirmation gates** | `pending_agent_actions` | Parent approval for any external actions |

### 6.2 What Must Be Built Net-New

| Component | Complexity | Description |
|-----------|------------|-------------|
| **File parser** | Medium | PDF/DOCX/PPTX/image text extraction (new edge function) |
| **Education-aware chunking** | Medium | Subject-aware content splitting with exercise detection |
| **Quiz engine** | High | Generate questions from chunks, track responses, score |
| **Progress tracker** | High | Per-subject, per-topic mastery tracking with concept prerequisites |
| **Spaced repetition** | Medium | SM-2 algorithm for flashcard review scheduling |
| **Parent-child accounts** | High | Multi-user model with COPPA compliance, parental controls |
| **Grade-level adapter** | Medium | Adjust AI response complexity based on student profile |
| **Worksheet OCR** | Medium | Camera-based problem reading via CamS3 (shared with Fitness Phase 3) |
| **Parent dashboard** | Medium | Weekly reports, study time, subject breakdown |
| **Content safety filter** | Medium | Age-appropriate response filtering layer |

### 6.3 Effort Estimate

- **Reusable from AMIE:** ~60% of Tutor Buddy's backend infrastructure already exists
- **New education features:** ~6-8 months of development for the 10 net-new components
- **Hardest parts:** Parent-child account model (touches auth, RLS, every query), quiz engine (needs pedagogically sound question generation), COPPA compliance (legal + technical)

---

## 7. Recommended Architecture for Tutor Buddy Knowledge Flow

```
┌────────────────────────────────────────────────────────────┐
│                   Parent's Visionary AI App                 │
│                                                            │
│  Upload: PDF textbook → knowledge-parse → knowledge-ingest │
│  Upload: DOCX syllabus → knowledge-parse → knowledge-ingest│
│  Upload: Photo of worksheet → OCR → knowledge-ingest       │
│  Set: Grade level, subjects, study limits                  │
└──────────────────────┬─────────────────────────────────────┘
                       │
            ┌──────────┴───────────┐
            │  Supabase Knowledge  │
            │                      │
            │  user_knowledge_     │
            │    sources           │
            │  user_knowledge_     │
            │    chunks (+vectors) │
            │  student_profiles    │
            │  quiz_sessions       │
            │  concept_mastery     │
            └──────────┬───────────┘
                       │
            ┌──────────┴───────────┐
            │    Bridge Server     │
            │                      │
            │  + Education prompt  │
            │    builder           │
            │  + Quiz state        │
            │    machine           │
            │  + Difficulty        │
            │    adjuster          │
            └──────────┬───────────┘
                       │ WebSocket
            ┌──────────┴───────────┐
            │   Tutor Buddy Robot  │
            │   (StackChan)        │
            │                      │
            │  "Let's practice     │
            │   fractions!         │
            │   What's 3/4 + 1/2?" │
            │                      │
            │  😊 "That's right!"  │
            │  😟 "Almost! Let's   │
            │     try again..."    │
            └──────────────────────┘
```

---

*Generated from analysis of: AI-Interactive-Vision-Board-2 (main branch), edge functions (knowledge-ingest, knowledge-embed, knowledge-query, thought-router, voice-coach-session, amie-realtime-session), migrations (20251201, 20260112, 20260113), AMIE-ROBOT-ANALYSIS.md, ROADMAP.md Phase 5. November 13, 2026.*

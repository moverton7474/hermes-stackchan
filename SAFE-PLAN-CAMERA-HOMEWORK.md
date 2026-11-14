# Safe Plan: Camera-Based Document & Homework Review

**Date:** 2026-11-13
**Author:** localagent (Hermes Desktop Agent)
**Objective:** Enable Tutor Buddy to read, analyze, and grade handwritten/printed homework when a student holds a page up to the robot's camera
**Risk Level:** LOW — additive features, no production changes
**Patent Coverage:** PA-12 Claims 14-16 (camera-based sensing + exercise form detection framework applies to document scanning)

---

## What NOT to Change

- ❌ Existing AMIE coaching flows
- ❌ Visionary AI Coach production
- ❌ Stock StackChan firmware (camera is already accessible via firmware API)
- ❌ Existing Second Brain chunking/embedding pipeline (we ADD a new input path, not modify)

---

## Use Cases

### Use Case 1: "Check My Homework"
**Student:** *holds up math worksheet* "Tutor Buddy, check my homework"
**Robot:** *camera captures page → OCR → parse problems + answers → grade each one*
**Robot:** "I can see 10 problems. You got 8 right! Nice work! Let's look at problems 4 and 7 together. On problem 4, you wrote 3 × 7 = 24. What's 3 × 7 if we count by threes?"

### Use Case 2: "Read This Page"
**Student:** *holds up textbook page* "Tutor Buddy, read this to me"
**Robot:** *camera captures → OCR → text extraction*
**Robot:** *reads the page aloud, then asks comprehension questions*

### Use Case 3: "Help Me With This Problem"
**Student:** *holds up a single problem* "I'm stuck on this one"
**Robot:** *captures → OCR → identifies problem type → Socratic coaching*
**Robot:** "I see a fraction problem: 3/4 + 1/2. What's the first step when adding fractions with different denominators?"

### Use Case 4: "Scan My Notes"
**Student:** *holds up handwritten study notes*
**Robot:** *captures → OCR → saves to Second Brain as knowledge source*
**Robot:** "Got it! I saved your notes on Chapter 5. Want me to quiz you on them later?"

### Use Case 5: "What Does This Diagram Show?"
**Student:** *holds up science diagram, map, or chart*
**Robot:** *captures → sends to vision model (GPT-4o or Gemini) → describes and explains*
**Robot:** "This is a diagram of the water cycle. I can see evaporation, condensation, and precipitation. Want me to explain how each step works?"

---

## Architecture

```
Student holds up page
    ↓
Robot Camera (CamS3 5MP or built-in GC0308 0.3MP)
    ↓
JPEG frame capture (640x480 or higher)
    ↓
Bridge Server receives frame via WebSocket
    ↓
┌─────────────────────────────────────────────┐
│ Processing Pipeline (on bridge server)       │
│                                              │
│  1. Image Enhancement                        │
│     - Auto-rotate (detect orientation)       │
│     - Perspective correction (de-skew)       │
│     - Contrast/brightness normalization      │
│     - Noise reduction                        │
│                                              │
│  2. OCR Engine (choose one)                  │
│     Option A: Tesseract.js (free, local)     │
│     Option B: Google Vision API (better)     │
│     Option C: GPT-4o Vision (best, $$$)      │
│                                              │
│  3. Content Parser                           │
│     - Detect: math equations, text, diagrams │
│     - Parse math notation (LaTeX-style)      │
│     - Identify individual problems            │
│     - Extract student's written answers      │
│                                              │
│  4. Analysis Engine                          │
│     - Grade each answer (correct/incorrect)  │
│     - Identify error patterns                │
│     - Generate Socratic follow-up questions  │
│     - Classify difficulty level              │
│                                              │
│  5. Response Generator                       │
│     - Build voice response with results      │
│     - Set robot face (celebration/coaching)   │
│     - Save results to progress tracker       │
└─────────────────────────────────────────────┘
    ↓
Voice response + face expression → Robot speaker + LCD
    ↓
Results → quiz_results table → mastery_scores update
```

---

## Phase 0: Camera Capability Assessment (DONE ✅)

The StackChan hardware has TWO camera options:
- **Built-in GC0308**: 0.3MP (640x480) — adequate for printed text, struggles with small handwriting
- **CamS3 5MP add-on**: 2592x1944 — excellent for all document types, connects via Grove port

**Decision:** Support both. Start with built-in camera (every robot has it), recommend CamS3 for handwriting recognition.

---

## Phase 1: Image Capture Service

### Step 1.1: Add camera capture command to bridge server
- **What:** New WebSocket message type that triggers camera frame capture on robot
- **Risk:** NONE — the xiaozhi firmware already supports camera frames
- **Implementation:**
  ```json
  // Bridge → Robot: request capture
  {"type": "camera", "action": "capture", "resolution": "high"}
  
  // Robot → Bridge: frame response
  // Binary WebSocket frame with type=0x03 (camera/avatar)
  ```
- **The robot firmware already sends camera frames** — we just need to request them at the right time
- **Reversible:** Don't send the capture command

### Step 1.2: Add voice trigger detection
- **What:** When student says "check my homework" / "read this" / "scan this" / "look at this", trigger camera capture
- **Risk:** NONE — keyword detection in the AI response
- **Implementation:** Add tool definition to Tutor Buddy prompt:
  ```json
  {
    "name": "capture_document",
    "description": "Take a photo of a document the student is holding up to the camera. Use when student asks you to check, read, scan, or look at a page.",
    "parameters": {
      "purpose": {
        "type": "string",
        "enum": ["check_homework", "read_page", "help_problem", "scan_notes", "explain_diagram"]
      }
    }
  }
  ```
- **Dependencies:** Step 1.1

### Step 1.3: Image enhancement pipeline
- **What:** Pre-process captured image for OCR accuracy
- **Risk:** NONE — image processing only
- **Implementation:** Node.js with `sharp` library:
  ```
  Input JPEG → auto-rotate → perspective correction → grayscale → 
  contrast enhancement → noise reduction → output PNG
  ```
- **Install:** `npm install sharp`
- **Dependencies:** Step 1.1

---

## Phase 2: OCR & Document Understanding

### Step 2.1: Multi-engine OCR
- **What:** Extract text from captured document images
- **Risk:** NONE — processing only, no data leaves local network (with Tesseract)
- **Three tiers (configurable):**

| Engine | Accuracy | Cost | Handwriting | Math | Privacy |
|---|---|---|---|---|---|
| **Tesseract.js** | Good (printed) | Free | Poor | Basic | ✅ Local |
| **Google Vision API** | Excellent | $1.50/1000 images | Good | Good | ⚠️ Cloud |
| **GPT-4o Vision** | Best | ~$0.01/image | Excellent | Excellent | ⚠️ Cloud |

- **Default:** Tesseract.js for privacy-first, with parent opt-in for cloud OCR
- **Install:** `npm install tesseract.js`
- **Dependencies:** Phase 1

### Step 2.2: Math expression parser
- **What:** Parse recognized text into structured math problems
- **Risk:** NONE — text processing
- **Implementation:**
  ```
  OCR text: "3 × 7 = 24"
  Parsed: { left: "3 × 7", operator: "×", expected: 21, student_answer: 24, correct: false }
  
  OCR text: "3/4 + 1/2 = 5/4"
  Parsed: { left: "3/4 + 1/2", expected: "5/4", student_answer: "5/4", correct: true }
  ```
- **Libraries:** `mathjs` for expression evaluation
- **Install:** `npm install mathjs`
- **Dependencies:** Step 2.1

### Step 2.3: Document type classifier
- **What:** Determine if captured image is: math worksheet, text page, diagram, handwritten notes, or mixed
- **Risk:** NONE
- **Implementation:** 
  - If lots of numbers/operators → math worksheet
  - If mostly text → reading material
  - If GPT-4o available → use vision model for classification
  - Fallback: ask the student "Is this math, reading, or something else?"
- **Dependencies:** Step 2.1

---

## Phase 3: Grading & Feedback Engine

### Step 3.1: Homework grader
- **What:** Grade each problem on a captured math worksheet
- **Risk:** NONE
- **Implementation:**
  1. Parse each problem from OCR output
  2. Evaluate correct answer using `mathjs`
  3. Compare to student's written answer
  4. Generate per-problem feedback:
     - Correct → "✓ Problem 3: Great job!"
     - Wrong → "✗ Problem 4: Let's look at this one. What's 3 × 7?"
  5. Calculate overall score
  6. Save to `quiz_results` table
- **Robot behavior:**
  - Overall score > 80% → celebration face + dance
  - Score 50-80% → encouraging face + "Good effort! Let's review the ones you missed"
  - Score < 50% → coaching face + "Let's work through these together"
- **Dependencies:** Step 2.2

### Step 3.2: Socratic follow-up for wrong answers
- **What:** Instead of just marking wrong, teach through the error
- **Risk:** NONE
- **Implementation:** Feed the problem + student's wrong answer to the AI:
  ```
  System: The student wrote 3 × 7 = 24. The correct answer is 21. 
  Use the Socratic method to guide them to the right answer.
  Do NOT say the correct answer. Give a hint.
  ```
  AI responds: "I see you wrote 24 for 3 × 7. Try counting by threes: 3, 6, 9... can you keep going?"
- **Dependencies:** Step 3.1

### Step 3.3: Reading comprehension analysis
- **What:** After reading a text page, generate comprehension questions
- **Risk:** NONE
- **Implementation:**
  1. OCR captures text from page
  2. AI generates 3-5 comprehension questions based on the text
  3. Voice Q&A with student
  4. Track results in progress tracker
- **Dependencies:** Step 2.1

---

## Phase 4: Second Brain Integration

### Step 4.1: Save scanned documents to knowledge base
- **What:** OCR'd text from scanned pages gets saved to student's Second Brain
- **Risk:** LOW — uses existing knowledge-ingest pipeline
- **Implementation:**
  1. OCR extracts text from captured page
  2. Student confirms: "Tutor Buddy, save these notes"
  3. Text sent to `knowledge-ingest` edge function with metadata:
     ```json
     {
       "content": "OCR'd text...",
       "source_type": "scanned_document",
       "title": "Math Chapter 5 Notes",
       "subject": "math",
       "child_id": "uuid"
     }
     ```
  4. Existing pipeline chunks → embeds → stores in pgvector
- **Dependencies:** Phase 2 + existing knowledge-ingest

### Step 4.2: Quiz from scanned material
- **What:** After scanning notes/textbook pages, generate quiz questions
- **Risk:** NONE
- **Implementation:**
  1. Scan page → OCR → save to Second Brain
  2. Student says "Quiz me on what I just scanned"
  3. Quiz engine generates questions from the newly ingested chunks
  4. FSRS schedules review for optimal retention
- **Dependencies:** Step 4.1 + Quiz Engine (from Tutor Buddy Plan Phase B)

---

## Phase 5: Vision Model Integration (Advanced)

### Step 5.1: Diagram/chart understanding
- **What:** Use GPT-4o Vision or Gemini to explain diagrams, charts, maps
- **Risk:** LOW — cloud API call with image
- **Implementation:**
  1. Student holds up diagram: "What does this show?"
  2. Bridge server sends JPEG to GPT-4o Vision API:
     ```json
     {
       "model": "gpt-4o",
       "messages": [{
         "role": "user",
         "content": [
           {"type": "text", "text": "This student is in grade [N]. Explain this diagram in age-appropriate language."},
           {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
         ]
       }]
     }
     ```
  3. AI explains the diagram through the robot speaker
- **Requires:** Parent opt-in for cloud image processing (COPPA)
- **Dependencies:** Phase 1

### Step 5.2: Handwriting recognition improvement
- **What:** Use vision models for better handwriting OCR
- **Risk:** LOW — cloud API call
- **Implementation:** When Tesseract.js confidence is low, fall back to GPT-4o Vision:
  ```
  "Read this child's handwritten math homework. List each problem and the student's answer."
  ```
- **Dependencies:** Step 2.1

---

## Execution Order

| Phase | Blocked By | Can Build Now? |
|---|---|---|
| Phase 1: Image capture | Bridge server running | ✅ YES |
| Phase 2: OCR pipeline | Phase 1 | ✅ YES (after Phase 1) |
| Phase 3: Grading engine | Phase 2 | ✅ YES (after Phase 2) |
| Phase 4: Second Brain save | Phase 2 + existing pipeline | ✅ YES |
| Phase 5: Vision model | Phase 1 + API key | ✅ YES |

**All phases can be built without physical robot** — test with the desktop simulator using sample worksheet images.

---

## Privacy & Safety (COPPA Critical)

| Requirement | Implementation |
|---|---|
| No persistent child image storage | Images deleted from bridge server immediately after OCR processing |
| Parent opt-in for cloud OCR | Default is local Tesseract.js; Google Vision / GPT-4o requires parent toggle |
| No child facial recognition | Camera is triggered only on explicit voice command, not continuous |
| Camera LED indicator | StackChan LED lights up when camera is active |
| Voice command to disable camera | "Tutor Buddy, camera off" stops all camera functionality |
| Data belongs to parent | All scanned content stored in parent's Supabase account, exportable |

---

## New Tool Definitions for Tutor Buddy Prompt

```json
[
  {
    "name": "capture_document",
    "description": "Take a photo of a page the student is holding up. Use when they say 'check my homework', 'read this', 'scan this', 'look at this', 'help with this problem'.",
    "parameters": {
      "purpose": { "type": "string", "enum": ["check_homework", "read_page", "help_problem", "scan_notes", "explain_diagram"] }
    }
  },
  {
    "name": "grade_worksheet",
    "description": "Grade a captured math worksheet. Returns per-problem results with correct/incorrect and overall score.",
    "parameters": {
      "image_id": { "type": "string" },
      "subject": { "type": "string", "enum": ["math", "science", "language_arts"] }
    }
  },
  {
    "name": "read_page_aloud",
    "description": "Read captured text page aloud to the student, then ask comprehension questions.",
    "parameters": {
      "image_id": { "type": "string" }
    }
  },
  {
    "name": "explain_visual",
    "description": "Explain a diagram, chart, map, or visual the student is showing. Requires GPT-4o Vision.",
    "parameters": {
      "image_id": { "type": "string" },
      "subject": { "type": "string" }
    }
  },
  {
    "name": "save_scanned_notes",
    "description": "Save captured page text to the student's Second Brain knowledge base for future quizzing.",
    "parameters": {
      "image_id": { "type": "string" },
      "title": { "type": "string" },
      "subject": { "type": "string" }
    }
  }
]
```

---

*Safe plan generated November 13, 2026. Covered by PA-12 Claims 14-16 (camera sensing) and Claims 6-8 (multi-personality, knowledge base, tutoring). All phases additive with no production modifications.*

# Safe Plan: AMIE Awareness of Tutor Buddy & Physical Robot

**Date:** 2026-11-14
**Author:** localagent (Hermes Desktop Agent)
**Objective:** Make AMIE aware of Tutor Buddy features and the physical AMIE Robot Coach, so she can answer user questions and navigate to Tutor Buddy
**Risk Level:** LOW — all changes are additive prompt text and a new navigation entry

---

## What NOT to Change

- ❌ Existing AMIE coaching logic, session types, or tool schemas
- ❌ Existing voice coach session flow or tool execution
- ❌ Any database tables, RLS policies, or edge function signatures
- ❌ Existing navigation destinations (only ADD, never modify)
- ❌ AMIE's personality, theme system, or identity engine
- ❌ Any tool definitions or confirmation gates

---

## Voice Command Gap Analysis

### Dialog Analysis (Milton ↔ AMIE)

| User Said | AMIE Responded | Gap |
|-----------|---------------|-----|
| "Are you familiar with the new feature, the tutor?" | "I'm not seeing a built-in feature called 'the Tutor'" | AMIE has no knowledge of Tutor Buddy |
| (Implied) "Navigate to Tutor Buddy" | Would fail — no nav destination | TUTOR_BUDDY not in app destinations |
| (Implied) "Tell me about the robot" | Would fail — no knowledge | No physical robot awareness |
| (Implied) "Upload a lesson plan for my kids" | Would fail — no awareness | No Tutor Buddy feature knowledge |
| (Implied) "How's Brad doing in math?" | Would fail — no child profile access | No tutor-specific tools |

### Gaps Identified

1. **No TUTOR_BUDDY navigation destination** — AMIE can't navigate users to it
2. **No Tutor Buddy feature awareness** — AMIE doesn't know it exists
3. **No physical robot awareness** — AMIE doesn't know about StackChan/AMIE Robot
4. **No voice command routing for tutor queries** — "check my kid's grades", "upload a lesson plan", etc.

---

## Changes Required (All Additive)

### Change 1: Add TUTOR_BUDDY to App Destinations
**File:** `supabase/functions/_shared/amie-app-destinations.ts`
**Risk:** NONE — adds one new entry to the array
**What:** Add navigation entry so AMIE can say "Let me take you to Tutor Buddy" and navigate there

### Change 2: Add Tutor Buddy & Robot Awareness to Voice Coach Prompt
**File:** `supabase/functions/voice-coach-session/index.ts`
**Risk:** NONE — adds new section AFTER existing capabilities list
**What:** Add a "PLATFORM FEATURES" section describing Tutor Buddy and the AMIE Robot

### Change 3: Add Tutor Buddy Awareness to AMIE Prompt Builder
**File:** `supabase/functions/amie-prompt-builder/index.ts`
**Risk:** NONE — adds new section AFTER guidelines
**What:** Add platform features knowledge to the built prompt

### Change 4: Redeploy voice-coach-session and amie-prompt-builder
**Risk:** LOW — redeploying existing functions with additive text

---

## What AMIE Will Know After This Update

### Tutor Buddy
- It's a kids homework helper feature inside Visionary AI
- Parents can add children (name, grade K-12, subjects)
- Parents can upload lesson plans, syllabi, textbooks (PDF/DOCX/TXT)
- The robot uses Socratic method — guides, never gives answers
- FSRS spaced repetition tracks what kids need to review
- Bible studies module with daily verses and stories
- Parent dashboard shows mastery charts, study sessions, progress
- Navigate users to it: "Let me take you to Tutor Buddy"

### Physical Robot (AMIE Robot Coach)
- AMIE exists as a physical desktop robot (StackChan M5Stack CoreS3)
- Three personalities: Hermes (assistant), AMIE (coach), Tutor Buddy (kids tutor)
- Voice-first interaction via bridge server
- Same coaching capabilities as the app, delivered through a physical robot
- Offline mode with local AI fallback
- Patent filed (PA-12)

---

*Safe plan generated November 14, 2026. All changes are additive prompt text and one navigation entry.*

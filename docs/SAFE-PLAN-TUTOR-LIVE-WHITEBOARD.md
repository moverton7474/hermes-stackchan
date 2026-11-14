# SAFE PLAN — Tutor Buddy Live Whiteboard (talk + draw + student solves on the same board)
**Date:** 2026-11-14 | **Status:** DRAFT — awaiting Milton's approval | **Repo:** AI-Interactive-Vision-Board-2

## Problem (from Brad's session transcript)
- Brad asked for the whiteboard **6 times** ("Can you put this on a whiteboard while you're talking?", "I wish I could see a whiteboard"). Each time the tutor said it couldn't draw.
- The existing 📐 Whiteboard is a separate, typed step-solver ("doesn't look like a whiteboard… it's not connected to you").
- Long division (728 ÷ 4) is hard to follow by ear alone. Brad said "I don't know" 5 times, and the tutor kept asking "what's next?" instead of showing him.

## Goal
While Tutor Buddy talks (OpenAI Realtime voice, unchanged), she **draws on a shared board, one step at a time**. Brad can **write on the same board** (tap a blank box and type, or use a pen), and she **reacts to what he writes**.

## Reference reviewed: harjothkhara/whiteboard-tutor (MIT)
Good ideas we keep:
- One short idea, then draw it, then the next idea.
- Keep diagrams to about a dozen shapes.
- Send the model a **text description of the board, not screenshots** (cheap and fast).

Why we don't adopt it wholesale:
| Issue | Detail |
|---|---|
| tldraw licence | Watermark in production unless we buy a commercial tldraw licence |
| Bundle size | tldraw is ~1 MB+; our build fails any chunk over 500 KiB (`bundle-budget`) |
| Different stack | Cloudflare Worker + Durable Objects + Claude + TTS. We'd lose the Realtime voice you said sounds conversational |
| General purpose | Built for boxes and arrows, not 5th-grade math layouts (long-division bracket, fraction bars, number lines) |

## Recommended design (Option A, custom math board)
1. **New `TutorLiveBoard.tsx`:** an SVG board shown beside the voice chat during a session. Tutor marks are gold and Brad's are blue. It has a simple pen (`perfect-freehand`, MIT, ~3 KB).
2. **Math templates the tutor can place:** long division, multi-digit multiplication, fraction add/subtract (with common-denominator rows), number line, place-value chart, area/volume box, and free text/arrows/highlights. Each template has **answer slots** (e.g. quotient digits, remainder, new numerator).
3. **New Realtime tools** (defined in `tutor-realtime-session`, handled in `TutorRealtimeVoice`):
   - `board_show_problem(kind, operands)`: e.g. long_division 728 ÷ 4
   - `board_write(text, near?)` / `board_fill(slot, value)` / `board_highlight(slot|step)` / `board_arrow(from, to)` / `board_clear()`
   - `board_ask(slot)`: pulses a blank box for Brad to fill
   - `board_read()`: returns the board as text, e.g. "quotient: [1][?][?]; Brad wrote 8 in tens slot (correct)"
4. **Brad's side:** he taps a pulsing slot and types or says the answer. The client immediately sends the tutor a note ("Brad wrote 8 in the tens place"), so she reacts in under a second with no vision needed. He can also draw with the pen anywhere.
5. **"Check my drawing" (phase 2):** snapshot the board and send it as an image into the same Realtime conversation (gpt-realtime accepts image input). This only happens when Brad asks or taps ✔, not every turn, which keeps cost low.
6. **Teaching-style fix (prompt only):**
   - **Always draw** before explaining a computation.
   - After **2 "I don't know"s**, demonstrate the step on the board and then give an easier look-alike problem.
   - Never say "I can't draw."

## Scope: additive, AMIE-safe
| Changed | Not changed |
|---|---|
| NEW `components/TutorLiveBoard.tsx`, NEW `lib/tutorBoard/*` (templates, board state) | `amie-realtime-session`, `AmieRealtimeClient.ts`, all AMIE prompts and tools |
| `tutor-realtime-session` (tutor-only fn): add board tools and prompt rules | Existing 📐 Whiteboard step-solver (stays as is) |
| `TutorRealtimeVoice.tsx` (tutor-only): handle board tool calls, show board | Quiz, Flashcards, Homework Help, Bible Study |
| Optional: `perfect-freehand` dependency | Database schema (no migrations in phase 1) |

**Kill switch:** the board tools are only sent when `liveBoard` is on (UI toggle, default on). Turning it off restores exactly today's voice tutor.

## Phases
| Phase | Deliverable | Est. |
|---|---|---|
| 1 | Shared board, tutor tools, long division + fractions + multiplication + number line templates, Brad answer slots, prompt rules | 1 session |
| 2 | Pen drawing + "check my drawing" (image into Realtime) + undo/clear | ½ session |
| 3 | Save board snapshots and slot results to `study_sessions`; update `student_models` per slot (e.g. "missed bring-down step") | ½ session |
| 4 (later) | Robot: show the same board on the StackChan screen, or mirror it to a tablet | after robot arrives |

## Cost
- Voice is unchanged (Realtime, about $0.06–0.11/min).
- Board tool calls add a few hundred tokens per step, which is negligible.
- "Check my drawing" costs about 1 image input per check.

## Test plan (done before telling you it's ready)
1. Build passes, including the 500 KiB bundle budget; edge function deploys.
2. Browser test (computer_use):
   - Start a voice session and say "show me 728 divided by 4". Confirm the long-division layout draws as she talks.
   - Fill a quotient slot. Confirm she responds to the correct and the wrong digit.
   - Run a fractions problem (1/2 + 1/3) the same way.
3. Toggle the board off. Confirm the voice tutor behaves exactly as today.
4. Confirm the AMIE voice session still works.

## Rollback
Revert the tutor commits. AMIE and the database are untouched in phase 1.

## Alternatives considered
- **B, Excalidraw (MIT):** freehand feel, no watermark, but ~1 MB (must be lazy-split and may still trip the budget) and no math templates. Tutor drawing would be shapes only.
- **C, Fork whiteboard-tutor (tldraw):** fastest to demo, but needs a licence for production, uses a separate stack/hosting, and loses Realtime voice.

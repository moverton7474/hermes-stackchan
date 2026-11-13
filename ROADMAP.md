# Hermes StackChan Robot — Product Roadmap

**Version:** 1.0
**Maintainer:** Milton Overton
**Last Updated:** November 13, 2026
**Canonical File:** `ROADMAP.md`

---

## Product Vision

The AMIE Robot is a physical-world extension of the Visionary AI Coach platform — not a separate product, but **AMIE in robot form**. It combines the StackChan open-source robot platform (M5Stack CoreS3 + servos + camera) with AMIE's proven coaching engine (20+ tools, 7 session types, SMS/voice/email, habit tracking, goal accountability) via the GVC Hermes bridge server.

Future additions: personal fitness trainer, football trainer, basketball trainer.

---

## Phase 1: Hermes Robot (Desk Assistant) — CURRENT ✅

**Status:** Foundation complete, bridge server operational

### Completed
- [x] Bridge server architecture (xiaozhi WebSocket protocol)
- [x] Stock firmware compatibility with CoreS3
- [x] GVC Hermes voice integration (48 tools mapped)
- [x] Capability map: 40 of 48 Hermes tools are robot-relevant
- [x] Architecture documentation (ARCHITECTURE.md)
- [x] Face expression mapping (8 emotional states)
- [x] Head movement choreography (7 motion patterns)
- [x] M5Stack partnership inquiry drafted

### In Progress
- [ ] Bridge server emotion-to-expression mapping
- [ ] Head servo choreography synchronized to speech
- [ ] Proactive behavior polling (calendar, builds, health)

### Remaining
- [ ] Morning briefing auto-trigger on first wake word of day
- [ ] LED ring integration for status indication
- [ ] Sound effects library (notification chimes, celebration sounds)
- [ ] Camera-based presence detection (wake on face detect)
- [ ] Custom face designs (navy/gold brand theme)

---

## Phase 2: AMIE Robot Coach (Personal Coach) — NEXT 🔵

**Target:** Q1 2027
**Dependency:** AMIE voice-coach-session edge function + bridge server AMIE adapter

### Architecture
- Bridge server adds AMIE session adapter alongside existing Hermes adapter
- Connects to Visionary AI Supabase (edaigbnnofyxcfbpcvct) for AMIE tools
- User authenticates via Supabase token stored on device
- Session type auto-selected based on time of day and context

### Core Features
- [ ] **AMIE Personality Integration** — Load user's identity profile, motivational theme, and coaching style
- [ ] **7 Session Types via Robot** — morning_routine, check_in, reflection, goal_setting, celebration, accountability, crisis_support
- [ ] **Proactive Morning Briefings** — Robot initiates: calendar, habits due, tasks, motivational message
- [ ] **Habit Accountability Loop** — `get_todays_habits` → read incomplete → offer to mark complete → streak celebration
- [ ] **Goal Coaching** — Active goal summary, progress updates, milestone celebrations
- [ ] **Communication Hub** — "Text Lisa..." / "Email the team..." / "Call me at 3pm" via Twilio
- [ ] **Confirmation Gate** — Screen displays proposed action, robot asks "Should I send it?", waits for verbal yes/no
- [ ] **Celebration Dances** — On goal completion or streak milestone: happy face + head oscillation ±10° for 3 cycles + sound effect
- [ ] **Scripture & Prayer** — Faith-first coaching: read scripture, guided prayer, worship session prompts
- [ ] **Thought Capture** — "Remember this idea..." saves to Second Brain inbox
- [ ] **Knowledge Recall** — "What did I say about..." searches personal knowledge base

### Proactive Behaviors (Bridge Server Polling)
- [ ] Poll `scheduled_reminders` table for due reminders
- [ ] Poll `voice_outreach_queue` for scheduled calls/check-ins
- [ ] Subscribe to Supabase Realtime channel for instant notifications
- [ ] Quiet hours enforcement (no proactive messages during sleep)
- [ ] Wake-from-idle protocol: attention sound → light up face → speak

### Session Routing Logic
```
First interaction of day       → morning_routine
After goal marked complete     → celebration
Scheduled check-in fires       → accountability
User says "I need to talk"     → check_in
User says "I'm struggling"    → crisis_support
User says "Let's set a goal"   → goal_setting
End of day (if enabled)        → reflection
```

---

## Phase 3: AMIE Fitness Coach (Gym Trainer) — PLANNED ⏳

**Target:** Q2-Q3 2027
**Hardware Additions:** External CamS3 5MP camera, MAX30102 heart rate sensor, ToF distance sensor

### Exercise Form Detection
- [ ] CamS3 5MP module connected via Grove port
- [ ] Bridge server runs MediaPipe Pose (33 keypoints, < 500ms latency)
- [ ] Joint angle calculation for form assessment
- [ ] Real-time voice corrections: "Straighten your back on the next rep"

### Rep Counting & Set Tracking
- [ ] Joint angle oscillation detection for rep counting
- [ ] Exercise state machine: idle → exercising → resting → set complete
- [ ] Robot announces rep count: "8... 9... 10! Great set!"
- [ ] Rest timer with countdown on screen
- [ ] Set/rep history logged to AMIE goals

### Heart Rate Monitoring
- [ ] MAX30102 sensor for real-time BPM
- [ ] Heart rate zones (warm-up, fat burn, cardio, peak)
- [ ] Voice alerts: "Heart rate at 170, take it easy" / "You're in the zone!"
- [ ] Workout summary with average/max HR

### Workout Session Flow
- [ ] Pre-workout: "What are we working on today?" → exercise selection
- [ ] Camera positioning: "I can see you, let's go!"
- [ ] During exercise: rep counting + form correction + HR monitoring
- [ ] Between sets: rest timer + encouragement + next exercise preview
- [ ] Post-workout: summary with stats, logged to goals/habits
- [ ] Progress tracking: "You did 20% more reps than last Tuesday!"

### Supported Exercises (Phase 3 MVP)
- Push-ups, squats, lunges, bicep curls, shoulder press
- Planks (hold time), jumping jacks (count)
- Stretching routines with hold timers

### Privacy Safeguards
- [ ] Keypoint-only processing (no raw video stored)
- [ ] Physical camera disconnect via Grove port
- [ ] LED indicator when camera is active
- [ ] Opt-in per session
- [ ] Local processing on bridge server (no cloud video)

---

## Phase 4: AMIE Sports Trainer (Football + Basketball) — PLANNED ⏳

**Target:** Q4 2027 - Q1 2028
**Dependency:** Phase 3 camera infrastructure

### Football Trainer
- [ ] Throwing form analysis (arm angle, follow-through, stance)
- [ ] Route running drills (timed routes with voice cues)
- [ ] Footwork drills with step counting
- [ ] Playbook review via knowledge base (upload play diagrams)
- [ ] Performance metrics: completion %, throw velocity estimation

### Basketball Trainer
- [ ] Shooting form analysis (elbow angle, follow-through, arc)
- [ ] Free throw routine coaching
- [ ] Dribbling drill timers and counting
- [ ] Defensive stance assessment
- [ ] Shot tracking and percentage logging

### Shared Sports Features
- [ ] Drill library with progressive difficulty
- [ ] Session history and performance trends
- [ ] Voice-guided warm-up and cool-down routines
- [ ] Tripod mount for field/court placement
- [ ] Weather-resistant enclosure option

---

## Phase 5: Commercial Product (M5Stack Partnership) — FUTURE ⏳

**Target:** 2028
**Dependency:** Phases 2-4 proven with founding users

### Hardware
- [ ] Custom enclosure design (navy/gold Visionary AI branding)
- [ ] Pre-loaded firmware with AMIE personality
- [ ] Quick-start guide and unboxing experience
- [ ] Retail packaging (premium box, branded accessories)
- [ ] Optional fitness kit (camera + HR sensor + mount)

### Software
- [ ] First-run setup wizard (WiFi → Supabase auth → theme selection)
- [ ] OTA firmware updates via bridge server
- [ ] Multi-user profiles (family mode)
- [ ] Parental controls for youth coaching
- [ ] Admin dashboard for fleet management (enterprise)

### Business Model
| Item | Price |
|------|-------|
| AMIE Robot (hardware) | $199-299 one-time |
| AMIE Coach subscription | $14.99/mo |
| AMIE Fitness add-on | $9.99/mo |
| AMIE Sports add-on | $9.99/mo |
| AMIE Family bundle | $29.99/mo |

### Distribution
- [ ] Amazon FBA (primary channel)
- [ ] M5Stack store (co-branded listing)
- [ ] Visionary AI website (direct, higher margin)
- [ ] Kickstarter/Indiegogo for initial funding + validation
- [ ] Church partnerships (faith-first positioning)
- [ ] Fitness influencer partnerships for gym trainer launch

### M5Stack Partnership Structure
- [ ] Co-development agreement for custom enclosure
- [ ] Volume pricing (1,000+ unit MOQ)
- [ ] Co-marketing: M5Stack blog, social, community
- [ ] Revenue share on M5Stack store sales
- [ ] Technical support collaboration

---

## Priority Rules

1. **No new phase starts until previous phase is production-stable** with real user feedback
2. **AMIE integration (Phase 2) before fitness (Phase 3)** — coaching is the core value, fitness is an add-on
3. **Faith-first remains the flagship** — scripture, prayer, and worship sessions are prominent in Phase 2
4. **Privacy-by-default** — no camera data leaves the local network without explicit consent
5. **Hardware simplicity** — each phase adds minimal hardware; avoid scope creep in BOM

---

## Open Questions (Awaiting Milton)

1. **Bridge server hosting** — Same Batman VPS as GVC, or separate instance?
2. **AMIE auth model** — Robot uses Milton's Supabase JWT, or gets its own service account?
3. **Wake word** — "Hey AMIE" or physical button press?
4. **M5Stack outreach timing** — After Phase 2 demo, or start partnership discussion now?
5. **Fitness MVP exercise list** — Which exercises to prioritize?
6. **Youth coaching** — COPPA implications for family mode?

---

*Roadmap generated from analysis of: Visionary AI Coach (134 migrations, 30+ edge functions, 120+ tables, 1,107 production reminders), GVC Hermes (69 tools, 466 PRs), hermes-stackchan capability map. November 13, 2026.*

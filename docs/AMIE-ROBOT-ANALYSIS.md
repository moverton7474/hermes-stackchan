# AMIE Robot Analysis — Visionary AI Coach → Physical Robot

**Date:** November 13, 2026
**Author:** Hermes Agent (automated analysis)
**Purpose:** Inform the custom AMIE robot build by mapping every Visionary AI Coach capability to robot form factor

---

## 1. AMIE Capability Inventory (Complete)

### 1.1 Voice Coach Tools (20 tools across 3 surfaces)

**Voice Coach Session (OpenAI GPT-4 backend, 17 tools):**

| Tool | Risk | Robot Relevance | Notes |
|------|------|-----------------|-------|
| `send_email` | HIGH (confirmation required) | ⭐ Daily | Send on behalf of user — robot says "I'll email that" |
| `send_sms` | HIGH (confirmation required) | ⭐ Daily | Text contacts by name or number |
| `make_voice_call` | SELF-CONFIRMING | ⭐ Frequent | Initiate calls (habit_reminder, goal_checkin, accountability, celebration, custom) |
| `create_task` | WRITE | ⭐ Daily | Create action items with due dates and priority |
| `schedule_reminder` | WRITE | ⭐ Daily | Schedule by SMS, email, or voice channel |
| `get_user_data` | READ | ⭐ Daily | Retrieve goals, habits, tasks, progress, vision |
| `get_todays_habits` | READ | ⭐ Daily | Today's habits with completion status |
| `mark_habit_complete` | WRITE | ⭐ Daily | Mark habits done by name or ID |
| `send_habit_reminder` | WRITE | ⭐ Frequent | Push reminders through preferred channel |
| `update_goal_progress` | WRITE | ⭐ Frequent | Update goal percentage (0-100) |
| `schedule_goal_checkin` | WRITE | ⭐ Weekly | Future check-in scheduling |
| `check_calendar_availability` | READ | ⭐ Daily | Google Calendar free/busy lookup |
| `create_calendar_event` | HIGH (confirmation required) | ⭐ Daily | Book appointments |
| `create_vision_board` | MEDIUM (confirmation required) | Monthly | Generate AI vision board images |
| `get_vision_briefing` | READ | ⭐ Daily | Morning/evening/weekly briefing with tasks, streaks, wins |
| `capture_thought` | WRITE | ⭐ Frequent | Save ideas to Second Brain inbox |
| `get_second_brain_stats` | READ | Weekly | Inbox/capture statistics |
| `search_knowledge` | READ | ⭐ Frequent | Semantic search across personal knowledge base |
| `confirm_pending_action` | SELF-CONFIRMING | ⭐ Frequent | Execute approved actions |
| `cancel_pending_action` | SELF-CONFIRMING | ⭐ Frequent | Decline proposed actions |

**AMIE Realtime Session (OpenAI Realtime API, 64 tools):**

Additional tools beyond the Voice Coach set:

| Category | Tools | Robot Use |
|----------|-------|-----------|
| App Navigation | `navigate_app`, `show_current_view`, `get_current_view` | ❌ N/A (browser-only) |
| Onboarding | `get_onboarding_status`, `save_preferred_name`, `update_onboarding_progress` | 🟡 Initial setup only |
| Goals (enhanced) | `get_active_goals`, `get_goal_status_summary`, `create_goal` | ⭐ Daily |
| Tasks (enhanced) | `list_action_tasks`, `complete_task`, `archive_task`, `restore_task`, `merge_tasks` | ⭐ Daily |
| Habits (enhanced) | `list_habits`, `create_habit`, `create_habit_reminder`, `deactivate_habit` | ⭐ Daily |
| MDALS Music | 20+ tools for music-driven learning plans | 🟡 Audio playback limited on robot |
| Scripture/Worship | `read_scripture_passage`, `resume_worship_session` | ⭐ Faith-first flagship |
| Vision Board Forms | `fill_vision_board_form`, `generate_vision_board`, `save_generated_vision_board` | ❌ N/A (UI-dependent) |
| Memory | `save_session_summary`, `get_recent_voice_session_summary`, `capture_voice_memory`, `search_voice_memory`, `forget_voice_memory` | ⭐ Continuity |
| Notifications | `get_notification_settings`, `get_notification_delivery_status`, `send_test_notification` | ⭐ Proactive alerts |
| Support | `create_support_ticket` | Weekly |

**Gemini Live Session (15 tools):**
Subset of Voice Coach tools — same capabilities, different AI backend (Gemini instead of OpenAI).

### 1.2 Session Types (7 coaching modes)

| Session Type | Purpose | Robot Behavior |
|-------------|---------|----------------|
| `morning_routine` | Start day with intention | Wake-up briefing with calendar, habits, goals |
| `check_in` | Emotional state assessment | Empathetic listening, head tilt, warm tone |
| `reflection` | Review recent experiences | Thoughtful pauses, slow head movement |
| `goal_setting` | Clarify and commit to goals | Excited expressions, upward head tilt |
| `celebration` | Acknowledge wins | Happy face, celebration dance (head oscillation) |
| `accountability` | Review commitments, adjust plans | Determined expression, direct tone |
| `crisis_support` | Calm support during difficulty | Gentle movements, soft tone, "I'm here" face |

### 1.3 Communication Channels (Production-Proven)

**Twilio Integration (verified production stats):**
- **SMS:** 991 messages delivered in 30 days, 0 failures
- **Voice Calls:** 86 calls completed, 0 failures
- **Email:** 30 sent, 0 failures
- **Total:** 1,107 reminders across 2,982 Twilio events

The robot can trigger all three channels. This is AMIE's strongest differentiator — it doesn't just talk, it acts.

### 1.4 AMIE Identity Engine

**Personalization layers:**
1. **Motivational Themes** (5 built-in):
   - Christian Faith & Purpose (flagship — includes scripture, prayer)
   - Executive Performance (metrics-driven)
   - Health & Vitality (holistic wellness)
   - Legacy & Wisdom (long-term impact)
   - Custom personalization
2. **Identity Profile**: core values, life roles, motivation drivers, coaching focus areas, communication style
3. **Knowledge Base**: RAG retrieval from personal documents, voice transcripts, captured thoughts
4. **Session Memory**: Recent session summaries for continuity
5. **Preferences**: formality level, encouragement frequency, AI voice preference

### 1.5 Proactive Automation System

**Event-driven triggers (process-automations):**
- `streak_milestone` — User hits a habit streak milestone
- `missed_habit` — User misses habits for X days
- `goal_progress` — Goal progress changes significantly
- `inactivity` — User hasn't logged in for X days

**Outreach queue (voice_outreach_queue):**
- Scheduled voice calls for habit reminders, goal check-ins
- Burst control with per-user daily cap (default 50)
- Quiet hours enforcement with staggered release

### 1.6 TEACH-AI Quality Scoring

Every coaching session is scored on 5 dimensions:
- **Helpfulness** — Tool success rate
- **Adaptivity** — Theme consistency (baseline 85%)
- **Explainability** — Explanation keyword presence in responses
- **Responsibility** — Guardrail compliance (starts at 100, -10 per trigger)
- **Refinement** — Correction handling (baseline 80%)

### 1.7 Database Schema (120+ tables)

**Core coaching tables relevant to robot:**
- `voice_coach_sessions` — Session history with transcripts, TEACH-AI scores
- `habits` / `habit_completions` — Habit tracking with streaks
- `goals` / `goal_plans` / `action_tasks` — Goal hierarchy
- `scheduled_reminders` — All reminder scheduling
- `voice_outreach_queue` — Proactive call queue
- `user_identity_profiles` — AMIE personalization
- `motivational_themes` — Coaching style templates
- `user_knowledge_chunks` — RAG knowledge base
- `coach_session_memory` — Cross-session continuity
- `pending_agent_actions` — Confirmation gate queue
- `teach_ai_evaluations` — Quality scores
- `automation_rules` / `automation_executions` — Proactive triggers
- `user_contacts` — Contact directory for SMS/calls
- `prayer_entries` — Faith coaching prayers
- `streak_celebrations` — Milestone celebrations

---

## 2. Robot Translation Recommendations

### 2.1 Highest-Value Robot Capabilities (Phase 2 — AMIE Robot Coach)

**Tier 1 — Daily Use (implement first):**

1. **Morning Briefing** — Robot wakes up, plays opening message, delivers `get_vision_briefing` (morning type) with calendar, habits, tasks. Face: happy → neutral as it reads items.

2. **Habit Accountability** — `get_todays_habits` → read incomplete habits → offer to `mark_habit_complete`. On streak milestone: celebration dance. On missed: gentle accountability face.

3. **Communication Hub** — "Text Lisa I'm on my way" → `send_sms`. "Email the team about the deadline" → `send_email`. "Call me at 3pm to remind me" → `schedule_reminder` with voice channel. All with confirmation gate.

4. **Goal Coaching** — "How am I doing on my goals?" → `get_active_goals` + `get_goal_status_summary`. "I finished the proposal" → `update_goal_progress`. On 100%: celebration dance + "Let's set your next goal!"

5. **Calendar Assistant** — "What's on my calendar?" → `check_calendar_availability`. "Book a meeting tomorrow at 10" → `create_calendar_event` (with confirmation).

**Tier 2 — Weekly Use:**

6. **Thought Capture** — "Remember this idea..." → `capture_thought` to Second Brain
7. **Knowledge Recall** — "What did I say about the marketing plan?" → `search_knowledge`
8. **Scripture/Prayer** — "Read me today's scripture" → `read_scripture_passage`. Faith coaching is the flagship theme.
9. **Session Memory** — Robot references previous conversations for continuity

**Tier 3 — Proactive (bridge server polling):**

10. **Proactive Reminders** — Bridge polls `scheduled_reminders` and `voice_outreach_queue`, robot speaks reminders at scheduled times
11. **Streak Alerts** — Robot initiates: "Hey Milton, you haven't logged your morning prayer today. Want to do it now?"
12. **Inactivity Check-in** — After X days without interaction, robot says "I've missed talking with you. Everything okay?"

### 2.2 Hardware Requirements by Phase

**Phase 2 — AMIE Robot Coach (current hardware sufficient):**
- ESP32-S3 + WiFi ✅
- Built-in mic + speaker ✅
- Touchscreen for status display ✅
- Servos for head movement ✅
- No additional hardware needed

**Phase 3 — AMIE Fitness Coach (hardware additions needed):**

| Component | Purpose | Connection | Est. Cost |
|-----------|---------|------------|-----------|
| CamS3 5MP (external) | Exercise form capture | Grove I2C/UART | $20 |
| Heart Rate Sensor (MAX30102) | HR monitoring during workouts | Grove I2C | $8 |
| Distance Sensor (ToF) | Position tracking, rep counting | Grove I2C | $12 |
| Larger speaker (optional) | Louder voice in gym environment | 3.5mm or I2S | $10 |

**Phase 4 — AMIE Sports Trainer:**
- Same camera module as Phase 3
- Consider tripod mount for field placement
- Bluetooth for connecting to phone as secondary camera

### 2.3 Bridge Server Features Needed

**Beyond basic voice relay:**

1. **Proactive Notification Engine** — Poll AMIE's `scheduled_reminders` and `voice_outreach_queue` tables. When a reminder fires, initiate a conversation on the robot without user wake word. Requires:
   - Supabase Realtime subscription to `scheduled_reminders` changes
   - Wake-from-idle protocol (play attention sound, light up face, then speak)
   - Queue management (don't interrupt active conversation)

2. **Session Type Routing** — Bridge should map time-of-day and context to session types:
   - First interaction of day → `morning_routine`
   - After goal completion → `celebration`
   - Scheduled check-in → `accountability`
   - User-initiated "I need to talk" → `check_in` or `crisis_support`

3. **Emotion-to-Expression Mapping** — Parse AMIE's responses for emotional context:
   - Tool results: success → happy face, failure → sad face
   - Session type: celebration → excited, crisis_support → gentle
   - Keywords: "proud", "amazing" → happy; "missed", "behind" → concerned

4. **Confirmation Gate UI** — When AMIE proposes a high-risk action (send email, make call, book calendar), the robot must:
   - Show action details on screen
   - Ask for verbal confirmation
   - Wait for "yes"/"approve" or "no"/"cancel"
   - Execute `confirm_pending_action` or `cancel_pending_action`

5. **Context Injection** — Pass robot-specific context to AMIE sessions:
   - `deviceType: 'robot'` (already supported in voice-coach-session)
   - Sensor data (heart rate, ambient light for time-of-day)
   - Last interaction timestamp for continuity

### 2.4 Fitness Coaching Technical Architecture (Phase 3)

**Exercise Form Detection Pipeline:**
```
CamS3 5MP camera
    ↓ (JPEG frames via UART/I2C to ESP32)
    ↓
ESP32 captures frame, sends to bridge server via WebSocket
    ↓
Bridge server runs MediaPipe Pose (33 keypoints)
    ↓
Pose analysis: joint angles, body alignment, movement patterns
    ↓
Form assessment sent to AMIE as context
    ↓
AMIE provides voice correction: "Straighten your back on the next rep"
```

**Key considerations:**
- ESP32 cannot run MediaPipe locally — processing must happen on bridge server
- CamS3 at 5MP can do 15fps JPEG at 640x480 — sufficient for pose estimation
- Latency target: < 500ms from frame capture to voice correction
- Heart rate sensor provides real-time BPM during exercise

**Rep Counting:**
- Track joint angle oscillations (e.g., elbow angle for bicep curls)
- Bridge server maintains exercise state machine
- Robot announces: "That's 8... 9... 10! Great set!"

**Workout Session Flow:**
1. "Let's work out" → Robot asks what exercise
2. User positions camera → Robot confirms "I can see you"
3. User exercises → Robot counts reps, monitors form
4. Form issue detected → "Try to keep your elbows closer to your body"
5. Set complete → "Rest for 60 seconds" (countdown on screen)
6. Workout complete → Summary: "3 sets of 12, average heart rate 145 BPM"
7. Data logged to AMIE goals/habits

### 2.5 Privacy Considerations

**Camera-based coaching raises privacy concerns:**

1. **Local Processing Preferred** — When possible, run pose estimation on the bridge server (user's local network), not cloud
2. **No Video Storage** — Process frames for keypoints, discard raw video immediately
3. **Keypoint-Only Transmission** — If cloud processing needed, send only extracted keypoints (33 x,y,z coordinates), never raw images
4. **Camera Indicator** — LED or screen indicator when camera is active
5. **Physical Kill Switch** — CamS3 has a physical disconnect option via Grove port
6. **Opt-In Only** — Camera features require explicit activation per session
7. **Compliance** — COPPA if marketing to families, GDPR for EU users

### 2.6 Business Model Recommendations

**Pricing Structure:**
| Tier | Price | Includes |
|------|-------|----------|
| Robot Hardware (one-time) | $199-299 | M5Stack CoreS3 + custom enclosure + pre-loaded firmware |
| AMIE Coach (monthly) | $14.99/mo | Voice coaching, habits, goals, reminders, SMS/email/calls |
| AMIE Fitness (add-on) | $9.99/mo | Camera module + exercise form analysis + workout tracking |
| AMIE Sports (add-on) | $9.99/mo | Sport-specific drill coaching + technique analysis |
| AMIE Family (bundle) | $29.99/mo | Multiple user profiles, family goals, shared accountability |

**Revenue Model:**
- Hardware margin: ~40% ($80-120 profit per unit at $199-299)
- Software subscription: recurring revenue, high margin
- API costs per user: ~$5-8/mo (OpenAI Realtime + Twilio SMS/voice + Supabase)
- Target: 1,000 units Year 1 → $180K hardware + $180K ARR subscriptions

**Distribution:**
- Amazon (primary) — FBA for fulfillment
- Direct (website) — Higher margin, customer relationship
- M5Stack partnership — Co-branded, their distribution channels
- Visionary AI app bundle — Existing users get discount

---

## 3. What's Built vs. What's Planned in AMIE

### Currently Operational
- ✅ 7 session types with context-aware openings
- ✅ 20+ voice tools with confirmation gates
- ✅ Twilio SMS, voice calls, email (1,107 reminders delivered, 0 failures)
- ✅ TEACH-AI quality scoring on every session
- ✅ RAG knowledge base with semantic search
- ✅ 5 motivational themes (Christian faith flagship)
- ✅ Session memory and cross-session continuity
- ✅ Google Calendar integration
- ✅ Second Brain thought capture
- ✅ Proactive automation triggers (streak, missed habit, inactivity)
- ✅ Apple Watch integration
- ✅ MDALS music-driven learning
- ✅ Scripture and worship sessions

### Planned But Not Built
- ⏳ Fitness/exercise coaching (no tables, no code yet)
- ⏳ Sport-specific training (no tables, no code yet)
- ⏳ Physical robot integration
- ⏳ Claude integration for enhanced reasoning
- ⏳ Dynamic knowledge graph relationships
- ⏳ Cross-project knowledge retrieval

### Platform Maturity Assessment
- **Production-grade:** Reminder delivery (99%+ success), session management, TEACH-AI scoring
- **Functional but fragile:** Realtime voice (race conditions identified in AMIE_REVIEW_REPORT), auto-send logic
- **Launch status:** Gated founding cohort (50 users), 6 readiness gates (A-F), not public yet
- **User base:** 23 accounts (mostly internal/test), 0 paid subscriptions

---

## 4. AMIE-to-Robot Integration Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    AMIE Cloud (Supabase)                 │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐   │
│  │ Voice    │  │ Identity │  │ Scheduled Reminders │   │
│  │ Coach    │  │ Engine   │  │ + Outreach Queue    │   │
│  │ Session  │  │ (AMIE    │  │ + Automations       │   │
│  │ (7 types)│  │ Prompt   │  │                     │   │
│  └────┬─────┘  │ Builder) │  └──────────┬──────────┘   │
│       │        └──────────┘             │               │
│  ┌────┴────────────────────────────┐    │               │
│  │ Tools: email, SMS, calls,      │    │               │
│  │ habits, goals, calendar,       │    │               │
│  │ knowledge, vision boards       │    │               │
│  └────┬────────────────────────────┘    │               │
│       │                                 │               │
│  ┌────┴────┐                      ┌─────┴─────┐        │
│  │ Twilio  │                      │ Supabase  │        │
│  │ SMS/    │                      │ Realtime  │        │
│  │ Voice   │                      │ Channel   │        │
│  └─────────┘                      └─────┬─────┘        │
└─────────────────────────────────────────┼───────────────┘
                                          │
                    ┌─────────────────────┴───────────────┐
                    │        Bridge Server (VPS)           │
                    │                                      │
                    │  ┌──────────────────────────────┐    │
                    │  │ xiaozhi WebSocket Protocol   │    │
                    │  │ + AMIE Session Router        │    │
                    │  │ + Proactive Poll Engine      │    │
                    │  │ + Emotion Mapper             │    │
                    │  │ + MediaPipe Pose (Phase 3)   │    │
                    │  └──────────────┬───────────────┘    │
                    └─────────────────┼────────────────────┘
                                      │ WebSocket
                    ┌─────────────────┴────────────────────┐
                    │         AMIE Robot (StackChan)        │
                    │                                       │
                    │  ┌─────┐ ┌─────┐ ┌──────┐ ┌──────┐  │
                    │  │ Mic │ │ Spk │ │Screen│ │Servos│  │
                    │  └─────┘ └─────┘ └──────┘ └──────┘  │
                    │  ┌──────┐ ┌─────┐ ┌──────┐          │
                    │  │CamS3 │ │ HR  │ │ ToF  │ Phase 3  │
                    │  │(ext) │ │Sens.│ │Sens. │ add-ons  │
                    │  └──────┘ └─────┘ └──────┘          │
                    └──────────────────────────────────────┘
```

---

*Generated from analysis of: AI-Interactive-Vision-Board-2 (main branch, 134 migrations, 30+ edge functions, 120+ tables), gemini-voice-center (main branch, 69 tools), hermes-stackchan (docs/CAPABILITY-MAP.md). November 13, 2026.*

# Hermes StackChan Capability Map

**How GVC Hermes voice tools map to StackChan robot behaviors.**

All 48 Hermes voice tools execute server-side via the OpenAI Realtime API. The robot is ears, mouth, and a face — tools work through the bridge with zero firmware changes. This document maps those capabilities to robot-specific behaviors.

## Tool Categories & Robot Relevance

| Category | Tools | Robot Use | Key Tools |
|----------|-------|-----------|-----------|
| Goal Management | 6 | ⭐ Daily | `set_goal`, `list_goals`, `complete_goal`, `coach_me` |
| Team Orchestration | 9 | ⭐ Daily | `assign_task`, `list_assignments`, `team_workload`, `post_to_lobby` |
| Calendar & Email | 2 | ⭐ Daily | `read_m365_calendar`, `read_m365_email` |
| Communications | 7 | ⭐ Frequent | `propose_action`, `resolve_contact`, `decide_action` |
| Session Recall | 5 | ⭐ Continuity | `recall_recent_sessions` |
| System Health | 4 | ⭐ Monitor | `gvc_health`, `list_running_actions`, `list_trio_runs` |
| Scheduling | 3 | ⭐ Reminders | `schedule_task`, `list_scheduled_tasks` |
| Help Desk | 4 | Weekly | `list_help_desk_tickets` |
| GitHub | 3 | Weekly | `query_github` |
| Web Research | 1 | On-demand | `web_research` |
| Productivity | 5 | Weekly | `exec_brief`, `generate_proposal` |
| Dashboard/Screen | 4 | ❌ N/A | Requires browser — not applicable |

**40 of 48 tools are robot-relevant** (68% HIGH, 32% MEDIUM). Only 8 are N/A (screen-dependent).

## Milton's Typical Voice Interactions

### Daily (multiple times)
```
"Good morning"              → Morning briefing (calendar + email + goals)
"What's on my calendar?"    → read_m365_calendar
"Check my email"            → read_m365_email
"What goals am I tracking?" → list_goals / coach_me
"What's the team doing?"    → list_assignments + team_workload
"Assign X to localagent"    → team_workload → assign_task
"Tell the team..."          → post_to_lobby
"Is everything healthy?"    → gvc_health
"Who called me?"            → who_called
```

### Frequent (several times per week)
```
"Text Lisa..."              → resolve_contact → propose_action(send_sms)
"Set a goal to..."          → list_goals → set_goal
"Approve" / "Reject"        → decide_action (two-step voice confirm)
"Is the build done?"        → list_trio_runs
"Remind me to..."           → schedule_task
"Look this up"              → web_research
"Staff brief"               → exec_brief
"Help desk / support inbox" → list_help_desk_tickets
```

### Agent Team Dispatch Pattern
```
Milton: "Give localagent the auth fix, link to Vision Board goal"
  1. team_workload()                    → Check who's available
  2. assign_task(localagent, task, goal) → Dispatch + track
  3. Robot: determined face, "Assigned to localagent"

Milton: "Check on the agents"
  1. verify_agent_tasks()               → Reconcile + check
  2. Robot: brief status per agent
```

## Face Expression Mapping

| State | Emotion | When |
|-------|---------|------|
| Idle | `neutral` | Calm, slow blink |
| Wake word | `happy` | Eyes brighten, 1-2s |
| Listening | `neutral` | Focused, attentive |
| Processing | `neutral` | Thinking animation |
| Good news | `happy` | Goal complete, build passed, calendar clear |
| Bad news | `sad` | Build failed, blocker, error |
| Exciting | `surprised` | Major milestone, urgent alert |
| Confusion | `confused` | Ambiguous request |
| Error | `sad` | Connection lost, tool failure |
| Coaching | `happy` | coach_me, goal progress |

### Emotion Selection Logic

The bridge server should select emotions based on:
1. **Tool name**: `complete_goal` → happy, `who_called` → surprised
2. **Tool result**: success → happy, failure → sad
3. **Text analysis**: "completed/shipped/passed" → happy, "failed/blocked/error" → sad
4. **Default**: neutral

## Head Movement Choreography

| Phase | Pan | Tilt | Speed |
|-------|-----|------|-------|
| Idle | Slow random ±15° | Level | Very slow |
| Wake word | Center on user | Lift 5° | Fast |
| Listening | Tilt 5° left | Level | Slow |
| Processing | Center | Look up 10° | Medium |
| Speaking | Center | Nod ±3° | Matched to speech |
| Good news | Center | Nod 5° | Medium-fast |
| Celebration | ±10° oscillate | ±5° nod | Fast, 3 cycles |
| Error | Shake ±8° | Level | Medium, 2 cycles |

## Proactive Behaviors (Bridge Server Polling)

These behaviors require the bridge server to poll Hermes tools independently:

| Behavior | Poll Target | Trigger |
|----------|-------------|---------|
| Meeting reminder | `read_m365_calendar` | Meeting starts in 10 min |
| Build complete | `list_trio_runs` | Status → completed |
| Build failed | `list_trio_runs` | Status → PAUSED |
| Task done | `list_assignments` | Status → done |
| Urgent email | `read_m365_email` | importance: high |
| New blocker | `list_blockers` | New blocked assignment |
| System issue | `gvc_health` | Health degraded |
| Goal milestone | goal progress | Crosses 25/50/75/100% |

## Implementation Priority

1. **Phase 2 (MVP)**: All tools work via bridge — add emotion mapping + basic head servo
2. **Phase 3**: Add bridge-side polling for proactive alerts (calendar, builds, health)
3. **Phase 4**: Morning briefing auto-trigger on first wake word of day
4. **Phase 5**: LED ring, sound effects, camera presence detection, custom faces

## Priority Rules Affecting Robot Behavior

| Rule | Robot Impact |
|------|-------------|
| **EXECUTION_BIAS** | On "do it"/"go"/"yes" — execute immediately, no verbal preamble. Show working face. |
| **GOAL_MANAGEMENT** | Goals are the spine — link all work to goals. Celebrate on complete. |
| **TRUST_BUT_VERIFY** | Say "queued for approval" not "done" for propose_action calls. |
| **CAPABILITY_ASSESSMENT** | Never say "I can't" — the robot HAS all 48 tools. |
| **LANGUAGE** | English by default, switch only when Milton explicitly asks. |

---

*Full detailed analysis: see `stackchan-research/hermes-voice-capability-mapping.md`*
*Source: GVC Hermes voice endpoint v43, prompt-shared.ts (2026-11)*

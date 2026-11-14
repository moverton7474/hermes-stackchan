# Multi-Child Voice Switching — Design Document

## Overview

Tutor Buddy supports multiple children in a household sharing one physical robot. When a child says **"This is [name]"** or **"My name is [name]"**, the system switches to that child's profile, loading their grade level, subjects, study progress, and personalized system prompt — all without requiring a parent to intervene each time.

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  StackChan   │────▶│  Bridge Server   │────▶│   Supabase   │
│  Robot       │◀────│  (WebSocket)     │◀────│   Database   │
│              │     │                  │     │              │
│  Microphone  │     │  Name Detection  │     │ child_profiles│
│  Speaker     │     │  Session Mgmt    │     │ study_sessions│
│  Display     │     │  Prompt Reload   │     │ mastery_scores│
└─────────────┘     └──────────────────┘     └──────────────┘
```

### Flow

1. Robot captures speech → STT converts to text
2. Bridge server receives transcript text
3. **Name detection interceptor** checks every utterance for profile-switch triggers
4. If matched → query `child_profiles` → switch active profile → reload prompt
5. If unmatched → respond with unrecognized-name message

---

## Trigger Phrases

The system recognizes these patterns (case-insensitive):

| Pattern | Example |
|---------|---------|
| `This is {name}` | "This is Sarah" |
| `My name is {name}` | "My name is Marcus" |
| `I'm {name}` | "I'm Emily" |
| `It's {name}` | "It's David" |
| `Switch to {name}` | "Switch to Sarah" (parent usage) |
| `{name} is here` | "Marcus is here" |

Extraction regex (applied to STT transcript):
```
/(?:this is|my name is|i'm|i am|it's|it is|switch to)\s+(\w+)/i
/^(\w+)\s+is here$/i
```

---

## Security Model

### Pre-Registration Required

- A **parent** must register each child's name in `child_profiles` before voice switching works
- Only exact name matches (case-insensitive) against registered profiles are accepted
- No dynamic profile creation from voice — prevents unauthorized access

### Unrecognized Name Handling

When a name is detected but doesn't match any registered child:

```
Robot: "I don't recognize that name. Can you ask a parent to add you?"
```

- No data is exposed about which names ARE registered
- The interaction is logged for parent review
- The current session (if any) remains active and unchanged

### Same-Household Scoping

- Profiles are scoped to a `household_id` or `parent_id` in `child_profiles`
- The bridge server is configured with the household scope at setup time
- A child can only switch to profiles within the same household

---

## Session Boundaries

### On Profile Switch

1. **End current session**: Update `study_sessions` with `ended_at = now()`, save progress
2. **Log the switch**: Record in `profile_switches` table (timestamp, from_child_id, to_child_id)
3. **Start new session**: Create new `study_sessions` entry for the incoming child
4. **Reload prompt context**: Build personalized system prompt with child's data
5. **Greet the child**: Robot says a personalized greeting using the child's name

### Session Data Isolation

- Quiz results, mastery scores, and study progress are always tied to the active `child_id`
- Switching profiles mid-quiz discards the incomplete quiz (not graded)
- The bridge server maintains a `currentChildId` variable that gates all Supabase writes

---

## System Prompt Reconstruction

When a profile switch occurs, the bridge server rebuilds the system prompt:

```
Base prompt (from STACKCHAN_SYSTEM_PROMPT in .env)
+ Child-specific context block:
  - Name: {name}
  - Grade level: {grade_level}
  - Subjects: {subjects list}
  - Current mastery summary: {top/struggling topics}
  - Study streak: {consecutive days}
  - Last session summary: {what was studied}
  - Preferences: {learning style notes}
```

The context block is appended to the base system prompt and sent to the LLM on the next interaction after the switch.

---

## Pseudocode

### Name Detection Interceptor

```typescript
// In bridge server's message handler (after STT transcript received)

const NAME_PATTERNS = [
  /(?:this is|my name is|i'm|i am|it's|it is|switch to)\s+(\w+)/i,
  /^(\w+)\s+is here$/i,
];

interface ActiveSession {
  childId: string | null;
  sessionId: string | null;
  systemPrompt: string;
}

let activeSession: ActiveSession = {
  childId: null,
  sessionId: null,
  systemPrompt: BASE_SYSTEM_PROMPT,
};

async function handleTranscript(transcript: string): Promise<boolean> {
  // Check all patterns for a name match
  for (const pattern of NAME_PATTERNS) {
    const match = transcript.match(pattern);
    if (match) {
      const detectedName = match[1].trim();
      return await attemptProfileSwitch(detectedName);
    }
  }
  return false; // No name detected, continue normal processing
}
```

### Profile Switch Logic

```typescript
async function attemptProfileSwitch(name: string): Promise<boolean> {
  // Query Supabase for matching child profile
  const { data: child, error } = await supabase
    .from('child_profiles')
    .select('*')
    .eq('household_id', HOUSEHOLD_ID)
    .ilike('name', name)
    .single();

  if (error || !child) {
    // Unrecognized name
    sendRobotMessage({
      type: 'tts',
      text: "I don't recognize that name. Can you ask a parent to add you?",
    });
    sendRobotEmotion('confused');

    // Log the attempt for parent review
    await supabase.from('unrecognized_name_attempts').insert({
      household_id: HOUSEHOLD_ID,
      attempted_name: name,
      timestamp: new Date().toISOString(),
      previous_child_id: activeSession.childId,
    });

    return true; // Handled (don't pass to normal LLM flow)
  }

  // Check if switching to the already-active child
  if (activeSession.childId === child.id) {
    sendRobotMessage({
      type: 'tts',
      text: `I know it's you, ${child.name}! We're already studying together!`,
    });
    sendRobotEmotion('happy');
    return true;
  }

  // ── Execute Profile Switch ──
  await switchProfile(child);
  return true;
}

async function switchProfile(child: ChildProfile): Promise<void> {
  const previousChildId = activeSession.childId;

  // 1. End current session (if one exists)
  if (activeSession.sessionId) {
    await supabase
      .from('study_sessions')
      .update({
        ended_at: new Date().toISOString(),
        ended_reason: 'profile_switch',
      })
      .eq('id', activeSession.sessionId);
  }

  // 2. Log the switch
  await supabase.from('profile_switches').insert({
    household_id: HOUSEHOLD_ID,
    from_child_id: previousChildId,
    to_child_id: child.id,
    switched_at: new Date().toISOString(),
  });

  // 3. Build personalized context
  const context = await buildChildContext(child);

  // 4. Update active session state
  const { data: newSession } = await supabase
    .from('study_sessions')
    .insert({
      child_id: child.id,
      started_at: new Date().toISOString(),
      session_type: 'voice_switch',
    })
    .select('id')
    .single();

  activeSession = {
    childId: child.id,
    sessionId: newSession?.id || null,
    systemPrompt: BASE_SYSTEM_PROMPT + '\n\n' + context,
  };

  // 5. Update LLM system prompt for subsequent messages
  updateSystemPrompt(activeSession.systemPrompt);

  // 6. Greet the child
  const isFirstToday = await checkFirstSessionOfDay(child.id);
  const greeting = isFirstToday
    ? `Hi ${child.name}! Welcome back! Ready to learn something awesome today?`
    : `Hey ${child.name}! Good to see you again! Let's pick up where we left off!`;

  sendRobotMessage({ type: 'tts', text: greeting });
  sendRobotEmotion('happy');
}
```

### Context Builder

```typescript
async function buildChildContext(child: ChildProfile): Promise<string> {
  // Fetch mastery scores
  const { data: mastery } = await supabase
    .from('mastery_scores')
    .select('subject, topic, score')
    .eq('child_id', child.id)
    .order('score', { ascending: false });

  // Fetch recent sessions
  const { data: recentSessions } = await supabase
    .from('study_sessions')
    .select('subject, session_type, started_at')
    .eq('child_id', child.id)
    .order('started_at', { ascending: false })
    .limit(3);

  // Categorize topics
  const strongTopics = mastery
    ?.filter((m: any) => m.score >= 0.8)
    .map((m: any) => `${m.subject}: ${m.topic}`)
    .slice(0, 5) || [];

  const strugglingTopics = mastery
    ?.filter((m: any) => m.score < 0.5)
    .map((m: any) => `${m.subject}: ${m.topic}`)
    .slice(0, 5) || [];

  const lastStudied = recentSessions
    ?.map((s: any) => `${s.subject} (${s.session_type})`)
    .join(', ') || 'nothing yet';

  return `
--- ACTIVE CHILD PROFILE ---
Name: ${child.name}
Grade Level: ${child.grade_level || 'not set'}
Subjects: ${child.subjects?.join(', ') || 'general'}
Strong Topics: ${strongTopics.join(', ') || 'still exploring'}
Needs Practice: ${strugglingTopics.join(', ') || 'none identified yet'}
Recent Sessions: ${lastStudied}
Learning Notes: ${child.learning_notes || 'none'}
---
Adjust your teaching to ${child.name}'s grade level (${child.grade_level || 'elementary'}).
Use their name occasionally. Focus on their struggling topics when they ask for help.
Celebrate their strong topics when relevant.
`.trim();
}
```

### First Session of Day Check

```typescript
async function checkFirstSessionOfDay(childId: string): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('study_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('child_id', childId)
    .gte('started_at', todayStart.toISOString());

  return (count || 0) <= 1; // 1 because we just created the new session
}
```

---

## Database Requirements

### Existing Tables Used
- `child_profiles` — add `household_id` column if not present
- `study_sessions` — add `ended_reason` column (nullable string)
- `mastery_scores` — read-only for context building

### New Tables Needed

```sql
-- Track profile switches for analytics and parent review
CREATE TABLE profile_switches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL,
  from_child_id UUID REFERENCES child_profiles(id),
  to_child_id UUID NOT NULL REFERENCES child_profiles(id),
  switched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Log unrecognized name attempts for security
CREATE TABLE unrecognized_name_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL,
  attempted_name TEXT NOT NULL,
  previous_child_id UUID REFERENCES child_profiles(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Recommended Index

```sql
CREATE INDEX idx_child_profiles_household_name
  ON child_profiles (household_id, lower(name));
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Name spoken mid-quiz | Quiz is abandoned (not graded), profile switches |
| Same child says their name | "I know it's you!" — no switch, no session reset |
| Two children with same name in household | Should not occur; parent registration UI prevents duplicates |
| Name is a common word ("Grace", "Hope") | Only triggers on pattern phrases, not bare mentions |
| Robot is idle (no active session) | Creates new session for the detected child, no session to end |
| Rapid switching (abuse/play) | Rate limit: max 1 switch per 30 seconds, ignore rapid re-triggers |
| STT mishears the name | Falls through to unrecognized-name handling gracefully |

---

## Rate Limiting

To prevent children from playing with the switching feature:

```typescript
let lastSwitchTime = 0;
const SWITCH_COOLDOWN_MS = 30_000; // 30 seconds

async function attemptProfileSwitch(name: string): Promise<boolean> {
  const now = Date.now();
  if (now - lastSwitchTime < SWITCH_COOLDOWN_MS) {
    sendRobotMessage({
      type: 'tts',
      text: "Hold on! Let's wait a moment before switching. Are you sure you want to switch?",
    });
    return true;
  }
  lastSwitchTime = now;
  // ... rest of switch logic
}
```

---

## Implementation Plan

### Phase 1: Core Switching (MVP)
1. Add `household_id` to `child_profiles` table
2. Create `profile_switches` and `unrecognized_name_attempts` tables
3. Add name detection interceptor to bridge server's transcript handler
4. Implement `switchProfile()` with session end/start
5. Build `buildChildContext()` for prompt reconstruction
6. Test with 2-3 registered profiles

### Phase 2: Polish
7. Add rate limiting (30s cooldown)
8. Add "first session of day" greeting logic
9. Parent notification on profile switch (optional push notification)
10. Parent dashboard: view switch history and unrecognized attempts

### Phase 3: Advanced (Future)
11. Voice fingerprint detection (automatic switching without verbal trigger)
12. Per-child TTS voice preference (different voice pitch/speed per child)
13. Shared family quiz mode (children take turns, scores compared)
14. Parental controls per child (time limits, content restrictions)

---

## Testing Checklist

- [ ] "This is Sarah" switches to Sarah's profile
- [ ] "My name is Marcus" switches to Marcus's profile
- [ ] Unrecognized name returns friendly rejection message
- [ ] Previous session is properly ended on switch
- [ ] New session is created for incoming child
- [ ] System prompt includes child's grade level and mastery data
- [ ] Same-child re-identification is handled gracefully
- [ ] Mid-quiz switch abandons quiz without crashing
- [ ] Rate limiting prevents rapid switching
- [ ] All quiz/mastery writes use the correct child_id after switch

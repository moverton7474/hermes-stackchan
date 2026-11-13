# Hermes StackChan Face Designs

## Emotion Faces for Hermes Personality

The StackChan device renders animated faces on its 2" LCD based on the `llm.emotion` message from the server. The stock firmware has built-in face rendering for the standard emotions.

### Supported Emotions (Stock Firmware)

| Emotion | Description | Hermes Context |
|---------|-------------|----------------|
| `neutral` | Calm, attentive eyes | Default listening state, factual responses |
| `happy` | Upturned eyes, subtle smile | Task completed, good news, greetings |
| `sad` | Downcast eyes | Errors, bad news, empathy moments |
| `angry` | Narrowed eyes | Critical errors, frustration |
| `surprised` | Wide round eyes | Unexpected information, "wow" moments |
| `confused` | Slightly tilted, uneven eyes | Ambiguous requests, needs clarification |

### Hermes Personality Face Guidelines

Hermes is an **executive assistant** — professional, competent, warm but not overly casual.

#### State-to-Emotion Mapping

| Robot State | Emotion | Face | Notes |
|-------------|---------|------|-------|
| Idle | `neutral` | Calm, blinking occasionally | Relaxed but attentive |
| Listening | `neutral` | Eyes focused, slight lean forward | Shows attention |
| Processing | `neutral` | Brief thinking animation | While waiting for Realtime response |
| Speaking (general) | `neutral` | Gentle expression | Most responses |
| Speaking (good news) | `happy` | Warm smile | Calendar clear, task done |
| Speaking (sorry/issue) | `sad` | Empathetic | Can't do something, bad news |
| Speaking (exciting) | `surprised` | Energetic | Great results, achievements |
| Error state | `sad` | Concerned | Connection lost, tool failure |
| Wake word detected | `happy` | Brightens up | Responds to being called |

### Phase 5: Custom Face Design (Future)

When we customize faces beyond stock firmware emotions:

#### Hermes Brand Colors
- Primary: Deep navy blue (#1a1a3e)
- Accent: Gold (#d4af37)
- Eyes: Bright cyan (#00d4ff)
- Error: Warm red (#ff6b6b)

#### Custom Face States (Requires Firmware Mod)
- **Hermes Logo Mode**: Display Hermes logo during boot
- **Tool Execution**: Special "working" animation while Hermes runs tools
- **Team Dispatch**: Show agent icon when dispatching to team members
- **Calendar View**: Mini calendar on face when discussing schedule
- **Notification Badge**: Subtle indicator for pending alerts

#### Head Movement Patterns
The StackChan has servo motors for head pan/tilt:

| Action | Movement |
|--------|----------|
| Listening | Slight tilt toward speaker |
| Speaking | Gentle nodding |
| Thinking | Look up-right briefly |
| Greeting | Small bow |
| Error | Shake side to side |
| Idle | Slow random look-around |

### Face Rendering Technical Notes

The stock firmware handles face rendering internally based on the `llm.emotion` field in server messages. The server sends:

```json
{
  "type": "llm",
  "emotion": "happy",
  "text": "",
  "session_id": "..."
}
```

The device maps this to its internal face animation system. No bitmap/SVG data is sent over the wire — the emotion is just a string tag.

Custom faces would require firmware modification to add new emotion tags or replace the rendering engine. This is planned for Phase 5 but not required for the initial integration.

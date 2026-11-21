Read-only full-stack audit report
No files, services, devices, credentials, or cloud resources were changed. The two requested regression suites passed: Tutor Buddy 330/330 tests; AMIE 301/301 tests.
Executive summary
Top risks:
1. Child curriculum can reach AMIE’s adult knowledge context through shared parent-scoped Knowledge Base sources.
2. Several Tutor endpoints authorize too broadly, including weekly bulk email, Bible/flashcard flows, and consent-sensitive child-data actions.
3. Robot wake delay is dominated by device reconnect plus continuous audio/VAD, not provider response latency.
4. Firmware has plausible AFE backpressure and display-lock starvation paths that can produce unrecoverable listening stalls.
5. A VPS move is blocked by insecure protocol/enrollment design: OTA currently advertises ws://, and credentials are derived from spoofable identity headers.
Top actions, in order:
1. Disable/quarantine Tutor sources from AMIE retrieval until explicit adult/child knowledge scopes are enforced.
2. Patch authorization for weekly reports, Bible, flashcards, quiz generation, and robot child ownership before broader use.
3. Introduce a server-owned, revocable lesson lease; require it for usage, vision, board, robot, and paid actions.
4. Instrument and bench-test firmware/bridge failure paths before changing thresholds or MCP behavior.
5. Design the VPS gateway around explicit wss://, trusted one-time activation, a private bridge listener, signed firmware, and a canary.
Architecture and trust boundaries
StackChan → OTA HTTP → Go bridge → OpenAI Realtime / Tutor Edge Functions → Supabase is the live Tutor path. The bridge accepts xiaozhi WebSocket audio, converts device Opus audio, calls OpenAI Realtime, performs device MCP and camera uploads, and logs sessions through tutor-robot-session.

The web Tutor path mints a Realtime session through tutor-realtime-session, uses shared Tutor tools/board state, and sends usage/progress events to Supabase. AMIE has direct navigation/text awareness of Tutor Buddy, but generic Knowledge Base retrieval crosses the same parent account boundary and currently lacks a Tutor exclusion.

The old [ARCHITECTURE.md](C:/Users/mover/hermes-stackchan/docs/ARCHITECTURE.md) describes a historical Node/Hermes-token bridge, while production Tutor code is a Go bridge. Treat that document as stale until rewritten from current runtime evidence.
Findings
ID	Severity	Finding and evidence
F1	Critical	Tutor uploads and LMS sources are created as include_in_context=true; AMIE prompt/context/search paths use parent-only filters. Child curriculum can enter adult AMIE context. [Tutor document source (line 112)](C:/Users/mover/ai-coach-review/supabase/functions/tutor-parse-document/index.ts:112), [AMIE context (line 4668)](C:/Users/mover/ai-coach-review/lib/realtime/AmieRealtimeClient.ts:4668), [prompt builder (line 284)](C:/Users/mover/ai-coach-review/supabase/functions/amie-prompt-builder/index.ts:284).
F2	High	The no-`child_id` weekly-report branch uses service role to email all families; malformed/non-POST requests can reach it. [Handler (line 491)](C:/Users/mover/ai-coach-review/supabase/functions/tutor-weekly-report/index.ts:491).
F3	High	Bible and flashcard endpoints use service role without validating caller ownership of the requested child/card. [Bible (line 184)](C:/Users/mover/ai-coach-review/supabase/functions/tutor-bible-studies/index.ts:184), [flashcards (line 84)](C:/Users/mover/ai-coach-review/supabase/functions/tutor-flashcard-mode/index.ts:84).
F4	High	Consent, budget, and time limits are checked at session entry, not continuously. Vision, board, and robot actions can proceed without a shared active-session lease; revocation does not close active work. [Web mint (line 147)](C:/Users/mover/ai-coach-review/supabase/functions/tutor-realtime-session/index.ts:147), [robot vision (line 533)](C:/Users/mover/ai-coach-review/supabase/functions/tutor-robot-session/index.ts:533).
F5	High	tutor-data deletion/export omits LMS/reading-related content; deletion tolerates failures, leaving imported knowledge sources possible. [Deletion (line 150)](C:/Users/mover/ai-coach-review/supabase/functions/tutor-data/index.ts:150).
F6	High	The Tutor bridge’s OTA response hard-codes ws://; device token issuance trusts Device-Id/Client-Id headers. TLS termination alone does not secure enrollment. [OTA (line 44)](C:/Users/mover/stackchan-research/stackchan-ai-server/stackchan-server/server/internal/service/ai/ota_proxy.go:44), [device auth (line 176)](C:/Users/mover/stackchan-research/stackchan-ai-server/stackchan-server/server/internal/service/ai/device_auth.go:176).
F7	High	Firmware has a bounded-queue backpressure chain: stalled outbound send can block encoding and then AFE fetching while input continues. It is a credible, not yet incident-proven, explanation for AFE(FEED) is full.
F8	Medium	The StackChan HAL holds the LVGL lock and sleeps 100 ms in its non-idle loop, competing with status/emotion rendering during voice operation. [HAL (line 145)](C:/Users/mover/stackchan-firmware-visionary/firmware/main/hal/hal.cpp:145).
F9	Medium	Quiz retrieval is parent-scoped rather than child-scoped; the client receives answer keys and retries create duplicate/independent FSRS events. [Quiz (line 212)](C:/Users/mover/ai-coach-review/supabase/functions/tutor-quiz-generate/index.ts:212).
F10	Medium	Bridge stop phrases can send an unnecessary cancellation after VAD already ended a response. The observed response_cancel_not_active is a confirmed benign-but-noisy race. [Stop handler (line 40)](C:/Users/mover/stackchan-research/stackchan-ai-server/stackchan-server/server/internal/service/ai/tutor_stop.go:40).


Root-cause assessment
- Two-minute wake: confirmed to include a device 1006 unexpected EOF 12 ms after listen:start, followed by reconnect and two continuous VAD spans of about 27.5 s and 35.7 s. Later healthy replies reached bridge first-audio in 302–383 ms; the 804 ms case was the goodbye. This is not an OpenAI latency problem. Root cause of the EOF remains unconfirmed: firmware, Wi-Fi, or device-side socket failure are still candidates.
- Choppy/cut-off responses: strong evidence of automatic interruption: new speech was detected 18 ms, 17 ms, and 3 ms before responses ended. Background speech, acoustic echo, and overly eager semantic VAD remain competing hypotheses.
- MCP timeout/stall: the recent EOF preceded the delayed MCP startup, so MCP is not the sole cause. It can still exacerbate an already-congested application loop. The next connection completed MCP discovery successfully.
- Wake reliability: WakeNet sensitivity has not been measured systematically. While in Listening state, WakeNet detection is disabled; a stuck state can look like wake failure. “Hi, Stack Chan,” variants, background playback, touch fallback, and false-wake rate need controlled measurement.
- Face firmware lag: tb1 does not alter audio, codec, I²C, or MCP implementation. It does add shared-display work, including avoidable lock contention and repeated face animation behavior.
- Data integrity: production aggregate checks found 1 active robot session, 23 study sessions, 13 usage rows, 32 reward events, no duplicate live boards/robot-session rows, and no detected orphan usage/reward references. This is reassuring but does not prove per-lesson atomicity.
Recommended implementation plan
1. Contain data crossover first. Add explicit knowledge_scope/audience fields; default Tutor content to child-private; exclude it from every AMIE retrieval, prompt, cache, vector, and keyword path.
   - Rollback: feature flag allowing only previously classified adult sources.
   - Verify: parent/sibling/AMIE isolation tests plus production-safe metadata audit.
2. Repair authorization and consent lease. Deny by default in weekly reporting; enforce verified parent ownership in Bible/flashcards/quiz/robot handlers. Create a server-issued lesson lease with expiry/revocation and enforce it for child-data, model, camera, board, and usage requests.
   - Rollback: independently disable affected external/paid routes.
   - Verify: anonymous, unrelated-parent, sibling, consent-revoked, and expired-lease integration tests.
3. Make Tutor state writes idempotent. Persist authoritative quiz question IDs/answer keys; use unique idempotency keys for study, usage, reward, and FSRS writes; transact linked writes.
   - Verify: duplicate/retry/concurrent requests produce exactly one outcome.
4. Improve bridge observability and interruption handling. Log response status/reason, response IDs, audio queued/sent/played, device disconnect reason, and MCP timing. Discard queued audio for cancelled turns; guard response.cancel with an active response ID.
   - Rollback: feature flags preserving current VAD/audio behavior.
   - Verify: quiet room, deliberate barge-in, speaker playback, and long-pause matrices.
5. Prepare 1.5.1-tb2 as a small reliability release. Move the 100 ms wait before LVGL lock acquisition; bound audio enqueue waits; add queue high-water, AFE, I²C, WS-send, lock-hold, heap, and stack telemetry without transcript logging. Do not implement hot AFE restart until worker shutdown/join is safe.
   - Keep ota_0 factory rollback.
   - Verify on a bench device with transport loss, slow writes, MCP discovery, face animation, and I²C fault injection.
VPS readiness
Batman has capacity for a single-device pilot: 4 vCPU, about 9.7 GiB available RAM, 95 GiB free disk, active Nginx/TLS, and UFW allowing only 22/80/443. Its measured connection setup suggests roughly 30 ms median extra proxy-path latency, within the target if sustained WebSocket tests confirm it.

Do not deploy the current Compose manifest as-is: it publishes raw 0.0.0.0:12802, runs without a declared non-root runtime user, and retains a Windows-specific bind mount.

Migration gate:
- Explicit public wss:// endpoint, private/loopback bridge.
- One-time trusted activation, revocable device credentials, signed firmware/OTA.
- Nginx allowlist only for OTA and WebSocket routes.
- Separate container, resource/capability limits, narrow egress, redacted logs.
- Canary against actual ESP32 certificate validation and persistent WSS.
- Preserve LAN endpoint and OTA rollback until p50 end-of-speech-to-audio stays near 1 s and added median latency stays ≤50 ms.
Security and privacy
For a child-facing deployment, the unresolved consent lease, deletion/export gaps, AMIE crossover, and external-processing retention posture are release gates. COPPA requires verifiable parental consent, purpose-limited retention/deletion, and appropriate safeguards; OpenAI’s under-18 guidance calls for confirming Zero Data Retention where under-13 or equivalent-age personal data is processed. Review actual provider/project retention settings for Realtime, vision, audit, and transcript paths before expanding the pilot. FTC COPPA guidance, OpenAI under-18 guidance.
Verification performed
- Read-only source, migration, Git history, Docker runtime/log, and VPS inspection.
- Production aggregate-only SQL checks; no child content retrieved.
- Tutor Buddy tests: 27 files, 330 tests passed.
- AMIE tests: 20 files, 301 tests passed.
- No live lesson, camera, robot control, deployment, RLS mutation, flash operation, or browser dashboard action was performed.
Remaining gaps: effective deployed Edge Function JWT settings/RLS grants, device UART correlation during an incident, actual ESP32 WSS validation, and end-to-end consent-revocation behavior.

      
9:27 PM
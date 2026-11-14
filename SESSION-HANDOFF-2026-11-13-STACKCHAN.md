# Session Handoff — StackChan Robot Project (FINAL)
**Date:** 2026-11-13 | **Session:** 16+ hours | **Repo:** moverton7474/hermes-stackchan

## ⚠️ URGENT — Do Before Next Session
1. **FILE PA-12 PATENT** → https://patentcenter.uspto.gov ($130) — files in `~/Dropbox/.../Patent Filings/PA-12-AMIE-Robot-Coach/`
2. **ROTATE OPENAI API KEY** → https://platform.openai.com/api-keys — update `~/stackchan-research/stackchan-ai-server/stackchan-server/.env`

## Summary
Built entire AMIE Robot Coach stack: bridge server running (Docker 12800), offline mode with Gemma 2B (12900), patent drafted (25 claims), website updated, Tutor Buddy schema live on production Supabase, marketing mockup deployed. Three robot personalities on same hardware.

## Services Running
| Service | Port | Status |
|---------|------|--------|
| stackchan-ai-server (Docker) | 12800 | ✅ OTA + WebSocket at 192.168.1.189 |
| Offline service | 12900 | ✅ Connectivity + Ollama + SQLite + sync |
| Ollama | 11434 | ✅ Gemma 2B (1.6GB) |

## PRs Merged (Vision Board repo)
#289 Robot section on landing page | #290 Real StackChan photos | #291 Tutor Buddy schema + edge functions | #292 Marketing link

## Deployments
- https://www.visionaryai.life/ — Robot section live
- https://amie-robot-marketing.vercel.app — Marketing mockup
- Supabase `edaigbnnofyxcfbpcvct` — 5 Tutor Buddy tables on production

## Three Robot Personalities
| Port | Name | Voice | Purpose |
|------|------|-------|---------|
| 12800 | Hermes | marin | Desk assistant / orchestrator |
| 12801 | AMIE | coral | Life coach / fitness / faith |
| 12802 | Tutor Buddy | shimmer | Kids homework / tutoring |

## Patent (PA-12) — READY TO FILE
Location: `~/Dropbox/.../Patent Filings/PA-12-AMIE-Robot-Coach/`
25 claims, 10 figures, DOCX+PDF. Hardware-agnostic (covers StackChan → Unitree humanoid). $130 filing fee.

## Key Files (hermes-stackchan repo)
Prompts: hermes-robot-prompt.md, amie-robot-prompt.md, tutor-buddy-prompt.md
Configs: .env.hermes (12800), amie-env (12801), tutor-buddy-env (12802) + Docker compose for each
Faces: hermes (6), amie (7), tutor-buddy (7 kawaii) — all animated HTML
Docs: SETUP-GUIDE, DEMO-SCRIPT, AMIE-ROBOT-ANALYSIS (21KB), CAPABILITY-MAP, ARCHITECTURE, M5STACK-PARTNERSHIP-INQUIRY, TUTOR-BUDDY-PLAN (14KB), TUTOR-BUDDY-PLATFORM-ANALYSIS (22KB), TUTOR-BUDDY-MARKET-RESEARCH (28KB)
Plans: SAFE-PLAN (main), SAFE-PLAN-OFFLINE, SAFE-PLAN-CAMERA-HOMEWORK
Offline: offline-service/ (connectivity, ollama-client, offline-store, sync-engine, index)
Other: marketing/robot-mockup.html, simulator/index.html, ROADMAP.md (7 phases + IP)

## Bridge Server
Container: `stackchan-server-stackchan-1` | Restart: `cd ~/stackchan-research/stackchan-ai-server/stackchan-server && docker compose -f docker-compose.standalone.yml restart`
OTA: `http://192.168.1.189:12800/xiaozhi/ota` | WebSocket: `ws://192.168.1.189:12800/xiaozhi/ws`
Build notes: Dockerfile patched (collect-licenses.sh), CRLF fixed, Go server with native OPUS

## Next Steps
1. ⚠️ File PA-12 ($130) | 2. ⚠️ Rotate OpenAI key | 3. ⏳ Robots arrive → test → demo video | 4. Send M5Stack email | 5. Tutor Buddy Phase B | 6. AMIE coaching content

## Credentials
OpenAI key: `~/stackchan-research/.../stackchan-server/.env` (ROTATE) | Supabase token: `~/Dropbox/.../New Supabase Access Token 4 17 2026.txt` | Vision Board: `edaigbnnofyxcfbpcvct` | GVC lobby: `vjlsjnhacarurcoqcwki` (`~/batmanmo74/.env`) | VPS: `ssh -i ~/.ssh/batman-mo-vps root@187.77.219.169`

## Environment
Windows 11 ARM64 | Docker ✅ v29.2.0 | Ollama ✅ v0.16.3 | Python 3.14.9 | Node.js ✅ | GH CLI ✅ | LAN: 192.168.1.189

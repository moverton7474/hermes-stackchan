# Session Handoff — StackChan Robot + Tutor Buddy Project (FINAL)
**Date:** 2026-11-13 | **Session:** 16+ hours | **Repo:** moverton7474/hermes-stackchan

---

## URGENT — Do Before Next Session
1. **FILE PA-12 PATENT** at https://patentcenter.uspto.gov ($130) — files in ~/Dropbox/Finanicals/Milton & Lisa Overton Financials/GF Accelerate LLC/Patent Filings/PA-12-AMIE-Robot-Coach/
2. **ROTATE OPENAI API KEY** at https://platform.openai.com/api-keys — update ~/stackchan-research/stackchan-ai-server/stackchan-server/.env then restart Docker

---

## NEW SESSION STARTUP INSTRUCTIONS

New session MUST execute these before any work:

### Step 1: Read Project Context
```
cat ~/hermes-stackchan/ROADMAP.md
cat ~/hermes-stackchan/SAFE-PLAN.md
cat ~/hermes-stackchan/SAFE-PLAN-OFFLINE.md
cat ~/hermes-stackchan/SAFE-PLAN-CAMERA-HOMEWORK.md
cat ~/hermes-stackchan/docs/TUTOR-BUDDY-PLAN.md
cat ~/hermes-stackchan/docs/ARCHITECTURE.md
cd ~/hermes-stackchan && git log --oneline -20
cd ~/ai-coach-review && git log --oneline -20
```

### Step 2: Verify Services
```
docker ps | grep stackchan
curl -s http://localhost:12800/xiaozhi/ota
curl -s http://localhost:12900/status
ollama list
```

### Step 3: Check Database
```
export SUPABASE_ACCESS_TOKEN=$(cat "$HOME/Dropbox/Finanicals/Milton & Lisa Overton Financials/GF Accelerate LLC/AI Interactive Vision Board/API Keys/New Supabase Access Token 4 17 2026.txt" | grep -o 'sbp_[a-f0-9]*')
echo "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('child_profiles','quiz_results','mastery_scores','study_sessions','educational_content') ORDER BY 1;" | npx supabase db query --remote=edaigbnnofyxcfbpcvct --read-only
```

### Step 4: Check Deployments
```
curl -s https://www.visionaryai.life/ | grep -o "COMING 2027"
curl -s https://amie-robot-marketing.vercel.app | grep -o "Meet AMIE"
curl -s https://voice.visionaryai.marketing/api/health | head -1
```

### Step 5: Review Visionary AI Coach Codebase
```
cd ~/ai-coach-review && git pull origin main
gh pr list --state merged --limit 10
ls supabase/functions/
ls supabase/migrations/ | tail -10
```

### Step 6: Review VPS (if needed)
```
ssh -i ~/.ssh/batman-mo-vps root@187.77.219.169 "pm2 list"
```

---

## Summary
Built entire AMIE Robot Coach stack: bridge server (Docker 12800), offline mode with Gemma 2B (12900), patent (25 claims), website updated, Tutor Buddy schema live on production Supabase, marketing mockup deployed. Three robot personalities on same hardware.

## Services Running
| Service | Port | Status |
|---------|------|--------|
| stackchan-ai-server (Docker) | 12800 | OTA + WebSocket at 192.168.1.189 |
| Offline service (Node.js) | 12900 | Connectivity + Ollama + SQLite + sync |
| Ollama | 11434 | Gemma 2B (1.6GB) |

## PRs Merged (AI-Interactive-Vision-Board-2)
| PR | What |
|----|------|
| #289 | Robot section on landing page |
| #290 | Real StackChan photos |
| #291 | Tutor Buddy schema + edge functions |
| #292 | Marketing link |

## Three Robot Personalities
| Port | Name | Voice | Config |
|------|------|-------|--------|
| 12800 | Hermes | marin | config/.env.hermes |
| 12801 | AMIE | coral | config/amie-env.template |
| 12802 | Tutor Buddy | shimmer | config/tutor-buddy-env.template |

## Patent (PA-12) — READY TO FILE
Location: ~/Dropbox/.../PA-12-AMIE-Robot-Coach/
25 claims, 10 figures, DOCX+PDF. Hardware-agnostic. $130.

## Repos
| Repo | Local | Purpose |
|------|-------|---------|
| moverton7474/hermes-stackchan | ~/hermes-stackchan | Robot project |
| moverton7474/AI-Interactive-Vision-Board-2 | ~/ai-coach-review | Visionary AI Coach |
| moverton7474/gemini-voice-center | ~/gvc-review | GVC Hermes |
| moverton7474/c-suite-support | ~/c-suite-support-work | Book |
| rudyll/stackchan-ai-server | ~/stackchan-research/stackchan-ai-server | Bridge (upstream) |

## Credentials & Access

### API Keys
| Key | Location |
|-----|----------|
| OpenAI API key | ~/stackchan-research/stackchan-ai-server/stackchan-server/.env (ROTATE!) |
| Supabase token | ~/Dropbox/Finanicals/Milton & Lisa Overton Financials/GF Accelerate LLC/AI Interactive Vision Board/API Keys/New Supabase Access Token 4 17 2026.txt |
| OpenAI keys | ~/Dropbox/.../API Keys/new open ai keys for applications 7 28 2026.txt |

### Supabase Projects
| Project | Ref |
|---------|-----|
| AI Interactive Vision Board | edaigbnnofyxcfbpcvct |
| GVC Lobby | vjlsjnhacarurcoqcwki (creds in ~/batmanmo74/.env) |

### SSH
| Host | Command |
|------|---------|
| Batman VPS | ssh -i ~/.ssh/batman-mo-vps root@187.77.219.169 |
| Robin VPS | ssh -i ~/.ssh/robin-vps-main root@187.124.68.10 |

### GitHub & Tools
- Account: moverton7474 (GH CLI authenticated)
- Lobby bridge: cd ~ && python hermes-bridge.py post "MESSAGE"
- Vercel: npx vercel (authenticated)
- Supabase CLI: export SUPABASE_ACCESS_TOKEN=$(cat "path-to-token-file" | grep -o 'sbp_[a-f0-9]*') then npx supabase db query --remote=edaigbnnofyxcfbpcvct
- browser_vault for saved logins
- computer_use for driving Milton's local desktop
- Docker: v29.2.0

## Bridge Server
Container: stackchan-server-stackchan-1 | Restart: cd ~/stackchan-research/stackchan-ai-server/stackchan-server && docker compose -f docker-compose.standalone.yml restart
OTA: http://192.168.1.189:12800/xiaozhi/ota | WS: ws://192.168.1.189:12800/xiaozhi/ws | Settings: http://localhost:8099

## Tutor Buddy Tables (LIVE on edaigbnnofyxcfbpcvct)
child_profiles, quiz_results, mastery_scores, study_sessions, educational_content

## Environment
Windows 11 ARM64 | Docker v29.2.0 | Ollama v0.16.3 | Python 3.14.9 | Node.js | GH CLI | LAN: 192.168.1.189

## Next Steps
1. File PA-12 ($130) | 2. Rotate OpenAI key | 3. Robots arrive -> test -> demo | 4. M5Stack email | 5. Tutor Buddy Phase B | 6. AMIE content

---
*To continue: "Read ~/hermes-stackchan/SESSION-HANDOFF-2026-11-13-STACKCHAN.md and execute startup instructions."*

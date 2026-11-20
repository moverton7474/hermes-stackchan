# SAFE PLAN — Permanent Tutor Buddy Faces (custom StackChan firmware)

**Status:** DRAFT for Milton's review · 2026-11-19  
**Device:** M5Stack StackChan (CoreS3, ESP32-S3, 16 MB), MAC 7c:4f:ad:af:bd:7c, factory fw **1.5.1**  
**Source:** official, MIT-licensed `github.com/m5stack/StackChan` → `firmware/` (latest tag v1.6.2, ESP-IDF + xiaozhi-esp32 v2.5.2)

## Why firmware (and not just images)
- Today our faces are pushed as `self.screen.preview_image` pop-ups. They work (≈0.4 s to appear) but auto-hide after ~6 s and cover the lip-synced face.
- The stock face is **drawn in code** (`main/stackchan/avatar/skins/default/` — eyes.cpp, mouth.cpp, speech_bubble.cpp + decorators heart/shy/dizzy/angry/sweat). The emoji files in the assets partition are not used by the face, so an assets pack alone cannot change it.
- The firmware already has a **skin system** (`avatar/skins/`). The clean, permanent solution is a new **`tutor_buddy` skin**: our faces drawn natively (LVGL), keeping blink, lip-sync and emotions — better than static PNGs.

## Facts verified (read-only)
| Item | Value |
|---|---|
| Partition table (source == device) | nvs 0x9000 · otadata 0xd000 · ota_0 0x20000 (0x4f0000) · ota_1 0x510000 · assets 0xA00000 (4 MB) |
| Wake word | `CONFIG_SR_WN_WN9L_HISTACKCHAN_TTS3` → only **"Hi, Stack Chan"** |
| Custom wake word | Supported in source (`USE_CUSTOM_WAKE_WORD`, MultiNet phrase) — e.g. "Hey Tutor Buddy" |
| Idle head movement | Built-in `IdleMotionModifier`, user setting **Setup → AI Agent → "Idle movement frequency" Off/Low/Medium/High** (no firmware change needed) |
| Full flash backup | `~/hermes-stackchan/backups/stackchan-firmware-backups-20261120.7z` (AES-256 encrypted, key in ~/.secrets; + Dropbox) |
| Our OTA setting | NVS `wifi/ota_url` = `http://192.168.1.189:12802/xiaozhi/ota/` (must survive) |

## Phases (each gated — nothing is flashed until Phase 3 is approved)

### Phase 0 — Reproducible build, no device contact (≈1–2 h)
1. Fork to private `moverton7474/stackchan-firmware-visionary`.
2. Build stock v1.6.2 in Docker `espressif/idf:v5.5.x` (no local IDF install); `fetch_repos.py` + patch.
3. Gate: build succeeds; binary size < 0x4f0000; partition table identical to device.

### Phase 1 — `tutor_buddy` skin (≈1 day)
1. New `avatar/skins/tutor_buddy/` (eyes, mouth, accessories) matching `faces/tutor-buddy/*` designs: Ready to Learn, Explaining, Listening, You Got It!, Almost! Try Again, Reading Together, Let Me Think.
2. Map xiaozhi emotions → skin states (same mapping as `faces.json`); keep blink + lip-sync.
3. Skin selectable (NVS key, default = tutor_buddy, setting to switch back to default skin) so the stock face is one tap away.
4. Optional: Tutor Buddy splash/boot screen.
5. Test in the firmware's avatar simulator/WS-avatar first, screenshots for Milton.
6. Gate: Milton approves screenshots.

### Phase 2 — Optional extras (each separately approved)
- **Custom wake word** "Hey Tutor Buddy" (MultiNet). Risk: lower accuracy than the trained "Hi Stack Chan" WakeNet → ship as an *additional* phrase only if supported, otherwise keep Hi Stack Chan.
- Idle-movement default = Low during tutoring builds.
- Bridge: stop pushing preview_image when the device reports the tutor_buddy skin.

### Phase 3 — Flash (≈30 min, USB connected, Milton present)
1. Fresh full backup again (`esptool read-flash 0 0x1000000`), SHA-256 recorded.
2. Write the new app **only to the inactive OTA slot** + otadata to switch (or `esptool write-flash 0x20000 app.bin` if the device runs ota_1). **Never write NVS (0x9000) or assets (0xA00000).**
3. Read back and compare the written region.
4. Boot log check: Wi-Fi joins, OTA URL still ours (12802), activation, wake word loads, servo calibration intact.
5. Real-device test: wake → tutoring → faces → end_session → idle.

### Rollback (any step)
- Switch otadata back to the previous slot (factory 1.5.1 app is untouched in the other slot), **or**
- Re-flash only the app slice from `full_flash.bin`. Never restore the full image (it would also roll back NVS).

## Risks & mitigations
| Risk | Mitigation |
|---|---|
| Upgrading 1.5.1 → 1.6.2 base changes behaviour | Phase 0 can pin to the 1.5.1-equivalent commit if one exists; otherwise test stock 1.6.2 first (flash stock before custom) |
| Factory OTA overwrites our firmware | Our OTA server (12802) controls the firmware field — return no update |
| Lose Wi-Fi/OTA settings | Never write NVS; readback compare |
| Wake word broken | Assets partition untouched |
| Bricked boot | USB download mode always available (ROM bootloader); full backup |

## Approval needed
- [ ] Phase 0+1 (build + skin, no device contact)
- [ ] Phase 2 items (wake word / idle default)
- [ ] Phase 3 flash (Milton present, robot on USB)

# Firmware build notes — Tutor Buddy skin (Phase 0 + Phase 1)

**Status:** built, **not flashed**. No device contact (no COM port, no esptool against hardware).
**Date:** 2026-11-19/20 · **Repo:** <https://github.com/moverton7474/stackchan-firmware-visionary> (private)

## TL;DR

| | |
|---|---|
| Private fork | `moverton7474/stackchan-firmware-visionary`, full upstream history (81 commits, `upstream` remote = m5stack/StackChan), MIT `firmware/LICENSE` + `NOTICE.md` |
| Branches | `main` (upstream 1.6.2 + build script) · `tutor-buddy-skin` (skin on **1.6.2**) · `tutor-buddy-skin-1.5.1` (same skin on the **1.5.1** commit the robot runs today) |
| Stock build | ✅ 1.6.2 and ✅ 1.5.1 both build in Docker |
| Skin build | ✅ on 1.6.2 and ✅ on 1.5.1, no new warnings |
| Partition table | generated table is **byte-identical** to the robot's (compared with `0x8000` in the full-flash backup) and matches `partitions.csv` |
| App size | ~3.8 MB of the 0x4f0000 (5,177,344 B) slot → **~73.5 % used, ~1.37 MB free** |
| ⚠️ Biggest finding | **1.6.2 changes the wake-word model** (WN9 → WN9L). The robot's assets partition has the WN9 model, so a 1.6.2 app without new assets will probably not load "Hi, Stack Chan". **Recommend Phase 3 uses the 1.5.1-based build** (`tutor-buddy-skin-1.5.1`). |

## Build steps

Prereqs: Docker Desktop (Linux containers), git-bash. Nothing installed on the host.

```bash
git clone https://github.com/moverton7474/stackchan-firmware-visionary.git
cd stackchan-firmware-visionary
git checkout tutor-buddy-skin-1.5.1      # or tutor-buddy-skin (1.6.2 base) / main (stock 1.6.2)
bash scripts/build.sh [--clean] [--out dist/<name>]
bash scripts/preview.sh dist/preview      # optional: host LVGL screenshots of the skin
```

`scripts/build.sh`:
1. streams `firmware/` (no build outputs) into a Docker **named volume** (fast Linux FS, LF line endings),
2. runs `python fetch_repos.py` (mooncake, mooncake_log, smooth_ui_toolkit, ArduinoJson, esp-now, xiaozhi-esp32 + `patches/xiaozhi-esp32.patch`) and `idf.py build`,
3. exports bins + `flash_args` + `sdkconfig` + size reports + the decoded partition table to `dist/…`.
It never flashes. Containers are named `tbfw-*` (never `stackchan-*`).

| Branch | Image (tag / digest) | ESP-IDF | xiaozhi-esp32 | Volume |
|---|---|---|---|---|
| `main`, `tutor-buddy-skin` (1.6.2) | `espressif/idf:v6.1` `sha256:81893c71bb5e…edb18c` | 6.1.0 (pinned in `dependencies.lock`; upstream README says IDF 6.1 — **not 5.5.x as the plan assumed**) | v2.5.2 | `tbfw-work` |
| `tutor-buddy-skin-1.5.1` | `espressif/idf:v5.5.4` `sha256:b9f2d6ea1c19…db892b` | 5.5.4 (same as the robot's app: `esp_app_desc` says v5.5.4) | v2.2.4 | `tbfw-work-151` |

Docker Desktop on this host reports `amd64` server images; a clean build takes ~20–25 min, incremental ~3–5 min.
Re-running fetch on the 1.5.1 tree prints harmless `patch does not apply` lines (its older `fetch_repos.py` just skips an already-applied patch).

## Results & sizes

App slot = `0x4f0000` = 5,177,344 bytes.

| Build (`dist/…`) | app `stack-chan.bin` | % of slot | free | SHA-256 (app) |
|---|---|---|---|---|
| `stock-1.6.2` | 3,777,808 (0x39a510) | 73.0 % | 1,399,536 | `e14a8935827b2275b5fce3867d4763f12b458f17e137d4cc271d14494a5f4f1b` |
| `tutor-buddy` (1.6.2 + skin) | 3,798,080 (0x39f440) | 73.4 % | 1,379,264 | `eb7ee9ae68c74e6f9669ba6bb8ecda3037ef87feab9002f4b98bce9a27e0af4e` |
| `stock-1.5.1` | 3,786,944 (0x39c8c0) | 73.1 % | 1,390,400 | `3c1717ae91d1cae26b1764090a539b9cfb83412bad508a46c7d490e4725d08f7` |
| **`tutor-buddy-1.5.1`** (recommended) | **3,807,760 (0x3a1a10)** | **73.5 %** | **1,369,584** | `b6391eaa456437215459604ba568198976c2bbd8a6d046c73fe91e00a8fe5db7` |

The skin costs ~20 KB of flash; DIRAM use is unchanged (~208 KB / 342 KB). For reference the robot's own 1.5.1 app (ota_0) is 3,790,288 bytes.

### Partition table check
Generated (`gen_esp32part.py` decode of `partition-table.bin`, identical for all four builds, SHA `48da0866…1e1a4b`):

```
nvs      data nvs      0x9000    16K      (0x4000)
otadata  data ota      0xd000    8K       (0x2000)
phy_init data phy      0xf000    4K
ota_0    app  ota_0    0x20000   5056K    (0x4f0000)
ota_1    app  ota_1    0x510000  5056K    (0x4f0000)
assets   data spiffs   0xa00000  4M
coredump data coredump 0xe00000  64K
```
= `firmware/partitions.csv`, and **byte-identical to `0x8000–0x8c00` of `backups/stackchan_20261119_203320/full_flash.bin`**.

## Artifact paths (local, git-ignored — not committed)

Root: `C:/Users/mover/stackchan-firmware-visionary/dist/<build>/`

| File | Path inside `<build>/` | Notes |
|---|---|---|
| bootloader | `bootloader/bootloader.bin` | 1.6.2 builds `d444e7d2…`, 1.5.1 builds `3a863e13…`. The 1.5.1 one differs from the robot's only by its embedded build date (identical string table → same config). **Do not flash it.** |
| partition table | `partition_table/partition-table.bin` (+ `.csv` decode) | identical to the robot |
| OTA data (initial) | `ota_data_initial.bin` | all-0xFF "boot ota_0" image — **do not flash** (would reset slot selection) |
| app | `stack-chan.bin` (+ `.elf`, `.map`) | |
| assets image | `generated_assets.bin` | for reference only; plan says never write 0xA00000 |
| flash map | `flash_args`, `flasher_args.json` | what `idf.py flash` would write |
| config | `sdkconfig`, `dependencies.lock`, `xiaozhi-esp32.rev` | reproducibility |
| sizes | `size.txt`, `size-components.txt` | |

Phase-3 helpers (generated on the host from the backup, not from the device): `dist/phase3/`
- `otadata_select_ota1.bin` (8 KB) – sector 0 unchanged, sector 1 = `{seq=2, state=NEW, crc=…}` → boot **ota_1**. SHA `8ee76b96…765ddf`
- `otadata_sector1_select_ota1.bin` (4 KB, for `0xe000` only). SHA `3fea9220…5b379e`
- `otadata_device_original.bin` (8 KB, rollback = the backup's otadata). SHA `8ba3b110…4b91a3`
(CRC algorithm verified: reproduces the robot's existing entry `seq=1 state=VALID crc=0x4743989a` byte-for-byte.)

## Robot state (from the 2026-11-19 full-flash backup, read offline)

- otadata: sector 0 = `seq 1, state 0x2 (VALID)` → running **ota_0**; sector 1 erased.
- ota_0: `stack-chan` **1.5.1**, built Jul 31 2026 10:38, ESP-IDF **v5.5.4**.
- ota_1: **completely erased** (0xFF) → free for the new app.
- assets (0xA00000): 2,298,029 bytes, 42 files; same files as the 1.5.1 build's `generated_assets.bin` (only pack order differs). `srmodels.bin` = **wn9_histackchan_tts3**.

## Flash offsets Phase 3 would use (proposal, needs approval)

Use the **1.5.1-based** app. Re-read otadata first (the backup may be stale).

| Step | Offset | Data | Why |
|---|---|---|---|
| 1 | — | `esptool read-flash 0 0x1000000` + SHA-256 | fresh backup |
| 2 | `0x510000` | `dist/tutor-buddy-1.5.1/stack-chan.bin` | inactive slot **ota_1** (robot runs ota_0) |
| 3 | `0x510000` | read back `len(app)` and compare | verify |
| 4 | `0xe000` | `dist/phase3/otadata_sector1_select_ota1.bin` (4 KB) | select ota_1 with state NEW → bootloader marks PENDING_VERIFY |
| 5 | `0xd000` | read back 8 KB and compare | verify |

**Never write:** `0x0` bootloader, `0x8000` partition table, `0x9000` NVS, `0xA00000` assets, and **never run `idf.py flash`** (its `flash_args` writes bootloader + otadata_initial + **assets at 0xa00000** + app at 0x20000, i.e. overwrites the running slot and the assets).

Rollback: write `otadata_device_original.bin` at `0xd000` (or erase `0xe000` sector) → ota_0 (factory 1.5.1, untouched). Rollback is also **automatic**: `CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=y` is in the 1.5.1 defaults and the robot's bootloader matches the 1.5.1 build's bootloader except for its build date (Jul 21 2026), and xiaozhi only calls `MarkCurrentVersionValid()` after a successful OTA version check — so if the new app crashes/reboots before reaching our OTA server, the next boot returns to ota_0. (Side effect: if our OTA server (12802) is down at first boot, the new image is never confirmed and a later reset will also roll back.)

## Risks found

1. **1.5.1 → 1.6.2 is a big jump**, not a patch: ESP-IDF 5.5.4 → **6.1.0**, xiaozhi-esp32 2.2.4 → **2.5.2**, wake word **WN9 → WN9L** (`CONFIG_SR_WN_WN9_HISTACKCHAN_TTS3` → `…WN9L…`), new LAN/network setup + app-visibility toggles, font asset renamed (`font_puhui_common_20_4` → `font_noto_sans_common_20_4`). The robot's assets partition carries the WN9 model and the old font; the plan forbids writing assets. → 1.6.2 app on old assets = likely **no wake word**. Mitigation: ship the 1.5.1-based build (identical avatar API — upstream changed only 2 lines in the avatar core between 1.5.1 and 1.6.2; renders are pixel-identical).
2. **Bootloader vs 1.6.2**: robot bootloader = IDF 5.5.4 (≈ the 1.5.1 build's bootloader). Espressif guarantees old bootloaders boot newer-IDF apps (and AR2026-007 affects only C6/H2), so a 1.6.2 app *should* boot, but the 1.5.1 build avoids the question entirely.
3. **OTA auto-update**: on every AI-agent start xiaozhi `CheckNewVersion()` queries NVS `wifi/ota_url` (ours: 12802; compiled default `https://api.tenclass.net/xiaozhi/ota/` if the key were lost). If the response's `firmware.version` is newer than `PROJECT_VER` and has a URL, it **auto-downloads and flashes it** (no prompt). Setup → Firmware → *Check for Updates* uses the same URL. The skin builds keep `PROJECT_VER` (1.5.1 / 1.6.2), so our server must keep returning no newer firmware. Consider a distinct version string (open question).
4. **Assets auto-download**: NVS `assets/download_url` (settable via the OTA response / MCP) makes the app rewrite the assets partition on boot — make sure our server never sets it.
5. **Cloud defaults compiled in**: `CONFIG_STACKCHAN_SERVER_URL=http://47.113.125.164:12800` (M5 WS-avatar/app server) and the tenclass OTA URL are build defaults; our redirect lives only in NVS. A `sdkconfig.defaults.local` overlay (git-ignored, supported by `CMakeLists.txt`) could pin `CONFIG_OTA_URL` to 12802 as a belt-and-braces default — not done (would change behaviour).
6. 1.5.1 `Avatar` lacked a virtual destructor (upstream fixed in 1.6.2); backported on the 1.5.1 branch so skins are freed correctly.

### NVS keys read on boot (both bases)

| Namespace | Keys | Used by |
|---|---|---|
| `wifi` | SSID list, **`ota_url`** | esp-wifi-connect, xiaozhi OTA (must survive) |
| `websocket` / `mqtt` | `url`, `token`, `version` / `endpoint`, `client_id`, `username`, `password`, `keepalive`, `publish_topic` | written from the OTA response |
| `assets` | `download_url` | assets auto-download (risk 4) |
| `display` | `theme`, `brightness`, **`avatar_skin` (new)** | display, backlight, skin |
| `audio` | `output_volume` | codec |
| `xiaozhi` | AI-agent config (start on boot, idle movement level, …) | hal_bridge |
| `servo` | calibration | servos (must survive) |
| `warm_boot`, `system` (`tz`), `account`, `app_config` (`is_configed`, `app_setup`), `stackchan` (WS-avatar) | | HAL/apps |

Phase 1 adds exactly one key: **`display/avatar_skin`** = `"tutor_buddy"` (default when absent) | `"default"`. Nothing else is written unless the user changes it in Setup.

## What Phase 1 changed (firmware)

- `main/stackchan/avatar/skins/tutor_buddy/` — `tutor_buddy.{h,cpp}`, `eyes.cpp`, `mouth.cpp`, `tb_draw.h`: the 7 designs drawn with LVGL objects (eye whites with clipped pupils/highlights, brows, lower lids, cheeks, glasses, `^ ^` joy arcs; smile/oval/grin mouths; per-face accessories: stars, bulb, sound waves, confetti, stars, check, heart, retry arrow, pulsing thinking dots, thought bubbles, book, `abc`/`123`, warm glows). Blink (eye weight), lip-sync (mouth weight), breath/idle (position/rotation/size) all go through the existing `Feature` API. Face changes: 260 ms overshoot pop + 300 ms accessory fade.
- Emotion mapping = `faces.json`: Emotion enum → face (`Happy→you-got-it`, `Sad/Angry→almost`, `Doubt→thinking`, `Sleepy→reading`, `Neutral→ready`); plus the raw xiaozhi string in `StackChanAvatarDisplay::SetEmotion` (stock handling untouched, the skin refines afterwards: thinking/explaining/listening/reading/confused/…). While xiaozhi status is LISTENING the Listening face is shown.
- `skins/skins.{h,cpp}` factory + `hal/avatar_skin_setting.*` (NVS) used by the AI-agent display and Avatar/Dance/ESP-NOW/EzData apps; Wi-Fi setup screen unchanged.
- **Setup → Device → Face style** (Tutor Buddy / Classic) — the way back to the stock face; applied the next time a face is created.

## Visual evidence

`faces/tutor-buddy/firmware-preview/` (this repo): `compare-design-vs-firmware.png`, `contact-sheet.png`, per-face PNGs, blink / talk / listening / speech-bubble / idle / transition frames, stock reference. Rendered by `scripts/preview.sh`: the real skin sources + LVGL (9.5 on 1.6.2, 9.4 on 1.5.1 — outputs pixel-identical) configured from the device build's `CONFIG_LV_*`, RGB565, 320×240. Known deltas vs SVG: no −3° head tilt; ellipses are LVGL rounded rects; glows quantised by RGB565.

## Open questions

1. Approve basing Phase 3 on **1.5.1** (`tutor-buddy-skin-1.5.1`) instead of 1.6.2? (Recommended; 1.6.2 would also need the assets partition → violates the "never write assets" rule.)
2. Should the custom build report a distinct version (e.g. `1.5.1-tb1`) so our OTA server/bridge can detect it (Phase 2 "stop pushing preview_image")? Needs a check of xiaozhi's version comparison so the official 1.6.x is still not offered.
3. Keep the Listening-face-on-LISTENING-status behaviour, or drive faces from emotions only?
4. Add the optional Tutor Buddy boot/splash screen (plan item 4) — not done.
5. Pin `CONFIG_OTA_URL` to our server via `sdkconfig.defaults.local` as a fallback if NVS were ever lost?

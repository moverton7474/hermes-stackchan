# Firmware 1.5.1-tb2: root cause, changes, and flash plan

**Status:** built and bench-tested on the host only. **Not flashed.** Flashing needs Milton present, the robot on USB (COM3), and his explicit approval.
**Date:** 2026-11-21 · **Firmware repo:** `moverton7474/stackchan-firmware-visionary`, branch **`tutor-buddy-1.5.1-tb2`** (commit `22c6cdd`, based on tb1 `870eb95`)

## TL;DR

| | |
|---|---|
| App | `dist/tutor-buddy-1.5.1-tb2/stack-chan.bin`: **3,820,736 B** (0x3a4cc0). That is 73.8 % of the 0x4f0000 slot, with **1,356,608 B free** |
| SHA-256 | `4a93ac6b45dc4b271e51a4eb5a033d262d1d31ba6aa6b66d47c29ea85adfa334` |
| Version | `esp_app_desc` = `1.5.1-tb2`, IDF v5.5.4 |
| Unchanged vs tb1 | Partition table (`48da0866…1e1a4b`, same as the device), bootloader, assets (`0d701c78…`), Tutor Buddy skin, wake word (WN9 "Hi, Stack Chan"). The only sdkconfig differences are the new `CONFIG_TB2_*` lines |
| Recommended slot | **ota_1 (0x510000), overwriting tb1.** Factory 1.5.1 in ota_0 stays untouched as the rollback. tb1 can be re-flashed from `dist/tutor-buddy-1.5.1-tb1/` |
| Tests | Host unit test of the watchdog state machine: `firmware/tests/tb2_watchdog_test.cpp`, **3,900 checks pass** (g++ 13 with ASan/UBSan). Build has no new compiler warnings |
| Baseline serial log | 10 min passive capture with no reset. Uptime was 10.9 h, the robot was idle, and there were no AFE floods. Internal SRAM: about 27 KB free, minimum ever 9.3 KB. Encrypted: `backups/stackchan-serial-tb2-baseline-20261121-DELETE-AFTER-20261128.7z` |

## 1. Root cause (code evidence)

Paths: `xiaozhi-esp32` v2.2.4 (`e77dedb`) with our patch, and `firmware/main` from tb1. Line numbers are from tb1, before the tb2 changes.

### Audio input chain
`I2S → audio_input task (prio 8, core 0) → afe->feed() → [esp-sr ringbuffer] → audio_communication task fetch_with_delay(portMAX_DELAY) (prio 3) → output_callback → PushTaskToEncodeQueue → opus_codec task (prio 2) → audio_send_queue_ (max 40 = 2.4 s) → MAIN task pops + websocket send`

1. **The AFE fetch task can block forever on a full encode queue.** `audio/audio_service.cc:501`: `audio_queue_cv_.wait(...encode_queue.size() < 2)` has no timeout. It is called from `afe_audio_processor.cc:176/181` (`output_callback_`) inside the fetch loop (`:144`).
2. **The encode queue only drains while the send queue has room.** See `audio_service.cc:332/395` (`audio_send_queue_.size() < MAX_SEND_PACKETS_IN_QUEUE`).
3. **Only the main task drains the send queue.** See `application.cc:221-222` (`PopPacketFromSendQueue` → `protocol_->SendAudio`). The main task also runs:
   - every display call: 48 `display->` calls in `application.cc`, such as SetStatus/SetEmotion at each state change;
   - **every MCP tool call**: `mcp_server.cc:555` schedules all `tools/call` on the main task. That includes `self.camera.take_photo` (capture + HTTP upload, and it *lowers* main to priority 1, `mcp_server.cc:113`), `self.screen.preview_image` (HTTP download, `mcp_server.cc:252`), and `set_head_angles` (LVGL lock);
   - **all MCP replies**, including the `tools/list` reply. Replies go through `SendMcpMessage` → `Schedule`;
   - a **blocking** websocket send. `esp-ml307 esp_tcp.cc:117` uses plain `send()` with no `SO_SNDTIMEO`. If the bridge stops reading, `send()` blocks until lwIP gives up (minutes) or forever while the peer still ACKs with a zero window;
   - `WaitForPlaybackQueueEmpty()` with no timeout at listening start (`application.cc:890`).
4. **esp-sr feed does not block.** It logs `Ringbuffer of AFE(FEED) is full, Please use fetch() …` and drops audio. This string was checked in `libesp_audio_front_end.a`.

→ **Mechanism.** If the main task is busy for more than about 2.4 s while Listening, this happens: the send queue fills → opus stops → encode queue full → the AFE fetch task blocks → the ringbuffer fills → the "AFE(FEED) is full" flood starts and no audio reaches the bridge. Nothing in the audio path times out. The pipeline only resumes when the main task resumes.

This matches the recorded incident: the device connected, answered MCP `initialize`, then floods started and **`tools/list` timed out**. The `tools/list` reply can only leave via the main task, so the main task was blocked (see `iot-robot-bridge` rule 8). It also explains why a slow tool (camera) or a stalled socket triggers floods.

**"Deaf until reboot"** follows when the main task stays blocked:
- wake-word events (`MAIN_EVENT_WAKE_WORD_DETECTED`) are not processed;
- in Listening, WakeNet is disabled anyway (`CONFIG_WAKE_WORD_DETECTION_IN_LISTENING` is not set);
- the face keeps blinking because LVGL runs in other tasks, so the robot *looks* alive.

The only exits are the socket erroring out or a reboot. The 120 s `IsTimeout()` (`protocol.cc:82`) is only checked by the main task, so it cannot rescue it.

Secondary factors:
- `tcp_receive` runs at **priority 1** (`esp_tcp.cc:69`). It is the task that parses incoming JSON/MCP (`application.cc:568`), so it can be starved by priority-3 LVGL/AFE work.
- Internal SRAM minimum was 9.3 KB in the baseline.

### Display (LVGL) lock inventory: long holders
`lvgl_port_lock` is a recursive mutex. Note that `lvgl_port_lock(0)` means **wait forever**.

| Holder | Where | Hold time | Who waits |
|---|---|---|---|
| StackChan UI task: **sleeps 100 ms while holding the lock** whenever xiaozhi is not idle | `hal/hal.cpp:154-158` | ~100 ms of every ~120 ms during Listening/Speaking | main task (all display calls), LVGL render task |
| `DisplayLockGuard` | xiaozhi `display/display.h:67` | waits **up to 30 s** | main task (SetStatus/SetEmotion/SetChatMessage/ClearChatMessages/SetPreviewImage), esp_timer task (preview hide timer) |
| LVGL render (`lv_timer_handler`), including decoding encoded preview images (PNG/JPEG via `LvglAllocatedImage(data,size)`, which is decoded at draw time) | `esp_lvgl_port.c:226` | render + SPI flush. Hundreds of ms for a first decode of an encoded 320×240 preview | everyone |
| Skin face change (`TutorBuddyAvatar::setFaceFromString`), status modifiers | `stackchan_display.cc:325-389, 490-579` | short (object creation) | main task |
| MCP head/LED tools (`LvglLockGuard`) | `hal/hal_mcp.cpp:31,59,87` | short | main task |
| Preview hide timer callback calls `SetPreviewImage(nullptr)` on the **esp_timer task** | `stackchan_display.cc:170-181` | can block the esp_timer task for up to 30 s, which also delays the clock tick and audio power timers | — |

**Do audio tasks wait on the display lock?** Not directly: there are no display calls in `audio/` or `protocols/`, and the audio callbacks only set event bits. They wait **indirectly**, because their only consumer, the main task, does. The UI task's 100 ms sleep inside the lock is a continuous source of delay, and the 30 s guards are the worst case.

## 2. What tb2 changes (all Kconfig, defaults ON, under menu "Tutor Buddy reliability (tb2)")

| Kconfig (default) | Change | Files |
|---|---|---|
| `TB2_ENCODE_WAIT_MS=30` (0 = stock) | AFE output waits at most 30 ms for an encode slot, then drops the **oldest** queued frame (counted as `enc_drops`, logged at most every 5 s). The AFE keeps fetching, so the ringbuffer never overflows. No added latency | `audio_service.cc` (patch) |
| `TB2_AFE_WATCHDOG=y`, `TB2_AFE_STALL_MS=4000`, `TB2_AFE_MAX_RESETS=2` | 1 Hz esp_timer compares feed and fetch counters of the AFE(VC) and the wake-word AFE. "Fed but no frames for 4 s" escalates in three steps: (1) if blocked in the output callback, release backpressure; (2) otherwise **reset the AFE** with stop + `reset_buffer` + start, the same operation as every idle↔listening switch; (3) after 2 failed resets, **request a restart**. All are serialized with `Enable*()` through a new pipeline mutex and use try-lock (never block). | `tb_watchdog.h` (pure, unit-tested), `application.cc`, `audio_service.cc`, `afe_*.cc` (patch) |
| `TB2_MAIN_STALL_MS=15000`, `TB2_MAIN_STALL_RESTART_MS=120000` | Main-loop heartbeat. A main task busy for 15 s logs `main_loop_stall` and counts it. Busy for 120 s requests a restart. | `application.cc` |
| `TB2_RESTART_ON_STALL=y`, `TB2_RESTART_MIN_IDLE_S=30` | A requested restart runs **only when quiet-idle**: state Idle, no audio channel, audio queues empty, idle for at least 30 s. It runs on the main task, or from the watchdog timer if the main task is itself stuck *and* the state is Idle. Never mid-conversation. | `application.cc`, `tb_diag.cc` |
| `TB2_DISPLAY_NONBLOCKING=y`, `TB2_DISPLAY_LOCK_TIMEOUT_MS=30` | SetStatus/SetEmotion/SetChatMessage/ClearChatMessages/SetPreviewImage try the lock for 30 ms. If it is busy, the update is queued (max 24, in order) and applied by the UI task at its next cycle. The preview-hide timer no longer blocks the esp_timer task. | `stackchan_display.{h,cc}`, `hal_bridge.*`, `hal.cpp` |
| `TB2_UI_DELAY_OUTSIDE_LOCK=y` | The UI task sleeps its 100 ms *before* taking the LVGL lock. Same update rate, no lock held while sleeping. | `hal/hal.cpp` |
| `TB2_PREVIEW_JPEG_PREDECODE=y` | JPEG previews are decoded to RGB565 with `jpeg_to_image` before the lock is taken. PNG is unchanged, but the bridge no longer sends PNG face pop-ups (`STACKCHAN_TUTOR_FACES=false`). | `stackchan_display.cc` |
| `TB2_DAILY_RESTART=y`, hour `3`, min uptime 6 h, min idle 10 min, fallback 48 h | Maintenance restart at 03:00 **local time** (NVS `system/tz`) when idle and up for at least 6 h. If time is unknown, it restarts after 48 h of uptime instead. | `application.cc`, `tb_watchdog.h` |
| — | After any tb2 restart, a one-shot NVS flag (`tb2diag/boot_ai1`) makes the next boot go **straight into the AI agent**, even if "start AI agent on boot" is off. | `main.cpp`, `tb_diag.cc` |
| — | `PROJECT_VER 1.5.1-tb2`; `scripts/build.sh` now resets the fetched xiaozhi tree before applying the patch and fails if the patch is not applied. Before this, an updated patch was **silently skipped** on a reused build volume. | `CMakeLists.txt`, `scripts/build.sh` |

**Diagnostics.** Look for these in serial logs:
- `TB2: config: …` and `TB2 diag: vc_bp=… vc_stall=… ww_stall=… main_stall=… daily=… tb2_restarts=… last=<reason>@<uptime>s | live: enc_drops=… disp_deferred=… disp_dropped=… disp_max_wait=…ms jpeg_predecoded=…`. These print at boot and every 10 min.
- Counters persist in NVS namespace `tb2diag` (blob `ctr`). NVS writes are rate-limited to one per 60 s and never abort.
- Reason codes: 1 `vc_backpressure`, 2 `vc_fetch_stall`, 3 `ww_fetch_stall`, 4 `main_loop_stall`, 5 `daily_restart`, 6 `uptime_restart`.

**Runtime overrides.** NVS namespace `tb2cfg`, keys `wdt_en` (u8), `wdt_rst` (u8), `stall_ms` (i32), `daily_en` (u8), `daily_hr` (i32). There is no UI to set these yet. The practical switch is a Kconfig rebuild.

## 3. Slot decision

The robot runs tb1 in **ota_1**, with factory 1.5.1 in **ota_0** (rollback). Options:

- **A. tb2 → ota_1, overwriting tb1 (recommended).**
  - The factory image stays the rollback, and the otadata layout stays exactly as in the tb1 procedure.
  - Writing sector 1 = `{seq 2, NEW}` again gives automatic rollback to **factory** if tb2 crashes before it confirms itself (about 20 s, `hal.cpp _confirm_ota_image_if_stable`).
  - tb1 stays recoverable from `dist/tutor-buddy-1.5.1-tb1/stack-chan.bin` (sha256 `49f68a96…2d45c87`, 3,807,664 B) in about 1 min.
- B. tb2 → ota_0, keeping tb1 in ota_1: **rejected.** It destroys the factory image, the most trusted fallback, and the only one whose behaviour we did not write.
- C. Pointing otadata at ota_1 with a higher seq in sector 0: **rejected.** Rollback would then pick the other sector, which also points at ota_1 (the same image), so automatic rollback would not work.

## 4. Flash procedure (Milton present, robot idle on USB COM3)

```bash
PY=C:/Users/mover/AppData/Roaming/uv/tools/esptool/Scripts/python.exe
FW=C:/Users/mover/stackchan-firmware-visionary
TS=$(date +%Y%m%d_%H%M%S); BK=C:/Users/mover/hermes-stackchan/backups/stackchan_pre_tb2_$TS   # native paths only (not $TMPDIR)
mkdir -p $BK
# 0. Close every serial monitor on COM3. Verify the artifact:
sha256sum $FW/dist/tutor-buddy-1.5.1-tb2/stack-chan.bin   # must be 4a93ac6b45dc4b271e51a4eb5a033d262d1d31ba6aa6b66d47c29ea85adfa334

# 1. Fresh full backup (enters download mode; the chip stays there)
$PY -m esptool --chip esp32s3 -p COM3 -b 921600 --before default-reset --after no-reset read-flash 0 0x1000000 $BK/full_flash.bin
sha256sum $BK/full_flash.bin > $BK/full_flash.sha256
# 1a. Sanity checks on the dump (all must hold before writing anything):
python - "$BK/full_flash.bin" "$FW" <<'EOF'
import sys, struct, zlib, hashlib
d=open(sys.argv[1],'rb').read(); fw=sys.argv[2]
pt=open(fw+'/dist/tutor-buddy-1.5.1-tb2/partition_table/partition-table.bin','rb').read()
assert d[0x8000:0x8000+len(pt)]==pt, 'partition table differs from build!'
for off in (0xd000,0xe000):
    seq,=struct.unpack('<I',d[off:off+4]); st,crc=struct.unpack('<II',d[off+24:off+32])
    print(hex(off),'seq',seq,'state',st,'crc_ok',crc==zlib.crc32(struct.pack('<I',seq),0xffffffff))
tb1=open(fw+'/dist/tutor-buddy-1.5.1-tb1/stack-chan.bin','rb').read()
print('ota_1 == tb1:', d[0x510000:0x510000+len(tb1)]==tb1)
print('ota_0 version:', d[0x20000+0x30:0x20000+0x50].split(b'\0')[0])
EOF
# expected: table OK; 0xd000 seq 1 state 2; 0xe000 seq 2 state 2 crc_ok; ota_1 == tb1: True; ota_0 version b'1.5.1'
# 1b. Encrypt immediately, verify, delete the plaintext (it contains the Wi-Fi password)
7z a -t7z -mhe=on -p"$(cat ~/.secrets/stackchan-backup.key)" $BK.7z $BK/full_flash.bin $BK/full_flash.sha256
mkdir $BK/chk && 7z x -p"$(cat ~/.secrets/stackchan-backup.key)" -o$BK/chk $BK.7z && cmp $BK/full_flash.bin $BK/chk/full_flash.bin && rm -rf $BK

# 2. Write tb2 to ota_1 (esptool verifies the MD5 of the written region)
$PY -m esptool --chip esp32s3 -p COM3 -b 921600 --before no-reset --after no-reset write-flash 0x510000 $FW/dist/tutor-buddy-1.5.1-tb2/stack-chan.bin
# 3. Read back and compare
$PY -m esptool --chip esp32s3 -p COM3 -b 921600 --before no-reset --after no-reset read-flash 0x510000 3820736 C:/Users/mover/hermes-stackchan/backups/rb_tb2.bin
cmp C:/Users/mover/hermes-stackchan/backups/rb_tb2.bin $FW/dist/tutor-buddy-1.5.1-tb2/stack-chan.bin && echo APP_OK && rm C:/Users/mover/hermes-stackchan/backups/rb_tb2.bin
# 4. otadata sector 1 = {seq 2, state NEW} -> boot ota_1 with PENDING_VERIFY (auto-rollback to factory ota_0 on early crash)
$PY -m esptool --chip esp32s3 -p COM3 -b 921600 --before no-reset --after no-reset write-flash 0xe000 $FW/dist/phase3/otadata_sector1_select_ota1.bin   # sha256 3fea9220…5b379e
# 5. Read back otadata and check: 0xd000 seq1 state2 | 0xe000 seq2 state0 crc_ok
$PY -m esptool --chip esp32s3 -p COM3 -b 921600 --before no-reset --after no-reset read-flash 0xd000 0x2000 C:/Users/mover/hermes-stackchan/backups/rb_otadata.bin
# 6. Reset (an RTS pulse does NOT leave download mode on USB-Serial-JTAG)
$PY -m esptool --chip esp32s3 -p COM3 --before no-reset --after hard-reset chip-id
```
**Never write** 0x0 (bootloader), 0x8000 (partition table), 0x9000 (NVS), 0xA00000 (assets). **Never** run `idf.py flash`.

**Boot checks.** Use a passive serial capture: `dtr=False, rts=False` set before `open()`. Encrypt it afterwards if it contains speech. Expect:
- the app version is `1.5.1-tb2`;
- `TB2: config: afe_wdt=1 restart_on_stall=1 stall_ms=4000 … daily=1@03:00` and a `TB2 diag:` line;
- `ota confirm check: partition=ota_1 … marking current app valid` at about 20 s;
- Wi-Fi joins and the OTA URL is still 12802;
- the wakenet model `wn9_histackchan_tts3` loads;
- servo calibration is intact;
- `load timezone from nvs: <tz>`. **If it says `GMT0`, the 03:00 restart happens at 03:00 UTC = 22:00 EST.** Set the timezone in Setup, or accept this.

### Rollback
- **To factory 1.5.1 (ota_0):** `$PY -m esptool --chip esp32s3 -p COM3 --before default-reset --after no-reset write-flash 0xd000 $FW/dist/phase3/otadata_device_original.bin`, then the reset command from step 6. The file is 8 KB, sha256 `8ba3b110…4b91a3`, and restores seq 1 → ota_0.
- **Back to tb1:** repeat steps 2–6 with `dist/tutor-buddy-1.5.1-tb1/stack-chan.bin` (read back 3807664 bytes).
- **Automatic:** if tb2 crashes or reboots within its first ~20 s, the bootloader rolls back to ota_0 by itself.

## 5. Bench test (30 min, Milton present) + overnight soak

| # | Test | Pass criteria |
|---|---|---|
| 1 | Boot log (above) | All boot checks pass, `TB2 diag` counters all 0 (first boot) |
| 2 | Wake 10× with "Hi, Stack Chan" from about 1 m, with a short exchange each time | ≥ 9/10 wake; first bridge audio < 1 s after wake; no `AFE(FEED) is full`; `main_loop_stall` stays 0 |
| 3 | Say "goodbye" to end a session | Returns to Idle (face "ready", idle motion resumes); wakes again on the next "Hi, Stack Chan" |
| 4 | Camera: "what do you see?" (`take_photo`) | Shutter + preview appear; an answer arrives. `enc_drops` may rise during the upload (expected: audio is dropped instead of stalling); **no** ringbuffer flood; the next turn works |
| 5 | Barge-in while the robot talks; then say nothing for 30 s | No freeze; VAD ends the turn; the session ends normally |
| 6 | Bridge restart mid-session (stop/start the bridge service) | Device returns to Idle within ~2 min, then wakes normally. `main_loop_stall` may count 1 (expected); no crash loop |
| 7 | Face/emotion changes during speech (thinking/explaining/you-got-it) | Faces update; `disp_max_wait` < ~50 ms; `disp_dropped` = 0 |
| 8 | **Overnight idle soak** (≥ 8 h, include 03:00) | Next morning: wake works first try. The log shows `tb2: maintenance restart (daily_restart)` at about 03:0x local time, after which the robot is back **in the AI agent** (not the launcher). `TB2 diag` shows `tb2_restarts=1` and `ww_stall=0`. Any `vc_stall`/`ww_stall` > 0 is a finding: send the log |

Capture tests 2–8 with passive serial, and keep the bridge log. Both contain child speech: **encrypt** them into the `stackchan-debug-logs-…-DELETE-AFTER-…7z` archive and keep for 7 days at most.

## 6. Code review notes / what remains uncertain

- **Not proven on hardware.** The flood mechanism is established from code. The trigger in the recorded incident is inferred from `tools/list` timing out: the main task was blocked, but by *what* (socket send, display lock, or a tool) is not proven. tb2 logs `main_loop_stall` and `enc_drops`, which will tell.
- **The AFE reset is a "soft" reset:** stop + `reset_buffer` + start, which the stock firmware does at every idle↔listening switch. A hot destroy/recreate of the AFE was *deliberately not* done: the fetch task may be inside `fetch_with_delay` and there is no safe join (audit item 5). If the AFE itself wedges, recovery is the quiet-idle restart.
- **Restart only when quiet-idle (owner rule).** A main task that stays blocked *in Listening* (for example, a socket stuck forever with a peer that keeps ACKing) is logged but not restarted until the state returns to Idle. The bridge closing the socket ends that state. If bench tests show it can persist, consider allowing a restart in Listening after N minutes without VAD speech. That would be a policy decision for Milton.
- The **blocking websocket `send()`** without a timeout (esp-ml307) is unchanged. tb2 only makes the audio path survive it. A socket send timeout would be a separate, network-adjacent change (out of scope: no network changes).
- The **UI task now releases the lock while sleeping.** LVGL may render a little more often during conversations (core 1, priority 3). It is expected to be negligible but unmeasured; watch for choppy audio in test 5.
- **PNG previews** are still decoded inside the LVGL render.
- The **daily restart** depends on correct local time and TZ (see the boot checks). Without valid time it falls back to restarting after 48 h of uptime.
- Concurrency review:
  - the watchdog runs on the esp_timer task and uses only try-locks or brief locks;
  - lock order is pipeline mutex → audio queue mutex, and nothing takes them in reverse;
  - display ops capture copies (`std::string`, `shared_ptr` image holder);
  - the deferred queue is capped at 24 and drained under the LVGL lock;
  - RAM cost is +492 B static DIRAM plus small heap.
  - NVS: one small blob, rate-limited writes, errors tolerated (no `ESP_ERROR_CHECK`).

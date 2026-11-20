# StackChan 1.5.1 firmware — assets partition analysis (read-only)

Source: `backups/stackchan_20261119_203320/full_flash.bin`, read only. Nothing was written to the device.
I extracted the partitions to a scratch dir outside git (`%LOCALAPPDATA%\Temp\stackchan_assets\`):
`assets.bin` (0xa00000, 0x400000) and `app0.bin` (0x20000). The extracted binaries are **not** in git.

## 1. Partition table (from 0x8000)

| name | type/subtype | offset | size |
|---|---|---|---|
| nvs | data/nvs | 0x9000 | 0x4000 (servo calibration lives here, never touch) |
| otadata | data/ota | 0xd000 | 0x2000 |
| phy_init | data/phy | 0xf000 | 0x1000 |
| ota_0 | app/ota_0 | 0x20000 | 0x4f0000 |
| ota_1 | app/ota_1 | 0x510000 | 0x4f0000 |
| **assets** | data/0x82 | **0xa00000** | **0x400000 (4 MB)** |
| coredump | data/coredump | 0xe00000 | 0x10000 |

## 2. Assets format: xiaozhi "mmap assets" pack, index.json v1

All values are little-endian. I checked this format against the factory image: `pack_assets.py` unpacks
the image and repacks it to the **same bytes** as the factory used region (2,298,029 bytes). The other
1,896,275 bytes of the partition are erased flash (0xFF).

```
header : u32 file_count (=42) | u32 checksum (=0x44a3) | u32 combined_len (=0x2310a1)
table  : 42 x { char name[32]; u32 size; u32 offset; u16 width; u16 height }   (44 B each, w/h = 0)
data   : per file  0x5A 0x5A + raw bytes   (offset is relative to data start and points at the 0x5A5A magic)
checksum = sum(bytes of table+data) & 0xFFFF      combined_len = len(table+data)
```
Firmware strings match this format: `The asset %s is not valid with magic %02x%02x`, `The checksum calculation time is 133 ms`
(boot log), and `The assets version %d is not supported`.

### index.json (2,497 B)
```json
{ "version": 1, "srmodels": "srmodels.bin", "text_font": "font_puhui_common_20_4.bin",
  "emoji_collection": [ {"name": "confused", "file": "confused.png"}, ... 21 entries ... ],
  "extra_files": [ "setup_stackchan_front_view.bin", "icon_*.bin" (16 icons), "app_center_bg.png" ] }
```

### Files present (42)
| file | bytes | format |
|---|---|---|
| font_puhui_common_20_4.bin | 1,240,332 | LVGL binary font (UI text font) |
| srmodels.bin | 291,070 | ESP-SR model pack: **WakeNet9 `wn9_histackchan_tts3` ("Hi Stack-chan" wake word)** |
| icon_ai_agent / app_center / controller / dance / ezdata / sentinel / setup.bin | 84,612 each | LVGL v9 image (magic 0x19, cf 0x14), 188x150 |
| setup_stackchan_front_view.bin | 58,980 | LVGL v9 image 126x156 |
| icon_indicator_left/right.bin | 6,708 each | LVGL v9 image 36x62 |
| icon_home.bin 3,084 · icon_bell.bin 1,740 · icon_wifi_{high,medium,low,slash}.bin 1,212 each · icon_bat_lightning.bin 588 | | LVGL v9 images (32x32, 24x24, 20x20, 12x16) |
| app_center_bg.png | 29,218 | PNG 320x240 RGBA |
| index.json | 2,497 | manifest |
| **21 emoji PNGs**, 58,028 B total | | **PNG 64x64 RGBA** |

Emoji sizes (bytes): angry 2451, confident 2555, confused 2643, cool 2503, crying 3115, delicious 2669,
embarrassed 3385, funny 3615, happy 2123, kissy 3193, laughing 3097, loving 2546, neutral 1728, relaxed 2603,
sad 2402, shocked 3377, silly 2924, sleepy 3041, surprised 2493, thinking 2893, winking 2672.
These are exactly the 21 xiaozhi emotion names the bridge sends.

## 3. Does the StackChan face use EmojiCollection? **No. It draws the face in code.**

Evidence from `app0.bin` strings:
- The display class is `StackChanAvatarDisplay` (`./main/hal/board/stackchan_display.cc`). It creates a
  `stackchan::avatar::DefaultAvatar` with `DefaultEyes`, `DefaultMouth`, `DefaultSpeechBubble` and the
  decorators `HeartDecorator`, `ShyDecorator` and `DizzyDecorator`, plus `IdleMotionModifier` and `TimedEmotionModifier`.
- In the same module: `Unknown emotion: %s, using NEUTRAL`, with emotion strings such as `laughing`, `crying` and `doubtful`.
  The firmware maps each xiaozhi emotion name to an avatar Emotion enum. It does not load a PNG for it.
- `EmojiCollection`, `emoji_collection` and `Emoji %s image file %s is not found` come from the generic xiaozhi
  `Assets`/`LvglTheme` code that is linked into the binary. The 64x64 PNGs are parsed into the theme's collection.
  The StackChan avatar does not appear to display them.
- `StackChanAvatarDisplay::SetPreviewImage(std::unique_ptr<LvglImage>)` overrides the generic preview with
  `esp_timer_start_once(preview_timer_, 6000 * 1000)`. **A `self.screen.preview_image` picture is shown for about 6 s,
  then the procedural avatar returns.** `LODEPNG` is linked in, so PNG decoding works. JPEG decoding is also present.
- Other device MCP tools: `self.screen.set_theme` (light/dark), `self.screen.snapshot`, `self.assets.set_download_url`.
  The firmware also has a `WebSocketAvatar` service (`{}/stackChan/ws?deviceType=StackChan`). It is an M5 cloud
  avatar/remote-control channel, not an image API.

**Conclusion:** replacing `happy.png` and the other emoji files in the assets pack would almost certainly **not**
change the StackChan face. That face is drawn in code. Our faces can only reach the screen two ways:
(a) at runtime through `preview_image`, or (b) a modified firmware that renders full-screen images.

## 4. Options for showing the Tutor Buddy faces

### A. Runtime (no flashing, do this now). Agent C's bridge owns it.
- Serve `png/*.png` over HTTP from the bridge. For each tutor event, call `self.screen.preview_image` with `faces.json[emotion]`.
- **Re-push at least every ~5 s** while a state should persist. Otherwise the 6 s preview timer drops back to the
  procedural face. For idle, alternate `ready-to-learn.png` and `ready-to-learn-blink.png` (for example 4.5 s open, then 0.2 s blink).
- Each file is 2.7–7 KB of palette PNG (320x240 decodes to about 150 KB of RGB565), so repeated pushes over Wi-Fi are cheap.
- Risk: none to flash. Worst case, the stock avatar shows.

### B. Permanent: a custom assets pack plus a firmware change (later, staged)
A new assets pack on its own does not change the face (section 3). A permanent version needs both of these:
1. **Firmware:** rebuild the open-source M5Stack StackChan firmware with a small change in `StackChanAvatarDisplay::SetEmotion`.
   If the theme's `EmojiCollection` (or an `extra_files` entry `tb_<emotion>.png`) has a 320x240 image for the emotion,
   show it full-screen and skip the procedural avatar. Otherwise fall back to the current avatar. Ship it via the existing
   OTA URL redirect (BUILD-GUIDE). The second app slot is the rollback path: ota_0/ota_1 plus otadata.
2. **Assets:** build a pack that is the factory pack **unchanged** plus our PNGs added. Either add them as
   `extra_files` (`tb_*.png`) or replace the 21 emoji entries with 320x240 PNGs. Use `pack_assets.py`:
   ```
   python pack_assets.py unpack assets.bin work/     # from the backup extract, never from git
   # copy png/*.png -> work/tb_*.png, append names to order.txt and index.json "extra_files"
   python pack_assets.py pack work/ tutor_buddy_assets.bin     # prints checksum + index sanity check
   ```
   I tested this on scratch: factory pack plus 11 Tutor Buddy PNGs = 53 files, 2,345,690 B (about 56% of 4 MB), and it verifies OK.
3. **Delivery:** the firmware downloads assets itself. `self.assets.set_download_url(url)` stores the URL.
   On the next boot or check, `Application::CheckAssetsVersion` logs `Downloading new version of assets from %s`,
   erases only the sectors the new content needs, writes the pack, checks the size, and re-initialises the partition.
   Serve the `.bin` from the bridge with an exact `Content-Length`.

**Risks**
- `srmodels.bin` (the "Hi Stack-chan" wake word) and `font_puhui_common_20_4.bin` (all UI text) are in this same partition.
  A pack that drops or corrupts them, uses a bad checksum, or has a broken index.json causes errors like
  `Failed to load srmodels.bin` and `index.json is not valid`. **Wake word and on-screen text then stop working.**
  The device still boots and the app still runs. Mitigation: always start from the byte-identical factory pack,
  only *add* files, keep names ≤ 32 bytes, keep `version: 1`, and run `pack_assets.py verify` before serving.
- A download interrupted mid-write leaves the partition half-written. Assets are not A/B. The firmware
  re-downloads only if the URL setting is still set. Use a wired-power, good-Wi-Fi window.
- Changing the 21 emoji to 320x240 makes them larger in PSRAM. LVGL decodes PNGs into a 2 MB image cache,
  and 320x240 RGBA is about 300 KB per image, so 21 of them would thrash the cache. Prefer adding a few `tb_*.png`
  and decoding them on demand.
- `set_download_url` writes to NVS, which also holds the servo calibration. It is one setting key, not a raw NVS
  write, but it is still a device write. It needs explicit user sign-off, like every other device write.

**Rollback**
- Assets: re-flash only the assets region from the backup. Never re-flash the whole image, because that also
  restores old NVS. Extract the factory assets region from `full_flash.bin`
  (`dd if=full_flash.bin of=assets_factory.bin bs=1 skip=$((0xa00000)) count=$((0x400000))`, or the Python slice used here),
  check it with `pack_assets.py verify assets_factory.bin` (expect checksum 0x44a3), then run
  `esptool.py write_flash 0xa00000 assets_factory.bin`. An alternative with no cable: serve the factory pack (first 2,298,029 bytes) through `set_download_url`.
- Firmware: OTA back to stock 1.5.1, or flip otadata to the other slot. The full `full_flash.bin` stays the last-resort restore.

## 5. Recommendation
Ship **Option A** now: bridge-driven `preview_image` with a refresh every 5 s or less, plus the blink loop.
Treat **Option B** as a separate, user-approved firmware project. Modifying the assets pack alone is not worth the
wake-word and font risk, because the StackChan avatar ignores the emoji PNGs.

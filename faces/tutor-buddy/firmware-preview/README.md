# Firmware preview — `tutor_buddy` skin

Screenshots of the **real firmware skin code** (`stackchan-firmware-visionary`,
branch `tutor-buddy-skin`, `firmware/main/stackchan/avatar/skins/tutor_buddy/`)
rendered on the host with LVGL 9.5 using the device build's `CONFIG_LV_*` options
(RGB565, 320x240) — `scripts/preview.sh` / `firmware/tools/avatar_preview`.
No device was contacted.

- `compare-design-vs-firmware.png` — SVG design (left) vs firmware render (right), 7 faces
- `contact-sheet.png` — all frames
- `<face>.png` — the 7 faces at rest
- `ready-to-learn-blink.png` — BlinkModifier closed frame (eye weight 25)
- `explaining-talk-open/closed.png`, `you-got-it-talk.png` — lip-sync (mouth weight 70 / 15 / 60)
- `status-listening.png` — Listening face shown while xiaozhi status is LISTENING
- `ready-to-learn-speech.png` — speech bubble (stock bubble, cream/navy)
- `ready-to-learn-idle-glance.png` — IdleExpression offsets (eyes +20/-15, mouth tilt)
- `transition-80ms.png` — 80 ms into an emotion change (eye "pop")
- `stock-default-*.png` — stock skin rendered by the same harness, for reference

Known differences vs the SVGs: no -3° head tilt on Ready/Listening; ellipses are
LVGL rounded rects (near-identical at these sizes); glows are quantised by RGB565.

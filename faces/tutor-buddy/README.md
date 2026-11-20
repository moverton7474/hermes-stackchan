# Tutor Buddy robot faces (320x240, StackChan LCD)

- `png/*.png`: opaque palette PNGs at 1:1. They are the key frames of the 7 designs in `../tutor-buddy-faces-preview.html`,
  plus closed-eye `*-blink.png` frames for the idle blink: show `ready-to-learn` for about 4.5 s, then `ready-to-learn-blink` for 0.2 s.
- `faces.json`: map from emotion or state name to file. It covers every xiaozhi emotion, the aliases `listening`, `explaining`, `reading` and `blink`, and `default`.
  The design's 7th face, "Hmm, Let Me Think...", maps to `thinking`, which fits tool-running better than `explaining`.
  `sleepy` (wrap-up) maps to `reading-together`, the calm face with lowered eyes.
- `contact-sheet.png`: all faces, labelled.
- `render.py`: re-renders the PNGs with headless Chrome. `contact_sheet.py` rebuilds the sheet.
- `pack_assets.py` and `ASSETS-ANALYSIS.md`: offline analysis of the firmware assets partition. The stock StackChan
  avatar is drawn in code, so use `self.screen.preview_image` and re-push at least every 5 s, because previews time out after 6 s.

"""Render the Tutor Buddy SVG faces (../tutor-buddy-faces-preview.html) to 320x240 robot PNGs.

Usage:  python faces/tutor-buddy/render.py
Needs:  Google Chrome (headless) + Pillow. Writes png/*.png, faces.json is hand-maintained.
Animations are disabled so each PNG is the design's rest/key frame; a closed-eye
'-blink' frame is produced for faces with blinking eyes (idle 2-frame blink).
"""
import os, re, subprocess, sys, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "tutor-buddy-faces-preview.html")
OUT = os.path.join(HERE, "png")
CHROME = os.environ.get("CHROME", r"C:/Program Files/Google/Chrome/Application/chrome.exe")
TMP = os.environ.get("TMPDIR") or tempfile.gettempdir()

NAMES = {  # design label -> file stem
    "Ready to Learn!": "ready-to-learn",
    "Explaining": "explaining",
    "Listening": "listening",
    "You Got It!": "you-got-it",
    "Almost! Try Again": "almost-try-again",
    "Hmm, Let Me Think...": "thinking",
    "Reading Together": "reading-together",
}
BLINK = {"ready-to-learn", "listening", "explaining", "reading-together"}

BASE_CSS = "html,body{margin:0;padding:0;background:#0B1120;overflow:hidden}svg{display:block;width:320px;height:240px}*{animation:none!important}"
BLINK_CSS = ".blink{transform-box:fill-box;transform-origin:50% 55%;transform:scaleY(0.08)}"


def render(svg, stem, extra_css=""):
    html = f"<!DOCTYPE html><html><head><meta charset='utf-8'><style>{BASE_CSS}{extra_css}</style></head><body>{svg}</body></html>"
    hp = os.path.join(TMP, f"tb_{stem}.html")
    raw = os.path.join(TMP, f"tb_{stem}_raw.png")
    with open(hp, "w", encoding="utf-8") as f:
        f.write(html)
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--force-device-scale-factor=1", "--default-background-color=0B1120FF",
                    f"--screenshot={raw}", "--window-size=320,240",
                    "file:///" + hp.replace("\\", "/")], check=True, capture_output=True)
    im = Image.open(raw).convert("RGB")
    assert im.size == (320, 240), im.size
    # Palette PNG (256 colours, no dither): keeps the faint glows/cheeks smooth and stays well under 40KB.
    pal = im.quantize(colors=256, method=Image.Quantize.MAXCOVERAGE, dither=Image.Dither.NONE)
    dst = os.path.join(OUT, stem + ".png")
    pal.save(dst, optimize=True)
    print(f"{stem}.png {os.path.getsize(dst)} bytes")


def main():
    os.makedirs(OUT, exist_ok=True)
    src = open(SRC, encoding="utf-8").read()
    cards = re.findall(r'<div class="face-label">(.*?)</div>.*?(<svg.*?</svg>)', src, re.S)
    assert len(cards) == 7, len(cards)
    for label, svg in cards:
        stem = NAMES[label]
        render(svg, stem)
        if stem in BLINK:
            render(svg, stem + "-blink", BLINK_CSS)


if __name__ == "__main__":
    sys.exit(main())

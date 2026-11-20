"""Build contact-sheet.png from png/*.png (labelled grid). Usage: python faces/tutor-buddy/contact_sheet.py"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FACES = ["ready-to-learn", "ready-to-learn-blink", "explaining", "thinking", "listening",
         "you-got-it", "almost-try-again", "reading-together"]
COLS, W, H, PAD, LAB = 4, 320, 240, 16, 26
rows = (len(FACES) + COLS - 1) // COLS
sheet = Image.new("RGB", (COLS * (W + PAD) + PAD, rows * (H + LAB + PAD) + PAD + 36), "#0a0a1a")
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 15)
    title = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 20)
except OSError:
    font = title = ImageFont.load_default()
d.text((PAD, 8), "Tutor Buddy robot faces - 320x240 (1:1)", fill="#D4A843", font=title)
for i, stem in enumerate(FACES):
    r, c = divmod(i, COLS)
    x, y = PAD + c * (W + PAD), 44 + r * (H + LAB + PAD)
    d.text((x, y), f"{stem}.png", fill="#D4A843", font=font)
    sheet.paste(Image.open(os.path.join(HERE, "png", stem + ".png")).convert("RGB"), (x, y + LAB))
    d.rectangle([x - 1, y + LAB - 1, x + W, y + LAB + H], outline="#1a2a40")
out = os.path.join(HERE, "contact-sheet.png")
sheet.quantize(colors=128, dither=Image.Dither.NONE).save(out, optimize=True)
print(out, os.path.getsize(out))

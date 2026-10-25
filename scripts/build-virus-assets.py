"""Crop the AI-painted purple virus, preserving native alpha; never draw art."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = Image.open(ROOT / "docs/virus-concepts-v1.png").convert("RGBA")
candidate = source.crop((0, 200, 535, 780))
# Ignore invisible pixels when finding the crop; retain the original alpha.
bounds = candidate.getchannel("A").point(lambda value: 255 if value > 64 else 0).getbbox()
if bounds is None:
    raise RuntimeError("The source candidate has no visible alpha.")
left, top, right, bottom = bounds
sprite = candidate.crop((max(0, left - 3), max(0, top - 3), min(candidate.width, right + 3), min(candidate.height, bottom + 3)))
canvas = Image.new("RGBA", (max(sprite.size) + 8,) * 2)
canvas.alpha_composite(sprite, ((canvas.width - sprite.width) // 2, (canvas.height - sprite.height) // 2))
canvas = canvas.resize((512, 512), Image.Resampling.LANCZOS)
target = ROOT / "assets/virus-purple-v1.png"
canvas.save(target)
print(f"Saved {target.name}: {canvas.size}, {canvas.mode}, alpha {canvas.getchannel('A').getextrema()}")

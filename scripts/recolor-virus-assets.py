"""Recolor existing virus illustrations without changing their shapes or alpha."""

from colorsys import hls_to_rgb, rgb_to_hls
from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1] / "assets"
SOURCES = {
    "small": "virus-small-v4.png",
    "medium": "virus-medium-v4.png",
    "large": "virus-purple-v1.png",
    "super": "virus-super-v2.png",
}
HUES = {"sky": 205 / 360, "mint": 155 / 360, "coral": 10 / 360}


def recolor(image: Image.Image, target_hue: float) -> Image.Image:
    output = []
    for red, green, blue, alpha in image.getdata():
        if alpha == 0:
            output.append((0, 0, 0, 0))
            continue
        hue, lightness, saturation = rgb_to_hls(red / 255, green / 255, blue / 255)
        if 0.60 <= hue <= 0.96 and saturation >= 0.08:
            variation = ((hue - 0.76 + 0.5) % 1) - 0.5
            red, green, blue = (
                round(channel * 255)
                for channel in hls_to_rgb((target_hue + variation * 0.25) % 1,
                                          lightness, saturation * 0.94)
            )
        output.append((red, green, blue, alpha))
    result = Image.new("RGBA", image.size)
    result.putdata(output)
    return result


for tier, filename in SOURCES.items():
    source = Image.open(ROOT / filename).convert("RGBA")
    for color, hue in HUES.items():
        target = ROOT / f"virus-{tier}-{color}-v1.png"
        recolor(source, hue).save(target, optimize=True)
        print(f"{target.name}: {source.size}")

preview = Image.new("RGB", (880, 940), "#e6f1ee")
draw = ImageDraw.Draw(preview)
for row, (tier, filename) in enumerate(SOURCES.items()):
    for column, color in enumerate(("violet", *HUES)):
        path = ROOT / (filename if color == "violet" else f"virus-{tier}-{color}-v1.png")
        thumb = Image.open(path).convert("RGBA")
        thumb.thumbnail((190, 190), Image.Resampling.LANCZOS)
        x, y = column * 220 + (220 - thumb.width) // 2, row * 235 + 8
        preview.paste(thumb, (x, y), thumb)
        draw.text((column * 220 + 16, row * 235 + 205), f"{tier} / {color}", fill="#2b5055")
preview.save(ROOT.parent / "docs/virus-palette-preview-v1.png", optimize=True)

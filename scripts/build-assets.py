"""Assemble existing raster artwork into reusable sprites; never draw character art."""
from pathlib import Path
from PIL import Image
import argparse
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets"


def build_head(source):
    parts = [
        ("Part_06.png", 752, -709.5, 1120, 1235),
        ("Part_05.png", 2117.5, -808, 1029, 1298),
        ("Part_02.png", 1497.5, -918, 1281, 1266),
        ("Part_01.png", 1583.5, -950, 381, 470),
    ]
    stored = OUT / "source" / "flystar"
    stored.mkdir(parents=True, exist_ok=True)
    canvas = Image.new("RGBA", (2900, 1800), (0, 0, 0, 0))
    for filename, x, y, width, height in parts:
        original = source / filename
        destination = stored / filename
        if original.resolve() != destination.resolve():
            shutil.copyfile(original, destination)
        with Image.open(original) as part:
            resized = part.convert("RGBA").resize((width, height), Image.Resampling.LANCZOS)
        canvas.alpha_composite(resized, (round(x - width / 2), round(-y - height / 2)))
    box = canvas.getchannel("A").getbbox()
    crop = canvas.crop(box)
    scale = 512 / crop.width
    image = crop.resize((512, round(crop.height * scale)), Image.Resampling.LANCZOS)
    padded = Image.new("RGBA", (image.width + 20, image.height + 20), (0, 0, 0, 0))
    padded.alpha_composite(image, (10, 10))
    padded.save(OUT / "flystar-head-v1.png")
    anchor = {"x": round((1497.5 - box[0]) * scale + 10, 3),
              "y": round((918 - box[1]) * scale + 10, 3)}
    return {"width": padded.width, "height": padded.height, "anchor": anchor,
            "source": "Original Flying Star raster layers; boot layers Part_03/04 omitted."}


def build_segment(source):
    image = Image.open(source).convert("RGBA")
    # Preserve native alpha when supplied. Otherwise remove the flat magenta backdrop.
    alpha = image.getchannel("A")
    corners = [image.getpixel((x, y)) for x, y in [(0, 0), (image.width-1, 0), (0, image.height-1)]]
    if all(pixel[3] < 12 for pixel in corners) and alpha.getextrema()[0] < 12:
        alpha = alpha.point(lambda value: 0 if value < 5 else (255 if value > 250 else value))
        image.putalpha(alpha)
    else:
        keyed = []
        for r, g, b, a in image.getdata():
            distance = max(abs(r - 255), abs(g), abs(b - 255))
            opacity = max(0, min(1, (distance - 24) / 42))
            if b > g + 20 and r > g + 24:
                opacity = 0
            keyed.append((r, g, b, round(a * opacity)))
        image.putdata(keyed)
    box = image.getchannel("A").point(lambda value: 255 if value > 24 else 0).getbbox()
    if not box:
        raise ValueError("Segment extraction produced no visible pixels.")
    image = image.crop(box)
    image.thumbnail((480, 480), Image.Resampling.LANCZOS)
    sprite = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    sprite.alpha_composite(image, ((512-image.width)//2, (512-image.height)//2))
    sprite.save(OUT / "hanzi-segment-v1.png")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--flystar-source", type=Path, default=OUT / "source" / "flystar")
    parser.add_argument("--segment-source", type=Path)
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)
    metadata = {"head": build_head(args.flystar_source), "segment": {"width": 512, "height": 512}}
    if args.segment_source:
        build_segment(args.segment_source)
    (OUT / "sprites.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    meadow = ROOT / "output" / "imagegen" / "snake-art-pilot-20261020" / "meadow-level-v1.png"
    if meadow.exists():
        Image.open(meadow).convert("RGB").save(OUT / "meadow-v1.jpg", quality=90)
    print(json.dumps(metadata, ensure_ascii=False))

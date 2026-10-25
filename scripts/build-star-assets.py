"""Prepare existing star artwork and repeatable imagegen floor for runtime."""
from pathlib import Path
from PIL import Image, ImageOps
import shutil

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"

star = Image.open(ASSETS / "source/flystar/Part_02.png").convert("RGBA")
star = star.crop(star.getchannel("A").getbbox())
star.thumbnail((488, 488), Image.Resampling.LANCZOS)
sprite = Image.new("RGBA", (512, 512))
sprite.alpha_composite(star, ((512-star.width)//2, (512-star.height)//2))
sprite.save(ASSETS / "hanzi-star-v2.png")

source = ASSETS / "source/arena-floor-v2.png"
if not source.exists():
    shutil.copyfile(ROOT / "output/imagegen/runtime-assets/arena-floor-source-v2.png", source)
floor = Image.open(source).convert("RGB").resize((768, 768), Image.Resampling.LANCZOS)
# Mirrored neighbours share exact edge pixels, including at negative world coordinates.
repeat = Image.new("RGB", (1536, 1536))
repeat.paste(floor, (0, 0))
repeat.paste(ImageOps.mirror(floor), (768, 0))
repeat.paste(ImageOps.flip(floor), (0, 768))
repeat.paste(ImageOps.flip(ImageOps.mirror(floor)), (768, 768))
repeat.save(ASSETS / "arena-floor-v2.jpg", quality=92)
print("Built transparent star body and seamless mirrored floor.")

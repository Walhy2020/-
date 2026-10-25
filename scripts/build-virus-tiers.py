"""Split three AI-painted, native-alpha sprites by their connected silhouettes."""
from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = Image.open(ROOT / "assets/source/virus-tiers-v2.png").convert("RGBA")
width, height = source.size
mask = bytearray(source.getchannel("A").point(lambda value: 1 if value > 64 else 0).tobytes())
components = []
for seed in range(len(mask)):
    if not mask[seed]:
        continue
    queue = deque([seed])
    mask[seed] = 0
    left = right = seed % width
    top = bottom = seed // width
    count = 0
    while queue:
        index = queue.popleft()
        x, y = index % width, index // width
        left, right, top, bottom = min(left, x), max(right, x), min(top, y), max(bottom, y)
        count += 1
        for neighbor in (index - width if y else -1, index + width if y + 1 < height else -1,
                         index - 1 if x else -1, index + 1 if x + 1 < width else -1):
            if neighbor >= 0 and mask[neighbor]:
                mask[neighbor] = 0
                queue.append(neighbor)
    if count > 5000:
        components.append((left, top, right + 1, bottom + 1))
if len(components) != 3:
    raise RuntimeError(f"Expected three sprites, found {components}")
for name, bounds in zip(("small", "medium", "super"), sorted(components)):
    left, top, right, bottom = bounds
    sprite = source.crop((max(0, left - 3), max(0, top - 3), min(width, right + 3), min(height, bottom + 3)))
    canvas = Image.new("RGBA", (max(sprite.size) + 8,) * 2)
    canvas.alpha_composite(sprite, ((canvas.width - sprite.width) // 2, (canvas.height - sprite.height) // 2))
    canvas = canvas.resize((512, 512), Image.Resampling.LANCZOS)
    target = ROOT / f"assets/virus-{name}-v2.png"
    canvas.save(target)
    print(f"{target.name}: source {bounds}; alpha {canvas.getchannel('A').getextrema()}")

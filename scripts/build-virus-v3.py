"""Prepare AI-edited virus sprites: retain their art, remove stray alpha specks, resize."""
from collections import deque
from pathlib import Path
import sys
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SIZE = 512
ALPHA_FLOOR = 48
VERSION = sys.argv[1] if len(sys.argv) == 2 else "v3"


def clean_sprite(source: Path, target: Path) -> None:
    image = Image.open(source).convert("RGBA").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    alpha = bytearray(image.getchannel("A").tobytes())
    center = (SIZE // 2) * SIZE + SIZE // 2
    if alpha[center] <= ALPHA_FLOOR:
        raise ValueError(f"Expected the virus body at the center of {source}")

    connected = bytearray(SIZE * SIZE)
    connected[center] = 1
    queue = deque([center])
    while queue:
        index = queue.popleft()
        x, y = index % SIZE, index // SIZE
        for neighbor in (index - SIZE if y else -1, index + SIZE if y + 1 < SIZE else -1,
                         index - 1 if x else -1, index + 1 if x + 1 < SIZE else -1):
            if neighbor >= 0 and alpha[neighbor] > ALPHA_FLOOR and not connected[neighbor]:
                connected[neighbor] = 1
                queue.append(neighbor)

    # Keep the original soft edge within two pixels of the solid connected art.
    edge = Image.frombytes("L", (SIZE, SIZE), bytes(255 if value else 0 for value in connected))
    edge = edge.filter(ImageFilter.MaxFilter(5))
    edge_bytes = edge.tobytes()
    for index in range(len(alpha)):
        if not edge_bytes[index]:
            alpha[index] = 0
    image.putalpha(Image.frombytes("L", (SIZE, SIZE), bytes(alpha)))
    pixels = bytearray(image.tobytes())
    for index, opacity in enumerate(alpha):
        if opacity == 0:
            pixels[index * 4:index * 4 + 3] = b"\0\0\0"
    image = Image.frombytes("RGBA", (SIZE, SIZE), bytes(pixels))
    image.save(target, optimize=True)
    print(f"{target.name}: {image.size}, alpha range {image.getchannel('A').getextrema()}")


for tier in ("small", "medium"):
    clean_sprite(ROOT / f"assets/source/virus-{tier}-{VERSION}.png",
                 ROOT / f"assets/virus-{tier}-{VERSION}.png")

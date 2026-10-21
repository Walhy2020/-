const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Sample a head-first polyline by distance, independent of frame rate. */
export function samplePath(points, offsets) {
  if (!points.length) return [];
  let index = 0;
  let travelled = 0;
  return offsets.map((offset) => {
    const wanted = Math.max(0, offset);
    while (index < points.length - 1) {
      const length = distance(points[index], points[index + 1]);
      if (length > 1e-8 && travelled + length >= wanted) {
        const fraction = (wanted - travelled) / length;
        return {
          x: points[index].x + (points[index + 1].x - points[index].x) * fraction,
          y: points[index].y + (points[index + 1].y - points[index].y) * fraction,
        };
      }
      travelled += length;
      index += 1;
    }
    return { ...points.at(-1) };
  });
}

export class GlyphTrail {
  constructor({ spacing = 37, leadGap = 61, glyphs = [] } = {}) {
    this.spacing = spacing;
    this.leadGap = leadGap;
    this.glyphs = [...glyphs];
    this.points = [];
  }

  reset(points, glyphs = this.glyphs) {
    if (!points.length) throw new Error("A trail needs a head position.");
    this.points = points.map((point) => ({ ...point }));
    this.glyphs = [...glyphs];
    this.trim();
  }

  moveTo(point) {
    if (!this.points.length) this.points.push({ ...point });
    else if (distance(this.points[0], point) > 1e-7) this.points.unshift({ ...point });
    this.trim();
  }

  grow(glyph) {
    if (typeof glyph !== "string" || [...glyph].length !== 1) {
      throw new Error("Each segment holds exactly one character.");
    }
    this.glyphs.push(glyph);
  }

  positions() {
    const offsets = this.glyphs.map((_, i) => this.leadGap + i * this.spacing);
    return samplePath(this.points, offsets).map((point, i) => ({ ...point, glyph: this.glyphs[i] }));
  }

  neck() {
    return samplePath(this.points, [this.leadGap / 2])[0];
  }

  trim() {
    const limit = this.leadGap + (this.glyphs.length + 12) * this.spacing;
    let travelled = 0;
    for (let i = 1; i < this.points.length; i += 1) {
      travelled += distance(this.points[i - 1], this.points[i]);
      if (travelled >= limit) {
        this.points.length = i + 1;
        return;
      }
    }
  }
}

export function turnTowards(current, target, maxTurn) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + Math.max(-maxTurn, Math.min(maxTurn, delta));
}

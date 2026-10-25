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

  shrink(count) {
    const lost = Math.min(this.glyphs.length, Math.max(0, Math.floor(count)));
    this.glyphs.splice(this.glyphs.length - lost, lost);
    this.trim();
    return lost;
  }

  setLayout(spacing, leadGap) {
    this.spacing = spacing;
    this.leadGap = leadGap;
    if (this.points.length < 2) return;
    let length = 0;
    for (let i = 1; i < this.points.length; i++) length += distance(this.points[i - 1], this.points[i]);
    const required = leadGap + (this.glyphs.length + 12) * spacing;
    if (length < required) {
      const end = this.points.at(-1), before = this.points.at(-2);
      const direction = Math.atan2(end.y - before.y, end.x - before.x);
      this.points.push({ x: end.x + Math.cos(direction) * (required - length),
        y: end.y + Math.sin(direction) * (required - length) });
    }
    this.trim();
  }

  positions(lag = 0) {
    const offsets = this.glyphs.map((_, i) => lag + this.leadGap + i * this.spacing);
    return samplePath(this.points, offsets).map((point, i) => ({ ...point, glyph: this.glyphs[i] }));
  }

  neck(lag = 0) {
    return samplePath(this.points, [lag + this.leadGap / 2])[0];
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

export const VIRUS_TYPES = Object.freeze([
  Object.freeze({ tier: "small", label: "小病毒", size: 52, valueKey: "smallVirusValue", asset: "virusSmall" }),
  Object.freeze({ tier: "medium", label: "中病毒", size: 84, valueKey: "mediumVirusValue", asset: "virusMedium" }),
  Object.freeze({ tier: "large", label: "大病毒", size: 144, valueKey: "largeVirusValue" }),
  Object.freeze({ tier: "super", label: "超级病毒", size: 288, valueKey: "superVirusValue", asset: "virusSuper", encircle: true }),
]);

/** Growth and literacy rewards are independent; excess growth is never discarded. */
export class RunRewards {
  constructor(threshold = 10) { this.reset(threshold); }

  reset(threshold = this.threshold) {
    this.threshold = Math.max(1, Math.round(threshold));
    this.growthPoints = 0;
    this.stars = 0;
    this.glyphs = new Set();
  }

  setThreshold(value) {
    this.threshold = Math.max(1, Math.round(value));
    return this.addGrowth(0);
  }

  addGrowth(value) {
    if (!Number.isFinite(value) || value < 0) throw new Error("Growth must be a non-negative finite number.");
    const total = this.growthPoints + Math.round(value);
    const segments = Math.floor(total / this.threshold);
    this.growthPoints = total % this.threshold;
    return segments;
  }

  collectGlyph(glyph) {
    this.stars += 1;
    this.glyphs.add(glyph);
  }
}

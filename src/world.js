import { makeRandom, randomSeed } from "./random.js";
import { VIRUS_TYPES } from "./rewards.js";

const CELL = 310;
export const VIRUS_COLORS = Object.freeze(["violet", "sky", "mint", "coral"]);
const VIRUS_RADII = Object.fromEntries(VIRUS_TYPES.map(type => [type.tier, type.size / 2]));
export let WORLD_BOUNDS = Object.freeze({ minX: -6400, minY: -6400, maxX: 6400, maxY: 6400, size: 12800 });
export function setWorldSize(size) {
  if (!Number.isFinite(size) || size < 3200 || size > 25600) throw new RangeError("Invalid map size");
  const half = size / 2;
  WORLD_BOUNDS = Object.freeze({ minX: -half, minY: -half, maxX: half, maxY: half, size });
  return WORLD_BOUNDS;
}
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function random(x, y, salt) {
  let hash = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(y ^ salt, 0xc2b2ae35);
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  return ((hash ^ (hash >>> 15)) >>> 0) / 4294967296;
}

/** Stream nearby cells inside a large square; there is no small local arena. */
export class FoodField {
  constructor(glyphs) {
    this.glyphs = glyphs;
    this.cells = new Map();
  }

  sync(position, radius = 850) {
    const minX = Math.floor((position.x - radius) / CELL);
    const maxX = Math.floor((position.x + radius) / CELL);
    const minY = Math.floor((position.y - radius) / CELL);
    const maxY = Math.floor((position.y + radius) / CELL);
    const keep = new Set();
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
      const key = `${x},${y}`;
      keep.add(key);
      if (!this.cells.has(key)) this.cells.set(key, this.createCell(x, y, key)
        .filter((food) => (food.homeX ?? food.x) > WORLD_BOUNDS.minX + 100 && (food.homeX ?? food.x) < WORLD_BOUNDS.maxX - 100
        && (food.homeY ?? food.y) > WORLD_BOUNDS.minY + 100 && (food.homeY ?? food.y) < WORLD_BOUNDS.maxY - 100));
    }
    for (const key of this.cells.keys()) if (!keep.has(key)) this.cells.delete(key);
  }

  createCell(x, y, key) {
    return [0, 1].map((index) => ({
        id: `${key}:${index}`,
        x: x * CELL + (index === 0 ? 55 : 200) + random(x, y, index + 1) * 45,
        y: y * CELL + (index === 0 ? 70 : 205) + random(x, y, index + 7) * 45,
        glyph: this.glyphs[Math.floor(random(x, y, index + 21) * this.glyphs.length)],
        consumed: false,
      }));
  }

  nearby() { return [...this.cells.values()].flat().filter((food) => !food.consumed); }

  consume(id) {
    for (const foods of this.cells.values()) {
      const food = foods.find((item) => item.id === id);
      if (food) { food.consumed = true; return; }
    }
  }
}

export class VirusField extends FoodField {
  constructor({ seed = randomSeed() } = {}) {
    super([]);
    this.seed = seed;
    this.animationTime = 0;
    this.drops = [];
    this.dropSerial = 0;
    this.center = { x: 0, y: 0 };
    this.viewRadius = 850;
  }

  reset(seed = randomSeed()) {
    this.seed = seed;
    this.cells.clear();
    this.animationTime = 0;
    this.drops = [];
    this.dropSerial = 0;
  }

  makeAnimated(virus, rand, dropped = false) {
    virus.homeX = virus.x;
    virus.homeY = virus.y;
    virus.color = VIRUS_COLORS[Math.floor(rand() * VIRUS_COLORS.length)];
    virus.swayPhase = rand() * Math.PI * 2;
    virus.swayRate = (virus.tier === "super" ? 0.45 + rand() * 0.45 : 0.75 + rand() * 0.9) * (dropped ? 0.85 : 1);
    virus.swayAmplitude = virus.tier === "super" ? 0.07 + rand() * 0.06 : 0.13 + rand() * 0.13;
    virus.pulsePhase = rand() * Math.PI * 2;
    virus.pulseRate = 0.55 + rand() * 0.7;
    return virus;
  }

  pose(virus) {
    const time = this.animationTime;
    const swing = Math.sin(virus.swayPhase + time * virus.swayRate);
    const secondary = Math.sin(virus.swayPhase * 1.7 + time * virus.swayRate * 0.43);
    return {
      rotation: virus.swayAmplitude * (swing + secondary * 0.22),
      scale: 1 + 0.035 * Math.sin(virus.pulsePhase + time * virus.pulseRate),
    };
  }

  advance(dt, speed) {
    if (!(dt > 0) || !(speed > 0)) return;
    this.animationTime += dt * speed / 22;
  }

  sync(position, radius = 850) {
    this.center = { ...position };
    this.viewRadius = radius;
    super.sync(position, radius);
  }

  spill(position, snakeLength) {
    const rand = makeRandom((this.seed ^ Math.imul(++this.dropSerial, 0x9e3779b9)) >>> 0);
    const count = Math.min(10, Math.max(6, Math.ceil(snakeLength * 0.7)));
    const angle = rand() * Math.PI * 2;
    const pile = Array.from({ length: count }, (_, index) => {
      const radius = index === 0 ? 0 : 48 + (index % 3) * 17;
      const direction = angle + index * 2.399963229728653;
      const tier = index === 0 ? "large" : index % 3 === 0 ? "medium" : "small";
      return this.makeAnimated({
        id: `drop:${this.dropSerial}:${index}`, kind: "virus", tier,
        x: clamp(position.x + Math.cos(direction) * radius, WORLD_BOUNDS.minX + 100, WORLD_BOUNDS.maxX - 100),
        y: clamp(position.y + Math.sin(direction) * radius, WORLD_BOUNDS.minY + 100, WORLD_BOUNDS.maxY - 100),
        consumed: false,
      }, rand, true);
    });
    this.drops.push(...pile);
    if (this.drops.length > 100) this.drops.splice(0, this.drops.length - 100);
    return pile;
  }

  nearby() {
    return [...super.nearby(), ...this.drops.filter(virus => !virus.consumed
      && Math.hypot(virus.x - this.center.x, virus.y - this.center.y) < this.viewRadius + 100)];
  }

  consume(id) {
    const drop = this.drops.find(virus => virus.id === id);
    if (drop) { drop.consumed = true; return; }
    super.consume(id);
  }

  createCell(x, y, key) {
    const rand = makeRandom((this.seed ^ Math.imul(x, 0x85ebca6b) ^ Math.imul(y, 0xc2b2ae35)) >>> 0);
    // Independent full-cell jitter, varied density, occasional gaps and clusters.
    const candidateBoss = rand() < 0.09 ? this.makeAnimated({
      id: `${key}:virus:super`, kind: "virus", tier: "super",
      x: x * CELL + 95 + rand() * 120, y: y * CELL + 95 + rand() * 120, consumed: false,
    }, rand) : null;
    const boss = candidateBoss && candidateBoss.homeX > WORLD_BOUNDS.minX + 250 && candidateBoss.homeX < WORLD_BOUNDS.maxX - 250
      && candidateBoss.homeY > WORLD_BOUNDS.minY + 250 && candidateBoss.homeY < WORLD_BOUNDS.maxY - 250 ? candidateBoss : null;
    const count = Math.floor(rand() * 5);
    const normal = [];
    for (let index = 0; index < count; index++) {
      const roll = rand();
      const virus = this.makeAnimated({
        id: `${key}:virus:${index}`, kind: "virus",
        tier: roll < 0.6 ? "small" : roll < 0.88 ? "medium" : "large",
        x: x * CELL + 35 + rand() * 240,
        y: y * CELL + 35 + rand() * 240,
        consumed: false,
      }, rand);
      if ((!boss || Math.hypot(virus.homeX - boss.homeX, virus.homeY - boss.homeY)
          > VIRUS_RADII.super + VIRUS_RADII[virus.tier] + 8)
        && normal.every(other => Math.hypot(virus.homeX - other.homeX, virus.homeY - other.homeY)
          > VIRUS_RADII[virus.tier] + VIRUS_RADII[other.tier] + 8)) normal.push(virus);
    }
    return boss ? [...normal, boss] : normal;
  }
}

export function nextTarget(head, angle, collected, glyph, blockers = []) {
  const turn = Math.sin(collected * 1.7 + 1) * 0.72;
  let best, bestClearance = -Infinity;
  for (let index = 0; index < 16; index++) {
    const direction = headingInsideMap(head, angle + turn + index * Math.PI / 8);
    const candidate = { x: clamp(head.x + Math.cos(direction) * 255, WORLD_BOUNDS.minX + 150, WORLD_BOUNDS.maxX - 150),
      y: clamp(head.y + Math.sin(direction) * 255, WORLD_BOUNDS.minY + 150, WORLD_BOUNDS.maxY - 150), glyph, id: "target" };
    const clearance = Math.min(Infinity, ...blockers.map(boss => Math.hypot(candidate.x - boss.x, candidate.y - boss.y)
      - VIRUS_RADII.super - 73));
    if (clearance > bestClearance) { best = candidate; bestClearance = clearance; }
    if (clearance >= 0) return candidate;
  }
  return best;
}

export function headingInsideMap(position, wanted) {
  let dx = Math.cos(wanted), dy = Math.sin(wanted);
  if (position.x > WORLD_BOUNDS.maxX - 180 && dx > 0) dx = -0.85;
  if (position.x < WORLD_BOUNDS.minX + 180 && dx < 0) dx = 0.85;
  if (position.y > WORLD_BOUNDS.maxY - 180 && dy > 0) dy = -0.85;
  if (position.y < WORLD_BOUNDS.minY + 180 && dy < 0) dy = 0.85;
  return Math.atan2(dy, dx);
}

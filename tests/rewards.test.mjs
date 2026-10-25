import test from "node:test";
import assert from "node:assert/strict";
import { RunRewards } from "../src/rewards.js";
import { DEFAULT_CONFIG, CONFIG_KEY, loadConfig, normalizeConfig, saveConfig } from "../src/config.js";
import { VirusField, WORLD_BOUNDS } from "../src/world.js";

test("small, medium and large rewards accumulate before growth, carrying the remainder", () => {
  const rewards = new RunRewards(10);
  assert.equal(rewards.addGrowth(DEFAULT_CONFIG.smallVirusValue), 0);
  assert.equal(rewards.addGrowth(DEFAULT_CONFIG.mediumVirusValue), 0);
  assert.equal(rewards.addGrowth(DEFAULT_CONFIG.largeVirusValue), 0);
  assert.equal(rewards.growthPoints, 9);
  assert.equal(rewards.addGrowth(5), 1);
  assert.equal(rewards.growthPoints, 4);
  assert.equal(rewards.stars, 0);
  assert.equal(rewards.addGrowth(6), 1);
  assert.equal(rewards.growthPoints, 0);
});

test("correct characters award only star points, keeping growth unchanged", () => {
  const rewards = new RunRewards(10);
  rewards.addGrowth(9);
  for (const glyph of ["山", "水", "山"]) rewards.collectGlyph(glyph);
  assert.equal(rewards.stars, 3);
  assert.equal(rewards.growthPoints, 9);
  assert.deepEqual([...rewards.glyphs], ["山", "水"]);
});

test("a large reward can grow multiple segments; threshold changes settle only pending points", () => {
  const rewards = new RunRewards(3);
  assert.equal(rewards.addGrowth(50), 16);
  assert.equal(rewards.growthPoints, 2);
  assert.equal(rewards.setThreshold(1), 2);
  assert.equal(rewards.growthPoints, 0);
  assert.equal(rewards.setThreshold(10), 0);
  rewards.collectGlyph("花");
  rewards.addGrowth(7);
  rewards.reset();
  assert.equal(rewards.stars, 0);
  assert.equal(rewards.growthPoints, 0);
  assert.equal(rewards.glyphs.size, 0);
  assert.equal(rewards.threshold, 10);
  assert.throws(() => rewards.addGrowth(-1));
  assert.throws(() => rewards.addGrowth(Infinity));
});

test("old saved movement settings migrate with growth defaults; integer rewards survive storage", () => {
  const data = new Map([[CONFIG_KEY, JSON.stringify({ speed: 215, spacing: 19 })]]);
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const migrated = loadConfig(storage);
  assert.equal(migrated.speed, 215);
  assert.equal(migrated.spacing, 19);
  assert.equal(migrated.growthPerSegment, 10);
  assert.equal(migrated.largeVirusValue, 5);
  const changed = normalizeConfig({ smallVirusValue: 2.4, mediumVirusValue: 0, largeVirusValue: 500, growthPerSegment: 6.8 }, migrated);
  assert.deepEqual([changed.smallVirusValue, changed.mediumVirusValue, changed.largeVirusValue, changed.growthPerSegment], [2, 1, 100, 7]);
  saveConfig(storage, changed);
  assert.deepEqual(loadConfig(storage), changed);
});

test("all four virus tiers stream inside the square and consumed viruses stay removed nearby", () => {
  const field = new VirusField({seed:12345});
  for (const head of [{ x: 0, y: 0 }, { x: 4500, y: -4500 }, { x: 6200, y: 6200 }]) {
    field.sync(head);
    assert.ok(field.cells.size <= 49);
    assert.deepEqual(new Set(field.nearby().map(virus => virus.tier)), new Set(["small", "medium", "large", "super"]));
    assert.ok(field.nearby().every(virus => virus.x > WORLD_BOUNDS.minX && virus.x < WORLD_BOUNDS.maxX
      && virus.y > WORLD_BOUNDS.minY && virus.y < WORLD_BOUNDS.maxY));
    const virus = field.nearby()[0];
    field.consume(virus.id);
    field.sync(head);
    assert.ok(!field.nearby().some(item => item.id === virus.id));
  }
});

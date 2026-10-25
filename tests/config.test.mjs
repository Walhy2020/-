import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG_KEY, CONFIG_FIELDS, DEFAULT_CONFIG, PRESETS, normalizeConfig, loadConfig, saveConfig } from "../src/config.js";
import { StarMotion, FIXED_STEP } from "../src/motion.js";
import { GlyphTrail } from "../src/trail.js";

function turnTime(values) {
  const motion = new StarMotion(values);
  for (let step = 1; step < 600; step++) {
    motion.advance(Math.PI / 2, FIXED_STEP);
    if (Math.abs(motion.angle - Math.PI / 2) < Math.PI / 180 * 2) return step * FIXED_STEP;
  }
  return Infinity;
}

test("zero-radius tuning retains the previous fast turn for comparison", () => {
  const fast = turnTime({ ...DEFAULT_CONFIG, turnRadius: 0 }), old = turnTime(PRESETS.previous.values);
  assert.ok(fast < 0.35, `default turn took ${fast}s`);
  assert.ok(old > 0.8);
  assert.ok(fast < old / 3);
});

test("live speed changes affect subsequent movement without resetting position or distance", () => {
  const motion = new StarMotion({ speed: 136 });
  motion.advance(0, 1);
  const before = motion.x;
  motion.configure({ ...DEFAULT_CONFIG, speed: 272 });
  motion.advance(0, 0.5);
  assert.equal(motion.x, before + 136);
  assert.equal(motion.distance, 272);
  motion.configure({ ...DEFAULT_CONFIG, speed: 0 });
  const stopped = motion.x;
  motion.advance(Math.PI / 2, FIXED_STEP);
  assert.equal(motion.x, stopped);
  assert.ok(motion.angle > 0);
});

test("invalid imported values cannot poison simulation or add unknown config keys", () => {
  const config = normalizeConfig({ speed: Infinity, turnSpeed: -100, physicsHz: 0,
    spacing: 100000, zoom: "bad", cameraFollow: null, unexpected: 123 });
  assert.equal(config.speed, DEFAULT_CONFIG.speed);
  assert.equal(config.turnSpeed, 30);
  assert.equal(config.physicsHz, 30);
  assert.equal(config.spacing, 200);
  assert.equal(config.zoom, DEFAULT_CONFIG.zoom);
  assert.equal(config.cameraFollow, DEFAULT_CONFIG.cameraFollow);
  assert.ok(!("unexpected" in config));
  assert.deepEqual(normalizeConfig(null), DEFAULT_CONFIG);
});

test("stored tuning survives reload; broken or unavailable storage falls back safely", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const config = { ...DEFAULT_CONFIG, speed: 211, leadGap: 110 };
  assert.equal(saveConfig(storage, config), true);
  assert.deepEqual(loadConfig(storage), config);
  storage.setItem(CONFIG_KEY, "not JSON");
  assert.deepEqual(loadConfig(storage), DEFAULT_CONFIG);
  assert.deepEqual(loadConfig(undefined), DEFAULT_CONFIG);
  assert.equal(saveConfig(undefined, config), false);
});

test("all tuning fields, including the map size, retain saved values on reload", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const changed = Object.fromEntries(CONFIG_FIELDS.map(field => [field.key,
    field.key === "mapSize" ? 6400 : field.min]));
  assert.equal(saveConfig(storage, changed), true);
  assert.deepEqual(loadConfig(storage), normalizeConfig(changed));
  assert.equal(loadConfig(storage).mapSize, 6400);
  assert.equal(normalizeConfig({ mapSize: 999999 }).mapSize, 25600);
});

test("damage interval can be tuned and saved without losing old settings", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  data.set(CONFIG_KEY, JSON.stringify({ speed: 201 }));
  assert.equal(loadConfig(storage).damageCooldown, 1);
  assert.equal(normalizeConfig({ damageCooldown: 0 }).damageCooldown, 0.25);
  assert.equal(normalizeConfig({ damageCooldown: 10 }).damageCooldown, 3);
  saveConfig(storage, { ...loadConfig(storage), damageCooldown: 0.6 });
  assert.equal(loadConfig(storage).damageCooldown, 0.6);
  assert.equal(loadConfig(storage).speed, 201);
});

test("increasing live body spacing keeps each tail letter at a distinct position", () => {
  const trail = new GlyphTrail({ glyphs: [..."大山小鸟花草日月"] });
  trail.reset([{x:0,y:0},{x:-500,y:0}]);
  trail.setLayout(200, 260);
  const positions = trail.positions();
  for (let i = 1; i < positions.length; i++) assert.equal(positions[i - 1].x - positions[i].x, 200);
  assert.equal(positions[0].x, -260);
});

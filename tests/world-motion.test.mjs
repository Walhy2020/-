import test from "node:test";
import assert from "node:assert/strict";
import { StarMotion, FIXED_STEP } from "../src/motion.js";
import { FoodField, WORLD_BOUNDS, setWorldSize, headingInsideMap, nextTarget } from "../src/world.js";
import { GlyphTrail } from "../src/trail.js";
import { PRESETS } from "../src/config.js";

test("movement continues beyond the old arena; the full map is a 12800-unit square", () => {
  const motion = new StarMotion();
  for (let i = 0; i < 30 / FIXED_STEP; i++) motion.advance(0, FIXED_STEP);
  assert.ok(motion.x > 4000);
  assert.ok(Math.abs(motion.y) < 1e-8);
  assert.equal(WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX, 12800);
  assert.equal(WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY, 12800);
  assert.equal(headingInsideMap({ x: 4000, y: 0 }, 0), 0);
});

test("the legacy preset preserves its gradual turn for A/B comparison", () => {
  const motion = new StarMotion(PRESETS.previous.values);
  motion.advance(Math.PI / 2, FIXED_STEP);
  assert.ok(motion.turnRate > 0 && motion.turnRate < 0.2);
  let previous = motion.turnRate;
  for (let i = 0; i < 3 / FIXED_STEP; i++) {
    motion.advance(Math.PI / 2, FIXED_STEP);
    assert.ok(Math.abs(motion.turnRate - previous) < 0.18);
    assert.ok(Math.abs(motion.turnRate) <= 2.15);
    previous = motion.turnRate;
  }
  assert.ok(Math.abs(motion.angle - Math.PI / 2) < 0.01);
});

test("render interpolation moves head and all body segments along the same history", () => {
  const trail = new GlyphTrail({ glyphs: [..."山水木"] });
  trail.reset([{ x: 500, y: 0 }, { x: -500, y: 0 }]);
  const now = trail.positions();
  const rendered = trail.positions(0.7);
  for (let i = 0; i < now.length; i++) assert.ok(Math.abs(now[i].x - rendered[i].x - 0.7) < 1e-8);
});

test("food streams into distant and negative map regions without unbounded cache growth", () => {
  const field = new FoodField([..."山水木花"]);
  for (const center of [{x:0,y:0},{x:4000,y:4000},{x:-4000,y:-4000},{x:6200,y:6200}]) {
    field.sync(center);
    assert.ok(field.cells.size <= 49);
    assert.ok(field.nearby().length > 0);
    assert.ok(field.nearby().every(food => food.x > WORLD_BOUNDS.minX && food.x < WORLD_BOUNDS.maxX
      && food.y > WORLD_BOUNDS.minY && food.y < WORLD_BOUNDS.maxY));
    const nearest = Math.min(...field.nearby().map(food => Math.hypot(food.x-center.x,food.y-center.y)));
    assert.ok(nearest < 330);
  }
  const food = field.nearby()[0];
  field.consume(food.id);
  field.sync({x:6200,y:6200});
  assert.ok(!field.nearby().some(item => item.id === food.id));
});

test("distant map targets remain nearby and the actual outer edge steers gently inward", () => {
  const point = { x: 4300, y: -4200 };
  const target = nextTarget(point, 0, 0, "山");
  assert.ok(target.x > 4300 && Math.hypot(target.x-point.x,target.y-point.y) > 250);
  const corner = { x: WORLD_BOUNDS.maxX - 70, y: WORLD_BOUNDS.minY + 70 };
  const direction = headingInsideMap(corner, -Math.PI / 4);
  assert.ok(Math.cos(direction) < 0 && Math.sin(direction) > 0);
  for (let i = 0; i < 12; i++) {
    const food = nextTarget(corner, i, i, "山");
    assert.ok(food.x < WORLD_BOUNDS.maxX && food.y > WORLD_BOUNDS.minY);
  }
});

test("a held outward direction turns before crossing the actual square boundary", () => {
  const motion = new StarMotion({ x: 6150, y: 6150, angle: Math.PI / 4 });
  for (let i = 0; i < 15 / FIXED_STEP; i++) {
    motion.advance(headingInsideMap(motion, Math.PI / 4), FIXED_STEP);
    assert.ok(motion.x < WORLD_BOUNDS.maxX && motion.y < WORLD_BOUNDS.maxY);
  }
});

test("changing the square map size updates boundaries and streamed food", () => {
  try {
    setWorldSize(4800);
    assert.equal(WORLD_BOUNDS.minX, -2400);
    assert.equal(WORLD_BOUNDS.maxY, 2400);
    const field = new FoodField(["山"]);
    field.sync({ x: 2300, y: 2300 });
    assert.ok(field.nearby().every(food => food.x < 2400 && food.y < 2400));
    assert.ok(headingInsideMap({ x: 2300, y: 0 }, 0) !== 0);
  } finally {
    setWorldSize(12800);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { GlyphTrail, samplePath, turnTowards } from "../src/trail.js";

test("segments follow the travelled corner, rather than a line toward the head", () => {
  const path = [{ x: 100, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }];
  assert.deepEqual(samplePath(path, [25, 50, 75, 125]), [
    { x: 75, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 25 }, { x: 50, y: 75 },
  ]);
});

test("growth appends a character at the tail without moving existing letters", () => {
  const trail = new GlyphTrail({ spacing: 30, leadGap: 40, glyphs: ["大", "山"] });
  trail.reset([{ x: 200, y: 0 }, { x: -300, y: 0 }]);
  const before = trail.positions();
  trail.grow("鸟");
  assert.deepEqual(trail.positions().slice(0, 2), before);
  assert.deepEqual(trail.positions()[2], { x: 100, y: 0, glyph: "鸟" });
});

test("damage removes two tail segments and leaves the head-first body intact", () => {
  const trail = new GlyphTrail({ spacing: 30, leadGap: 40, glyphs: ["甲", "乙", "丙", "丁"] });
  trail.reset([{ x: 200, y: 0 }, { x: -300, y: 0 }]);
  const before = trail.positions();
  assert.equal(trail.shrink(2), 2);
  assert.deepEqual(trail.glyphs, ["甲", "乙"]);
  assert.deepEqual(trail.positions(), before.slice(0, 2));
  assert.equal(trail.shrink(2), 2);
  assert.deepEqual(trail.positions(), []);
  assert.equal(trail.shrink(2), 0);
  trail.grow("星");
  assert.equal(trail.positions().length, 1);
});

test("different frame subdivisions produce the same positions on a straight route", () => {
  const make = () => {
    const trail = new GlyphTrail({ glyphs: ["大", "山", "小", "鸟"] });
    trail.reset([{ x: 0, y: 0 }, { x: -900, y: 0 }]);
    return trail;
  };
  const slow = make(); const fast = make();
  for (let x = 5; x <= 300; x += 5) slow.moveTo({ x, y: 0 });
  for (let x = 1; x <= 300; x += 1) fast.moveTo({ x, y: 0 });
  assert.deepEqual(slow.positions(), fast.positions());
});

test("stopping does not add duplicate history or move body letters", () => {
  const trail = new GlyphTrail({ glyphs: ["山"] });
  trail.reset([{ x: 100, y: 0 }, { x: -500, y: 0 }]);
  const before = trail.positions();
  for (let i = 0; i < 100; i += 1) trail.moveTo({ x: 100, y: 0 });
  assert.equal(trail.points.length, 2);
  assert.deepEqual(trail.positions(), before);
});

test("head turning takes the shortest route across the angle boundary", () => {
  const result = turnTowards(Math.PI - 0.05, -Math.PI + 0.05, 0.04);
  assert.ok(Math.abs(result - (Math.PI - 0.01)) < 1e-9);
});

test("long sessions retain enough history for the body without unbounded history", () => {
  const trail = new GlyphTrail({ glyphs: Array(30).fill("山") });
  trail.reset([{ x: 0, y: 0 }, { x: -2000, y: 0 }]);
  for (let x = 2; x <= 12000; x += 2) trail.moveTo({ x, y: 0 });
  assert.equal(trail.positions().length, 30);
  assert.ok(trail.positions().at(-1).x < 11000);
  assert.ok(trail.points.length < 1000);
  assert.throws(() => trail.grow("大山"), /one character/);
});

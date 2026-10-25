import test from "node:test";
import assert from "node:assert/strict";
import { SteeringInput, actionForKey } from "../src/steering.js";
import { StarMotion, FIXED_STEP } from "../src/motion.js";
import { DEFAULT_CONFIG, PRESETS } from "../src/config.js";
import { GlyphTrail } from "../src/trail.js";

test("held direction combinations keep diagonal heading despite repeat and alias release", () => {
  const input = new SteeringInput();
  input.press("ArrowUp", "up");
  input.press("KeyW", "up");
  input.press("KeyD", "right");
  input.press("KeyW", "up");
  assert.equal(input.read().angle, -Math.PI / 4);
  input.release("ArrowUp");
  assert.equal(input.read().angle, -Math.PI / 4);
  input.release("KeyW");
  assert.equal(input.read().angle, 0);
  input.clear();
  assert.deepEqual(input.read(), { angle: null, turn: null });
  assert.equal(actionForKey("E"), "turnRight");
});

test("continuous steering accepts both signs, cancels opposing keys and clears on release", () => {
  const input = new SteeringInput();
  input.press("KeyQ", "turnLeft");
  assert.equal(input.read().turn, -1);
  input.press("KeyE", "turnRight");
  assert.equal(input.read().turn, 0);
  input.release("KeyQ");
  assert.equal(input.read().turn, 1);
  input.release("KeyE");
  assert.equal(input.read().turn, null);
});

test("round bends respond on the first update and respect their spatial radius", () => {
  const motion = new StarMotion(PRESETS.smooth.values);
  motion.advance(Math.PI / 2, FIXED_STEP);
  assert.ok(motion.y > 0 && motion.angle > 0, "turn starts immediately");
  let intermediate = 0;
  for (let i = 0; i < 120; i++) {
    motion.advance(Math.PI / 2, FIXED_STEP);
    assert.ok(Math.abs(motion.turnRate) <= motion.speed / motion.turnRadius + 1e-8);
    if (motion.angle > 0.2 && motion.angle < 1.3) intermediate++;
  }
  assert.ok(intermediate > 35, "bend travels through intermediate headings");
  assert.ok(motion.x > 40 && motion.y > 60, "bend has visible width instead of an L corner");
  assert.ok(Math.abs(motion.angle - Math.PI / 2) < 0.01);
});

test("constant Q/E steering settles onto a circle rather than a star-shaped center path", () => {
  const motion = new StarMotion();
  const rate = Math.min(DEFAULT_CONFIG.keyboardTurnSpeed * Math.PI / 180,
    motion.maxTurnRate, motion.speed / motion.turnRadius);
  for (let i = 0; i < 120; i++) motion.advance(motion.angle, FIXED_STEP, rate);
  const radius = motion.speed * FIXED_STEP / (2 * Math.sin(rate * FIXED_STEP / 2));
  const center = { x: motion.x - Math.sin(motion.angle) * radius,
    y: motion.y + Math.cos(motion.angle) * radius };
  let maxError = 0;
  for (let i = 0; i < 240; i++) {
    motion.advance(motion.angle, FIXED_STEP, rate);
    maxError = Math.max(maxError, Math.abs(Math.hypot(motion.x - center.x, motion.y - center.y) - radius));
  }
  assert.ok(maxError < 1e-6, `circle radius varied by ${maxError}`);
});

test("continuous turn and body follow arbitrary curved positions at multiple update rates", () => {
  const results = [60, 120, 240].map(hz => {
    const motion = new StarMotion();
    const trail = new GlyphTrail({ glyphs: [..."大山小鸟"], spacing: 52, leadGap: 90 });
    trail.reset([{x:0,y:0}, {x:-1000,y:0}]);
    for (let i = 0; i < hz; i++) {
      motion.advance(motion.angle, 1 / hz, 1.7);
      trail.moveTo(motion);
    }
    assert.ok(Math.abs(motion.angle - Math.round(motion.angle / (Math.PI / 4)) * Math.PI / 4) > 0.05);
    assert.ok(trail.positions()[0].x > 20 && trail.positions()[0].y > 5);
    return motion;
  });
  for (const result of results) {
    assert.ok(Math.hypot(result.x - results[2].x, result.y - results[2].y) < 1.5);
  }
});

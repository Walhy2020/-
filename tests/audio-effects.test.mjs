import test from "node:test";
import assert from "node:assert/strict";
import { Soundscape } from "../src/audio.js";
import { StarBursts } from "../src/star-burst.js";

test("correct-character stars scatter around the pickup and expire", () => {
  const bursts = new StarBursts(() => 0.5);
  bursts.add(100, 200, 5);
  assert.equal(bursts.active(5.01).length, 17);
  const scattered = bursts.active(5.4);
  assert.ok(scattered.some(star => star.x < 80));
  assert.ok(scattered.some(star => star.x > 120));
  assert.ok(scattered.every(star => star.opacity > 0 && star.opacity < 1));
  assert.deepEqual(bursts.active(7), []);
  bursts.add(100, 200, 8);
  bursts.clear();
  assert.deepEqual(bursts.active(8), []);
});

test("music waits for activation, plays cues, and stops when muted", async () => {
  const stored = new Map();
  const storage = { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) };
  let voices = 0;
  class Parameter { setValueAtTime() {} exponentialRampToValueAtTime() {} }
  class Node {
    gain = new Parameter(); frequency = new Parameter();
    connect() {} disconnect() {} start() { voices++; } stop() {}
  }
  class Context {
    state = "suspended"; currentTime = 0; destination = new Node();
    createGain() { return new Node(); }
    createOscillator() { return new Node(); }
    async resume() { this.state = "running"; }
    async close() { this.state = "closed"; }
  }
  const sound = new Soundscape(storage, Context);
  assert.equal(sound.getState().active, false);
  try {
    assert.equal(await sound.unlock(), true);
    assert.ok(voices > 0, "background notes should be scheduled");
    const before = voices;
    sound.play("glyph");
    assert.equal(voices, before + 4);
    await sound.toggle();
    assert.equal(sound.getState().active, false);
    assert.equal(stored.get("flystar-sound-enabled-v1"), "false");
    sound.play("glyph");
    assert.equal(voices, before + 4);
  } finally {
    await sound.setEnabled(false);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { GamepadInput, readGamepad } from "../src/gamepad.js";

function pad({ axes = [0,0,0,0], buttons = [], index = 0, ...rest } = {}) {
  return { id: "Xbox Wireless Controller", index, mapping: "standard", connected: true,
    axes, buttons: Array.from({length:17}, (_, i) => ({ pressed: buttons.includes(i), value: Number(buttons.includes(i)) })), ...rest };
}

test("analog sticks keep arbitrary headings and ignore radial drift", () => {
  assert.equal(readGamepad(pad({ axes:[.1,-.1,0,0] })).angle, null);
  const arbitrary = readGamepad(pad({ axes:[.8,.3,0,0] }));
  assert.equal(arbitrary.angle, Math.atan2(.3,.8));
  assert.equal(arbitrary.source, "left-stick");
  assert.equal(readGamepad(pad({ axes:[0,0,-.4,.7] })).source, "right-stick");
  assert.equal(readGamepad(pad({ axes:[.8,0,-1,0] })).angle, 0);
  assert.equal(readGamepad(pad({ axes:[.3,0,0,0] }), .4).angle, null);
});

test("Xbox directional buttons and ABXY use their physical directions, including diagonals", () => {
  for (const [button, angle] of [[12,-Math.PI/2],[13,Math.PI/2],[14,Math.PI],[15,0],[3,-Math.PI/2],[0,Math.PI/2],[2,Math.PI],[1,0]]) {
    assert.equal(readGamepad(pad({buttons:[button]})).angle, angle);
  }
  assert.equal(readGamepad(pad({buttons:[12,15]})).angle, -Math.PI/4);
  assert.equal(readGamepad(pad({buttons:[3,1]})).angle, -Math.PI/4);
  assert.equal(readGamepad(pad({buttons:[12,13],axes:[1,0,0,0]})).angle, null);
  assert.equal(readGamepad(pad({buttons:[12],axes:[1,0,0,0]})).source, "dpad");
});

test("menu key toggles once per press and ignores a brief missing gamepad poll", () => {
  const input = new GamepadInput();
  assert.equal(input.poll([pad({buttons:[9]})], .2).pausePressed, true);
  assert.equal(input.poll([pad({buttons:[9]})], .2).pausePressed, false);
  input.poll([pad()], .2);
  assert.equal(input.poll([pad({buttons:[9]})], .2).pausePressed, true);
  assert.equal(input.poll([null], .2), null);
  assert.equal(input.poll([pad({buttons:[9]})], .2).pausePressed, false);
  input.poll([pad()], .2);
  assert.equal(input.poll([pad({buttons:[9]})], .2).pausePressed, true);
});

test("polling selects an active controller across sparse slots and rejects unknown layouts", () => {
  const input = new GamepadInput();
  assert.equal(input.poll([null,pad({index:1}),pad({index:2,axes:[.5,.5,0,0]})], .2).index, 2);
  assert.equal(readGamepad(pad({ mapping:"", id:"Unmapped device", axes:[1,0] })).supported, false);
  assert.equal(readGamepad(pad({connected:false})), null);
  assert.equal(readGamepad(pad({ axes:[NaN,undefined,0,0] })).angle, null);
});

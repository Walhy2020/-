const pressed = (pad, index) => Boolean(pad.buttons?.[index]?.pressed || pad.buttons?.[index]?.value > 0.5);
const axis = (pad, index) => Number.isFinite(pad.axes?.[index]) ? pad.axes[index] : 0;

export function readGamepad(pad, deadzone = 0.2) {
  if (!pad?.connected) return null;
  const supported = pad.mapping === "standard" || /xbox|xinput/i.test(pad.id);
  const state = { connected: true, id: pad.id, index: pad.index, supported,
    angle: null, source: null, magnitude: 0, start: false };
  if (!supported) return state;
  state.start = pressed(pad, 9);
  // Face buttons follow their physical diamond: Y up, A down, X left, B right.
  const dpad = [12, 13, 14, 15].some(index => pressed(pad, index));
  const face = [0, 1, 2, 3].some(index => pressed(pad, index));
  if (dpad || face) {
    const [up, down, left, right] = dpad ? [12, 13, 14, 15] : [3, 0, 2, 1];
    const x = Number(pressed(pad, right)) - Number(pressed(pad, left));
    const y = Number(pressed(pad, down)) - Number(pressed(pad, up));
    if (x || y) Object.assign(state, { angle: Math.atan2(y, x), source: dpad ? "dpad" : "buttons", magnitude: 1 });
    return state;
  }
  for (const [offset, source] of [[0, "left-stick"], [2, "right-stick"]]) {
    const x = axis(pad, offset), y = axis(pad, offset + 1);
    const magnitude = Math.hypot(x, y);
    if (magnitude > deadzone) {
      Object.assign(state, { angle: Math.atan2(y, x), source, magnitude: Math.min(1, magnitude) });
      break;
    }
  }
  return state;
}

export class GamepadInput {
  constructor() { this.starts = new Map(); this.index = null; }
  poll(pads, deadzone) {
    const states = Array.from(pads ?? []).map(pad => readGamepad(pad, deadzone)).filter(Boolean);
    for (const state of states) {
      const identity = `${state.index}:${state.id}`;
      state.pausePressed = state.start && !this.starts.get(identity);
      this.starts.set(identity, state.start);
    }
    const active = states.find(state => state.index === this.index && (state.angle !== null || state.pausePressed))
      ?? states.find(state => state.angle !== null || state.pausePressed)
      ?? states.find(state => state.index === this.index) ?? states.find(state => state.supported) ?? states[0] ?? null;
    this.index = active?.index ?? null;
    return active;
  }
}

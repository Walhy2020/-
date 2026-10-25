const KEY_ACTIONS = Object.freeze({
  ArrowUp: "up", w: "up", ArrowDown: "down", s: "down",
  ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right",
  q: "turnLeft", e: "turnRight",
});

export function actionForKey(key) {
  return KEY_ACTIONS[key.length === 1 ? key.toLowerCase() : key];
}

/** Track physical keys separately so aliases and key repeat cannot fight. */
export class SteeringInput {
  constructor() { this.held = new Map(); }
  press(key, action) { this.held.set(key, action); }
  release(key) { this.held.delete(key); }
  clear() { this.held.clear(); }
  read() {
    const actions = new Set(this.held.values());
    const x = Number(actions.has("right")) - Number(actions.has("left"));
    const y = Number(actions.has("down")) - Number(actions.has("up"));
    const rotating = actions.has("turnRight") || actions.has("turnLeft");
    return {
      angle: x || y ? Math.atan2(y, x) : null,
      turn: rotating ? Number(actions.has("turnRight")) - Number(actions.has("turnLeft")) : null,
    };
  }
}

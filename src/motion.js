import { DEFAULT_CONFIG } from "./config.js";

export const FIXED_STEP = 1 / 120;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Steering has acceleration, rather than an instant change of curvature. */
export class StarMotion {
  constructor({ x = 0, y = 0, angle = 0, ...config } = {}) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.configure({ ...DEFAULT_CONFIG, ...config });
    this.turnRate = 0;
    this.distance = 0;
  }

  configure(config) {
    this.speed = config.speed;
    this.maxTurnRate = config.turnSpeed * Math.PI / 180;
    this.turnGain = config.turnGain;
    this.turnResponse = config.turnResponse;
    this.turnRadius = config.turnRadius;
    this.turnRate = clamp(this.turnRate || 0, -this.maxTurnRate, this.maxTurnRate);
  }

  advance(targetAngle, dt, directTurnRate = null) {
    const delta = Math.atan2(Math.sin(targetAngle - this.angle), Math.cos(targetAngle - this.angle));
    // Limit spatial curvature, independently of how quickly input responds.
    // A stationary head may still turn for zero-speed tuning.
    const limit = this.speed > 0 && this.turnRadius > 0
      ? Math.min(this.maxTurnRate, this.speed / this.turnRadius) : this.maxTurnRate;
    const wantedRate = clamp(directTurnRate ?? delta * this.turnGain, -limit, limit);
    this.turnRate += (wantedRate - this.turnRate) * (1 - Math.exp(-dt * this.turnResponse));
    this.turnRate = clamp(this.turnRate, -limit, limit);
    const midAngle = this.angle + this.turnRate * dt / 2;
    this.angle += this.turnRate * dt;
    this.x += Math.cos(midAngle) * this.speed * dt;
    this.y += Math.sin(midAngle) * this.speed * dt;
    this.distance += this.speed * dt;
  }
}

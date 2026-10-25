const TAU = Math.PI * 2;

export class StarBursts {
  constructor(random = Math.random) {
    this.random = random;
    this.particles = [];
  }

  clear() { this.particles.length = 0; }

  add(x, y, time) {
    for (let index = 0; index < 17; index++) {
      const angle = TAU * (index + this.random() * 0.65) / 17;
      const speed = 95 + this.random() * 145;
      this.particles.push({ x, y, born: time, life: 0.85 + this.random() * 0.55,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 75,
        size: 12 + this.random() * 16, spin: (this.random() - 0.5) * 7,
        rotation: this.random() * TAU });
    }
  }

  active(time) {
    this.particles = this.particles.filter(star => time - star.born < star.life);
    return this.particles.map(star => {
      const age = Math.max(0, time - star.born);
      const progress = Math.min(1, age / star.life);
      return { x: star.x + star.vx * age * (1 - 0.24 * progress),
        y: star.y + star.vy * age + 112 * age * age,
        size: star.size * (1 + 0.18 * Math.sin(progress * Math.PI)),
        rotation: star.rotation + star.spin * age,
        opacity: Math.min(1, age / 0.09) * Math.pow(1 - progress, 1.35) };
    });
  }
}

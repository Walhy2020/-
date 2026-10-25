import { GlyphTrail, turnTowards } from "./trail.js";
import { headingInsideMap, VIRUS_COLORS, WORLD_BOUNDS } from "./world.js";
import { makeRandom, randomSeed } from "./random.js";
import { VIRUS_TYPES } from "./rewards.js";

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** A small local population of slow foragers; their bodies follow travelled paths. */
export class VirusSnakes {
  constructor({ count = 5, seed = randomSeed() } = {}) {
    this.count = count;
    this.seed = seed;
    this.snakes = [];
    this.respawns = [];
    this.defeated = 0;
    this.random = makeRandom(seed);
  }

  reset(position = { x: 0, y: 0 }, seed = randomSeed()) {
    this.seed = seed;
    this.random = makeRandom(seed);
    this.snakes = Array.from({ length: this.count }, (_, index) => this.spawn(index, position));
    this.respawns = [];
    this.defeated = 0;
  }

  setCount(count, position = { x: 0, y: 0 }) {
    if (!Number.isInteger(count) || count < 0 || count > 20) throw new RangeError("Invalid virus snake count");
    const previous = this.count;
    this.count = count;
    this.snakes = this.snakes.filter(snake => Number(snake.id.split("-").at(-1)) < count);
    this.respawns = this.respawns.filter(waiting => waiting.index < count);
    for (let index = previous; index < count; index++) this.snakes.push(this.spawn(index, position));
  }

  spawn(index, position) {
    const angle = this.random() * Math.PI * 2;
    const radius = 320 + this.random() * 480;
    const head = { x: clamp(position.x + Math.cos(angle) * radius, WORLD_BOUNDS.minX + 180, WORLD_BOUNDS.maxX - 180),
      y: clamp(position.y + Math.sin(angle) * radius, WORLD_BOUNDS.minY + 180, WORLD_BOUNDS.maxY - 180) };
    const heading = this.random() * Math.PI * 2;
    const trail = new GlyphTrail({spacing:18,leadGap:29,glyphs:Array(7 + Math.floor(this.random()*5)).fill("•")});
    trail.reset([head, {x:head.x-Math.cos(heading)*500,y:head.y-Math.sin(heading)*500}]);
    return {id:`virus-snake-${index}`,head,previousHead:{...head},angle:heading,desiredAngle:heading,
      trail,decisionIn:0,eaten:0,color:VIRUS_COLORS[Math.floor(this.random()*VIRUS_COLORS.length)]};
  }

  advance(dt, { speed, player, foods = [], consume = () => {}, recycleDistance = 2400 }) {
    const eaten = [];
    if (!(speed > 0) || !(dt > 0)) return eaten;
    for (let index = this.respawns.length - 1; index >= 0; index--) {
      const waiting = this.respawns[index];
      waiting.remaining -= dt;
      if (waiting.remaining <= 0) {
        this.snakes.push(this.spawn(waiting.index, player));
        this.respawns.splice(index, 1);
      }
    }
    for (let index=0;index<this.snakes.length;index++) {
      let snake=this.snakes[index];
      // Recycle only outside the visible play region as the player explores.
      if (distance(snake.head,player)>recycleDistance)
        snake=this.snakes[index]=this.spawn(Number(snake.id.split("-").at(-1)),player);
      snake.previousHead = { ...snake.head };
      snake.decisionIn-=dt;
      if (snake.decisionIn<=0) {
        const nearby=foods.filter(food=>food.tier!=="super"&&!eaten.includes(food.id)&&distance(snake.head,food)<330);
        const nearest=nearby.reduce((best,food)=>!best||distance(snake.head,food)<distance(snake.head,best)?food:best,null);
        snake.desiredAngle=nearest?Math.atan2(nearest.y-snake.head.y,nearest.x-snake.head.x):snake.angle+(this.random()-0.5)*1.8;
        snake.decisionIn=0.7+this.random()*1.2;
      }
      snake.angle=turnTowards(snake.angle,headingInsideMap(snake.head,snake.desiredAngle),Math.max(0.85,speed/20)*dt);
      snake.head={x:clamp(snake.head.x+Math.cos(snake.angle)*speed*dt,WORLD_BOUNDS.minX+80,WORLD_BOUNDS.maxX-80),
        y:clamp(snake.head.y+Math.sin(snake.angle)*speed*dt,WORLD_BOUNDS.minY+80,WORLD_BOUNDS.maxY-80)};
      snake.trail.moveTo(snake.head);
      const food=foods.find(item=>item.tier!=="super"&&!eaten.includes(item.id)
        &&distance(snake.head,item)<24+VIRUS_TYPES.find(type=>type.tier===item.tier).size/2);
      if (food) {
        consume(food.id);
        eaten.push(food.id);
        snake.eaten++;
        if (snake.trail.glyphs.length<20&&snake.eaten%2===0) snake.trail.grow("•");
        snake.decisionIn=0;
      }
    }
    return eaten;
  }

  /** Only an enemy head striking the player's body defeats that enemy. */
  defeatOnBody(playerHead, body, collisionRadius = 55) {
    if (!body.length) return [];
    const defeated = [];
    this.snakes = this.snakes.filter(snake => {
      if (distance(snake.head, playerHead) < 44
        || !body.some(segment => distance(snake.head, segment) < collisionRadius)
        || body.some(segment => distance(snake.previousHead, segment) < collisionRadius)) return true;
      defeated.push({ id: snake.id, head: { ...snake.head }, length: snake.trail.glyphs.length });
      this.respawns.push({ index: Number(snake.id.split("-").at(-1)), remaining: 8 });
      this.defeated++;
      return false;
    });
    return defeated;
  }

  getState() {
    return this.snakes.map(snake=>({id:snake.id,head:{...snake.head},angle:snake.angle,length:snake.trail.glyphs.length,
      eaten:snake.eaten,color:snake.color,segments:snake.trail.positions()}));
  }
}

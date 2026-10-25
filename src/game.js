import { GlyphTrail, samplePath } from "./trail.js";
import { StarMotion } from "./motion.js";
import { VirusField, VIRUS_COLORS, WORLD_BOUNDS, setWorldSize, headingInsideMap, nextTarget } from "./world.js";
import { RunRewards, VIRUS_TYPES } from "./rewards.js";
import { findEnclosure } from "./enclosure.js";
import { VirusSnakes } from "./virus-snakes.js";
import { loadConfig, saveConfig, normalizeConfig } from "./config.js";
import { setupTuning } from "./tuning.js";
import { SteeringInput, actionForKey } from "./steering.js";
import { GamepadInput } from "./gamepad.js";
import { setupFullscreen } from "./fullscreen.js";
import { setupUpdates } from "./updates.js";
import { Soundscape } from "./audio.js";
import { StarBursts } from "./star-burst.js";

const $ = (id) => document.getElementById(id);
const canvas = $("game");
const ctx = canvas.getContext("2d");
const INITIAL = Array(8).fill("★");
const LESSONS = [
  ["山", "大山"], ["水", "河水"], ["木", "木头"], ["花", "花朵"],
  ["鸟", "小鸟"], ["日", "日出"], ["月", "月亮"], ["云", "白云"],
  ["田", "田地"], ["土", "土地"], ["人", "大人"], ["口", "人口"],
];
let localConfigStorage;
try { localConfigStorage = window.localStorage; } catch { /* Runtime tuning also works without storage. */ }
let config = loadConfig(localConfigStorage), physicsStep = 1 / config.physicsHz, tuning;
setWorldSize(config.mapSize);
const trail = new GlyphTrail({ spacing: config.spacing, leadGap: config.leadGap, glyphs: INITIAL });
const virusField = new VirusField();
const virusSnakes = new VirusSnakes({ count: config.virusSnakeCount });
const rewards = new RunRewards(config.growthPerSegment);
const controls = new SteeringInput();
const gamepad = new GamepadInput();
const sound = new Soundscape(localConfigStorage);
const starBursts = new StarBursts();
let gamepadState = null, inputOwner = null, padNeedsNeutral = false, lastPadAngle = null, gamepadPlayActive = false;
let gamepadMissingSince = null;
let head, motion, angle, desiredAngle, lessonIndex, foods, viruses, target, mode = "auto";
let autoSeekingVirus = true;
let paused = false, pauseReason = null, ready = false, pointer = null, viewWidth = 900, viewHeight = 550;
let zoom = 1, camera = { x: -60, y: 0 }, previousCamera = { ...camera };
let clock = 0, lastTime = 0, toastUntil = 6, accumulator = 0, fieldTimer = 0;
let assets, metadata, floorPattern, growthFlash = -10;
let enclosureTimer = 0, captureFlash = null, capturedSuper = 0;
let lastDamageAt = -Infinity, damageFlashUntil = -Infinity, damageHits = 0, lastDamageCause = null;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function notify(text, duration = 3) {
  $("message").textContent = text;
  $("message").classList.remove("is-quiet");
  toastUntil = clock + duration;
}

function updateUI() {
  $("targetGlyph").textContent = LESSONS[lessonIndex % LESSONS.length][0];
  $("lengthCount").textContent = trail.glyphs.length;
  $("starScore").textContent = rewards.stars;
  $("growthCount").textContent = `${rewards.growthPoints} / ${rewards.threshold}`;
  $("growthProgress").max = rewards.threshold;
  $("growthProgress").value = rewards.growthPoints;
  $("growthProgress").setAttribute("aria-valuetext", `${rewards.growthPoints} 点，还差 ${rewards.threshold - rewards.growthPoints} 点长一节`);
  $("growthRule").textContent = `每 ${rewards.threshold} 点长一节`;
  for (const type of VIRUS_TYPES) $(`${type.tier}VirusValue`).textContent = `+${config[type.valueKey]}`;
  $("modeLabel").textContent = mode === "auto" ? "自动演示" : "自由操控";
  $("autoButton").setAttribute("aria-pressed", String(mode === "auto"));
  $("stageHint").textContent = mode === "auto"
    ? "推动手柄摇杆、拖动或按方向键，接过小飞星" : "摇杆 / 拖动任意转向 · 方向键可斜走 · Q/E 绕弯";
}

function spawnFoods() {
  virusField.sync(head, Math.max(850, Math.hypot(viewWidth, viewHeight) / zoom / 2 + 300));
  target = nextTarget(head, angle, rewards.stars, LESSONS[lessonIndex % LESSONS.length][0],
    virusField.nearby().filter(virus => virus.tier === "super"));
  refreshField();
}

function refreshField() {
  const radius = Math.max(850, Math.hypot(viewWidth, viewHeight) / zoom / 2 + 300);
  virusField.sync(head, radius);
  foods = [target];
  viruses = virusField.nearby().filter((virus) => {
    const type = VIRUS_TYPES.find((entry) => entry.tier === virus.tier);
    return type.encircle || distance(virus, target) > type.size / 2 + 50;
  });
  const mapX = (head.x - WORLD_BOUNDS.minX) / WORLD_BOUNDS.size * 100;
  const mapY = (head.y - WORLD_BOUNDS.minY) / WORLD_BOUNDS.size * 100;
  $("mapDot").style.left = `${mapX}%`;
  $("mapDot").style.top = `${mapY}%`;
  $("mapView").style.left = `${mapX}%`;
  $("mapView").style.top = `${mapY}%`;
  $("mapView").style.width = `${viewWidth / zoom / WORLD_BOUNDS.size * 100}%`;
  $("mapView").style.height = `${viewHeight / zoom / WORLD_BOUNDS.size * 100}%`;
  fieldTimer = 0;
}

function reset() {
  head = { x: 0, y: 0 };
  angle = -0.35;
  motion = new StarMotion({ ...head, angle, ...config });
  desiredAngle = angle;
  rewards.reset(config.growthPerSegment);
  autoSeekingVirus = true;
  lessonIndex = 0;
  pointer = null;
  controls.clear();
  inputOwner = null;
  padNeedsNeutral = true;
  growthFlash = -10;
  starBursts.clear();
  accumulator = 0;
  virusField.reset();
  virusSnakes.reset(head);
  enclosureTimer = 0;
  captureFlash = null;
  capturedSuper = 0;
  lastDamageAt = -Infinity;
  damageFlashUntil = -Infinity;
  damageHits = 0;
  lastDamageCause = null;
  // The seeded curve has the same tangent as the initial heading, avoiding a kink.
  const history = [];
  let point = { ...head };
  const seedLength = Math.max(1500, config.leadGap + (INITIAL.length + 12) * config.spacing);
  for (let d = 0; d <= seedLength; d += 3) {
    history.push({ ...point });
    const tangent = angle + 0.8 * Math.sin(d / 145);
    point = { x: point.x - Math.cos(tangent) * 3, y: point.y - Math.sin(tangent) * 3 };
  }
  trail.reset(history, INITIAL);
  camera = { x: -90, y: 0 };
  previousCamera = { ...camera };
  paused = false;
  pauseReason = null;
  $("pauseOverlay").hidden = true;
  spawnFoods();
  updateUI();
  notify(`吃病毒攒成长，每 ${rewards.threshold} 点长一节；吃对字得星星！`, 5);
}

function setMode(next) {
  if (!ready) return;
  mode = next;
  pointer = null;
  controls.clear();
  inputOwner = null;
  if (next === "auto") { padNeedsNeutral = true; gamepadPlayActive = false; }
  paused = false;
  pauseReason = null;
  $("pauseOverlay").hidden = true;
  desiredAngle = angle;
  updateUI();
  notify(mode === "auto" ? "小飞星带你看：吃病毒长身体，认汉字得积分" : "轮到你啦！吃病毒攒成长，找到目标字得星星");
}

function setPaused(value, title = "游戏已暂停") {
  if (!ready) return;
  paused = value;
  pauseReason = value ? title : null;
  accumulator = 0;
  pointer = null;
  controls.clear();
  if (value) { padNeedsNeutral = true; inputOwner = null; }
  $("pauseTitle").textContent = title;
  $("pauseOverlay").hidden = !value;
}

function resize() {
  const box = canvas.getBoundingClientRect();
  viewWidth = box.width;
  viewHeight = box.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(viewWidth * dpr);
  canvas.height = Math.round(viewHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  zoom = (viewWidth < 500 ? 0.77 : Math.min(1.1, viewWidth / 820)) * config.zoom;
  if (ready) refreshField();
}

function applyConfig(patch) {
  const previous = config;
  config = normalizeConfig(patch, config);
  if (previous.mapSize !== config.mapSize) {
    setWorldSize(config.mapSize);
    if (ready) {
      const moved = { x: clamp(head.x, WORLD_BOUNDS.minX + 110, WORLD_BOUNDS.maxX - 110),
        y: clamp(head.y, WORLD_BOUNDS.minY + 110, WORLD_BOUNDS.maxY - 110) };
      const dx = moved.x - head.x, dy = moved.y - head.y;
      if (dx || dy) {
        head = moved;
        motion.x = moved.x; motion.y = moved.y;
        for (const point of trail.points) { point.x += dx; point.y += dy; }
        camera.x += dx; camera.y += dy;
        previousCamera.x += dx; previousCamera.y += dy;
      }
      virusField.cells.clear();
      virusField.drops = virusField.drops.filter(item => item.x > WORLD_BOUNDS.minX + 100 && item.x < WORLD_BOUNDS.maxX - 100
        && item.y > WORLD_BOUNDS.minY + 100 && item.y < WORLD_BOUNDS.maxY - 100);
      virusSnakes.reset(head);
      spawnFoods();
      notify(`地图边长已调整为 ${config.mapSize}，设置已保存`);
    }
  }
  motion?.configure(config);
  if (previous.spacing !== config.spacing || previous.leadGap !== config.leadGap) {
    trail.setLayout(config.spacing, config.leadGap);
  }
  if (previous.physicsHz !== config.physicsHz) {
    physicsStep = 1 / config.physicsHz;
    accumulator = 0;
  }
  if (previous.virusSnakeCount !== config.virusSnakeCount)
    virusSnakes.setCount(config.virusSnakeCount, head || { x: 0, y: 0 });
  if (previous.zoom !== config.zoom) resize();
  if (previous.growthPerSegment !== config.growthPerSegment) {
    growBody(rewards.setThreshold(config.growthPerSegment));
  }
  if (ready) updateUI();
  tuning?.sync(config, saveConfig(localConfigStorage, config));
}

function growBody(count) {
  for (let index = 0; index < count; index++) trail.grow("★");
  if (count > 0) {
    trail.setLayout(config.spacing, config.leadGap);
    growthFlash = clock;
  }
}

function takeDamage(cause) {
  if (clock - lastDamageAt < config.damageCooldown) return false;
  const lost = trail.shrink(2);
  lastDamageAt = clock;
  damageFlashUntil = clock + 0.8;
  damageHits += 1;
  lastDamageCause = cause;
  sound.play("damage");
  updateUI();
  notify(lost ? `${cause}！尾巴掉了 ${lost} 节，快转向避开！`
    : `${cause}！尾巴已经掉光，快转向避开！`, 1.2);
  return true;
}

function update(dt) {
  clock += dt;
  let directTurnRate = null;
  if (clock > toastUntil) $("message").classList.add("is-quiet");
  if (mode === "auto") {
    const nearestVirus = autoSeekingVirus && viruses.filter(virus => virus.tier !== "super").reduce((nearest, virus) =>
      !nearest || distance(head, virus) < distance(head, nearest) ? virus : nearest, null);
    const destination = nearestVirus || target;
    desiredAngle = Math.atan2(destination.y - head.y, destination.x - head.x);
  }
  else if (pointer) {
    const destination = { x: (pointer.x - viewWidth / 2) / zoom + camera.x,
      y: (pointer.y - viewHeight / 2) / zoom + camera.y };
    if (distance(head, destination) > config.pointerDeadzone) desiredAngle = Math.atan2(destination.y - head.y, destination.x - head.x);
  } else if (inputOwner === "gamepad" && !padNeedsNeutral && gamepadState?.angle != null) {
    desiredAngle = gamepadState.angle;
  } else {
    const input = controls.read();
    if (input.turn !== null) {
      desiredAngle = angle;
      directTurnRate = input.turn * config.keyboardTurnSpeed * Math.PI / 180;
    } else if (input.angle !== null) desiredAngle = input.angle;
  }
  const boundedAngle = mode === "auto" ? headingInsideMap(head, desiredAngle) : desiredAngle;
  motion.advance(boundedAngle, dt, boundedAngle === desiredAngle ? directTurnRate : null);
  const hitBoundary = mode !== "auto" && (motion.x < WORLD_BOUNDS.minX + 65 || motion.x > WORLD_BOUNDS.maxX - 65
    || motion.y < WORLD_BOUNDS.minY + 65 || motion.y > WORLD_BOUNDS.maxY - 65);
  motion.x = clamp(motion.x, WORLD_BOUNDS.minX + 65, WORLD_BOUNDS.maxX - 65);
  motion.y = clamp(motion.y, WORLD_BOUNDS.minY + 65, WORLD_BOUNDS.maxY - 65);
  head = { x: motion.x, y: motion.y };
  angle = motion.angle;
  trail.moveTo(head);
  if (hitBoundary) takeDamage("撞到边界");
  virusField.advance(dt, config.virusDriftSpeed);
  fieldTimer += dt;
  if (distance(head, target) > 650) spawnFoods();
  else if (fieldTimer >= 0.3) refreshField();
  const npcEaten = virusSnakes.advance(dt, { speed:config.virusSnakeSpeed, player:head, foods:viruses,
    recycleDistance:Math.max(2400,Math.hypot(viewWidth,viewHeight)/zoom/2+500),
    consume:id=>virusField.consume(id) });
  if (npcEaten.length) {
    const ids=new Set(npcEaten);
    viruses=viruses.filter(virus=>!ids.has(virus.id));
  }
  const defeated = virusSnakes.defeatOnBody(head, trail.positions(), config.bodySize / 2 + 18);
  if (defeated.length) {
    let dropped = 0;
    for (const snake of defeated) dropped += virusField.spill(snake.head, snake.length).length;
    refreshField();
    notify(`病毒蛇撞上星星身体，散成 ${dropped} 颗可吃的病毒！`, 3);
  }
  const food = foods.find((item) => distance(head, item) < 29);
  if (food && food.glyph === LESSONS[lessonIndex % LESSONS.length][0]) {
    rewards.collectGlyph(food.glyph);
    starBursts.add(food.x, food.y, clock);
    sound.play("glyph");
    lessonIndex += 1;
    autoSeekingVirus = true;
    spawnFoods();
    updateUI();
  }
  const virus = viruses.find((item) => {
    const type = VIRUS_TYPES.find((entry) => entry.tier === item.tier);
    return !type.encircle && distance(head, item) < type.size / 2 + 12;
  });
  if (virus) {
    const type = VIRUS_TYPES.find((entry) => entry.tier === virus.tier);
    const value = config[type.valueKey];
    const grown = rewards.addGrowth(value);
    growBody(grown);
    sound.play(grown ? "growth" : "virus");
    virusField.consume(virus.id);
    viruses = viruses.filter((item) => item.id !== virus.id);
    autoSeekingVirus = false;
    notify(`${type.label} +${value} 成长${grown ? `，长了 ${grown} 节！` : `，还差 ${rewards.threshold - rewards.growthPoints} 点长一节`}`);
    updateUI();
  }
  enclosureTimer += dt;
  if (enclosureTimer >= Math.min(0.08, config.enclosureGap / Math.max(1, motion.speed))) {
    enclosureTimer = 0;
    const superType = VIRUS_TYPES.find(type => type.encircle);
    const bosses = viruses.filter(item => item.tier === "super");
    const enclosure = findEnclosure(trail.points, {
      bodyLength: trail.leadGap + (trail.glyphs.length - 1) * trail.spacing,
      bodyRadius: config.bodySize * 0.35, closureGap: config.enclosureGap,
    }, bosses.map(boss => ({ ...boss, radius: superType.size / 2 })));
    if (enclosure) {
      const ids = new Set(enclosure.enclosed.map(boss => boss.id));
      for (const id of ids) virusField.consume(id);
      viruses = viruses.filter(item => !ids.has(item.id));
      const value = ids.size * config.superVirusValue;
      const grown = rewards.addGrowth(value);
      growBody(grown);
      sound.play("capture");
      capturedSuper += ids.size;
      captureFlash = { polygon: enclosure.polygon, until: clock + 1 };
      notify(`圈住超级病毒啦！成长 +${value}${grown ? `，长了 ${grown} 节！` : ""}`, 4);
      updateUI();
    }
  }
  const superType = VIRUS_TYPES.find(type => type.encircle);
  const hitSuper = viruses.some(virus => virus.tier === "super" && distance(head, virus) < superType.size / 2 + 20);
  const hitSnake = virusSnakes.snakes.some(snake => distance(head, snake.head) < 44
    || snake.trail.positions().some(segment => distance(head, segment) < 32));
  if (hitSuper) takeDamage("碰到超级病毒");
  else if (hitSnake) takeDamage("碰到病毒蛇");
  previousCamera = { ...camera };
  const follow = 1 - Math.exp(-dt * config.cameraFollow);
  const halfWidth = viewWidth / zoom / 2, halfHeight = viewHeight / zoom / 2;
  camera.x += (clamp(head.x, WORLD_BOUNDS.minX + halfWidth, WORLD_BOUNDS.maxX - halfWidth) - camera.x) * follow;
  camera.y += (clamp(head.y, WORLD_BOUNDS.minY + halfHeight, WORLD_BOUNDS.maxY - halfHeight) - camera.y) * follow;
}

function tile(x, y, size, glyph, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(assets.segment, x - size / 2, y - size / 2, size, size);
  if (glyph) {
    ctx.font = `700 ${Math.round(size * 0.35)}px "Microsoft YaHei", "PingFang SC", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#654620";
    ctx.fillText(glyph, x, y + size * 0.055);
  }
  ctx.restore();
}

function draw(alpha) {
  const lag = paused ? 0 : motion.speed * physicsStep * (1 - alpha);
  const renderHead = samplePath(trail.points, [lag])[0];
  const renderCamera = paused ? camera : {
    x: previousCamera.x + (camera.x - previousCamera.x) * alpha,
    y: previousCamera.y + (camera.y - previousCamera.y) * alpha,
  };
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  ctx.save();
  ctx.translate(viewWidth / 2, viewHeight / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-renderCamera.x, -renderCamera.y);
  const left = renderCamera.x - viewWidth / zoom / 2 - 2, top = renderCamera.y - viewHeight / zoom / 2 - 2;
  ctx.fillStyle = "#508a94";
  ctx.fillRect(left, top, viewWidth / zoom + 4, viewHeight / zoom + 4);
  ctx.fillStyle = floorPattern;
  const floorLeft = Math.max(left, WORLD_BOUNDS.minX), floorTop = Math.max(top, WORLD_BOUNDS.minY);
  ctx.fillRect(floorLeft, floorTop, Math.min(left + viewWidth / zoom + 4, WORLD_BOUNDS.maxX) - floorLeft,
    Math.min(top + viewHeight / zoom + 4, WORLD_BOUNDS.maxY) - floorTop);
  ctx.strokeStyle = "#d9f3ed";
  ctx.lineWidth = 10;
  ctx.strokeRect(WORLD_BOUNDS.minX, WORLD_BOUNDS.minY, WORLD_BOUNDS.size, WORLD_BOUNDS.size);
  if (captureFlash && clock < captureFlash.until) {
    ctx.save();
    ctx.globalAlpha = (captureFlash.until - clock) * 0.4;
    ctx.beginPath();
    captureFlash.polygon.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath();
    ctx.fillStyle = "#ffe39a";
    ctx.fill();
    ctx.restore();
  }
  for (const virus of viruses) {
    const type = VIRUS_TYPES.find((entry) => entry.tier === virus.tier);
    const { rotation, scale } = virusField.pose(virus);
    const visibleMargin = type.size * Math.max(1, scale) / 2 + 25;
    if (Math.abs(virus.x - renderCamera.x) > viewWidth / zoom / 2 + visibleMargin
      || Math.abs(virus.y - renderCamera.y) > viewHeight / zoom / 2 + visibleMargin) continue;
    ctx.save();
    ctx.translate(virus.x, virus.y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.drawImage(assets.virusPalettes[virus.tier][virus.color] || assets[type.asset] || assets.virus,
      -type.size / 2, -type.size / 2, type.size, type.size);
    ctx.restore();
    ctx.font = `${type.encircle ? "800 17" : virus.tier === "small" ? "600 12" : "700 14"}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineWidth = type.encircle ? 5 : 3;
    ctx.strokeStyle = "#fffdf4";
    const label = `${type.encircle ? "圈住吃 " : ""}+${config[type.valueKey]}`;
    ctx.strokeText(label, virus.x, virus.y + type.size / 2 + 3);
    ctx.fillStyle = type.encircle ? "#87541f" : "#806e92";
    ctx.fillText(label, virus.x, virus.y + type.size / 2 + 3);
  }
  for (const snake of virusSnakes.snakes) {
    if (Math.abs(snake.head.x-renderCamera.x)>viewWidth/zoom/2+450
      ||Math.abs(snake.head.y-renderCamera.y)>viewHeight/zoom/2+450) continue;
    const body=snake.trail.positions();
    for (let index=body.length-1;index>=0;index--) {
      const point=body[index],size=20+4*(1-index/Math.max(1,body.length-1));
      ctx.drawImage(assets.virusPalettes.small[snake.color],point.x-size/2,point.y-size/2,size,size);
    }
    ctx.drawImage(assets.virusPalettes.large[snake.color],snake.head.x-24,snake.head.y-24,48,48);
  }
  // Independent image sprites, not a stretched full-character illustration.
  for (const food of foods) {
    if (Math.abs(food.x - renderCamera.x) > viewWidth / zoom / 2 + 75
      || Math.abs(food.y - renderCamera.y) > viewHeight / zoom / 2 + 75) continue;
    const bob = Math.sin(clock * 2 + food.x) * 2;
    ctx.save();
    ctx.shadowColor = food.id === "target" ? "#fff1a3" : "#326e7540";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 5;
    tile(food.x, food.y + bob, food.id === "target" ? 74 : 61, food.glyph, food.id === "target" ? 1 : 0.94);
    ctx.restore();
  }
  const segments = trail.positions(lag);
  ctx.save();
  if (clock < damageFlashUntil && Math.floor(clock * 22) % 2 === 0) ctx.globalAlpha = 0.2;
  // Small stars bridge the tips, so the body reads as one continuous star chain.
  const links = samplePath(trail.points, segments.map((_, i) => lag + trail.leadGap + (i - 0.5) * trail.spacing));
  for (const link of links) tile(link.x, link.y, config.bodySize * 0.54, "");
  for (let i = segments.length - 1; i >= 0; i--) {
    const item = segments[i];
    const newlyGrown = i === segments.length - 1 && clock - growthFlash < 0.65;
    const size = newlyGrown ? config.bodySize * (1 + Math.sin((clock - growthFlash) / 0.65 * Math.PI) * 0.135) : config.bodySize;
    tile(item.x, item.y, size, "");
  }
  if (segments.length) {
    const neck = trail.neck(lag);
    tile(neck.x, neck.y, config.bodySize * 0.69, "");
  }
  ctx.save();
  ctx.translate(renderHead.x, renderHead.y - 4 + Math.sin(clock * 3) * config.hover);
  ctx.rotate(clamp(motion.turnRate / motion.maxTurnRate, -1, 1) * config.headBank * Math.PI / 180);
  ctx.shadowColor = "#4a57362b";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 7;
  const scale = config.headSize / metadata.head.width;
  ctx.drawImage(assets.head, -metadata.head.anchor.x * scale, -metadata.head.anchor.y * scale,
    metadata.head.width * scale, metadata.head.height * scale);
  ctx.restore();
  for (const star of starBursts.active(clock)) {
    ctx.save();
    ctx.translate(star.x, star.y);
    ctx.rotate(star.rotation);
    ctx.globalAlpha *= star.opacity;
    ctx.shadowColor = "#fff1a2";
    ctx.shadowBlur = 9;
    ctx.drawImage(assets.segment, -star.size / 2, -star.size / 2, star.size, star.size);
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();
}

function pollGamepad() {
  let unavailable = false;
  try { gamepadState = gamepad.poll(navigator.getGamepads?.() ?? [], config.gamepadDeadzone); }
  catch { gamepadState = null; unavailable = true; }
  const status = $("gamepadStatus");
  const connected = Boolean(gamepadState?.supported);
  const label = unavailable || !navigator.getGamepads ? "手柄：浏览器暂时无法读取手柄"
    : !gamepadState ? "手柄：请按一下手柄按键连接"
    : !connected ? "手柄：已检测到设备，尚不支持此按键布局"
    : "手柄已连接 · 摇杆 / 十字键 / ABXY 转向";
  if (status.textContent !== label) {
    status.textContent = label;
    status.dataset.connected = String(connected);
  }
  status.title = gamepadState?.id ?? "连接微软 / Xbox 手柄后，在游戏页按一下手柄按键";
  const padAngle = gamepadState?.angle ?? null;
  const changed = padAngle !== null && (lastPadAngle === null
    || Math.abs(Math.atan2(Math.sin(padAngle - lastPadAngle), Math.cos(padAngle - lastPadAngle))) > 0.02);
  lastPadAngle = padAngle;
  if (padAngle === null) {
    padNeedsNeutral = false;
    if (inputOwner === "gamepad") { desiredAngle = angle; inputOwner = null; }
  }
  if (gamepadState?.connected || !gamepadPlayActive || mode !== "manual" || document.hidden)
    gamepadMissingSince = null;
  else {
    gamepadMissingSince ??= performance.now();
    if (performance.now() - gamepadMissingSince >= 1200) {
      gamepadPlayActive = false;
      setPaused(true, "手柄已断开，连接后按菜单键继续");
    }
  }
  const editing = document.activeElement?.closest("input, textarea, select, [contenteditable=true]");
  if (!ready || document.hidden || (!document.hasFocus() && !gamepadPlayActive) || editing) {
    padNeedsNeutral = true;
    if (inputOwner === "gamepad") { desiredAngle = angle; inputOwner = null; }
    return;
  }
  if (gamepadState?.pausePressed) {
    if (mode === "auto") setMode("manual");
    else setPaused(!paused, "手柄已暂停");
    gamepadPlayActive = true;
    return;
  }
  if (paused) { if (padAngle !== null) padNeedsNeutral = true; return; }
  if (padAngle !== null && !padNeedsNeutral && changed) {
    if (mode !== "manual") setMode("manual");
    pointer = null;
    controls.clear();
    inputOwner = "gamepad";
    gamepadPlayActive = true;
  }
}

function frame(time) {
  const elapsed = Math.min((time - lastTime) / 1000 || 0, 0.25);
  lastTime = time;
  if (ready) {
    pollGamepad();
    if (!paused) accumulator += elapsed;
    while (!paused && accumulator >= physicsStep) {
      update(physicsStep);
      accumulator -= physicsStep;
    }
    draw(accumulator / physicsStep);
  }
  requestAnimationFrame(frame);
}

function steer(direction) {
  if (!ready) return;
  if (mode !== "manual") setMode("manual");
  if (paused) setPaused(false);
  pointer = null;
  controls.clear();
  inputOwner = "keyboard";
  gamepadPlayActive = false;
  desiredAngle = { up: -Math.PI / 2, right: 0, down: Math.PI / 2, left: Math.PI }[direction];
}

document.addEventListener("keydown", (event) => {
  if (event.target.closest("input, textarea, select, [contenteditable=true]")) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const action = actionForKey(event.key);
  if (action && ready) {
    event.preventDefault();
    if (event.repeat) return;
    if (mode !== "manual") setMode("manual");
    if (paused) setPaused(false);
    pointer = null;
    inputOwner = "keyboard";
    gamepadPlayActive = false;
    controls.press(event.code, action);
    const input = controls.read();
    desiredAngle = input.turn !== null ? angle : input.angle ?? desiredAngle;
  }
  if (event.code === "Space" && !event.target.closest("button")) { event.preventDefault(); if (!event.repeat) setPaused(!paused, "键盘已暂停"); }
});
document.addEventListener("keyup", (event) => {
  const wasTurning = controls.read().turn !== null;
  controls.release(event.code);
  if (wasTurning && controls.read().turn === null) desiredAngle = angle;
});
$("startButton").addEventListener("click", () => { setMode("manual"); canvas.focus({ preventScroll: true }); });
$("autoButton").addEventListener("click", () => setMode("auto"));
$("resetButton").addEventListener("click", () => { if (ready) reset(); });
function syncSoundButton() {
  const state = sound.getState();
  const button = $("soundToggle");
  button.disabled = !state.supported;
  button.textContent = !state.supported ? "声音不可用" : state.active ? "🔊 声音开" : state.enabled ? "♫ 开启声音" : "🔇 声音关";
  button.setAttribute("aria-pressed", String(state.active));
  button.title = state.active ? "关闭背景音乐和音效" : "开启背景音乐和音效";
}
syncSoundButton();
$("soundToggle").addEventListener("click", async () => { await sound.toggle(); syncSoundButton(); });
const unlockSound = (event) => {
  if (event.target?.closest?.("#soundToggle")) return;
  if (!sound.getState().active) void sound.unlock().then(syncSoundButton);
};
document.addEventListener("pointerdown", unlockSound, { capture: true });
document.addEventListener("keydown", unlockSound, { capture: true });
$("resumeButton").addEventListener("click", () => { setPaused(false); canvas.focus({ preventScroll: true }); });
document.querySelectorAll("[data-direction]").forEach((button) => {
  const direct = () => { steer(button.dataset.direction); canvas.focus({ preventScroll: true }); };
  button.addEventListener("pointerdown", (event) => { event.preventDefault(); direct(); });
  button.addEventListener("click", (event) => { if (event.detail === 0) direct(); });
});
function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
canvas.addEventListener("pointerdown", (event) => {
  if (!ready || paused) return;
  event.preventDefault();
  if (mode !== "manual") setMode("manual");
  controls.clear();
  inputOwner = "pointer";
  gamepadPlayActive = false;
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  pointerPosition(event);
});
canvas.addEventListener("pointermove", (event) => { if (pointer) pointerPosition(event); });
for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(name, () => { pointer = null; });
window.addEventListener("blur", () => {
  pointer = null;
  controls.clear();
  if (mode === "manual" && !gamepadPlayActive) setPaused(true, "窗口失焦，返回后继续");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { gamepadPlayActive = false; setPaused(true, "页面已切换，返回后继续"); }
});
$("speakButton").addEventListener("click", () => {
  if (!("speechSynthesis" in window)) { notify("这台浏览器暂时没有朗读功能"); return; }
  const [glyph, word] = LESSONS[lessonIndex % LESSONS.length];
  const speech = new SpeechSynthesisUtterance(`${glyph}，${word}的${glyph}`);
  speech.lang = "zh-CN";
  speech.rate = 0.8;
  speech.onerror = () => notify("朗读暂时不可用，可以先看字继续玩");
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(speech);
});
new ResizeObserver(resize).observe($("stage"));
tuning = setupTuning({ values: config, apply: applyConfig });
tuning.sync(config, saveConfig(localConfigStorage, config));
setupFullscreen({ area: $("playArea"), button: $("fullscreenButton"), canvas });
setupUpdates({ beforeUpdate: () => setPaused(true, "正在更新游戏…") });

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`素材加载失败：${path}`));
    img.src = path;
  });
}

// Read-only inspection for browser checks; input and growth still use the actual game loop.
Object.defineProperty(window, "__snakeDemo", { value: Object.freeze({ getState: () => ({
  ready, paused, mode, collected: rewards.stars, length: trail.glyphs.length, head: head && { ...head }, angle,
  rewards: { stars: rewards.stars, growthPoints: rewards.growthPoints, threshold: rewards.threshold, glyphs: [...rewards.glyphs] },
  viruses: viruses?.map((virus) => ({ ...virus, pose: virusField.pose(virus) })),
  segments: trail.positions(), target: target && { ...target },
  camera: { ...camera }, turnRate: motion?.turnRate, distance: motion?.distance, simulationTime: clock,
  steering: { ...controls.read(), desiredAngle },
  gamepad: gamepadState && { ...gamepadState }, inputOwner, gamepadPlayActive, pauseReason,
  config: { ...config }, stepDistance: motion?.speed * physicsStep,
  world: { bounded: true, bounds: WORLD_BOUNDS, cells: virusField.cells.size, foods: foods?.length, body: "stars" },
  enclosure: { capturedSuper, flash: captureFlash && { until: captureFlash.until }, bodyLength: trail.leadGap + (trail.glyphs.length - 1) * trail.spacing },
  damage: { hits: damageHits, lastCause: lastDamageCause, lastAt: lastDamageAt, flashing: clock < damageFlashUntil },
  virusSnakes: virusSnakes.getState(),
  virusSnakeTargetCount: virusSnakes.count,
  enemyDefeats: virusSnakes.defeated,
  virusDrops: virusField.drops.filter(virus => !virus.consumed).map(virus => ({ id: virus.id, x: virus.x, y: virus.y, tier: virus.tier })),
  viewport: { width: viewWidth, height: viewHeight, zoom },
  sound: sound.getState(), starParticles: starBursts.active(clock).length,
}) }) });

try {
  const response = await fetch("./assets/sprites.json");
  if (!response.ok) throw new Error("素材配置加载失败");
  metadata = await response.json();
  const variants = VIRUS_TYPES.flatMap(type => VIRUS_COLORS.slice(1).map(color => ({ tier: type.tier, color })));
  const [headImage, segment, floor, virus, virusSmall, virusMedium, virusSuper, ...variantImages] = await Promise.all([
    loadImage("./assets/flystar-head-v1.png"), loadImage("./assets/hanzi-star-v2.png"), loadImage("./assets/arena-floor-v2.jpg"),
    loadImage("./assets/virus-purple-v1.png"),
    loadImage("./assets/virus-small-v4.png"), loadImage("./assets/virus-medium-v4.png"), loadImage("./assets/virus-super-v2.png"),
    ...variants.map(({ tier, color }) => loadImage(`./assets/virus-${tier}-${color}-v1.png`)),
  ]);
  const baseViruses = { small: virusSmall, medium: virusMedium, large: virus, super: virusSuper };
  const virusPalettes = Object.fromEntries(VIRUS_TYPES.map(type => [type.tier, { violet: baseViruses[type.tier] }]));
  variants.forEach(({ tier, color }, index) => { virusPalettes[tier][color] = variantImages[index]; });
  assets = { head: headImage, segment, floor, virus, virusSmall, virusMedium, virusSuper, virusPalettes };
  floorPattern = ctx.createPattern(assets.floor, "repeat");
  resize();
  reset();
  ready = true;
  $("loading").hidden = true;
  requestAnimationFrame(frame);
} catch (error) {
  $("loading").textContent = `${error.message}。请通过本地服务打开此页面。`;
  console.error(error);
}

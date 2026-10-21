import { GlyphTrail, turnTowards } from "./trail.js";

const $ = (id) => document.getElementById(id);
const canvas = $("game");
const ctx = canvas.getContext("2d");
const WORLD = { width: 1600, height: 1067, margin: 220 };
const INITIAL = [..."大山小鸟花草日月"];
const LESSONS = [
  ["山", "大山"], ["水", "河水"], ["木", "木头"], ["花", "花朵"],
  ["鸟", "小鸟"], ["日", "日出"], ["月", "月亮"], ["云", "白云"],
  ["田", "田地"], ["土", "土地"], ["人", "大人"], ["口", "人口"],
];
const trail = new GlyphTrail({ spacing: 45, leadGap: 80, glyphs: INITIAL });
let head, angle, desiredAngle, collected, lessonIndex, foods, mode = "auto";
let paused = false, ready = false, pointer = null, viewWidth = 900, viewHeight = 550;
let zoom = 1, camera = { x: 800, y: 550 }, clock = 0, lastTime = 0, toastUntil = 6;
let assets, metadata, lastWrong = -10, growthFlash = -10;
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
  $("collectedCount").textContent = collected;
  $("glyphBag").replaceChildren(...trail.glyphs.map((glyph) => {
    const span = document.createElement("span");
    span.className = "bag-glyph";
    span.textContent = glyph;
    return span;
  }));
  $("modeLabel").textContent = mode === "auto" ? "自动演示" : "自由操控";
  $("autoButton").setAttribute("aria-pressed", String(mode === "auto"));
  $("stageHint").textContent = mode === "auto"
    ? "按方向键，接过小飞星的方向盘" : "方向键转向 · 按住场地拖动 · 空格暂停";
}

function spawnFoods() {
  const target = LESSONS[lessonIndex % LESSONS.length][0];
  const turn = collected % 4 < 2 ? 0.85 : -0.85;
  let destination = {
    x: head.x + Math.cos(angle + turn) * 215,
    y: head.y + Math.sin(angle + turn) * 215,
  };
  destination.x = clamp(destination.x, WORLD.margin + 40, WORLD.width - WORLD.margin - 40);
  destination.y = clamp(destination.y, WORLD.margin + 20, WORLD.height - WORLD.margin - 20);
  if (distance(head, destination) < 130) {
    const towardCenter = Math.atan2(WORLD.height / 2 - head.y, WORLD.width / 2 - head.x);
    destination = { x: head.x + Math.cos(towardCenter) * 200, y: head.y + Math.sin(towardCenter) * 200 };
  }
  foods = [{ ...destination, glyph: target, correct: true }];
  for (let i = 1; i <= 2; i++) {
    const dir = angle + (i === 1 ? -1.2 : 2.1);
    const glyph = LESSONS[(lessonIndex + i) % LESSONS.length][0];
    foods.push({ x: clamp(head.x + Math.cos(dir) * (180 + i * 25), 250, 1350),
      y: clamp(head.y + Math.sin(dir) * (180 + i * 25), 250, 815), glyph, correct: false });
  }
}

function reset() {
  head = { x: 850, y: 550 };
  angle = -0.35;
  desiredAngle = angle;
  collected = 0;
  lessonIndex = 0;
  pointer = null;
  growthFlash = -10;
  // Seed actual route history so the assembled body has a curve immediately.
  const history = [];
  for (let d = 0; d <= 1000; d += 4) {
    history.push({ x: head.x - d * 0.81, y: head.y + Math.sin(d / 135) * 96 });
  }
  trail.reset(history, INITIAL);
  camera = { x: 780, y: 560 };
  paused = false;
  $("pauseOverlay").hidden = true;
  spawnFoods();
  updateUI();
  notify("看，小飞星正在带着汉字转弯", 5);
}

function setMode(next) {
  if (!ready) return;
  mode = next;
  pointer = null;
  paused = false;
  $("pauseOverlay").hidden = true;
  desiredAngle = angle;
  updateUI();
  notify(mode === "auto" ? "小飞星带你看：吃字，转弯，再长一节" : "轮到你啦！找到上面的目标字");
}

function setPaused(value, title = "休息一下") {
  if (!ready) return;
  paused = value;
  pointer = null;
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
  zoom = viewWidth < 500 ? 0.77 : Math.min(1.1, viewWidth / 820);
}

function update(dt) {
  clock += dt;
  if (clock > toastUntil) $("message").classList.add("is-quiet");
  if (mode === "auto") desiredAngle = Math.atan2(foods[0].y - head.y, foods[0].x - head.x);
  else if (pointer) {
    const destination = { x: (pointer.x - viewWidth / 2) / zoom + camera.x,
      y: (pointer.y - viewHeight / 2) / zoom + camera.y };
    if (distance(head, destination) > 12) desiredAngle = Math.atan2(destination.y - head.y, destination.x - head.x);
  }
  // Gentle boundary steering keeps this art prototype playable without a game-over screen.
  if (mode === "manual" && (head.x < 220 || head.x > 1380 || head.y < 210 || head.y > 857)) {
    desiredAngle = Math.atan2(WORLD.height / 2 - head.y, WORLD.width / 2 - head.x);
  }
  angle = turnTowards(angle, desiredAngle, 3.3 * dt);
  head.x += Math.cos(angle) * 116 * dt;
  head.y += Math.sin(angle) * 116 * dt;
  trail.moveTo(head);
  const food = foods.find((item) => distance(head, item) < 31);
  if (food?.correct) {
    const [, word] = LESSONS[lessonIndex % LESSONS.length];
    trail.grow(food.glyph);
    collected += 1;
    lessonIndex += 1;
    growthFlash = clock;
    notify(`吃到「${food.glyph}」啦！${word}的${food.glyph}，队伍又长一节`);
    spawnFoods();
    updateUI();
  } else if (food && clock - lastWrong > 2.5) {
    lastWrong = clock;
    notify(`再找找看，这次要找「${foods[0].glyph}」`, 2);
  }
  const follow = 1 - Math.exp(-dt * 3);
  const aim = { x: head.x - Math.cos(angle) * 78, y: head.y - Math.sin(angle) * 40 };
  const halfW = viewWidth / zoom / 2, halfH = viewHeight / zoom / 2;
  camera.x += (clamp(aim.x, halfW, WORLD.width - halfW) - camera.x) * follow;
  camera.y += (clamp(aim.y, halfH, WORLD.height - halfH) - camera.y) * follow;
}

function tile(x, y, size, glyph, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(assets.segment, x - size / 2, y - size / 2, size, size);
  if (glyph) {
    ctx.font = `700 ${Math.round(size * 0.49)}px "Microsoft YaHei", "PingFang SC", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#685035";
    ctx.fillText(glyph, x, y + size * 0.018);
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  ctx.save();
  ctx.translate(viewWidth / 2, viewHeight / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-camera.x, -camera.y);
  ctx.drawImage(assets.meadow, 0, 0, WORLD.width, WORLD.height);
  // Independent image sprites, not a stretched full-character illustration.
  for (const food of foods) {
    const bob = Math.sin(clock * 2.4 + food.x) * 3;
    ctx.save();
    ctx.shadowColor = "#4a64393b";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 5;
    tile(food.x, food.y + bob, 61, food.glyph);
    ctx.restore();
  }
  const segments = trail.positions();
  for (let i = segments.length - 1; i >= 0; i--) {
    const item = segments[i];
    const newlyGrown = i === segments.length - 1 && clock - growthFlash < 0.65;
    const size = newlyGrown ? 55 + Math.sin((clock - growthFlash) / 0.65 * Math.PI) * 12 : 55;
    tile(item.x, item.y, size, item.glyph);
  }
  const neck = trail.neck();
  tile(neck.x, neck.y, 47, "");
  ctx.save();
  ctx.translate(head.x, head.y - 4 + Math.sin(clock * 4) * 2);
  ctx.rotate(Math.sin(angle) * 0.07);
  ctx.shadowColor = "#4a57362b";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 7;
  const scale = 128 / metadata.head.width;
  ctx.drawImage(assets.head, -metadata.head.anchor.x * scale, -metadata.head.anchor.y * scale,
    metadata.head.width * scale, metadata.head.height * scale);
  ctx.restore();
  ctx.restore();
}

function frame(time) {
  let remaining = Math.min((time - lastTime) / 1000 || 0, 0.25);
  lastTime = time;
  if (ready) {
    // Substeps preserve collision checks and smooth route samples on slower devices.
    while (!paused && remaining > 0) {
      const step = Math.min(remaining, 1 / 60);
      update(step);
      remaining -= step;
    }
    draw();
  }
  requestAnimationFrame(frame);
}

function steer(direction) {
  if (!ready) return;
  if (mode !== "manual") setMode("manual");
  if (paused) setPaused(false);
  pointer = null;
  desiredAngle = { up: -Math.PI / 2, right: 0, down: Math.PI / 2, left: Math.PI }[direction];
}

const keys = { ArrowUp: "up", w: "up", ArrowLeft: "left", a: "left", ArrowDown: "down", s: "down", ArrowRight: "right", d: "right" };
document.addEventListener("keydown", (event) => {
  if (event.target.closest("button, input, textarea, select, [contenteditable=true]")) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (keys[key]) { event.preventDefault(); steer(keys[key]); }
  if (event.code === "Space") { event.preventDefault(); if (!event.repeat) setPaused(!paused); }
});
$("startButton").addEventListener("click", () => { setMode("manual"); canvas.focus({ preventScroll: true }); });
$("autoButton").addEventListener("click", () => setMode("auto"));
$("resetButton").addEventListener("click", () => { if (ready) reset(); });
$("resumeButton").addEventListener("click", () => { setPaused(false); canvas.focus({ preventScroll: true }); });
document.querySelectorAll("[data-direction]").forEach((button) => {
  button.addEventListener("click", () => { steer(button.dataset.direction); canvas.focus({ preventScroll: true }); });
});
function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
canvas.addEventListener("pointerdown", (event) => {
  if (!ready || paused) return;
  event.preventDefault();
  if (mode !== "manual") setMode("manual");
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  pointerPosition(event);
});
canvas.addEventListener("pointermove", (event) => { if (pointer) pointerPosition(event); });
for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(name, () => { pointer = null; });
window.addEventListener("blur", () => { pointer = null; if (mode === "manual") setPaused(true); });
document.addEventListener("visibilitychange", () => { if (document.hidden) setPaused(true); });
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
  ready, paused, mode, collected, length: trail.glyphs.length, head: head && { ...head }, angle,
  segments: trail.positions(), target: foods?.[0] && { ...foods[0] },
  viewport: { width: viewWidth, height: viewHeight, zoom },
}) }) });

try {
  const response = await fetch("./assets/sprites.json");
  if (!response.ok) throw new Error("素材配置加载失败");
  metadata = await response.json();
  const [headImage, segment, meadow] = await Promise.all([
    loadImage("./assets/flystar-head-v1.png"), loadImage("./assets/hanzi-segment-v1.png"), loadImage("./assets/meadow-v1.jpg"),
  ]);
  assets = { head: headImage, segment, meadow };
  resize();
  reset();
  ready = true;
  $("loading").hidden = true;
  requestAnimationFrame(frame);
} catch (error) {
  $("loading").textContent = `${error.message}。请通过本地服务打开此页面。`;
  console.error(error);
}

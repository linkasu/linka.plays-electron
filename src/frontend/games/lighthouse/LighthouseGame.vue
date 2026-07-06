<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeLighthousePiano, playLighthouseCue, setLighthousePianoActive, tickLighthousePiano, warmLighthousePiano } from "./audio";

type Point = { x: number; y: number };
type BoatPhase = "drifting" | "guided" | "docked";
type Boat = Point & {
  id: string;
  phase: BoatPhase;
  hue: number;
  size: number;
  speed: number;
  bob: number;
  dockOffsetX: number;
  dockOffsetY: number;
  dockedAt: number;
};
type Star = Point & { radius: number; alpha: number; twinkle: number };
type Ripple = Point & { age: number; life: number; radius: number };

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("lighthouse", {
  maxSteps: 8,
  overrides: { preset: "gentle", targetScale: 1.75, motionSpeed: 0.34, distractors: "none", hints: "high", sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const boats = reactive<Boat[]>([]);
const stars = reactive<Star[]>([]);
const ripples = reactive<Ripple[]>([]);
const resultVisible = computed(() => session.status === "finished");

let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let enteredAt: number | undefined;
let dwellProgress = 0;
let beamAge = 0;
let activeBoatId = "";
let finishAfter = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function waterTop() {
  return window.innerHeight * 0.54;
}

function lighthouseLamp(): Point {
  return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.34 + 80 };
}

function lighthouseOffsetY() {
  return 80;
}

function islandCenter(): Point {
  return { x: window.innerWidth * 0.5, y: waterTop() + window.innerHeight * 0.115 };
}

function islandSize() {
  return {
    width: Math.min(560, Math.max(300, window.innerWidth * 0.34)),
    height: Math.min(170, Math.max(110, window.innerHeight * 0.16))
  };
}

function dockPoint(boat?: Boat): Point {
  const center = islandCenter();
  const size = islandSize();
  return {
    x: center.x + (boat?.dockOffsetX ?? 0),
    y: center.y + (boat?.dockOffsetY ?? size.height * 0.36)
  };
}

function hitRadius() {
  return Math.min(190, Math.max(118, 90 * session.settings.targetScale));
}

function copyPointer() {
  return {
    x: pointer.value.x,
    y: pointer.value.y,
    valid: pointer.value.valid,
    source: pointer.value.source,
    timestamp: pointer.value.timestamp
  };
}

function initScene() {
  stars.splice(0);
  boats.splice(0);
  ripples.splice(0);
  activeBoatId = "";
  finishAfter = 0;
  const starCount = Math.min(120, Math.max(46, Math.round(window.innerWidth / 13)));
  for (let index = 0; index < starCount; index++) {
    stars.push({
      x: randomRange(0, window.innerWidth),
      y: randomRange(0, waterTop() * 0.86),
      radius: randomRange(0.7, 2.2),
      alpha: randomRange(0.16, 0.6),
      twinkle: randomRange(0, Math.PI * 2)
    });
  }
  for (let index = 0; index < session.maxSteps; index++) boats.push(createBoat(index));
}

function createBoat(index: number): Boat {
  const side = index % 2 === 0 ? -1 : 1;
  const island = islandSize();
  const berthColumns = [-0.28, -0.13, 0.04, 0.2];
  const berthRows = [0.28, 0.39];
  return {
    id: `lighthouse-boat-${index}`,
    x: window.innerWidth * (side < 0 ? randomRange(0.12, 0.34) : randomRange(0.66, 0.88)),
    y: waterTop() + window.innerHeight * randomRange(0.18, 0.38),
    phase: "drifting",
    hue: [24, 38, 196, 214, 282][index % 5],
    size: Math.min(68, Math.max(44, window.innerWidth * 0.04)) * randomRange(0.9, 1.12),
    speed: randomRange(8, 18) * session.settings.motionSpeed * side,
    bob: randomRange(0, Math.PI * 2),
    dockOffsetX: island.width * berthColumns[index % berthColumns.length],
    dockOffsetY: island.height * berthRows[Math.floor(index / berthColumns.length) % berthRows.length],
    dockedAt: 0
  };
}

function resizeCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx = canvas.getContext("2d") ?? undefined;
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  initScene();
}

function resetDwell() {
  enteredAt = undefined;
  dwellProgress = 0;
}

function nextBoat() {
  if (boats.some((boat) => boat.phase === "guided")) return undefined;
  return boats.find((boat) => boat.phase === "drifting");
}

function targetPayload(now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: `lighthouse:lamp:${session.step + 1}`,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: enteredAt === undefined ? 0 : now - enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function lightBeam(now: number) {
  const boat = nextBoat();
  if (!boat) return;
  recordEvent("target-click", targetPayload(now, 1));
  recordSuccess({ targetId: boat.id, mode: "lighthouse-guided-boat" });
  playLighthouseCue(session.settings.sound);
  boat.phase = "guided";
  activeBoatId = boat.id;
  beamAge = 0;
  resetDwell();
}

function updateDwell(now: number) {
  if (session.status !== "running" || session.step >= session.maxSteps) return;
  if (boats.some((boat) => boat.phase === "guided")) {
    resetDwell();
    return;
  }
  const lamp = lighthouseLamp();
  const inside = pointer.value.valid && distance(pointer.value, lamp) <= hitRadius();
  if (!inside) {
    if (enteredAt !== undefined) recordEvent("target-cancel", targetPayload(now, dwellProgress, pointer.value.valid ? "left" : "invalid-gaze"));
    resetDwell();
    return;
  }
  if (enteredAt === undefined) {
    enteredAt = now;
    recordEvent("target-enter", targetPayload(now, 0));
  }
  dwellProgress = Math.min(1, (now - enteredAt) / session.settings.dwellMs);
  if (dwellProgress >= 1) lightBeam(now);
}

function updateBoats(delta: number, now: number) {
  for (const boat of boats) {
    boat.bob += delta * 1.7;
    if (boat.phase === "drifting") {
      boat.x += boat.speed * delta;
      boat.y += Math.sin(boat.bob) * delta * 5;
      if (boat.x < -boat.size) boat.x = window.innerWidth + boat.size;
      if (boat.x > window.innerWidth + boat.size) boat.x = -boat.size;
      continue;
    }
    if (boat.phase === "guided") {
      const dock = dockPoint(boat);
      boat.x += (dock.x - boat.x) * Math.min(1, delta * 1.45);
      boat.y += (dock.y - boat.y) * Math.min(1, delta * 1.45);
      if (distance(boat, dock) < 12) {
        boat.phase = "docked";
        boat.dockedAt = now;
        if (activeBoatId === boat.id) activeBoatId = "";
        ripples.push({ x: boat.x, y: boat.y, age: 0, life: 1.8, radius: boat.size });
        if (session.step >= session.maxSteps) finishAfter = now + 1800;
      }
    }
  }
}

function updateRipples(delta: number) {
  for (let index = ripples.length - 1; index >= 0; index--) {
    ripples[index].age += delta;
    if (ripples[index].age >= ripples[index].life) ripples.splice(index, 1);
  }
}

function update(delta: number, now: number) {
  if (session.status === "running") {
    updateDwell(now);
    tickLighthousePiano(session.settings.sound);
  }
  setLighthousePianoActive(session.settings.sound, session.status === "running");
  beamAge += delta;
  updateBoats(delta, now);
  updateRipples(delta);
  if (finishAfter > 0 && now >= finishAfter) finishSession("max-steps");
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#081027");
  sky.addColorStop(0.5, "#102345");
  sky.addColorStop(1, "#0a2837");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);
  context.save();
  for (const star of stars) {
    const pulse = 0.72 + Math.sin(now * 0.0005 + star.twinkle) * 0.28;
    context.globalAlpha = star.alpha * pulse;
    context.fillStyle = "#e6f2ff";
    context.beginPath();
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawWater(context: CanvasRenderingContext2D, now: number) {
  const top = waterTop();
  const water = context.createLinearGradient(0, top, 0, window.innerHeight);
  water.addColorStop(0, "#174d63");
  water.addColorStop(0.52, "#0b4259");
  water.addColorStop(1, "#062534");
  context.fillStyle = water;
  context.fillRect(0, top, window.innerWidth, window.innerHeight - top);
  context.save();
  context.strokeStyle = "rgb(170 224 232 / 18%)";
  context.lineWidth = 2;
  for (let line = 0; line < 11; line++) {
    const y = top + 22 + line * ((window.innerHeight - top) / 11);
    context.beginPath();
    for (let index = 0; index <= 46; index++) {
      const x = window.innerWidth * index / 46;
      const wave = Math.sin(index * 0.68 + line * 0.8 + now * 0.0007) * 7;
      if (index === 0) context.moveTo(x, y + wave);
      else context.lineTo(x, y + wave);
    }
    context.stroke();
  }
  context.restore();
}

function drawBeam(context: CanvasRenderingContext2D) {
  const boat = boats.find((item) => item.id === activeBoatId && item.phase === "guided");
  const lamp = lighthouseLamp();
  if (!boat && dwellProgress <= 0) return;
  const target = boat ?? { x: window.innerWidth * 0.72, y: waterTop() + 64 };
  const alpha = boat ? 0.46 : dwellProgress * 0.34;
  context.save();
  context.globalCompositeOperation = "lighter";
  const gradient = context.createLinearGradient(lamp.x, lamp.y, target.x, target.y);
  gradient.addColorStop(0, `rgb(255 226 141 / ${alpha})`);
  gradient.addColorStop(1, "rgb(141 221 255 / 0)");
  context.strokeStyle = gradient;
  context.lineCap = "round";
  context.lineWidth = Math.max(42, window.innerWidth * 0.045);
  context.beginPath();
  context.moveTo(lamp.x, lamp.y);
  context.lineTo(target.x, target.y);
  context.stroke();
  context.restore();
}

function drawIsland(context: CanvasRenderingContext2D, now: number) {
  const center = islandCenter();
  const width = Math.min(560, Math.max(300, window.innerWidth * 0.34));
  const height = Math.min(170, Math.max(110, window.innerHeight * 0.16));
  context.save();
  context.fillStyle = "rgb(225 190 117 / 42%)";
  context.beginPath();
  context.ellipse(center.x, center.y + height * 0.16, width * 0.58, height * 0.42, -0.02, 0, Math.PI * 2);
  context.fill();
  const sand = context.createLinearGradient(0, center.y - height * 0.34, 0, center.y + height * 0.56);
  sand.addColorStop(0, "#d7b16c");
  sand.addColorStop(0.62, "#c8944f");
  sand.addColorStop(1, "#8f693d");
  context.fillStyle = sand;
  context.beginPath();
  context.moveTo(center.x - width * 0.45, center.y + height * 0.16);
  context.bezierCurveTo(center.x - width * 0.38, center.y - height * 0.24, center.x - width * 0.14, center.y - height * 0.44, center.x + width * 0.08, center.y - height * 0.34);
  context.bezierCurveTo(center.x + width * 0.36, center.y - height * 0.2, center.x + width * 0.5, center.y + height * 0.06, center.x + width * 0.42, center.y + height * 0.34);
  context.bezierCurveTo(center.x + width * 0.14, center.y + height * 0.55, center.x - width * 0.24, center.y + height * 0.5, center.x - width * 0.45, center.y + height * 0.16);
  context.closePath();
  context.fill();
  context.strokeStyle = "rgb(255 238 181 / 34%)";
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = "#5b5f62";
  for (const rock of [-0.32, -0.2, 0.28, 0.38]) {
    context.beginPath();
    context.ellipse(center.x + width * rock, center.y + height * (0.16 + Math.abs(rock) * 0.2), width * 0.035, height * 0.05, rock, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawLighthouse(context: CanvasRenderingContext2D, now: number) {
  const lamp = lighthouseLamp();
  const baseY = waterTop() + 46 + lighthouseOffsetY();
  const glow = Math.max(dwellProgress, boats.some((boat) => boat.phase === "guided") ? 1 : 0);
  context.save();
  context.translate(lamp.x, 0);
  const lampGlow = context.createRadialGradient(0, lamp.y, 0, 0, lamp.y, hitRadius() * 1.3);
  lampGlow.addColorStop(0, `rgb(255 231 151 / ${0.2 + glow * 0.22})`);
  lampGlow.addColorStop(1, "rgb(255 231 151 / 0)");
  context.fillStyle = lampGlow;
  context.beginPath();
  context.arc(0, lamp.y, hitRadius() * 1.3, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#c74652";
  context.beginPath();
  context.moveTo(-62, lamp.y - 70);
  context.lineTo(62, lamp.y - 70);
  context.lineTo(40, lamp.y - 22);
  context.lineTo(-40, lamp.y - 22);
  context.closePath();
  context.fill();
  context.fillStyle = "#f7f0dc";
  context.beginPath();
  context.moveTo(-46, lamp.y + 20);
  context.lineTo(46, lamp.y + 20);
  context.lineTo(70, baseY);
  context.lineTo(-70, baseY);
  context.closePath();
  context.fill();
  context.fillStyle = "#c84d56";
  for (const offset of [86, 154]) {
    context.save();
    context.translate(0, lamp.y + offset);
    context.rotate(-0.12);
    context.fillRect(-64, -12, 128, 24);
    context.restore();
  }
  context.fillStyle = "#ffe7a0";
  context.beginPath();
  context.roundRect(-42, lamp.y - 24, 84, 48, 14);
  context.fill();
  context.fillStyle = "#3d313a";
  context.beginPath();
  context.roundRect(-22, baseY - 58, 44, 58, 20);
  context.fill();
  context.restore();
}

function drawBoat(context: CanvasRenderingContext2D, boat: Boat, now: number) {
  const bobY = Math.sin(boat.bob + now * 0.001) * 4;
  const size = boat.size;
  context.save();
  context.translate(boat.x, boat.y + bobY);
  context.globalAlpha = boat.phase === "docked" ? 0.62 : 1;
  context.fillStyle = `hsl(${boat.hue} 58% 52%)`;
  context.beginPath();
  context.moveTo(-size * 0.75, 0);
  context.quadraticCurveTo(0, size * 0.45, size * 0.75, 0);
  context.lineTo(size * 0.48, size * 0.28);
  context.lineTo(-size * 0.48, size * 0.28);
  context.closePath();
  context.fill();
  context.strokeStyle = "rgb(255 245 218 / 72%)";
  context.lineWidth = Math.max(2, size * 0.045);
  context.beginPath();
  context.moveTo(0, -size * 0.68);
  context.lineTo(0, 0);
  context.stroke();
  context.fillStyle = "rgb(255 245 218 / 86%)";
  context.beginPath();
  context.moveTo(0, -size * 0.64);
  context.lineTo(size * 0.42, -size * 0.08);
  context.lineTo(0, -size * 0.02);
  context.closePath();
  context.fill();
  context.restore();
}

function drawRipples(context: CanvasRenderingContext2D) {
  context.save();
  context.strokeStyle = "rgb(210 246 255 / 46%)";
  context.lineWidth = 2;
  for (const ripple of ripples) {
    const progress = ripple.age / ripple.life;
    context.globalAlpha = 1 - progress;
    context.beginPath();
    context.ellipse(ripple.x, ripple.y, ripple.radius * (0.6 + progress), ripple.radius * (0.14 + progress * 0.12), 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawBackground(context, now);
  drawWater(context, now);
  drawIsland(context, now);
  drawBeam(context);
  drawRipples(context);
  for (const boat of boats) drawBoat(context, boat, now);
  drawLighthouse(context, now);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  update(delta, now);
  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  resetDwell();
  beamAge = 0;
  initScene();
  startSession();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  warmLighthousePiano(session.settings.sound);
  window.addEventListener("resize", resizeCanvas);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
  disposeLighthousePiano();
});
</script>

<template>
  <div class="lighthouse-shell">
    <canvas ref="canvasRef" class="lighthouse-canvas" />

    <GameHud
      title="Маяк"
      :step="session.step"
      :max-steps="session.maxSteps"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      @pause="pauseSession"
      @resume="resumeSession"
    />

    <GameResultDialog
      :model-value="resultVisible"
      title="Маяк"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :metrics="metrics"
      :recommendation="recommendation"
      @menu="router.push(resolveMenuRoute())"
      @restart="restart"
    />
  </div>
</template>

<style scoped>
.lighthouse-shell {
  background: #081027;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.lighthouse-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>

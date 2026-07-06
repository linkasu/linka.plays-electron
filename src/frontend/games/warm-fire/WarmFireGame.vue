<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeWarmFirePiano, playWarmFireCue, setWarmFirePianoActive, tickWarmFirePiano, warmWarmFirePiano } from "./audio";

type Point = { x: number; y: number };
type Spark = Point & {
  age: number;
  life: number;
  radius: number;
  driftX: number;
  driftY: number;
  hue: number;
  spin: number;
};
type Ember = Point & {
  phase: number;
  radius: number;
  warmth: number;
  hueShift: number;
};
type AuraRing = Point & {
  age: number;
  life: number;
  radius: number;
  hue: number;
};
type FlameFlight = Point & {
  age: number;
  life: number;
  size: number;
  driftX: number;
  driftY: number;
  hue: number;
  phase: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("warm-fire", {
  maxSteps: 8,
  overrides: { preset: "gentle", targetScale: 1.72, motionSpeed: 0.3, distractors: "none", hints: "high", sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const sparks = reactive<Spark[]>([]);
const embers = reactive<Ember[]>([]);
const auraRings = reactive<AuraRing[]>([]);
const flameFlights = reactive<FlameFlight[]>([]);
const resultVisible = computed(() => session.status === "finished");
const maxFireEnergy = 1.25;

let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let lastSparkAt = 0;
let lastFlightAt = 0;
let fireEnergy = 0.04;
let gazeHeat = 0;
let dwellProgress = 0;
let enteredAt: number | undefined;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function fireCenter(): Point {
  return {
    x: window.innerWidth * 0.5,
    y: window.innerHeight * (window.innerHeight < 720 ? 0.63 : 0.66)
  };
}

function targetRadius() {
  const viewport = Math.min(window.innerWidth, window.innerHeight);
  return clamp(viewport * 0.29 * session.settings.targetScale, 205, 360);
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
  initEmbers();
}

function initEmbers() {
  embers.splice(0);
  const center = fireCenter();
  const count = clamp(Math.round(window.innerWidth / 22), 34, 84);
  for (let index = 0; index < count; index += 1) {
    embers.push({
      x: center.x + randomRange(-210, 210),
      y: center.y + randomRange(74, 148),
      phase: randomRange(0, Math.PI * 2),
      radius: randomRange(1.7, 5.8),
      warmth: randomRange(0.36, 1),
      hueShift: randomRange(-14, 34)
    });
  }
}

function resetFire() {
  sparks.splice(0);
  auraRings.splice(0);
  flameFlights.splice(0);
  enteredAt = undefined;
  dwellProgress = 0;
  lastSparkAt = 0;
  lastFlightAt = 0;
  fireEnergy = 0.04;
  gazeHeat = 0;
  initEmbers();
}

function currentGazeInfluence() {
  if (!pointer.value.valid || session.status !== "running") return 0;
  const center = fireCenter();
  const raw = 1 - distance(pointer.value, center) / targetRadius();
  return clamp(Math.pow(Math.max(0, raw), 0.78), 0, 1);
}

function targetPayload(now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: `warm-fire:flame:${session.step + 1}`,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: enteredAt === undefined ? 0 : now - enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function addSpark(now: number, burst = false) {
  const center = fireCenter();
  const angle = randomRange(-Math.PI * 0.92, -Math.PI * 0.08);
  const energy = burst ? 1 : fireEnergy;
  sparks.push({
    x: center.x + randomRange(-70, 70),
    y: center.y + randomRange(-26, 54),
    age: 0,
    life: randomRange(2.6, 4.8) * (burst ? 1.1 : 1),
    radius: randomRange(2.2, 6.4) * (0.85 + energy * 0.54),
    driftX: Math.cos(angle) * randomRange(10, 30) * session.settings.motionSpeed,
    driftY: Math.sin(angle) * randomRange(42, 92) * session.settings.motionSpeed,
    hue: randomRange(28, 58) + fireEnergy * randomRange(18, 96),
    spin: now * 0.001 + randomRange(0, Math.PI * 2)
  });

  if (sparks.length > 150) sparks.splice(0, sparks.length - 150);
}

function addAuraRing(now: number) {
  const center = fireCenter();
  auraRings.push({
    x: center.x,
    y: center.y + 12,
    age: 0,
    life: 3.8,
    radius: targetRadius() * randomRange(0.46, 0.62),
    hue: 34 + session.step * 23 + Math.sin(now * 0.001) * 18
  });
  if (auraRings.length > 8) auraRings.splice(0, auraRings.length - 8);
}

function addFlameFlight(now: number, burst = false) {
  const center = fireCenter();
  const side = Math.random() < 0.5 ? -1 : 1;
  const energy = burst ? 1 : fireEnergy;
  flameFlights.push({
    x: center.x + randomRange(-42, 42),
    y: center.y + randomRange(-16, 34),
    age: 0,
    life: randomRange(2.9, 4.7) * (burst ? 1.08 : 1),
    size: randomRange(34, 78) * (0.64 + energy * 0.72),
    driftX: side * randomRange(18, 54) * session.settings.motionSpeed,
    driftY: -randomRange(72, 128) * session.settings.motionSpeed,
    hue: randomRange(28, 64) + energy * randomRange(18, 112),
    phase: now * 0.001 + randomRange(0, Math.PI * 2)
  });

  if (flameFlights.length > 18) flameFlights.splice(0, flameFlights.length - 18);
}

function completeWarmStep(now: number) {
  if (session.step >= session.maxSteps) return;
  recordEvent("target-click", targetPayload(now, 1));
  recordSuccess({ targetId: `warm-fire:flame:${session.step + 1}`, mode: "gaze-kindled-fire" });
  playWarmFireCue(session.settings.sound);
  addAuraRing(now);
  for (let index = 0; index < 10; index += 1) addSpark(now + index, true);
  for (let index = 0; index < 4; index += 1) addFlameFlight(now + index, true);
  fireEnergy = clamp(fireEnergy + 0.28, 0, maxFireEnergy);
  enteredAt = now;
  dwellProgress = 0;
}

function updateAttention(delta: number, now: number) {
  const influence = currentGazeInfluence();
  const heatSmoothing = influence > gazeHeat ? 1.8 : 0.72;
  gazeHeat += (influence - gazeHeat) * Math.min(1, delta * heatSmoothing);

  const targetEnergy = gazeHeat > 0.06 ? 0.06 + gazeHeat * 1.24 : 0;
  fireEnergy += (targetEnergy - fireEnergy) * Math.min(1, delta * (gazeHeat > 0.08 ? 1.5 : 0.95));
  fireEnergy = clamp(fireEnergy, 0, maxFireEnergy);

  if (session.status !== "running" || session.step >= session.maxSteps) return;

  if (gazeHeat < 0.1) {
    if (enteredAt !== undefined) recordEvent("target-cancel", targetPayload(now, dwellProgress, pointer.value.valid ? "left" : "invalid-gaze"));
    enteredAt = undefined;
    dwellProgress = Math.max(0, dwellProgress - delta * 0.8);
    return;
  }

  if (enteredAt === undefined) {
    enteredAt = now;
    recordEvent("target-enter", targetPayload(now, 0));
  }

  dwellProgress = clamp(dwellProgress + delta * 1000 * (0.62 + gazeHeat * 0.66) / session.settings.dwellMs, 0, 1);
  if (dwellProgress >= 1) completeWarmStep(now);
}

function updateSparks(delta: number, now: number) {
  const sparkInterval = 250 - fireEnergy * 130 - gazeHeat * 46;
  if (fireEnergy > 0.035 && now - lastSparkAt >= sparkInterval) {
    lastSparkAt = now;
    addSpark(now);
    if (fireEnergy > 0.66 && window.innerWidth >= 760) addSpark(now + 1);
    if (fireEnergy > 1.02 && window.innerWidth >= 760) addSpark(now + 2);
  }

  const flightInterval = 980 - fireEnergy * 430 - gazeHeat * 180;
  if (fireEnergy > 0.14 && now - lastFlightAt >= flightInterval) {
    lastFlightAt = now;
    addFlameFlight(now);
    if (gazeHeat > 0.7) addFlameFlight(now + 1);
  }

  for (let index = sparks.length - 1; index >= 0; index -= 1) {
    const spark = sparks[index];
    spark.age += delta * (gazeHeat > 0.08 ? 1 : 1.9);
    spark.x += spark.driftX * delta + Math.sin(spark.age * 2.2 + spark.spin) * delta * (5 + fireEnergy * 8);
    spark.y += spark.driftY * delta;
    spark.driftY -= (3.8 + fireEnergy * 4.6) * delta;
    spark.driftX += Math.sin(spark.age * 1.4 + spark.spin) * delta * 2.4;
    if (spark.age >= spark.life) sparks.splice(index, 1);
  }

  for (let index = flameFlights.length - 1; index >= 0; index -= 1) {
    const flame = flameFlights[index];
    flame.age += delta * (gazeHeat > 0.08 ? 1 : 1.9);
    flame.x += flame.driftX * delta + Math.sin(flame.age * 2.4 + flame.phase) * delta * (18 + fireEnergy * 22);
    flame.y += flame.driftY * delta;
    flame.driftX += Math.sin(flame.age * 1.1 + flame.phase) * delta * 4.2;
    flame.driftY -= (7 + fireEnergy * 12) * delta;
    if (flame.age >= flame.life) flameFlights.splice(index, 1);
  }

  for (let index = auraRings.length - 1; index >= 0; index -= 1) {
    auraRings[index].age += delta;
    if (auraRings[index].age >= auraRings[index].life) auraRings.splice(index, 1);
  }
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const center = fireCenter();
  const intensity = clamp(fireEnergy / maxFireEnergy, 0, 1);
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#090912");
  sky.addColorStop(0.5, "#1b1122");
  sky.addColorStop(1, "#2a170d");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const halo = context.createRadialGradient(center.x, center.y, 0, center.x, center.y, Math.max(window.innerWidth, window.innerHeight) * 0.82);
  halo.addColorStop(0, `hsla(${26 + fireEnergy * 54}, 100%, 64%, ${0.36 * intensity})`);
  halo.addColorStop(0.34, `hsla(${292 + Math.sin(now * 0.00038) * 18}, 82%, 48%, ${0.12 * intensity})`);
  halo.addColorStop(0.7, `hsla(${196 + Math.cos(now * 0.00031) * 16}, 88%, 44%, ${0.06 * intensity})`);
  halo.addColorStop(1, "rgb(16 8 12 / 0%)");
  context.fillStyle = halo;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const floorTop = window.innerHeight * 0.76;
  const floor = context.createLinearGradient(0, floorTop, 0, window.innerHeight);
  floor.addColorStop(0, "#21110c");
  floor.addColorStop(1, "#0d0706");
  context.fillStyle = floor;
  context.fillRect(0, floorTop, window.innerWidth, window.innerHeight - floorTop);
}

function drawPsychedelicVeil(context: CanvasRenderingContext2D, now: number) {
  const center = fireCenter();
  const intensity = clamp(fireEnergy / maxFireEnergy, 0, 1);
  if (intensity <= 0.02) return;
  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";
  for (let index = 0; index < 9; index += 1) {
    const phase = now * 0.00022 + index * 0.74;
    const radius = targetRadius() * (0.55 + index * 0.105 + fireEnergy * 0.2);
    const alpha = (0.01 + fireEnergy * 0.04) * intensity * (1 - index * 0.055);
    context.strokeStyle = `hsla(${(index * 36 + now * 0.012 + fireEnergy * 96) % 360}, 92%, 66%, ${alpha})`;
    context.lineWidth = 11 - index * 0.62;
    context.beginPath();
    for (let step = 0; step <= 96; step += 1) {
      const angle = step / 96 * Math.PI * 2;
      const wobble = Math.sin(angle * 3 + phase) * 18 + Math.sin(angle * 5 - phase * 1.6) * 9;
      const x = center.x + Math.cos(angle) * (radius + wobble);
      const y = center.y + Math.sin(angle) * (radius * 0.52 + wobble * 0.42);
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
  context.restore();
}

function drawHearth(context: CanvasRenderingContext2D) {
  const center = fireCenter();
  context.save();
  context.fillStyle = "rgb(74 48 38 / 84%)";
  context.beginPath();
  context.ellipse(center.x, center.y + 124, 252, 48, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgb(37 22 17 / 92%)";
  context.lineWidth = 24;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(center.x - 132, center.y + 92);
  context.lineTo(center.x + 126, center.y + 128);
  context.moveTo(center.x - 118, center.y + 134);
  context.lineTo(center.x + 136, center.y + 86);
  context.stroke();

  context.strokeStyle = "rgb(118 62 35 / 82%)";
  context.lineWidth = 11;
  context.beginPath();
  context.moveTo(center.x - 122, center.y + 88);
  context.lineTo(center.x + 112, center.y + 120);
  context.moveTo(center.x - 105, center.y + 130);
  context.lineTo(center.x + 126, center.y + 84);
  context.stroke();
  context.restore();
}

function drawFireGlow(context: CanvasRenderingContext2D) {
  const center = fireCenter();
  const intensity = clamp(fireEnergy / maxFireEnergy, 0, 1);
  if (intensity <= 0.01) return;
  const radius = 58 + fireEnergy * 390;
  const glow = context.createRadialGradient(center.x, center.y + 10, 0, center.x, center.y + 10, radius);
  glow.addColorStop(0, `rgb(255 226 152 / ${0.5 * intensity})`);
  glow.addColorStop(0.42, `rgb(255 109 74 / ${0.3 * intensity})`);
  glow.addColorStop(0.78, `rgb(206 71 170 / ${0.12 * intensity})`);
  glow.addColorStop(1, "rgb(206 71 170 / 0%)");
  context.save();
  context.globalCompositeOperation = "lighter";
  context.fillStyle = glow;
  context.beginPath();
  context.arc(center.x, center.y + 8, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawFlameLayer(context: CanvasRenderingContext2D, now: number, scale: number, hue: number, alpha: number, offset: number) {
  const intensity = clamp(fireEnergy / maxFireEnergy, 0, 1);
  if (intensity <= 0.01) return;
  const center = fireCenter();
  const pulse = Math.sin(now * 0.0011 + offset) * 0.045 + Math.sin(now * 0.00053 + offset * 0.9) * 0.035;
  const height = (18 + fireEnergy * 320) * scale * (1 + pulse);
  const width = (10 + fireEnergy * 148) * scale;
  const sway = Math.sin(now * 0.00072 + offset) * (7 + fireEnergy * 30);

  context.save();
  context.globalCompositeOperation = "lighter";
  const gradient = context.createRadialGradient(center.x + sway * 0.2, center.y + 58, 0, center.x + sway, center.y - height * 0.25, height * 1.02);
  gradient.addColorStop(0, `hsla(${hue + 18}, 100%, 84%, ${alpha * intensity})`);
  gradient.addColorStop(0.36, `hsla(${hue}, 98%, 62%, ${alpha * 0.72 * intensity})`);
  gradient.addColorStop(0.72, `hsla(${hue + 86 * fireEnergy}, 94%, 54%, ${alpha * 0.22 * intensity})`);
  gradient.addColorStop(1, `hsla(${hue + 120}, 88%, 42%, 0)`);
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(center.x + sway, center.y - height);
  context.bezierCurveTo(center.x - width * 0.95 - sway * 0.1, center.y - height * 0.42, center.x - width * 1.4, center.y + 62, center.x, center.y + 104);
  context.bezierCurveTo(center.x + width * 1.35, center.y + 64, center.x + width * 0.92 + sway * 0.16, center.y - height * 0.4, center.x + sway, center.y - height);
  context.fill();
  context.restore();
}

function drawFlameFlight(context: CanvasRenderingContext2D, flame: FlameFlight, now: number) {
  const intensity = clamp(fireEnergy / maxFireEnergy, 0, 1);
  if (intensity <= 0.01) return;
  const progress = flame.age / flame.life;
  const fade = Math.sin(progress * Math.PI) * intensity;
  const size = flame.size * (0.72 + progress * 0.58);
  const sway = Math.sin(now * 0.0014 + flame.phase) * size * 0.18;

  context.save();
  context.globalCompositeOperation = "lighter";
  context.translate(flame.x + sway, flame.y);
  context.rotate(Math.sin(flame.phase + flame.age * 1.2) * 0.32);

  const gradient = context.createRadialGradient(0, size * 0.24, 0, 0, -size * 0.22, size);
  gradient.addColorStop(0, `hsla(${flame.hue + 24}, 100%, 82%, ${0.3 * fade})`);
  gradient.addColorStop(0.42, `hsla(${flame.hue}, 96%, 62%, ${0.22 * fade})`);
  gradient.addColorStop(1, `hsla(${flame.hue + 112}, 88%, 48%, 0)`);
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(0, -size);
  context.bezierCurveTo(-size * 0.56, -size * 0.42, -size * 0.38, size * 0.38, 0, size * 0.52);
  context.bezierCurveTo(size * 0.44, size * 0.24, size * 0.5, -size * 0.44, 0, -size);
  context.fill();
  context.restore();
}

function drawAuraRings(context: CanvasRenderingContext2D) {
  context.save();
  context.globalCompositeOperation = "lighter";
  for (const ring of auraRings) {
    const progress = ring.age / ring.life;
    const fade = 1 - progress;
    context.strokeStyle = `hsla(${ring.hue + progress * 78}, 96%, 70%, ${0.22 * fade})`;
    context.lineWidth = 8 * fade + 1;
    context.beginPath();
    context.ellipse(ring.x, ring.y, ring.radius * (1 + progress * 1.35), ring.radius * (0.48 + progress * 0.34), progress * 0.4, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

function drawEmbers(context: CanvasRenderingContext2D, now: number) {
  const intensity = clamp(fireEnergy / maxFireEnergy, 0, 1);
  if (intensity <= 0.01) return;
  context.save();
  context.globalCompositeOperation = "lighter";
  for (const ember of embers) {
    const pulse = 0.55 + Math.sin(now * 0.001 + ember.phase) * 0.22 + fireEnergy * 0.26;
    context.fillStyle = `hsla(${32 + ember.hueShift + fireEnergy * 42}, 100%, 62%, ${Math.min(0.82, pulse * ember.warmth * intensity)})`;
    context.beginPath();
    context.arc(ember.x, ember.y, ember.radius * (0.86 + fireEnergy * 0.5), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawSpark(context: CanvasRenderingContext2D, spark: Spark, now: number) {
  const intensity = clamp(fireEnergy / maxFireEnergy, 0, 1);
  if (intensity <= 0.01) return;
  const progress = spark.age / spark.life;
  const fade = (1 - progress) * intensity;
  const twinkle = 0.74 + Math.sin(now * 0.002 + spark.spin) * 0.2;
  const radius = spark.radius * (1 + progress * 1.05);
  context.save();
  context.globalCompositeOperation = "lighter";
  const halo = context.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, radius * 5.5);
  halo.addColorStop(0, `hsla(${spark.hue}, 100%, 82%, ${0.28 * fade * twinkle})`);
  halo.addColorStop(1, `hsla(${spark.hue + 64}, 92%, 54%, 0)`);
  context.fillStyle = halo;
  context.beginPath();
  context.arc(spark.x, spark.y, radius * 5.5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = `hsla(${spark.hue + 8}, 100%, 88%, ${0.72 * fade * twinkle})`;
  context.beginPath();
  context.arc(spark.x, spark.y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawGazeHalo(context: CanvasRenderingContext2D) {
  if (!pointer.value.valid || session.status !== "running") return;
  const radius = clamp(82 + gazeHeat * 84, 82, 170);
  const halo = context.createRadialGradient(pointer.value.x, pointer.value.y, 0, pointer.value.x, pointer.value.y, radius);
  halo.addColorStop(0, `rgb(255 232 176 / ${0.12 + gazeHeat * 0.16})`);
  halo.addColorStop(0.5, `rgb(255 116 104 / ${0.055 + gazeHeat * 0.07})`);
  halo.addColorStop(1, "rgb(255 116 104 / 0%)");
  context.save();
  context.globalCompositeOperation = "lighter";
  context.fillStyle = halo;
  context.beginPath();
  context.arc(pointer.value.x, pointer.value.y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawBackground(context, now);
  drawPsychedelicVeil(context, now);
  drawFireGlow(context);
  drawHearth(context);
  drawFlameLayer(context, now, 1.36, 26, 0.16 + fireEnergy * 0.28, 0.2);
  drawFlameLayer(context, now, 0.98, 42, 0.2 + fireEnergy * 0.28, 1.4);
  drawFlameLayer(context, now, 0.68, 58 + fireEnergy * 62, 0.16 + fireEnergy * 0.28, 2.4);
  drawFlameLayer(context, now, 0.42, 186 + fireEnergy * 54, 0.04 + fireEnergy * 0.22, 3.1);
  for (const flame of flameFlights) drawFlameFlight(context, flame, now);
  drawAuraRings(context);
  drawEmbers(context, now);
  for (const spark of sparks) drawSpark(context, spark, now);
  drawGazeHalo(context);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  updateAttention(delta, now);
  updateSparks(delta, now);
  tickWarmFirePiano(session.settings.sound);
  setWarmFirePianoActive(session.settings.sound, session.status === "running");
  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  startSession();
  resetFire();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  resetFire();
  warmWarmFirePiano(session.settings.sound);
  window.addEventListener("resize", resizeCanvas);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
  disposeWarmFirePiano();
});
</script>

<template>
  <div class="warm-fire-shell">
    <canvas ref="canvasRef" class="warm-fire-canvas" aria-hidden="true" />

    <GameHud
      title="Тёплый костёр"
      :step="session.step"
      :max-steps="session.maxSteps"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      :show-progress="false"
      :show-timer="false"
      @pause="pauseSession"
      @resume="resumeSession"
    />

    <GameResultDialog
      :model-value="resultVisible"
      title="Тёплый костёр"
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
.warm-fire-shell {
  background: #090912;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.warm-fire-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>

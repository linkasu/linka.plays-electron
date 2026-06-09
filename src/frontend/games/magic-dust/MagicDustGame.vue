<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type Point = { x: number; y: number };
type DustParticle = Point & {
  id: string;
  age: number;
  life: number;
  radius: number;
  driftX: number;
  driftY: number;
  hue: number;
  spin: number;
  sparkle: boolean;
};
type BackgroundSpark = Point & {
  radius: number;
  alpha: number;
  twinkle: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, startSession } = useGameSession("magic-dust", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 75,
  targetScale: 1.45,
  motionSpeed: 0.42,
  distractors: "none",
  hints: "high",
  sound: false
}, {
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const particles = reactive<DustParticle[]>([]);
const backgroundSparks = reactive<BackgroundSpark[]>([]);
const resultVisible = computed(() => session.status === "finished");

const dustHues = [42, 52, 268, 292, 316];
let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let lastParticleAt = 0;
let attentionMs = 0;
let intervalEnteredAt: number | undefined;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomHue() {
  return dustHues[Math.floor(Math.random() * dustHues.length)];
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
  initBackgroundSparks();
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

function stepTargetMs() {
  return session.settings.sessionSeconds * 1000 / session.maxSteps;
}

function initBackgroundSparks() {
  backgroundSparks.splice(0);
  const count = Math.min(96, Math.max(42, Math.round((window.innerWidth * window.innerHeight) / 12500)));
  for (let index = 0; index < count; index += 1) {
    backgroundSparks.push({
      x: randomRange(0, window.innerWidth),
      y: randomRange(0, window.innerHeight),
      radius: randomRange(0.8, 2.4),
      alpha: randomRange(0.08, 0.28),
      twinkle: randomRange(0, Math.PI * 2)
    });
  }
}

function resetDust() {
  particles.splice(0);
  attentionMs = 0;
  intervalEnteredAt = undefined;
  lastParticleAt = 0;
}

function addParticle(now: number) {
  const angle = randomRange(0, Math.PI * 2);
  const distance = randomRange(8, 70) * session.settings.targetScale;
  const speed = randomRange(12, 34) * session.settings.motionSpeed;
  const x = pointer.value.x + Math.cos(angle) * distance;
  const y = pointer.value.y + Math.sin(angle) * distance;

  particles.push({
    id: `magic-dust-${now}-${particles.length}`,
    x,
    y,
    age: 0,
    life: randomRange(1.45, 2.8),
    radius: randomRange(3.5, 10.5) * session.settings.targetScale,
    driftX: Math.cos(angle) * speed * randomRange(0.35, 0.95),
    driftY: Math.sin(angle) * speed * randomRange(0.2, 0.75) - randomRange(5, 18),
    hue: randomHue(),
    spin: randomRange(0, Math.PI * 2),
    sparkle: Math.random() > 0.34
  });

  if (particles.length > 180) particles.splice(0, particles.length - 180);
}

function addParticleBurst(now: number) {
  if (!pointer.value.valid || now - lastParticleAt < 95) return;
  lastParticleAt = now;
  const amount = window.innerWidth < 720 ? 3 : 5;
  for (let index = 0; index < amount; index += 1) addParticle(now + index);
}

function recordAttentionEnter(now: number) {
  if (intervalEnteredAt !== undefined || session.step >= session.maxSteps) return;
  intervalEnteredAt = now;
  recordEvent("target-enter", {
    targetId: `magic-dust-attention-${session.step + 1}`,
    at: Date.now(),
    dwellMs: stepTargetMs(),
    pointer: copyPointer()
  });
}

function recordAttentionStep(now: number) {
  if (session.step >= session.maxSteps) return;
  const targetId = `magic-dust-attention-${session.step + 1}`;
  const elapsedMs = intervalEnteredAt === undefined ? stepTargetMs() : now - intervalEnteredAt;
  recordEvent("target-click", {
    targetId,
    at: Date.now(),
    dwellMs: stepTargetMs(),
    elapsedMs,
    progress: 1,
    pointer: copyPointer()
  });
  recordSuccess({ targetId, mode: "ambient-magic-dust" });
  intervalEnteredAt = now;
}

function updateAttention(delta: number, now: number) {
  if (session.status !== "running") return;

  if (!pointer.value.valid) {
    intervalEnteredAt = undefined;
    return;
  }

  recordAttentionEnter(now);
  attentionMs += delta * 1000;
  addParticleBurst(now);

  while (session.step < session.maxSteps && attentionMs >= (session.step + 1) * stepTargetMs()) {
    recordAttentionStep(now);
  }
}

function updateParticles(delta: number) {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.age += delta;
    particle.x += particle.driftX * delta;
    particle.y += particle.driftY * delta;
    particle.driftY += 4 * delta;
    particle.spin += delta * 1.4;
    if (particle.age >= particle.life) particles.splice(index, 1);
  }
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#11091f");
  sky.addColorStop(0.5, "#1a1233");
  sky.addColorStop(1, "#251431");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const glow = context.createRadialGradient(window.innerWidth * 0.52, window.innerHeight * 0.55, 0, window.innerWidth * 0.52, window.innerHeight * 0.55, Math.max(window.innerWidth, window.innerHeight) * 0.72);
  glow.addColorStop(0, "rgb(255 218 156 / 16%)");
  glow.addColorStop(0.48, "rgb(190 130 255 / 10%)");
  glow.addColorStop(1, "rgb(28 16 52 / 0%)");
  context.fillStyle = glow;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  context.save();
  context.globalCompositeOperation = "lighter";
  for (const spark of backgroundSparks) {
    const twinkle = 0.68 + Math.sin(now * 0.0007 + spark.twinkle) * 0.32;
    context.fillStyle = `rgb(255 235 192 / ${spark.alpha * twinkle})`;
    context.beginPath();
    context.arc(spark.x, spark.y, spark.radius * (0.85 + twinkle * 0.35), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawParticle(context: CanvasRenderingContext2D, particle: DustParticle) {
  const progress = Math.min(1, particle.age / particle.life);
  const fade = Math.max(0, 1 - progress);
  const radius = particle.radius * (0.75 + progress * 1.65);

  context.save();
  context.globalCompositeOperation = "lighter";

  const halo = context.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, radius * 3.2);
  halo.addColorStop(0, `hsla(${particle.hue}, 100%, 88%, ${0.34 * fade})`);
  halo.addColorStop(0.45, `hsla(${particle.hue + 20}, 92%, 72%, ${0.16 * fade})`);
  halo.addColorStop(1, `hsla(${particle.hue}, 90%, 58%, 0)`);
  context.fillStyle = halo;
  context.beginPath();
  context.arc(particle.x, particle.y, radius * 3.2, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = `hsla(${particle.hue}, 100%, 92%, ${0.74 * fade})`;
  context.beginPath();
  context.arc(particle.x, particle.y, radius * 0.34, 0, Math.PI * 2);
  context.fill();

  if (particle.sparkle) {
    context.translate(particle.x, particle.y);
    context.rotate(particle.spin);
    context.strokeStyle = `hsla(${particle.hue + 28}, 100%, 94%, ${0.5 * fade})`;
    context.lineWidth = Math.max(1.2, radius * 0.08);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-radius * 0.62, 0);
    context.lineTo(radius * 0.62, 0);
    context.moveTo(0, -radius * 0.62);
    context.lineTo(0, radius * 0.62);
    context.stroke();
  }

  context.restore();
}

function drawGazeHalo(context: CanvasRenderingContext2D) {
  if (!pointer.value.valid || session.status !== "running") return;
  const radius = Math.min(132, Math.max(72, 76 * session.settings.targetScale));
  const halo = context.createRadialGradient(pointer.value.x, pointer.value.y, 0, pointer.value.x, pointer.value.y, radius);
  halo.addColorStop(0, "rgb(255 246 214 / 16%)");
  halo.addColorStop(0.5, "rgb(229 178 255 / 8%)");
  halo.addColorStop(1, "rgb(229 178 255 / 0%)");
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
  drawGazeHalo(context);
  for (const particle of particles) drawParticle(context, particle);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (session.status === "running") updateAttention(delta, now);
  updateParticles(delta);

  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  startSession();
  resetDust();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  resetDust();
  window.addEventListener("resize", resizeCanvas);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
});
</script>

<template>
  <div class="magic-dust-shell">
    <canvas ref="canvasRef" class="magic-dust-canvas" />

    <GameHud
      title="Волшебная пыль"
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
      title="Волшебная пыль"
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
.magic-dust-shell {
  background: #11091f;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.magic-dust-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>

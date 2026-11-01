<script setup lang="ts">
import { scenePalette } from "../../core/themeSettings";
import { onMounted, onUnmounted, ref, watch } from "vue";
import { canvasArt, drawCanvasArt } from "../../core/canvasArt";
import { approach, createFrameClock } from "../../core/motion";

const props = defineProps<{
  paused: boolean;
  reduceMotion: boolean;
  sessionId: string;
  active: boolean;
  maxSteps: number;
  progress: number;
  raysLabel: string;
  step: number;
  title: string;
}>();

const canvasRef = ref<HTMLCanvasElement>();

let frame = 0;
let width = 1;
let height = 1;
let dpr = 1;
let animationTime = 0;
let lastTime = performance.now();
let observer: ResizeObserver | undefined;
const revealedRays: number[] = [];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resizeCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  dpr = window.devicePixelRatio || 1;
  width = Math.max(1, rect.width);
  height = Math.max(1, rect.height);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function rayProgress(index: number) {
  if (index < props.step) return 1;
  if (index === props.step) return props.progress;
  return 0;
}

function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(x - scale * 0.8, y + scale * 0.12, scale * 0.72, scale * 0.34, 0, 0, Math.PI * 2);
  ctx.ellipse(x - scale * 0.18, y - scale * 0.14, scale * 0.86, scale * 0.44, 0, 0, Math.PI * 2);
  ctx.ellipse(x + scale * 0.7, y + scale * 0.08, scale * 0.68, scale * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRay(
  ctx: CanvasRenderingContext2D,
  index: number,
  cx: number,
  cy: number,
  radius: number,
  now: number,
) {
  const count = Math.max(1, props.maxSteps);
  const progress = revealedRays[index] ?? 0;
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
  const shimmer = Math.sin(now * 0.0012 + index * 1.7) * 0.04;
  const visible = clamp(0.25 + progress * 0.75 + shimmer * progress, 0, 1);
  const outerRadius = Math.min(width * 0.46, height * 0.36);
  const start = radius * 0.92;
  const length = Math.max(8, outerRadius - start);
  const thickness = radius * (0.14 + progress * 0.1);
  const end = start + length * (0.4 + progress * 0.6);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const gradient = ctx.createLinearGradient(start, 0, end, 0);
  gradient.addColorStop(0, `rgb(235 139 24 / ${visible})`);
  gradient.addColorStop(0.55, `rgb(255 181 32 / ${visible})`);
  gradient.addColorStop(1, `rgb(255 213 58 / ${visible})`);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(start, Math.sin(now * 0.001 + index) * radius * 0.05);
  ctx.bezierCurveTo(
    start + length * 0.24,
    -radius * 0.14 * Math.sin(index + now * 0.0007),
    start + length * 0.56,
    radius * 0.18 * Math.cos(index + now * 0.0006),
    end,
    0,
  );
  ctx.stroke();

  if (visible > 0.12) {
    ctx.fillStyle = `rgb(255 248 211 / ${visible * 0.68})`;
    for (let spark = 0; spark < 3; spark += 1) {
      const phase = (now * 0.00018 + index * 0.23 + spark * 0.31) % 1;
      const distance = start + length * (0.18 + phase * 0.68);
      const offset = Math.sin(now * 0.0015 + spark + index) * thickness * 0.62;
      const size = radius * (0.024 + spark * 0.005) * visible;
      ctx.beginPath();
      ctx.arc(distance, offset, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

type SunFace = "face-sleep" | "face-smile" | "face-wow";
const sunFaces: SunFace[] = ["face-sleep", "face-smile", "face-wow"];
const faceWeight: Record<SunFace, number> = { "face-sleep": 1, "face-smile": 0, "face-wow": 0 };
const sunClock = createFrameClock();
let lastStep = 0;
let wowUntil = 0;

function drawSun(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  now: number,
) {
  const open = clamp(props.step / Math.max(1, props.maxSteps), 0, 1);
  const pulse = props.active && !props.reduceMotion ? 1 + Math.sin(now * 0.004) * 0.025 : 1;
  const glow = ctx.createRadialGradient(
    cx,
    cy,
    radius * 0.25,
    cx,
    cy,
    radius * (2.9 + open * 1.05),
  );
  glow.addColorStop(0, `rgb(255 232 104 / ${0.58 + open * 0.26})`);
  glow.addColorStop(0.46, `rgb(255 207 79 / ${0.22 + open * 0.22})`);
  glow.addColorStop(1, "rgb(255 215 96 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * (2.75 + open * 0.74), 0, Math.PI * 2);
  ctx.fill();

  // Testers asked for drawn pictures. The drawn sun is a disc with a face on top:
  // it sleeps until the child looks at it, wakes up smiling and is delighted for a
  // moment with every new ray. Faces cross-fade, so it never changes at a jump.
  const disc = canvasArt("sun-rays/sun-disc");
  if (disc) {
    const delta = sunClock("sun", now);
    if (props.step > lastStep && !props.reduceMotion) wowUntil = now + 900;
    lastStep = props.step;
    const target: SunFace =
      !props.reduceMotion && now < wowUntil
        ? "face-wow"
        : props.step > 0 || props.active
          ? "face-smile"
          : "face-sleep";
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    drawCanvasArt(ctx, disc, 0, 0, radius * 2.05);
    for (const face of sunFaces) {
      faceWeight[face] = props.reduceMotion
        ? face === target
          ? 1
          : 0
        : approach(faceWeight[face], face === target ? 1 : 0, 7, delta);
      const art = canvasArt(`sun-rays/${face}`);
      if (!art || faceWeight[face] < 0.01) continue;
      ctx.globalAlpha = faceWeight[face];
      drawCanvasArt(ctx, art, 0, radius * 0.1, radius * 1.55);
    }
    ctx.restore();
    return;
  }

  const body = ctx.createRadialGradient(
    cx - radius * 0.28,
    cy - radius * 0.34,
    radius * 0.08,
    cx,
    cy,
    radius * 1.08,
  );
  body.addColorStop(0, "#fff9c4");
  body.addColorStop(0.45, "#ffd75f");
  body.addColorStop(1, "#f39b27");
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = radius * 0.06;
  ctx.strokeStyle = "rgb(255 247 199 / 72%)";
  ctx.stroke();

  ctx.fillStyle = "rgb(104 64 22 / 72%)";
  ctx.beginPath();
  ctx.ellipse(-radius * 0.28, -radius * 0.1, radius * 0.055, radius * 0.09, 0, 0, Math.PI * 2);
  ctx.ellipse(radius * 0.28, -radius * 0.1, radius * 0.055, radius * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgb(104 64 22 / 58%)";
  ctx.lineWidth = radius * 0.04;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, radius * 0.04, radius * 0.36, 0.22 * Math.PI, 0.78 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgb(83 50 17 / 86%)";
  ctx.font = `700 ${clamp(radius * 0.16, 16, 26)}px system-ui, sans-serif`;
  ctx.fillText(props.title, cx, cy + radius * 1.52);
  ctx.fillStyle = "rgb(83 50 17 / 68%)";
  ctx.font = `600 ${clamp(radius * 0.12, 13, 20)}px system-ui, sans-serif`;
  ctx.fillText(`Лучи: ${props.raysLabel}`, cx, cy + radius * 1.82);
  ctx.restore();
}

function draw(now: number) {
  const canvas = canvasRef.value;
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, width, height);

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, scenePalette("sky").background[0]);
  sky.addColorStop(0.52, scenePalette("sky").background[1]);
  sky.addColorStop(1, scenePalette("sky").background[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  drawCloud(
    ctx,
    width * 0.22 + Math.sin(now * 0.00018) * width * 0.02,
    height * 0.24,
    Math.min(width, height) * 0.08,
    0.32,
  );
  drawCloud(
    ctx,
    width * 0.76 + Math.sin(now * 0.00014 + 2) * width * 0.025,
    height * 0.31,
    Math.min(width, height) * 0.095,
    0.24,
  );

  const cx = width * 0.5;
  const cy = height * 0.43;
  const radius = Math.min(width, height) * 0.2;
  for (let index = 0; index < props.maxSteps; index += 1) drawRay(ctx, index, cx, cy, radius, now);
  drawSun(ctx, cx, cy, radius, now);
  drawText(ctx, cx, cy, radius);
}

function tick(now: number) {
  const delta = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  if (!props.paused) {
    if (!props.reduceMotion) animationTime += delta * 1000;
    for (let index = 0; index < props.maxSteps; index += 1) {
      const target = rayProgress(index);
      revealedRays[index] = props.reduceMotion
        ? target
        : approach(revealedRays[index] ?? 0, target, 7, delta);
    }
  }
  draw(animationTime);
  frame = requestAnimationFrame(tick);
}

onMounted(() => {
  resizeCanvas();
  observer = new ResizeObserver(resizeCanvas);
  if (canvasRef.value) observer.observe(canvasRef.value);
  window.addEventListener("resize", resizeCanvas);
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  observer?.disconnect();
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
});

watch(
  () => props.sessionId,
  () => {
    animationTime = 0;
    revealedRays.length = 0;
    lastStep = 0;
    wowUntil = 0;
    faceWeight["face-sleep"] = 1;
    faceWeight["face-smile"] = 0;
    faceWeight["face-wow"] = 0;
  },
);
</script>

<template>
  <canvas ref="canvasRef" class="sun-rays-canvas" aria-hidden="true" />
</template>

<style scoped>
.sun-rays-canvas {
  block-size: clamp(16rem, 44vh, 22rem);
  display: block;
  inline-size: 100%;
}
</style>

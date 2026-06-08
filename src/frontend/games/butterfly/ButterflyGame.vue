<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useGazePointer } from "../../composables/useGazePointer";

type Point = { x: number; y: number };
type Butterfly = Point & {
  angle: number;
  hue: number;
  age: number;
  life: number;
  size: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const butterflies = reactive<Butterfly[]>([]);
const maxButterflies = 220;
const spawnDistance = 38;
let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastPoint: Point | undefined;
let lastTime = performance.now();

const inputLabel = computed(() => pointer.value.source === "tobii" ? "Tobii" : "мышь");

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
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function spawnButterfly(from: Point, to: Point) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  butterflies.push({
    x: to.x,
    y: to.y,
    angle,
    hue: 190 + Math.random() * 140,
    age: 0,
    life: 5 + Math.random() * 3,
    size: 18 + Math.random() * 22
  });
  if (butterflies.length > maxButterflies) butterflies.shift();
}

function drawButterfly(context: CanvasRenderingContext2D, butterfly: Butterfly) {
  const alpha = Math.max(0, 1 - butterfly.age / butterfly.life);
  const wingFlap = Math.sin(butterfly.age * 8) * 0.18;

  context.save();
  context.translate(butterfly.x, butterfly.y);
  context.rotate(butterfly.angle + Math.PI / 2);
  context.globalAlpha = alpha;

  const gradient = context.createRadialGradient(0, 0, 2, 0, 0, butterfly.size);
  gradient.addColorStop(0, `hsl(${butterfly.hue}, 95%, 82%)`);
  gradient.addColorStop(1, `hsl(${butterfly.hue + 36}, 86%, 52%)`);
  context.fillStyle = gradient;
  context.strokeStyle = `hsla(${butterfly.hue + 30}, 80%, 35%, ${alpha})`;
  context.lineWidth = 2;

  for (const side of [-1, 1]) {
    context.save();
    context.scale(side, 1);
    context.rotate(wingFlap * side);
    context.beginPath();
    context.ellipse(9, -6, butterfly.size * 0.72, butterfly.size * 0.42, -0.62, 0, Math.PI * 2);
    context.ellipse(8, 10, butterfly.size * 0.55, butterfly.size * 0.36, 0.62, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  }

  context.fillStyle = `hsla(${butterfly.hue + 20}, 45%, 22%, ${alpha})`;
  context.beginPath();
  context.roundRect(-3, -16, 6, 32, 5);
  context.fill();
  context.restore();
}

function drawBackground(context: CanvasRenderingContext2D) {
  const gradient = context.createLinearGradient(0, 0, window.innerWidth, window.innerHeight);
  gradient.addColorStop(0, "#fff8d8");
  gradient.addColorStop(0.45, "#dbfbf4");
  gradient.addColorStop(1, "#efe6ff");
  context.fillStyle = gradient;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);
}

function tick(now: number) {
  const context = ctx;
  if (!context) {
    frame = requestAnimationFrame(tick);
    return;
  }

  const delta = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  drawBackground(context);

  for (let i = butterflies.length - 1; i >= 0; i--) {
    const butterfly = butterflies[i];
    butterfly.age += delta;
    butterfly.y -= delta * 8;
    if (butterfly.age >= butterfly.life) {
      butterflies.splice(i, 1);
      continue;
    }
    drawButterfly(context, butterfly);
  }

  if (pointer.value.valid) {
    context.beginPath();
    context.arc(pointer.value.x, pointer.value.y, 10, 0, Math.PI * 2);
    context.fillStyle = pointer.value.source === "tobii" ? "#6c5ce7" : "#ff8a3d";
    context.fill();
  }

  frame = requestAnimationFrame(tick);
}

watch(pointer, (nextPointer) => {
  if (!nextPointer.valid) return;
  const nextPoint = { x: nextPointer.x, y: nextPointer.y };
  if (!lastPoint) {
    lastPoint = nextPoint;
    return;
  }
  if (distance(lastPoint, nextPoint) >= spawnDistance) {
    spawnButterfly(lastPoint, nextPoint);
    lastPoint = nextPoint;
  }
}, { deep: true });

onMounted(async () => {
  await nextTick();
  resizeCanvas();
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
  <div class="game-shell">
    <canvas ref="canvasRef" class="game-canvas" />
    <div class="game-hud">
      <v-btn color="surface" prepend-icon="mdi-arrow-left" variant="flat" @click="router.push('/')">
        В меню
      </v-btn>
      <v-chip color="primary" variant="flat">
        Ввод: {{ inputLabel }}
      </v-chip>
      <v-chip color="secondary" variant="flat">
        Бабочек: {{ butterflies.length }}
      </v-chip>
    </div>
    <div class="game-title">
      <div class="text-h4 font-weight-bold">Бабочки</div>
      <div class="text-body-1">Двигай взглядом или мышью, чтобы рисовать полёт.</div>
    </div>
  </div>
</template>

<style scoped>
.game-shell {
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.game-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.game-hud {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  left: 20px;
  position: absolute;
  top: 20px;
  z-index: 2;
}

.game-title {
  background: rgb(255 255 255 / 78%);
  border-radius: 24px;
  bottom: 24px;
  box-shadow: 0 12px 40px rgb(62 43 99 / 16%);
  max-inline-size: min(520px, calc(100vw - 48px));
  padding: 20px 24px;
  position: absolute;
  right: 24px;
  z-index: 2;
}
</style>

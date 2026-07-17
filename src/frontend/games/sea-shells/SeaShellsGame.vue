<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStartPromptAudio } from "../../composables/useStartPromptAudio";
import { resolveMenuRoute } from "../../core/menuMode";
import { percentToPixels, randomTargetCenterPercent } from "../../core/placement";
import { disposeSeaShellsPiano, playSeaShellsCue, setSeaShellsPianoActive, tickSeaShellsPiano, warmSeaShellsPiano } from "./audio";

type Point = { x: number; y: number };
type ShellPhase = "settling" | "closed" | "opening" | "glowing";
type SeaShell = Point & {
  id: string;
  radius: number;
  hue: number;
  age: number;
  phaseAge: number;
  phase: ShellPhase;
  dwellProgress: number;
  enteredAt?: number;
  tilt: number;
  pearlOffset: number;
};
type SandSparkle = Point & {
  radius: number;
  alpha: number;
  phase: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("sea-shells", {
  maxSteps: 8,
  overrides: { preset: "gentle", targetScale: 1.62, motionSpeed: 0.34, distractors: "none", hints: "high", sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
useStartPromptAudio({ gameId: "sea-shells", soundEnabled: toRef(session.settings, "sound") });

const shells = reactive<SeaShell[]>([]);
const sparkles = reactive<SandSparkle[]>([]);
const resultVisible = computed(() => session.status === "finished");

const shellHues = [24, 34, 326, 286, 196];
const settlingSeconds = 1.1;
const glowSeconds = 2.15;
let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let finishAfter = 0;
let previousShellPoint: Point | undefined;
let spawnIndex = 0;

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
  initSparkles();
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function shellRadius() {
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.2;
  return Math.min(168, Math.max(104, Math.min(viewportLimit, 98 * session.settings.targetScale)));
}

function desiredShellCount() {
  return window.innerWidth < 760 ? 2 : 3;
}

function shellPixelPoint(point: Point) {
  return percentToPixels(point);
}

function shellOverlaps(point: Point, radius: number, ignoredId?: string) {
  const pixelPoint = shellPixelPoint(point);
  return shells.some((shell) => {
    if (shell.id === ignoredId) return false;
    const other = shellPixelPoint(shell);
    return distance(pixelPoint, other) < Math.max(230, (radius + shell.radius) * 0.94);
  });
}

function chooseShellPoint(radius: number, first: boolean, ignoredId?: string) {
  if (first) return { x: 50, y: 66 };

  let best: Point | undefined;
  let bestGap = -1;
  for (let attempt = 0; attempt < 36; attempt++) {
    const candidate = randomTargetCenterPercent({
      targetWidth: radius * 2.2,
      targetHeight: radius * 1.7,
      hudHeight: Math.max(118, window.innerHeight * 0.18),
      sidePadding: Math.max(72, window.innerWidth * 0.1),
      bottomPadding: Math.max(70, window.innerHeight * 0.08),
      previous: previousShellPoint,
      minDistance: Math.min(340, Math.max(210, radius * 1.78)),
      attempts: 12
    });
    const candidatePixel = shellPixelPoint(candidate);
    const gap = shells.reduce((minimum, shell) => {
      if (shell.id === ignoredId) return minimum;
      return Math.min(minimum, distance(candidatePixel, shellPixelPoint(shell)) - (radius + shell.radius) * 0.94);
    }, Number.POSITIVE_INFINITY);
    if (!best || gap > bestGap) {
      best = candidate;
      bestGap = gap;
    }
    if (!shellOverlaps(candidate, radius, ignoredId)) return candidate;
  }
  return best ?? { x: 50, y: 66 };
}

function createShell(first = false, ignoredId?: string): SeaShell {
  const radius = shellRadius() * randomRange(0.94, 1.06);
  const point = chooseShellPoint(radius, first, ignoredId);
  previousShellPoint = point;

  return {
    id: `sea-shell-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    x: point.x,
    y: point.y,
    radius,
    hue: shellHues[spawnIndex % shellHues.length],
    age: randomRange(0, 5),
    phaseAge: 0,
    phase: "settling",
    dwellProgress: 0,
    tilt: randomRange(-0.16, 0.16),
    pearlOffset: randomRange(-0.12, 0.12)
  };
}

function shellPoint(shell: SeaShell) {
  const point = percentToPixels(shell);
  return {
    x: point.x + Math.sin(shell.age * 0.36 + shell.tilt * 8) * shell.radius * 0.025,
    y: point.y + Math.cos(shell.age * 0.28 + shell.tilt * 6) * shell.radius * 0.018
  };
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

function targetPayload(shell: SeaShell, now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: shell.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: shell.enteredAt === undefined ? 0 : now - shell.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function openShell(shell: SeaShell, now: number) {
  recordEvent("target-click", targetPayload(shell, now, 1));
  recordSuccess({ targetId: shell.id, hue: shell.hue });
  playSeaShellsCue(session.settings.sound);
  shell.phase = "glowing";
  shell.phaseAge = 0;
  shell.dwellProgress = 1;
  shell.enteredAt = undefined;

  if (session.step >= session.maxSteps) finishAfter = now + 1500;
}

function cancelShell(shell: SeaShell, now: number, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(shell, now, shell.dwellProgress, reason));
  shell.enteredAt = undefined;
  shell.dwellProgress = 0;
  if (shell.phase === "opening") {
    shell.phase = "closed";
    shell.phaseAge = 0;
  }
}

function closestShell() {
  if (!pointer.value.valid || session.step >= session.maxSteps) return undefined;

  let closest: SeaShell | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const shell of shells) {
    if (shell.phase === "glowing" || shell.phase === "settling") continue;
    const point = shellPoint(shell);
    const nextDistance = distance(point, pointer.value);
    const hitRadius = shell.radius * 1.32;
    if (nextDistance <= hitRadius && nextDistance < closestDistance) {
      closest = shell;
      closestDistance = nextDistance;
    }
  }
  return closest;
}

function updateShellGaze(shell: SeaShell, now: number, gazeShell?: SeaShell) {
  if (shell.phase === "glowing" || shell.phase === "settling" || session.status !== "running") return;
  const inside = gazeShell === shell;

  if (!inside) {
    if (shell.enteredAt !== undefined) cancelShell(shell, now, pointer.value.valid ? "left" : "invalid-gaze");
    return;
  }

  if (shell.enteredAt === undefined) {
    shell.enteredAt = now;
    shell.phase = "opening";
    shell.phaseAge = 0;
    recordEvent("target-enter", targetPayload(shell, now, 0));
  }

  shell.dwellProgress = Math.min(1, (now - shell.enteredAt) / session.settings.dwellMs);
  if (shell.dwellProgress >= 1) openShell(shell, now);
}

function resetShell(shell: SeaShell, index: number) {
  const fresh = createShell(index === 0 && session.step === 0 && previousShellPoint === undefined, shell.id);
  Object.assign(shell, fresh);
  spawnIndex += 1;
}

function ensureShells() {
  while (shells.length < desiredShellCount()) {
    shells.push(createShell(shells.length === 0));
    spawnIndex += 1;
  }
  while (shells.length > desiredShellCount()) shells.pop();
}

function updateShells(delta: number, now: number) {
  ensureShells();

  if (finishAfter > 0 && now >= finishAfter) {
    finishSession("max-steps");
    return;
  }

  const gazeShell = closestShell();
  for (let index = 0; index < shells.length; index++) {
    const shell = shells[index];
    shell.age += delta;
    shell.phaseAge += delta;

    if (shell.phase === "settling" && shell.phaseAge >= settlingSeconds) {
      shell.phase = "closed";
      shell.phaseAge = 0;
    }

    if (shell.phase === "glowing") {
      if (shell.phaseAge >= glowSeconds && session.status === "running" && session.step < session.maxSteps) resetShell(shell, index);
      continue;
    }

    updateShellGaze(shell, now, gazeShell);
  }
}

function initSparkles() {
  sparkles.splice(0);
  const count = Math.min(86, Math.max(34, Math.round(window.innerWidth / 18)));
  for (let index = 0; index < count; index++) {
    sparkles.push({
      x: randomRange(2, 98),
      y: randomRange(64, 96),
      radius: randomRange(0.8, 2.7),
      alpha: randomRange(0.1, 0.32),
      phase: randomRange(0, Math.PI * 2)
    });
  }
}

function initShells() {
  shells.splice(0);
  previousShellPoint = undefined;
  finishAfter = 0;
  spawnIndex = 0;
  for (let index = 0; index < desiredShellCount(); index++) {
    shells.push(createShell(index === 0));
    spawnIndex += 1;
  }
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const water = context.createLinearGradient(0, 0, 0, window.innerHeight);
  water.addColorStop(0, "#0c3156");
  water.addColorStop(0.52, "#176172");
  water.addColorStop(1, "#d6b581");
  context.fillStyle = water;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  context.save();
  context.globalAlpha = 0.34;
  for (let index = 0; index < 5; index++) {
    const x = window.innerWidth * (0.12 + index * 0.22) + Math.sin(now * 0.00018 + index) * window.innerWidth * 0.04;
    const y = window.innerHeight * (0.16 + index * 0.08);
    const light = context.createRadialGradient(x, y, 0, x, y, window.innerWidth * 0.24);
    light.addColorStop(0, "rgb(208 250 255 / 42%)");
    light.addColorStop(1, "rgb(208 250 255 / 0%)");
    context.fillStyle = light;
    context.beginPath();
    context.ellipse(x, y, window.innerWidth * 0.2, window.innerHeight * 0.08, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  context.fillStyle = "rgb(205 164 103 / 38%)";
  context.beginPath();
  context.ellipse(window.innerWidth * 0.28, window.innerHeight * 0.9, window.innerWidth * 0.48, window.innerHeight * 0.2, 0, 0, Math.PI * 2);
  context.ellipse(window.innerWidth * 0.72, window.innerHeight * 0.91, window.innerWidth * 0.5, window.innerHeight * 0.22, 0, 0, Math.PI * 2);
  context.fill();

  context.save();
  for (const sparkle of sparkles) {
    const point = percentToPixels(sparkle);
    context.globalAlpha = sparkle.alpha * (0.72 + Math.sin(now * 0.00055 + sparkle.phase) * 0.22);
    context.fillStyle = "#fff1cc";
    context.beginPath();
    context.arc(point.x, point.y, sparkle.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawShellHalf(context: CanvasRenderingContext2D, shell: SeaShell, point: Point, radius: number, open: number, upper: boolean) {
  const lift = upper ? -radius * 0.34 * open : radius * 0.08 * open;
  const height = radius * (upper ? 0.58 : 0.52);
  const y = point.y + lift + (upper ? -radius * 0.08 : radius * 0.12);

  context.save();
  context.translate(point.x, y);
  context.rotate((upper ? -0.24 : 0.09) * open);
  if (!upper) context.scale(1, -1);
  context.translate(-point.x, -y);
  const gradient = context.createRadialGradient(point.x - radius * 0.28, y - height * 0.28, radius * 0.08, point.x, y, radius * 1.12);
  gradient.addColorStop(0, `hsla(${shell.hue + 32}, 88%, 92%, 0.98)`);
  gradient.addColorStop(0.58, `hsla(${shell.hue}, 72%, ${74 + open * 5}%, 0.96)`);
  gradient.addColorStop(1, `hsla(${shell.hue - 18}, 54%, 54%, 0.96)`);
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(point.x - radius * 0.88, y + height * 0.2);
  context.bezierCurveTo(point.x - radius * 0.66, y - height * 0.92, point.x + radius * 0.66, y - height * 0.92, point.x + radius * 0.88, y + height * 0.2);
  context.quadraticCurveTo(point.x, y + height * 0.72, point.x - radius * 0.88, y + height * 0.2);
  context.fill();

  context.strokeStyle = `hsla(${shell.hue - 26}, 42%, 44%, 0.3)`;
  context.lineWidth = Math.max(2, radius * 0.018);
  for (let index = -3; index <= 3; index++) {
    const offset = index / 3;
    context.beginPath();
    context.moveTo(point.x, y + height * 0.48);
    context.quadraticCurveTo(point.x + offset * radius * 0.28, y - height * 0.14, point.x + offset * radius * 0.72, y + height * 0.04);
    context.stroke();
  }

  context.restore();
}

function drawPearl(context: CanvasRenderingContext2D, shell: SeaShell, point: Point, radius: number, openProgress: number, glow: number) {
  if (openProgress <= 0.12) return;

  const pearlX = point.x + shell.pearlOffset * radius;
  const pearlY = point.y + radius * (0.2 - openProgress * 0.14);
  const pearlRadius = radius * (0.16 + glow * 0.045);
  const pearl = context.createRadialGradient(pearlX - pearlRadius * 0.32, pearlY - pearlRadius * 0.38, pearlRadius * 0.08, pearlX, pearlY, pearlRadius);
  pearl.addColorStop(0, "rgb(255 255 250 / 100%)");
  pearl.addColorStop(0.55, "rgb(236 245 255 / 96%)");
  pearl.addColorStop(1, "rgb(180 202 232 / 82%)");
  context.fillStyle = pearl;
  context.beginPath();
  context.arc(pearlX, pearlY, pearlRadius, 0, Math.PI * 2);
  context.fill();
}

function drawShell(context: CanvasRenderingContext2D, shell: SeaShell) {
  const point = shellPoint(shell);
  const openProgress = shell.phase === "glowing" ? 1 : shell.phase === "opening" ? Math.max(0.24, shell.dwellProgress) : 0;
  const settle = shell.phase === "settling" ? Math.min(1, shell.phaseAge / settlingSeconds) : 1;
  const glow = shell.phase === "glowing" ? Math.max(0, 1 - shell.phaseAge / glowSeconds) : openProgress;
  const radius = shell.radius * (0.92 + settle * 0.08 + glow * 0.04);

  context.save();
  context.globalAlpha = settle;

  context.fillStyle = "rgb(70 57 45 / 20%)";
  context.beginPath();
  context.ellipse(point.x, point.y + radius * 0.48, radius * 0.96, radius * 0.23, 0, 0, Math.PI * 2);
  context.fill();

  context.translate(point.x, point.y);
  context.rotate(shell.tilt);
  context.translate(-point.x, -point.y);

  if (glow > 0.02) {
    const glowRadius = radius * (1.08 + glow * 1.32);
    const halo = context.createRadialGradient(point.x, point.y - radius * 0.04, 0, point.x, point.y - radius * 0.04, glowRadius);
    halo.addColorStop(0, `hsla(${shell.hue + 54}, 100%, 92%, ${0.22 + glow * 0.26})`);
    halo.addColorStop(0.52, `hsla(${shell.hue + 20}, 86%, 70%, ${0.08 + glow * 0.15})`);
    halo.addColorStop(1, `hsla(${shell.hue}, 80%, 58%, 0)`);
    context.fillStyle = halo;
    context.beginPath();
    context.arc(point.x, point.y - radius * 0.04, glowRadius, 0, Math.PI * 2);
    context.fill();
  }

  drawShellHalf(context, shell, point, radius, openProgress, false);
  drawPearl(context, shell, point, radius, openProgress, glow);
  drawShellHalf(context, shell, point, radius, openProgress, true);

  if (shell.phase === "opening") {
    context.strokeStyle = `hsla(${shell.hue + 42}, 96%, 92%, ${0.22 + shell.dwellProgress * 0.28})`;
    context.lineWidth = Math.max(2, radius * 0.02);
    context.setLineDash([Math.max(8, radius * 0.07), Math.max(12, radius * 0.09)]);
    context.beginPath();
    context.arc(point.x, point.y, radius * (0.82 + shell.dwellProgress * 0.12), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.12, shell.dwellProgress));
    context.stroke();
  }

  context.restore();
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawBackground(context, now);
  for (const shell of shells) drawShell(context, shell);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (session.status === "running") {
    updateShells(delta, now);
    tickSeaShellsPiano(session.settings.sound);
  }
  setSeaShellsPianoActive(session.settings.sound, session.status === "running");

  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  startSession();
  initShells();
  initSparkles();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  initShells();
  warmSeaShellsPiano(session.settings.sound);
  window.addEventListener("resize", resizeCanvas);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
  disposeSeaShellsPiano();
});
</script>

<template>
  <div class="sea-shells-shell">
    <canvas ref="canvasRef" class="sea-shells-canvas" />

    <GameHud
      title="Морские ракушки"
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
      title="Морские ракушки"
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
.sea-shells-shell {
  background: #0c3156;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.sea-shells-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>

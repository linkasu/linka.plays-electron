<script setup lang="ts">
import { computed, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { percentToPixels, randomTargetCenterPercent } from "../../core/placement";

type Point = { x: number; y: number };
type Robot = Point & {
  angle: number;
  phase: number;
  glow: number;
};
type DustTarget = Point & {
  id: string;
  kind: "dust" | "star";
  radius: number;
  hue: number;
  age: number;
  dwellProgress: number;
  enteredAt?: number;
};
type CleanupSpark = Point & {
  vx: number;
  vy: number;
  age: number;
  life: number;
  radius: number;
  hue: number;
};
type RoomDot = Point & {
  radius: number;
  alpha: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("robot-vacuum", {
  maxSteps: 8,
  overrides: { preset: "gentle", dwellMs: 600, targetScale: 1.42, motionSpeed: 0.58, distractors: "none", hints: "high" },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const robot = reactive<Robot>({ x: window.innerWidth * 0.5, y: window.innerHeight * 0.56, angle: 0, phase: 0, glow: 0 });
const targets = reactive<DustTarget[]>([]);
const sparks = reactive<CleanupSpark[]>([]);
const roomDots = reactive<RoomDot[]>([]);
const resultVisible = computed(() => session.status === "finished");

const targetHues = [42, 56, 194, 284, 318];
let previousTargetPoint: Point | undefined;
let finishAfter = 0;
let finishDelayRemainingMs = 0;
let targetSequence = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function roomBounds() {
  return {
    left: Math.max(32, width.value * 0.04),
    right: width.value - Math.max(32, width.value * 0.04),
    top: Math.max(118, height.value * 0.16),
    bottom: height.value - Math.max(54, height.value * 0.07)
  };
}

function robotRadius() {
  const viewportLimit = Math.min(width.value, height.value) * 0.074;
  return Math.min(68, Math.max(42, Math.min(viewportLimit, 42 * session.settings.targetScale)));
}

function targetRadius() {
  const viewportLimit = Math.min(width.value, height.value) * 0.052;
  return Math.min(42, Math.max(26, Math.min(viewportLimit, 26 * session.settings.targetScale)));
}

function clampToRoom(point: Point, padding = robotRadius()) {
  const bounds = roomBounds();
  return {
    x: clamp(point.x, bounds.left + padding, bounds.right - padding),
    y: clamp(point.y, bounds.top + padding, bounds.bottom - padding)
  };
}

function targetPixels(target: DustTarget) {
  return percentToPixels(target);
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

function targetPayload(target: DustTarget, now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: target.id,
    kind: target.kind,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: target.enteredAt === undefined ? 0 : now - target.enteredAt,
    progress,
    robot: { x: Math.round(robot.x), y: Math.round(robot.y) },
    pointer: copyPointer(),
    reason
  };
}

function createTarget(first = false): DustTarget {
  const radius = targetRadius() * randomRange(0.9, 1.12);
  const point = first
    ? { x: 50, y: 56 }
    : randomTargetCenterPercent({
      targetWidth: radius * 2.6,
      targetHeight: radius * 2.6,
      hudHeight: Math.max(118, height.value * 0.16),
      sidePadding: Math.max(72, width.value * 0.08),
      bottomPadding: Math.max(64, height.value * 0.08),
      previous: previousTargetPoint,
      minDistance: Math.min(260, Math.max(150, radius * 4.2)),
      attempts: 18
    });
  previousTargetPoint = point;
  targetSequence += 1;

  return {
    id: `vacuum-dust-${Date.now()}-${targetSequence}`,
    kind: targetSequence % 3 === 0 ? "star" : "dust",
    x: point.x,
    y: point.y,
    radius,
    hue: targetHues[targetSequence % targetHues.length],
    age: randomRange(0, Math.PI * 2),
    dwellProgress: 0
  };
}

function activeTargetLimit() {
  return width.value < 720 ? 3 : 4;
}

function refillTargets() {
  if (session.step >= session.maxSteps || finishAfter > 0) return;
  const remaining = session.maxSteps - session.step;
  const desired = Math.min(activeTargetLimit(), remaining);
  while (targets.length < desired) targets.push(createTarget(targets.length === 0 && session.step === 0));
}

function createRoomDots() {
  roomDots.splice(0);
  const count = width.value < 720 ? 34 : 54;
  const bounds = roomBounds();
  for (let index = 0; index < count; index += 1) {
    roomDots.push({
      x: randomRange(bounds.left + 16, bounds.right - 16),
      y: randomRange(bounds.top + 22, bounds.bottom - 18),
      radius: randomRange(1.4, 3.8),
      alpha: randomRange(0.08, 0.18)
    });
  }
}

function resetScene() {
  targets.splice(0);
  sparks.splice(0);
  previousTargetPoint = undefined;
  finishAfter = 0;
  finishDelayRemainingMs = 0;
  targetSequence = 0;
  const center = clampToRoom({ x: width.value * 0.5, y: height.value * 0.56 });
  robot.x = center.x;
  robot.y = center.y;
  robot.glow = 0;
  refillTargets();
}

function restart() {
  startSession();
  resetScene();
}

function updateRobot(delta: number) {
  const idleTarget = { x: width.value * 0.5 + Math.sin(robot.phase * 0.42) * 32, y: height.value * 0.56 + Math.cos(robot.phase * 0.36) * 18 };
  const nextTarget = clampToRoom(pointer.value.valid ? pointer.value : idleTarget);
  const previous = { x: robot.x, y: robot.y };
  const smoothing = pointer.value.valid ? 4.15 : 1.15;
  robot.x += (nextTarget.x - robot.x) * Math.min(1, delta * smoothing * session.settings.motionSpeed);
  robot.y += (nextTarget.y - robot.y) * Math.min(1, delta * smoothing * session.settings.motionSpeed);
  const clampedRobot = clampToRoom(robot);
  robot.x = clampedRobot.x;
  robot.y = clampedRobot.y;
  const travel = distance(previous, robot);
  if (travel > 0.15) robot.angle = Math.atan2(robot.y - previous.y, robot.x - previous.x);
  robot.phase += session.settings.reduceMotion ? 0 : delta * 2.4;
}

function addCleanupBurst(point: Point, hue: number, count = 14) {
  if (session.settings.reduceMotion) return;
  for (let index = 0; index < count; index += 1) {
    const angle = Math.PI * 2 * index / count + randomRange(-0.18, 0.18);
    const speed = randomRange(42, 108) * session.settings.motionSpeed;
    sparks.push({
      x: point.x,
      y: point.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: randomRange(0.85, 1.35),
      radius: randomRange(3.2, 7.6),
      hue
    });
  }
  if (sparks.length > 90) sparks.splice(0, sparks.length - 90);
}

function cancelTarget(target: DustTarget, now: number, reason: "left" | "invalid-gaze") {
  if (target.enteredAt === undefined) return;
  recordEvent("target-cancel", targetPayload(target, now, target.dwellProgress, reason));
  target.enteredAt = undefined;
  target.dwellProgress = 0;
}

function collectTarget(target: DustTarget, now: number) {
  const point = targetPixels(target);
  recordEvent("target-click", targetPayload(target, now, 1));
  recordSuccess({ targetId: target.id, kind: target.kind });
  addCleanupBurst(point, target.hue, target.kind === "star" ? 18 : 12);
  targets.splice(targets.indexOf(target), 1);
  robot.glow = 1;

  if (session.step >= session.maxSteps && finishAfter === 0) {
    finishAfter = now + 1700;
    finishDelayRemainingMs = 1700;
  } else {
    refillTargets();
  }
}

function closestCleanableTarget() {
  if (session.step >= session.maxSteps) return undefined;
  const radius = robotRadius();
  let closest: DustTarget | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    const point = targetPixels(target);
    const nextDistance = distance(robot, point);
    const cleanRadius = radius * 1.05 + target.radius;
    if (nextDistance <= cleanRadius && nextDistance < closestDistance) {
      closest = target;
      closestDistance = nextDistance;
    }
  }
  return closest;
}

function updateTargets(delta: number, now: number) {
  refillTargets();
  const active = closestCleanableTarget();

  for (const target of [...targets]) {
    target.age += delta;
    if (target !== active) {
      cancelTarget(target, now, pointer.value.valid ? "left" : "invalid-gaze");
      continue;
    }

    if (target.enteredAt === undefined) {
      target.enteredAt = now;
      recordEvent("target-enter", targetPayload(target, now, 0));
    }
    target.dwellProgress = Math.min(1, (now - target.enteredAt) / session.settings.dwellMs);
    if (target.dwellProgress >= 1) collectTarget(target, now);
  }
}

function updateSparks(delta: number) {
  for (let index = sparks.length - 1; index >= 0; index -= 1) {
    const spark = sparks[index];
    spark.age += delta;
    spark.x += spark.vx * delta;
    spark.y += spark.vy * delta;
    spark.vx *= 1 - Math.min(0.9, delta * 1.8);
    spark.vy *= 1 - Math.min(0.9, delta * 1.8);
    if (spark.age >= spark.life) sparks.splice(index, 1);
  }
}

function update(rawDelta: number, now: number) {
  const delta = session.status === "paused" ? 0 : rawDelta;
  if (session.status === "running") {
    updateRobot(delta);
    updateTargets(delta, now);
    updateSparks(delta);
    robot.glow += (0 - robot.glow) * Math.min(1, delta * 2.8);
    if (finishDelayRemainingMs > 0) {
      finishDelayRemainingMs = Math.max(0, finishDelayRemainingMs - delta * 1000);
      if (finishDelayRemainingMs === 0) finishSession("max-steps");
    }
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const bounds = roomBounds();
  const floor = ctx.createLinearGradient(0, 0, 0, height.value);
  floor.addColorStop(0, "#eef6ff");
  floor.addColorStop(0.5, "#f8f3e7");
  floor.addColorStop(1, "#e8d9c4");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "#c7b697";
  ctx.lineWidth = 2;
  const tile = Math.max(82, Math.min(128, width.value * 0.11));
  for (let x = bounds.left - tile; x < bounds.right + tile; x += tile) {
    ctx.beginPath();
    ctx.moveTo(x, bounds.top);
    ctx.lineTo(x + height.value * 0.24, bounds.bottom);
    ctx.stroke();
  }
  for (let y = bounds.top; y <= bounds.bottom; y += tile * 0.72) {
    ctx.beginPath();
    ctx.moveTo(bounds.left, y);
    ctx.lineTo(bounds.right, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#c9ddff";
  ctx.globalAlpha = 0.62;
  ctx.beginPath();
  ctx.ellipse(bounds.left + 84, bounds.top - 26, 118, 28, -0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f7d8c6";
  ctx.globalAlpha = 0.72;
  ctx.beginPath();
  ctx.ellipse(bounds.right - 112, bounds.bottom + 18, 146, 42, 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.38;
  ctx.fillStyle = "#ffffff";
  const visualNow = session.settings.reduceMotion ? 0 : now;
  const sunX = width.value * 0.78 + Math.sin(visualNow * 0.00012) * 10;
  ctx.beginPath();
  ctx.arc(sunX, height.value * 0.18, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRoomDust(ctx: CanvasRenderingContext2D) {
  ctx.save();
  for (const dot of roomDots) {
    ctx.globalAlpha = dot.alpha;
    ctx.fillStyle = "#9b866b";
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTarget(ctx: CanvasRenderingContext2D, target: DustTarget) {
  const point = targetPixels(target);
  const pulse = session.settings.reduceMotion ? 0.5 : 0.5 + Math.sin(target.age * 2.2) * 0.5;
  const radius = target.radius * (1 + target.dwellProgress * 0.28 + pulse * 0.08);

  ctx.save();
  ctx.globalCompositeOperation = target.kind === "star" ? "lighter" : "source-over";
  ctx.globalAlpha = target.kind === "star" ? 0.72 : 0.58;
  const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 2.2);
  glow.addColorStop(0, `hsla(${target.hue}, 94%, 72%, 0.55)`);
  glow.addColorStop(0.42, `hsla(${target.hue}, 76%, 58%, 0.18)`);
  glow.addColorStop(1, `hsla(${target.hue}, 72%, 48%, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius * 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 0.92;
  if (target.kind === "star") {
    drawStar(ctx, point.x, point.y, radius * 0.88, target.hue);
  } else {
    ctx.fillStyle = "#b79f82";
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, radius * 0.92, radius * 0.58, target.age * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgb(255 255 255 / 38%)";
    ctx.beginPath();
    ctx.arc(point.x - radius * 0.22, point.y - radius * 0.15, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  if (target.dwellProgress > 0) {
    ctx.strokeStyle = `hsla(${target.hue}, 88%, 48%, 0.76)`;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius * 1.36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * target.dwellProgress);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, hue: number) {
  ctx.save();
  ctx.fillStyle = `hsl(${hue}, 92%, 70%)`;
  ctx.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const stepRadius = index % 2 === 0 ? radius : radius * 0.46;
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const px = x + Math.cos(angle) * stepRadius;
    const py = y + Math.sin(angle) * stepRadius;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRobot(ctx: CanvasRenderingContext2D) {
  const radius = robotRadius();
  const bob = session.settings.reduceMotion ? 0 : Math.sin(robot.phase) * radius * 0.025;
  const sweep = session.settings.reduceMotion ? 0 : Math.sin(robot.phase * 2.1) * radius * 0.28;

  ctx.save();
  ctx.translate(robot.x, robot.y + bob);
  ctx.rotate(robot.angle * 0.14);

  ctx.globalAlpha = 0.24 + robot.glow * 0.28;
  const cleanGlow = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 2.2);
  cleanGlow.addColorStop(0, "rgba(109, 190, 214, 0.58)");
  cleanGlow.addColorStop(1, "rgba(109, 190, 214, 0)");
  ctx.fillStyle = cleanGlow;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgb(20 33 46 / 22%)";
  ctx.beginPath();
  ctx.ellipse(8, radius * 0.42, radius * 1.05, radius * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createLinearGradient(-radius, -radius, radius, radius);
  body.addColorStop(0, "#fafdff");
  body.addColorStop(0.52, "#dbe8f2");
  body.addColorStop(1, "#a9bfce");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#7da0b6";
  ctx.lineWidth = Math.max(4, radius * 0.09);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.84, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#77c8d9";
  ctx.beginPath();
  ctx.arc(radius * 0.28, -radius * 0.2, radius * 0.18 + robot.glow * radius * 0.06, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgb(83 111 128 / 70%)";
  ctx.lineWidth = Math.max(3, radius * 0.06);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-radius * 0.44, radius * 0.5);
  ctx.quadraticCurveTo(sweep, radius * 0.78, radius * 0.5, radius * 0.48);
  ctx.stroke();
  ctx.restore();
}

function drawSpark(ctx: CanvasRenderingContext2D, spark: CleanupSpark) {
  const progress = spark.age / spark.life;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = Math.max(0, 1 - progress);
  ctx.fillStyle = `hsl(${spark.hue}, 96%, 74%)`;
  ctx.beginPath();
  ctx.arc(spark.x, spark.y, spark.radius * (1 - progress * 0.35), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  const visualNow = session.settings.reduceMotion ? 0 : now;
  drawBackground(ctx, visualNow);
  drawRoomDust(ctx);
  for (const target of targets) drawTarget(ctx, target);
  for (const spark of sparks) drawSpark(ctx, spark);
  drawRobot(ctx);
}

onMounted(() => {
  createRoomDots();
  resetScene();
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="robot-vacuum-shell">
    <canvas ref="canvasRef" class="robot-vacuum-canvas" />

    <GameHud
      title="Робот-пылесос"
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
      title="Робот-пылесос"
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
.robot-vacuum-shell {
  background: #eef6ff;
  block-size: 100dvh;
  inline-size: 100dvw;
  overflow: hidden;
  position: relative;
}

.robot-vacuum-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>

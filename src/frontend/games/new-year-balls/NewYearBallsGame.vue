<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStartPromptAudio } from "../../composables/useStartPromptAudio";
import { resolveMenuRoute } from "../../core/menuMode";
import { percentToPixels } from "../../core/placement";
import { resolvePublicAssetUrl } from "../../core/publicAsset";
import { nextFreeSlot, treeSlots, type BallColor, type TreeSlot } from "./model";
import {
  disposeNewYearBallsAudio,
  playNewYearBallsMelody,
  resetNewYearBallsAudioSession,
  warmNewYearBallsAudio,
} from "./audio";

// Owner's idea (2026-11-13): the soap-bubble game redrawn for New Year. Pusya by the tree (the
// owner's picture) is the background, New Year balls float across the screen, the voice says
// «Помоги Пусе собрать новогодние шарики.» Look at a ball and it flies onto the tree: the 14
// circles drawn on the picture are empty at first and fill up — the tree first, then the garland.

type Point = { x: number; y: number };
type BallPhase = "floating" | "gazing" | "collecting";
type Ball = Point & {
  id: string;
  radius: number;
  color: BallColor;
  /** The circle of the picture this ball will hang on. */
  slot: number;
  age: number;
  phaseAge: number;
  phase: BallPhase;
  dwellProgress: number;
  enteredAt?: number;
  speed: number;
  wobble: number;
  drift: number;
  /** Where the ball was when it was collected, in pixels: it flies from here to its circle. */
  from?: Point;
};
type Sparkle = Point & { age: number; life: number; radius: number; color: BallColor };

// The colours of the balls on Pusya's tree: pink, yellow, sky blue, green.
const ballColors: Record<BallColor, { fill: string; shade: string }> = {
  pink: { fill: "#ff9fcf", shade: "#e2589f" },
  yellow: { fill: "#ffe44d", shade: "#e0a800" },
  blue: { fill: "#9eeeff", shade: "#3fb6dc" },
  green: { fill: "#b4f046", shade: "#68b81c" },
};
const outline = "#1f1f1f";
const pictureRatio = 1018 / 968;
const collectSeconds = 1.1;
/** After the last ball the full tree stays on screen a moment before the result. */
const admireSeconds = 2;

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const {
  session,
  durationMs,
  metrics,
  recommendation,
  pauseSession,
  resumeSession,
  finishSession,
  recordEvent,
  recordSuccess,
  startSession,
} = useGameSessionFor("new-year-balls", {
  maxSteps: treeSlots.length,
  overrides: {
    preset: "gentle",
    targetScale: 1.55,
    motionSpeed: 0.42,
    distractors: "none",
    hints: "high",
    sound: true,
  },
  finishOnMaxSteps: false,
});
useStartPromptAudio({ gameId: "new-year-balls", soundEnabled: toRef(session.settings, "sound") });

const balls = reactive<Ball[]>([]);
const sparkles = reactive<Sparkle[]>([]);
/** Circles of the picture that already have their ball. */
const filled = reactive(new Set<number>());
let admireLeft = 0;
const resultVisible = computed(() => session.status === "finished");

const picture = new Image();
picture.src = resolvePublicAssetUrl("images/new-year-balls/pusya.jpg");
let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let previousPoint: Point | undefined;

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

function hudClearance() {
  const value = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--game-hud-clearance"),
  );
  return Number.isFinite(value) ? value : window.innerHeight * 0.14;
}

/**
 * Pusya and the tree stand on the left, as tall as the space under the top bar allows but no
 * wider than about half the screen: the balls float on the free right side and never hide her.
 */
function pictureRect() {
  const top = hudClearance() + 8;
  let height = Math.max(1, window.innerHeight - top);
  let width = height * pictureRatio;
  const maxWidth = window.innerWidth * 0.48;
  if (width > maxWidth) {
    width = maxWidth;
    height = width / pictureRatio;
  }
  return { x: window.innerWidth * 0.01, y: window.innerHeight - height, width, height };
}

/** Where the balls float, in pixels: right of the picture, under the top bar. */
function ballArea() {
  const rect = pictureRect();
  const pad = Math.max(16, window.innerWidth * 0.015);
  return {
    left: rect.x + rect.width + pad,
    right: window.innerWidth - pad,
    top: hudClearance() + pad,
    bottom: window.innerHeight - pad,
  };
}

function slotPoint(slot: TreeSlot) {
  const rect = pictureRect();
  return {
    x: rect.x + rect.width * slot.x,
    y: rect.y + rect.height * slot.y,
    r: rect.height * slot.r,
  };
}

function slotById(id: number) {
  return treeSlots.find((slot) => slot.id === id) ?? treeSlots[0];
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function ballRadius() {
  const area = ballArea();
  const areaLimit = Math.min(area.right - area.left, area.bottom - area.top) * 0.2;
  return Math.min(128, Math.max(64, Math.min(areaLimit, 80 * session.settings.targetScale)));
}

function desiredBallCount() {
  const area = ballArea();
  const ratio = (area.right - area.left) / Math.max(1, area.bottom - area.top);
  return ratio < 1.15 ? 3 : 4;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function ballPoint(ball: Ball) {
  const point = percentToPixels(ball);
  return {
    x: point.x + Math.sin(ball.age * 0.55 + ball.wobble) * ball.radius * 0.14,
    y: point.y + Math.cos(ball.age * 0.42 + ball.wobble) * ball.radius * 0.05,
  };
}

/** Ball centre limits in percent of the screen (the cap above the ball needs room too). */
function ballBounds(radius: number) {
  const area = ballArea();
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  const left = ((area.left + radius) / w) * 100;
  const right = ((area.right - radius) / w) * 100;
  const top = ((area.top + radius * 1.4) / h) * 100;
  const bottom = ((area.bottom - radius) / h) * 100;
  return { left, right: Math.max(left, right), top, bottom: Math.max(top, bottom) };
}

function randomPoint(radius: number) {
  const bounds = ballBounds(radius);
  return {
    x: randomRange(bounds.left, bounds.right),
    y: randomRange(bounds.top, bounds.bottom),
  };
}

function clearance(point: Point, radius: number) {
  const candidate = percentToPixels(point);
  let best = Number.POSITIVE_INFINITY;
  for (const ball of balls) {
    if (ball.phase === "collecting") continue;
    const gap = radius + ball.radius + Math.max(24, Math.min(radius, ball.radius) * 0.2);
    best = Math.min(best, distance(candidate, ballPoint(ball)) - gap);
  }
  return best;
}

function choosePoint(radius: number, first: boolean) {
  if (first) {
    const bounds = ballBounds(radius);
    return { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
  }
  let bestPoint = randomPoint(radius);
  let bestClearance = clearance(bestPoint, radius);
  for (let index = 0; index < 40 && bestClearance < 0; index++) {
    const point = randomPoint(radius);
    const next = clearance(point, radius);
    if (next > bestClearance) {
      bestPoint = point;
      bestClearance = next;
    }
  }
  return bestPoint;
}

function clampBall(ball: Ball) {
  const bounds = ballBounds(ball.radius);
  ball.x = Math.max(bounds.left, Math.min(bounds.right, ball.x));
  ball.y = Math.max(bounds.top, Math.min(bounds.bottom, ball.y));
}

function separateBalls() {
  const visible = balls.filter((ball) => ball.phase !== "collecting");
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i];
        const b = visible[j];
        const pa = ballPoint(a);
        const pb = ballPoint(b);
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const current = Math.max(1, Math.hypot(dx, dy));
        const overlap =
          a.radius + b.radius + Math.max(24, Math.min(a.radius, b.radius) * 0.2) - current;
        if (overlap <= 0) continue;
        const shiftX = (dx / current) * overlap * 0.5;
        const shiftY = (dy / current) * overlap * 0.5;
        a.x -= (shiftX / Math.max(1, window.innerWidth)) * 100;
        a.y -= (shiftY / Math.max(1, window.innerHeight)) * 100;
        b.x += (shiftX / Math.max(1, window.innerWidth)) * 100;
        b.y += (shiftY / Math.max(1, window.innerHeight)) * 100;
        clampBall(a);
        clampBall(b);
      }
    }
  }
}

function placeBall(ball: Ball, first = false) {
  const radius = ballRadius() * randomRange(0.94, 1.08);
  const point = choosePoint(radius, first);
  previousPoint = point;
  Object.assign(ball, {
    x: point.x,
    y: point.y,
    radius,
    age: randomRange(0, 4),
    phaseAge: 0,
    phase: "floating",
    dwellProgress: 0,
    enteredAt: undefined,
    speed: randomRange(0.48, 0.86) * (Math.random() < 0.5 ? -1 : 1),
    wobble: randomRange(0, Math.PI * 2),
    drift: randomRange(-0.5, 0.5),
    from: undefined,
  });
}

function createBall(first = false): Ball | undefined {
  const slot = nextFreeSlot(filled, new Set(balls.map((ball) => ball.slot)));
  if (!slot) return undefined;
  const ball = {
    id: `new-year-ball-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    slot: slot.id,
    color: slot.color,
  } as Ball;
  placeBall(ball, first);
  return ball;
}

function copyPointer() {
  return {
    x: pointer.value.x,
    y: pointer.value.y,
    valid: pointer.value.valid,
    source: pointer.value.source,
    timestamp: pointer.value.timestamp,
  };
}

function targetPayload(ball: Ball, now: number, progress: number, reason?: string) {
  return {
    targetId: ball.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: ball.enteredAt === undefined ? 0 : now - ball.enteredAt,
    progress,
    pointer: copyPointer(),
    reason,
  };
}

function cancelBall(ball: Ball, now: number, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(ball, now, ball.dwellProgress, reason));
  ball.enteredAt = undefined;
  ball.dwellProgress = 0;
  if (ball.phase === "gazing") {
    ball.phase = "floating";
    ball.phaseAge = 0;
  }
}

function collectBall(ball: Ball, now: number) {
  recordEvent("target-click", targetPayload(ball, now, 1));
  recordSuccess({ targetId: ball.id, color: ball.color, slot: ball.slot });
  void playNewYearBallsMelody(session.settings.sound);
  ball.from = ballPoint(ball);
  ball.phase = "collecting";
  ball.phaseAge = 0;
  ball.dwellProgress = 1;
  ball.enteredAt = undefined;
}

function closestGazeBall() {
  if (!pointer.value.valid) return undefined;
  let closest: Ball | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const ball of balls) {
    if (ball.phase === "collecting") continue;
    const next = distance(ballPoint(ball), pointer.value);
    if (next <= ball.radius * 1.4 && next < closestDistance) {
      closest = ball;
      closestDistance = next;
    }
  }
  return closest;
}

function updateBallGaze(ball: Ball, now: number, gazeBall?: Ball) {
  if (ball.phase === "collecting" || session.status !== "running") return;
  if (gazeBall !== ball) {
    if (ball.enteredAt !== undefined)
      cancelBall(ball, now, pointer.value.valid ? "left" : "invalid-gaze");
    return;
  }
  if (ball.enteredAt === undefined) {
    ball.enteredAt = now;
    ball.phase = "gazing";
    ball.phaseAge = 0;
    recordEvent("target-enter", targetPayload(ball, now, 0));
  }
  ball.dwellProgress = Math.min(1, (now - ball.enteredAt) / session.settings.dwellMs);
  if (ball.dwellProgress >= 1) collectBall(ball, now);
}

function ensureBalls(delta: number) {
  if (session.status !== "running") return;
  // A new round started by the session itself (endless mode): an empty tree again.
  if (session.step === 0 && filled.size > 0 && !balls.some((b) => b.phase === "collecting"))
    filled.clear();
  if (filled.size >= treeSlots.length || session.step >= session.maxSteps) {
    if (balls.some((ball) => ball.phase === "collecting")) return;
    admireLeft -= delta;
    if (admireLeft <= 0) finishSession("max-steps");
    return;
  }
  admireLeft = admireSeconds;
  while (balls.length < desiredBallCount()) {
    const ball = createBall();
    if (!ball) break;
    balls.push(ball);
  }
}

function addSparkle(point: Point, color: BallColor) {
  sparkles.push({ ...point, age: 0, life: 1.2, radius: ballRadius() * 0.5, color });
  if (sparkles.length > 8) sparkles.shift();
}

function updateBalls(delta: number, now: number) {
  ensureBalls(delta);
  const gazeBall = closestGazeBall();
  for (let index = balls.length - 1; index >= 0; index--) {
    const ball = balls[index];
    ball.age += delta;
    ball.phaseAge += delta;
    if (ball.phase === "collecting") {
      if (ball.phaseAge >= collectSeconds) {
        filled.add(ball.slot);
        addSparkle(slotPoint(slotById(ball.slot)), ball.color);
        balls.splice(index, 1);
      }
      continue;
    }
    // Balls float slowly up or down and a little to the side, like decorations in the air.
    if (ball.phase === "floating") {
      ball.y -= ball.speed * session.settings.motionSpeed * delta;
      ball.x += ball.drift * session.settings.motionSpeed * delta;
    }
    // Off the edge of the free area: the ball floats in again from a new place.
    const bounds = ballBounds(ball.radius);
    const slack = 2;
    if (
      ball.y < bounds.top - slack ||
      ball.y > bounds.bottom + slack ||
      ball.x < bounds.left - slack ||
      ball.x > bounds.right + slack
    )
      placeBall(ball);
    updateBallGaze(ball, now, gazeBall);
  }
  separateBalls();
}

function updateSparkles(delta: number) {
  for (let index = sparkles.length - 1; index >= 0; index--) {
    sparkles[index].age += delta;
    if (sparkles[index].age >= sparkles[index].life) sparkles.splice(index, 1);
  }
}

function drawBackground(context: CanvasRenderingContext2D) {
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);
  if (!picture.complete || picture.naturalWidth === 0) return;
  const rect = pictureRect();
  context.drawImage(picture, rect.x, rect.y, rect.width, rect.height);
  for (const slot of treeSlots) {
    const point = slotPoint(slot);
    if (filled.has(slot.id)) drawHangingBall(context, point, slot.color);
    else drawEmptySlot(context, point);
  }
}

function hangingRadius(slotRadius: number) {
  return slotRadius * 1.25;
}

/** A circle still waiting for its ball: the drawn ball is covered by a pale dashed ring. */
function drawEmptySlot(context: CanvasRenderingContext2D, point: Point & { r: number }) {
  context.save();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(point.x, point.y, point.r * 1.12, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgb(120 120 120 / 75%)";
  context.lineWidth = Math.max(1.5, point.r * 0.12);
  context.setLineDash([point.r * 0.32, point.r * 0.24]);
  context.beginPath();
  context.arc(point.x, point.y, point.r * 0.92, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

/** A collected ball in its place on the tree or the garland. */
function drawHangingBall(
  context: CanvasRenderingContext2D,
  point: Point & { r: number },
  colorName: BallColor,
) {
  const radius = hangingRadius(point.r);
  const color = ballColors[colorName];
  context.save();
  const body = context.createRadialGradient(
    point.x - radius * 0.3,
    point.y - radius * 0.35,
    radius * 0.1,
    point.x,
    point.y,
    radius,
  );
  body.addColorStop(0, color.fill);
  body.addColorStop(0.7, color.fill);
  body.addColorStop(1, color.shade);
  context.fillStyle = body;
  context.strokeStyle = outline;
  context.lineWidth = Math.max(1.5, radius * 0.09);
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = "rgb(255 255 255 / 90%)";
  context.beginPath();
  context.ellipse(
    point.x - radius * 0.35,
    point.y - radius * 0.38,
    radius * 0.22,
    radius * 0.13,
    -0.7,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function drawBall(context: CanvasRenderingContext2D, ball: Ball) {
  let point = ballPoint(ball);
  let scale = 1 + Math.sin(ball.age * 0.9 + ball.wobble) * 0.02 + ball.dwellProgress * 0.08;
  let alpha = 1;
  if (ball.phase === "collecting" && ball.from) {
    const t = easeInOut(Math.min(1, ball.phaseAge / collectSeconds));
    const target = slotPoint(slotById(ball.slot));
    // A little arc on the way to Pusya.
    point = {
      x: ball.from.x + (target.x - ball.from.x) * t,
      y: ball.from.y + (target.y - ball.from.y) * t - Math.sin(t * Math.PI) * ball.radius * 1.2,
    };
    // Shrinks to the size of its circle on the picture.
    scale = 1.08 + (hangingRadius(target.r) / ball.radius - 1.08) * t;
  }
  const radius = ball.radius * scale;
  const color = ballColors[ball.color];
  const line = Math.max(2.5, radius * 0.045);
  // Swing a little, like a decoration on a thread.
  const tilt = Math.sin(ball.age * 1.1 + ball.wobble) * 0.08;

  context.save();
  context.globalAlpha = alpha;
  context.translate(point.x, point.y);
  context.rotate(tilt);

  if (ball.dwellProgress > 0 && ball.phase !== "collecting") {
    const glow = context.createRadialGradient(0, 0, radius * 0.6, 0, 0, radius * 1.6);
    glow.addColorStop(0, `${color.fill}aa`);
    glow.addColorStop(1, `${color.fill}00`);
    context.fillStyle = glow;
    context.beginPath();
    context.arc(0, 0, radius * 1.6, 0, Math.PI * 2);
    context.fill();
  }

  // Hanger loop and cap.
  const capWidth = radius * 0.42;
  const capHeight = radius * 0.24;
  const capTop = -radius - capHeight * 0.75;
  context.lineWidth = line;
  context.strokeStyle = outline;
  context.beginPath();
  context.ellipse(0, capTop - radius * 0.1, radius * 0.11, radius * 0.13, 0, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = "#c9ccd6";
  context.beginPath();
  context.roundRect(-capWidth / 2, capTop, capWidth, capHeight, capHeight * 0.3);
  context.fill();
  context.stroke();

  // The ball: flat colour with a darker lower side, black outline as in the picture.
  const body = context.createRadialGradient(
    -radius * 0.3,
    -radius * 0.35,
    radius * 0.1,
    0,
    0,
    radius,
  );
  body.addColorStop(0, color.fill);
  body.addColorStop(0.7, color.fill);
  body.addColorStop(1, color.shade);
  context.fillStyle = body;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.lineWidth = line;
  context.stroke();

  // Shine.
  context.fillStyle = "rgb(255 255 255 / 85%)";
  context.beginPath();
  context.ellipse(-radius * 0.38, -radius * 0.4, radius * 0.17, radius * 0.1, -0.7, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(-radius * 0.12, -radius * 0.58, radius * 0.05, 0, Math.PI * 2);
  context.fill();

  // How long is left to look: a white arc fills around the ball.
  if (ball.dwellProgress > 0 && ball.phase !== "collecting") {
    context.strokeStyle = "rgb(255 255 255 / 95%)";
    context.lineWidth = Math.max(5, radius * 0.1);
    context.lineCap = "round";
    context.beginPath();
    context.arc(0, 0, radius * 1.16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ball.dwellProgress);
    context.stroke();
    context.strokeStyle = color.shade;
    context.lineWidth = Math.max(2, radius * 0.035);
    context.stroke();
  }
  context.restore();
}

function drawSparkle(context: CanvasRenderingContext2D, sparkle: Sparkle) {
  const progress = Math.min(1, sparkle.age / sparkle.life);
  const color = ballColors[sparkle.color];
  context.save();
  context.globalAlpha = 1 - progress;
  context.strokeStyle = color.shade;
  context.lineWidth = 4;
  context.lineCap = "round";
  const inner = sparkle.radius * (0.2 + progress * 0.8);
  const outer = inner + sparkle.radius * 0.45;
  for (let index = 0; index < 8; index++) {
    const angle = (index / 8) * Math.PI * 2;
    context.beginPath();
    context.moveTo(sparkle.x + Math.cos(angle) * inner, sparkle.y + Math.sin(angle) * inner);
    context.lineTo(sparkle.x + Math.cos(angle) * outer, sparkle.y + Math.sin(angle) * outer);
    context.stroke();
  }
  context.restore();
}

function draw(context: CanvasRenderingContext2D) {
  drawBackground(context);
  for (const ball of balls) if (ball.phase !== "collecting") drawBall(context, ball);
  for (const ball of balls) if (ball.phase === "collecting") drawBall(context, ball);
  for (const sparkle of sparkles) drawSparkle(context, sparkle);
}

function tick(now: number) {
  const delta =
    session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  if (session.status === "running") {
    updateBalls(delta, now);
    updateSparkles(delta);
  }
  if (ctx) draw(ctx);
  frame = requestAnimationFrame(tick);
}

function initBalls() {
  balls.splice(0);
  sparkles.splice(0);
  filled.clear();
  admireLeft = admireSeconds;
  previousPoint = undefined;
  resetNewYearBallsAudioSession();
  for (let index = 0; index < desiredBallCount(); index++) {
    const ball = createBall(index === 0);
    if (ball) balls.push(ball);
  }
  separateBalls();
}

function restart() {
  startSession();
  initBalls();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  initBalls();
  window.addEventListener("resize", resizeCanvas);
  warmNewYearBallsAudio(session.settings.sound);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
  disposeNewYearBallsAudio();
});
</script>

<template>
  <div class="new-year-balls-shell">
    <canvas
      ref="canvasRef"
      class="new-year-balls-canvas"
      aria-label="Пуся у ёлки и новогодние шарики"
    />
    <GameHud
      title="Новогодние шарики"
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
      title="Новогодние шарики"
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
.new-year-balls-shell {
  background: #ffffff;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.new-year-balls-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>

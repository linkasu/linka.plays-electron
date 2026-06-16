<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeTennisAudio, playTennisMelody, resetTennisAudioSession, warmTennisAudio } from "./audio";
import { drawTennisScene, tennisCourtBottom, tennisCourtTop, type TennisBall, type TennisBurst, type TennisPaddle, type TennisTrail } from "./scene";

type RallyBall = TennisBall & {
  id: string;
  vx: number;
  vy: number;
  enteredAt?: number;
  approachId?: string;
  lastHitAt: number;
  trailAge: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, recordMistake, startSession } = useGameSessionFor("table-tennis", {
  maxSteps: 30,
  overrides: { preset: "gentle", dwellMs: 850, sessionSeconds: 90, targetScale: 1.38, motionSpeed: 0.72, distractors: "none", hints: "high" },
  finishOnMaxSteps: false
});

const paddle = reactive<TennisPaddle>({ x: 84, y: window.innerHeight * 0.56, width: 34, height: 210, glow: 0 });
const ball = reactive<RallyBall>({ id: `ball-${Date.now()}`, x: window.innerWidth * 0.72, y: window.innerHeight * 0.5, vx: -120, vy: 48, radius: 28, phase: 0, contactProgress: 0, lastHitAt: 0, trailAge: 0 });
const trails = reactive<TennisTrail[]>([]);
const bursts = reactive<TennisBurst[]>([]);
const streak = ref(0);
const partnerY = ref(window.innerHeight * 0.52);
const resultVisible = computed(() => session.status === "finished");

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function playArea() {
  const top = tennisCourtTop() + 28;
  const bottom = tennisCourtBottom() - 28;
  return {
    left: Math.max(54, width.value * 0.055),
    right: width.value - Math.max(54, width.value * 0.055),
    top,
    bottom,
    centerY: top + (bottom - top) / 2
  };
}

function paddleHeight() {
  const viewportLimit = Math.min(width.value, height.value) * 0.28;
  return Math.min(246, Math.max(154, Math.min(viewportLimit, 154 * session.settings.targetScale)));
}

function ballRadius() {
  const viewportLimit = Math.min(width.value, height.value) * 0.048;
  return Math.min(34, Math.max(23, Math.min(viewportLimit, 23 * session.settings.targetScale)));
}

function syncGeometry() {
  const area = playArea();
  paddle.x = Math.max(74, width.value * 0.1);
  paddle.width = Math.max(30, Math.min(42, width.value * 0.032));
  paddle.height = paddleHeight();
  paddle.y = Math.max(area.top + paddle.height / 2, Math.min(area.bottom - paddle.height / 2, paddle.y));
  ball.radius = ballRadius();
  partnerY.value = Math.max(area.top + paddle.height * 0.26, Math.min(area.bottom - paddle.height * 0.26, partnerY.value));
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

function targetPayload(progress: number, now: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: ball.approachId ?? ball.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: ball.enteredAt === undefined ? 0 : now - ball.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function addBurst(kind: TennisBurst["kind"], x: number, y: number, radius = ball.radius * 1.8) {
  bursts.push({ kind, x, y, radius, age: 0, life: kind === "hit" ? 1.05 : 1.25 });
  if (bursts.length > 10) bursts.shift();
}

function addTrail(delta: number) {
  ball.trailAge += delta;
  if (ball.trailAge < 0.045 || session.settings.reduceMotion) return;
  ball.trailAge = 0;
  trails.push({ x: ball.x, y: ball.y, radius: ball.radius, age: 0, life: 0.72 });
  if (trails.length > 18) trails.shift();
}

function resetBall(direction: -1 | 1 = -1) {
  const area = playArea();
  const speed = randomRange(160, 198) * session.settings.motionSpeed;
  ball.id = `ball-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  ball.x = direction < 0 ? area.right - randomRange(46, 110) : area.left + randomRange(80, 130);
  ball.y = randomRange(area.top + ball.radius, area.bottom - ball.radius);
  ball.vx = direction * speed;
  ball.vy = randomRange(-72, 72) * session.settings.motionSpeed;
  ball.phase = randomRange(0, Math.PI * 2);
  ball.contactProgress = 0;
  ball.enteredAt = undefined;
  ball.approachId = undefined;
  ball.lastHitAt = 0;
  ball.trailAge = 0;
}

function beginApproach(now: number) {
  if (ball.enteredAt !== undefined) return;
  ball.approachId = `rally-${Date.now()}`;
  ball.enteredAt = now;
  recordEvent("target-enter", targetPayload(ball.contactProgress, now));
}

function clearApproach() {
  ball.enteredAt = undefined;
  ball.approachId = undefined;
}

function completeApproach(now: number) {
  recordEvent("target-click", targetPayload(1, now));
  streak.value += 1;
  recordSuccess({ targetId: ball.approachId ?? ball.id, streak: streak.value });
  void playTennisMelody(session.settings.sound);
  addBurst("hit", ball.x, ball.y, ball.radius * 2.1);
  clearApproach();
}

function cancelApproach(now: number, reason: "left" | "invalid-gaze", progress = ball.contactProgress) {
  if (ball.enteredAt === undefined) return;
  recordEvent("target-cancel", targetPayload(progress, now, reason));
  clearApproach();
}

function hitBall(now: number) {
  const area = playArea();
  const offset = (ball.y - paddle.y) / Math.max(1, paddle.height / 2);
  const nextSpeed = Math.min(248, Math.abs(ball.vx) * (1.04 + Math.min(0.1, streak.value * 0.007)) + 10);
  completeApproach(now);
  ball.x = paddle.x + paddle.width + ball.radius;
  ball.vx = nextSpeed;
  ball.vy = (offset * 128 + randomRange(-26, 26)) * session.settings.motionSpeed;
  ball.y = Math.max(area.top + ball.radius, Math.min(area.bottom - ball.radius, ball.y));
  ball.lastHitAt = now;
  ball.contactProgress = 0;
}

function missBall(now: number) {
  cancelApproach(now, pointer.value.valid ? "left" : "invalid-gaze", ball.contactProgress);
  streak.value = 0;
  recordMistake({ targetId: ball.approachId ?? ball.id, softReset: true });
  addBurst("miss", Math.max(42, paddle.x - ball.radius), ball.y, ball.radius * 2.2);
  resetBall(-1);
}

function updatePaddle(delta: number) {
  const area = playArea();
  const targetY = pointer.value.valid ? pointer.value.y : paddle.y;
  const smoothing = pointer.value.valid ? 6.2 : 2.1;
  paddle.y += (targetY - paddle.y) * Math.min(1, delta * smoothing);
  paddle.y = Math.max(area.top + paddle.height / 2, Math.min(area.bottom - paddle.height / 2, paddle.y));
}

function updatePartner(delta: number) {
  const area = playArea();
  const targetY = ball.vx > 0 ? ball.y : area.centerY + Math.sin(ball.phase) * 18;
  partnerY.value += (targetY - partnerY.value) * Math.min(1, delta * 3.2);
  partnerY.value = Math.max(area.top + paddle.height * 0.26, Math.min(area.bottom - paddle.height * 0.26, partnerY.value));
}

function updateContact(now: number) {
  if (ball.vx >= 0) {
    ball.contactProgress = 0;
    return;
  }

  const distanceX = Math.max(0, ball.x - (paddle.x + paddle.width));
  const horizontal = 1 - Math.min(1, distanceX / Math.max(180, width.value * 0.18));
  const vertical = 1 - Math.min(1, Math.abs(ball.y - paddle.y) / Math.max(1, paddle.height * 0.72));
  ball.contactProgress = Math.max(0, horizontal * vertical);

  if (horizontal > 0.24) beginApproach(now);
}

function updateBall(delta: number, now: number) {
  const area = playArea();
  ball.phase += delta * (session.settings.reduceMotion ? 1.2 : 3.4);
  ball.x += ball.vx * delta;
  ball.y += ball.vy * delta;
  addTrail(delta);

  if (ball.y <= area.top + ball.radius) {
    ball.y = area.top + ball.radius;
    ball.vy = Math.abs(ball.vy) * 0.94 + 8;
  }
  if (ball.y >= area.bottom - ball.radius) {
    ball.y = area.bottom - ball.radius;
    ball.vy = -Math.abs(ball.vy) * 0.94 - 8;
  }

  const paddleFace = paddle.x + paddle.width;
  const verticalGap = Math.abs(ball.y - paddle.y);
  const touchesPaddle = ball.vx < 0 && ball.x - ball.radius <= paddleFace && ball.x + ball.radius >= paddle.x && verticalGap <= paddle.height / 2 + ball.radius * 0.62;
  if (touchesPaddle && now - ball.lastHitAt > 420) hitBall(now);

  const partnerFace = area.right - Math.max(92, width.value * 0.1);
  if (ball.x + ball.radius >= partnerFace && ball.vx > 0) {
    ball.x = partnerFace - ball.radius;
    ball.vx = -Math.abs(ball.vx) * randomRange(0.92, 1.02);
    ball.vy += (ball.y - partnerY.value) * 0.26;
    addBurst("return", ball.x, ball.y, ball.radius * 1.6);
  }

  if (ball.x < area.left - ball.radius * 2.8) missBall(now);
  updateContact(now);
}

function updateEffects(delta: number) {
  for (let index = trails.length - 1; index >= 0; index--) {
    trails[index].age += delta;
    if (trails[index].age >= trails[index].life) trails.splice(index, 1);
  }

  for (let index = bursts.length - 1; index >= 0; index--) {
    bursts[index].age += delta;
    if (bursts[index].age >= bursts[index].life) bursts.splice(index, 1);
  }

  const targetGlow = (pointer.value.valid ? 0.16 : 0) + ball.contactProgress * 0.84;
  paddle.glow += (targetGlow - paddle.glow) * Math.min(1, delta * 5.5);
}

function update(delta: number, now: number) {
  syncGeometry();
  if (session.status !== "running") return;
  updatePaddle(delta);
  updatePartner(delta);
  updateBall(delta, now);
  updateEffects(delta);
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawTennisScene(ctx, {
    paddle,
    partnerY: partnerY.value,
    ball,
    trails,
    bursts,
    pointer: pointer.value,
    running: session.status === "running",
    now,
    durationMs: durationMs.value,
    sessionSeconds: session.settings.sessionSeconds,
    score: session.score,
    streak: streak.value
  });
}

useGameLoop({ context, update, draw });

function restart() {
  trails.splice(0);
  bursts.splice(0);
  streak.value = 0;
  resetTennisAudioSession();
  startSession();
  syncGeometry();
  resetBall(-1);
}

onMounted(async () => {
  await nextTick();
  syncGeometry();
  resetBall(-1);
  resetTennisAudioSession();
  warmTennisAudio(session.settings.sound);
});

onUnmounted(() => {
  disposeTennisAudio();
});
</script>

<template>
  <div class="tennis-shell">
    <canvas ref="canvasRef" class="tennis-canvas" />

    <div class="quiet-controls d-flex align-center ga-1 pa-1">
      <v-btn aria-label="В меню" color="surface" density="comfortable" icon="mdi-arrow-left" size="small" variant="text" @click="router.push(resolveMenuRoute())" />
      <v-btn
        :aria-label="session.status === 'paused' ? 'Продолжить' : 'Пауза'"
        color="surface"
        density="comfortable"
        :icon="session.status === 'paused' ? 'mdi-play' : 'mdi-pause'"
        size="small"
        variant="text"
        @click="session.status === 'paused' ? resumeSession() : pauseSession()"
      />
    </div>

    <GameResultDialog :model-value="resultVisible" title="Теннис" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.tennis-shell {
  background: #b9ebff;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.tennis-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.quiet-controls {
  background: rgb(255 255 255 / 34%);
  border: 1px solid rgb(255 255 255 / 34%);
  border-radius: 18px;
  box-shadow: 0 10px 28px rgb(60 116 136 / 12%);
  inset-block-start: max(16px, env(safe-area-inset-top));
  inset-inline-start: max(16px, env(safe-area-inset-left));
  opacity: 0.5;
  position: absolute;
  transition: opacity 160ms ease;
  z-index: 2;
}

.quiet-controls:focus-within,
.quiet-controls:hover {
  opacity: 0.95;
}
</style>

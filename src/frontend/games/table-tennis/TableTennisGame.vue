<script setup lang="ts">
import { computed, reactive } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { useGameSession } from "../../core/session";

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("table-tennis", {
  maxSteps: 10,
  sessionSeconds: 90
});

const paddle = reactive({ x: 72, y: window.innerHeight / 2, width: 24, height: 190 });
const ball = reactive({ x: window.innerWidth * 0.58, y: window.innerHeight * 0.45, vx: -220, vy: 120, radius: 22, lastHitAt: 0 });
const resultVisible = computed(() => session.status === "finished");

function resetBall(direction = -1) {
  ball.x = width.value * 0.62;
  ball.y = 140 + Math.random() * Math.max(120, height.value - 240);
  ball.vx = direction * 220 * session.settings.motionSpeed;
  ball.vy = (Math.random() > 0.5 ? 1 : -1) * 130 * session.settings.motionSpeed;
}

function update(delta: number, now: number) {
  if (session.status !== "running") return;
  const targetY = pointer.value.valid ? pointer.value.y : paddle.y;
  paddle.y += (targetY - paddle.y) * Math.min(1, delta * 7);
  paddle.y = Math.max(130, Math.min(height.value - 80, paddle.y));

  ball.x += ball.vx * delta;
  ball.y += ball.vy * delta;

  if (ball.y < 118 + ball.radius || ball.y > height.value - ball.radius) {
    ball.vy *= -1;
  }

  const paddleTop = paddle.y - paddle.height / 2;
  const paddleBottom = paddle.y + paddle.height / 2;
  const touchesPaddle = ball.x - ball.radius <= paddle.x + paddle.width && ball.x > paddle.x && ball.y >= paddleTop && ball.y <= paddleBottom;
  if (touchesPaddle && now - ball.lastHitAt > 600) {
    ball.lastHitAt = now;
    ball.vx = Math.abs(ball.vx);
    ball.vy += (ball.y - paddle.y) * 2;
    recordSuccess({ targetId: "paddle" });
  }

  if (ball.x > width.value - ball.radius) ball.vx = -Math.abs(ball.vx);
  if (ball.x < -ball.radius) {
    recordMistake({ targetId: "ball" });
    resetBall(-1);
  }
}

function draw(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, width.value, height.value);
  const gradient = ctx.createLinearGradient(0, 0, width.value, height.value);
  gradient.addColorStop(0, "#ecfbff");
  gradient.addColorStop(1, "#d8ddff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.fillStyle = "#6c5ce7";
  ctx.beginPath();
  ctx.roundRect(paddle.x, paddle.y - paddle.height / 2, paddle.width, paddle.height, 14);
  ctx.fill();

  ctx.fillStyle = "#ffcf5c";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
}

useGameLoop({ context, update, draw });

function restart() {
  startSession();
  resetBall(-1);
}
</script>

<template>
  <div class="tennis-shell">
    <canvas ref="canvasRef" class="tennis-canvas" />
    <GameHud title="Теннис" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <GameResultDialog :model-value="resultVisible" title="Теннис" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :recommendation="recommendation" @menu="router.push('/')" @restart="restart" />
  </div>
</template>

<style scoped>
.tennis-shell {
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
}

.tennis-canvas {
  display: block;
}
</style>

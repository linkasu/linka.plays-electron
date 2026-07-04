<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeBoatAudio, playBoatDamageCue, playBoatSuccessCue, setBoatMusicActive, tickBoatMusic, warmBoatAudio } from "./audio";
import { boatPoint, boatRouteSegments, boatScrollSpeed, boatVisualSize, createBoatGameState, riverGeometry, syncBoatGeometry, updateBoatGame, type BoatGameState, type BoatHazard, type Point, type ViewportSize } from "./model";

type Decoration = Point & {
  kind: "island" | "buoy" | "reeds";
  size: number;
  speed: number;
  phase: number;
};

type Ripple = Point & {
  age: number;
  life: number;
  radius: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("boat", {
  maxSteps: boatRouteSegments.length,
  overrides: { preset: "standard", dwellMs: 500, sessionSeconds: 135, targetScale: 1.2, motionSpeed: 0.78, distractors: "low", hints: "medium" },
  finishOnMistakes: false
});

const soundEnabled = toRef(session.settings, "sound");
const viewport = ref<ViewportSize>({ width: window.innerWidth, height: window.innerHeight });
const boatState = ref<BoatGameState>(createBoatGameState(viewport.value, session.settings.targetScale));
const decorations = reactive<Decoration[]>([]);
const ripples = reactive<Ripple[]>([]);
const resultVisible = computed(() => session.status === "finished");
const currentRoute = computed(() => boatRouteSegments[boatState.value.routeIndex]);

let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let sceneryOffset = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function resizeCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  viewport.value = { width: window.innerWidth, height: window.innerHeight };
  canvas.width = Math.round(viewport.value.width * ratio);
  canvas.height = Math.round(viewport.value.height * ratio);
  canvas.style.width = "100dvw";
  canvas.style.height = "100dvh";
  ctx = canvas.getContext("2d") ?? undefined;
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  boatState.value = syncBoatGeometry(boatState.value, viewport.value, session.settings.targetScale);
}

function safeRiverY(size: number) {
  const river = riverGeometry(viewport.value);
  return randomRange(river.top + size * 0.68, river.bottom - size * 0.68);
}

function createDecoration(index: number): Decoration {
  const kind = index % 5 === 0 ? "island" : index % 3 === 0 ? "reeds" : "buoy";
  const size = kind === "island" ? randomRange(58, 96) : kind === "reeds" ? randomRange(38, 62) : randomRange(22, 34);
  return {
    kind,
    size,
    x: randomRange(0, viewport.value.width),
    y: safeRiverY(size),
    speed: randomRange(96, 126),
    phase: randomRange(0, Math.PI * 2)
  };
}

function initDecorations() {
  decorations.splice(0);
  const count = viewport.value.width < 760 ? 8 : 12;
  for (let index = 0; index < count; index += 1) decorations.push(createDecoration(index));
}

function addRipple(x: number, y: number, radius: number) {
  ripples.push({ x, y, radius, age: 0, life: 1.35 });
  if (ripples.length > 12) ripples.shift();
}

function restart() {
  startSession();
  ripples.splice(0);
  boatState.value = createBoatGameState(viewport.value, session.settings.targetScale);
  initDecorations();
  setBoatMusicActive(soundEnabled.value, true);
}

function updateDecorations(delta: number) {
  const currentSpeed = boatScrollSpeed(session.settings.motionSpeed);
  for (const decoration of decorations) {
    decoration.x -= decoration.speed * session.settings.motionSpeed * delta;
    decoration.phase += session.settings.reduceMotion ? 0 : delta * 1.3;
    if (decoration.x < -decoration.size * 2) {
      decoration.x = viewport.value.width + currentSpeed * randomRange(0.4, 1.5);
      decoration.y = safeRiverY(decoration.size);
    }
  }
}

function updateRipples(delta: number) {
  for (let index = ripples.length - 1; index >= 0; index -= 1) {
    const ripple = ripples[index];
    ripple.age += delta;
    if (ripple.age >= ripple.life) ripples.splice(index, 1);
  }
}

function update(delta: number) {
  tickBoatMusic(soundEnabled.value);
  if (session.status !== "running") return;
  sceneryOffset = (sceneryOffset + boatScrollSpeed(session.settings.motionSpeed) * delta) % Math.max(1, viewport.value.width);

  const previousGate = boatState.value.gate;
  const result = updateBoatGame(boatState.value, pointer.value.valid ? pointer.value.y : undefined, delta, viewport.value, session.settings.motionSpeed, session.settings.targetScale, session.settings.reduceMotion);
  boatState.value = result.state;

  if (result.event.type === "success") {
    recordSuccess({ routeId: boatRouteSegments[result.event.routeIndex]?.id, gateId: result.event.gateId, hull: boatState.value.hull });
    addRipple(previousGate.x, previousGate.y, previousGate.radius * 0.72);
    playBoatSuccessCue(soundEnabled.value);
    if (boatState.value.mode === "finished") finishSession("game-complete");
  }

  if (result.event.type === "damage" || result.event.type === "crashed") {
    recordMistake({ routeId: boatRouteSegments[result.event.routeIndex]?.id, hazardId: result.event.hazardId, reason: result.event.reason, hull: boatState.value.hull });
    void playBoatDamageCue(soundEnabled.value);
    if (result.event.type === "crashed") finishSession("game-lost");
  }

  updateDecorations(delta);
  updateRipples(delta);
}

function drawRiver(context: CanvasRenderingContext2D) {
  const { width, height } = viewport.value;
  const river = riverGeometry(viewport.value);
  const riverGradient = context.createLinearGradient(0, river.top, 0, river.bottom);
  riverGradient.addColorStop(0, "#8bc7dc");
  riverGradient.addColorStop(0.45, "#3c9fc3");
  riverGradient.addColorStop(1, "#176f9d");

  context.fillStyle = "#d9ead0";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#bad59d";
  context.fillRect(0, 0, width, river.top + 18);
  context.fillStyle = "#aeca91";
  context.fillRect(0, river.bottom - 10, width, height - river.bottom + 10);

  context.beginPath();
  context.moveTo(0, river.top + 18);
  context.bezierCurveTo(width * 0.24, river.top - 14, width * 0.62, river.top + 28, width, river.top + 8);
  context.lineTo(width, river.bottom - 10);
  context.bezierCurveTo(width * 0.7, river.bottom + 28, width * 0.26, river.bottom - 34, 0, river.bottom + 6);
  context.closePath();
  context.fillStyle = riverGradient;
  context.fill();

  context.strokeStyle = "rgb(255 255 255 / 28%)";
  context.lineWidth = 2;
  for (let index = 0; index < 6; index += 1) {
    const y = river.top + (river.bottom - river.top) * (0.12 + index * 0.15);
    const offset = sceneryOffset % (width * 0.28);
    context.beginPath();
    context.moveTo(-width * 0.28 - offset, y);
    for (let x = -width * 0.28 - offset; x <= width + width * 0.28; x += width * 0.28) {
      context.bezierCurveTo(x + width * 0.08, y - 12, x + width * 0.18, y + 14, x + width * 0.28, y - 5);
    }
    context.stroke();
  }

  drawMovingBankMarks(context, river.top + 18, true);
  drawMovingBankMarks(context, river.bottom - 10, false);
}

function drawMovingBankMarks(context: CanvasRenderingContext2D, y: number, topBank: boolean) {
  const width = viewport.value.width;
  const spacing = Math.max(82, width * 0.095);
  const offset = sceneryOffset % spacing;
  context.save();
  context.fillStyle = topBank ? "rgb(95 139 75 / 38%)" : "rgb(76 126 68 / 40%)";
  for (let x = -spacing - offset; x < width + spacing; x += spacing) {
    const markY = y + (topBank ? -10 : 10) + Math.sin((x + sceneryOffset) * 0.018) * 7;
    context.beginPath();
    context.ellipse(x, markY, spacing * 0.22, 5, 0.08, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawDecoration(context: CanvasRenderingContext2D, decoration: Decoration) {
  const bobY = decoration.y + (session.settings.reduceMotion ? 0 : Math.sin(decoration.phase) * decoration.size * 0.04);
  if (decoration.kind === "island") {
    context.fillStyle = "rgb(197 166 101 / 72%)";
    context.beginPath();
    context.ellipse(decoration.x, bobY, decoration.size * 0.68, decoration.size * 0.34, -0.08, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgb(69 122 76 / 78%)";
    context.beginPath();
    context.ellipse(decoration.x - decoration.size * 0.12, bobY - decoration.size * 0.12, decoration.size * 0.42, decoration.size * 0.2, 0.12, 0, Math.PI * 2);
    context.fill();
    return;
  }

  if (decoration.kind === "reeds") {
    context.strokeStyle = "rgb(44 99 72 / 76%)";
    context.lineWidth = 4;
    for (let index = -1; index <= 1; index += 1) {
      context.beginPath();
      context.moveTo(decoration.x + index * decoration.size * 0.16, bobY + decoration.size * 0.28);
      context.quadraticCurveTo(decoration.x + index * decoration.size * 0.08, bobY, decoration.x + index * decoration.size * 0.2, bobY - decoration.size * 0.38);
      context.stroke();
    }
    return;
  }

  context.fillStyle = "rgb(255 245 201 / 88%)";
  context.beginPath();
  context.arc(decoration.x, bobY, decoration.size * 0.46, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgb(202 77 67 / 86%)";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(decoration.x - decoration.size * 0.38, bobY);
  context.lineTo(decoration.x + decoration.size * 0.38, bobY);
  context.stroke();
}

function drawStoneGate(context: CanvasRenderingContext2D, hazard: BoatHazard) {
  const river = riverGeometry(viewport.value);
  const left = hazard.x - hazard.width / 2;
  const gapTop = hazard.gapY - hazard.gapHeight / 2;
  const gapBottom = hazard.gapY + hazard.gapHeight / 2;
  const topHeight = Math.max(0, gapTop - river.top);
  const bottomHeight = Math.max(0, river.bottom - gapBottom);
  context.save();
  drawStoneColumn(context, left, river.top, hazard.width, topHeight, false, hazard.phase);
  drawStoneColumn(context, left, gapBottom, hazard.width, bottomHeight, true, hazard.phase + 1.3);

  context.strokeStyle = "rgb(255 248 176 / 88%)";
  context.lineWidth = 5;
  context.setLineDash([12, 10]);
  context.beginPath();
  context.roundRect(left + hazard.width * 0.14, gapTop + hazard.gapHeight * 0.08, hazard.width * 0.72, hazard.gapHeight * 0.84, Math.min(hazard.width, hazard.gapHeight) * 0.18);
  context.stroke();
  context.setLineDash([]);
  context.restore();
}

function drawStoneColumn(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, fromBottom: boolean, phase: number) {
  if (height <= 0) return;
  const radius = Math.min(width, height) * 0.16;
  const gradient = context.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, "#6d7680");
  gradient.addColorStop(0.52, "#4d5964");
  gradient.addColorStop(1, "#303b45");
  context.fillStyle = gradient;
  context.strokeStyle = "rgb(28 39 49 / 78%)";
  context.lineWidth = Math.max(3, width * 0.04);
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
  context.stroke();

  context.fillStyle = "rgb(255 255 255 / 12%)";
  for (let index = 0; index < 5; index += 1) {
    const stoneX = x + width * (0.24 + (index % 2) * 0.34);
    const stoneY = fromBottom ? y + height * (0.16 + index * 0.16) : y + height * (0.84 - index * 0.16);
    context.beginPath();
    context.ellipse(stoneX + Math.sin(phase + index) * width * 0.04, stoneY, width * 0.17, Math.max(8, width * 0.06), -0.25, 0, Math.PI * 2);
    context.fill();
  }
}

function drawHazards(context: CanvasRenderingContext2D) {
  for (const hazard of boatState.value.hazards) {
    drawStoneGate(context, hazard);
  }
}

function drawGate(context: CanvasRenderingContext2D) {
  const gate = boatState.value.gate;
  const pulse = session.settings.reduceMotion ? 1 : 1 + Math.sin(gate.phase * 2) * 0.035;
  const radius = gate.radius * pulse;
  const gradient = context.createRadialGradient(gate.x, gate.y, radius * 0.18, gate.x, gate.y, radius);
  gradient.addColorStop(0, "rgb(255 255 255 / 42%)");
  gradient.addColorStop(0.62, "rgb(255 244 167 / 20%)");
  gradient.addColorStop(1, "rgb(255 244 167 / 0%)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(gate.x, gate.y, radius, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgb(255 250 196 / 92%)";
  context.lineWidth = 7;
  context.setLineDash([14, 12]);
  context.beginPath();
  context.arc(gate.x, gate.y, radius * 0.74, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
}

function drawBoat(context: CanvasRenderingContext2D) {
  const size = boatVisualSize(viewport.value, session.settings.targetScale);
  const position = boatPoint(boatState.value, session.settings.targetScale, viewport.value);
  const shake = boatState.value.shakeSeconds > 0 && !session.settings.reduceMotion ? Math.sin(performance.now() * 0.045) * size * 0.05 : 0;
  const x = position.x + shake;
  const glowRadius = size * (0.86 + boatState.value.boat.glow * 0.42);
  const damage = boatState.value.boat.damageFlash;
  const hullRatio = boatState.value.hull / boatState.value.maxHull;

  const glow = context.createRadialGradient(x, position.y, size * 0.24, x, position.y, glowRadius);
  glow.addColorStop(0, `rgb(255 246 182 / ${0.18 + boatState.value.boat.glow * 0.24 + damage * 0.18})`);
  glow.addColorStop(1, "rgb(255 246 182 / 0%)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, position.y, glowRadius, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgb(42 72 91 / 30%)";
  context.beginPath();
  context.ellipse(x - size * 0.06, position.y + size * 0.36, size * 0.68, size * 0.16, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = hullRatio <= 0.34 ? "#9b5a41" : hullRatio <= 0.67 ? "#d27c50" : "#f4a35f";
  context.beginPath();
  context.moveTo(x - size * 0.68, position.y + size * 0.14);
  context.quadraticCurveTo(x, position.y + size * 0.52, x + size * 0.68, position.y + size * 0.14);
  context.quadraticCurveTo(x + size * 0.42, position.y + size * 0.44, x - size * 0.42, position.y + size * 0.44);
  context.closePath();
  context.fill();
  context.strokeStyle = damage > 0 ? "rgb(255 250 220 / 82%)" : "rgb(95 55 39 / 52%)";
  context.lineWidth = 3 + damage * 3;
  context.stroke();

  if (boatState.value.hull < boatState.value.maxHull) {
    context.strokeStyle = "rgb(86 46 34 / 78%)";
    context.lineWidth = 3;
    for (let crack = 0; crack < boatState.value.maxHull - boatState.value.hull; crack += 1) {
      const startX = x - size * (0.24 - crack * 0.22);
      context.beginPath();
      context.moveTo(startX, position.y + size * 0.22);
      context.lineTo(startX + size * 0.08, position.y + size * 0.31);
      context.lineTo(startX + size * 0.02, position.y + size * 0.4);
      context.stroke();
    }
  }

  context.strokeStyle = "#6d503c";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(x - size * 0.04, position.y + size * 0.16);
  context.lineTo(x - size * 0.04, position.y - size * 0.58);
  context.stroke();

  context.fillStyle = boatState.value.mode === "crashed" ? "#d8d0bd" : "#fff7d6";
  context.beginPath();
  context.moveTo(x, position.y - size * 0.56);
  context.quadraticCurveTo(x + size * 0.54, position.y - size * 0.22, x, position.y + size * 0.08);
  context.closePath();
  context.fill();
  context.strokeStyle = "rgb(87 80 64 / 32%)";
  context.lineWidth = 2;
  context.stroke();
}

function drawRipples(context: CanvasRenderingContext2D) {
  for (const ripple of ripples) {
    const progress = ripple.age / ripple.life;
    context.strokeStyle = `rgb(255 255 255 / ${0.42 * (1 - progress)})`;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(ripple.x, ripple.y, ripple.radius * (0.5 + progress), 0, Math.PI * 2);
    context.stroke();
  }
}

function drawStatus(context: CanvasRenderingContext2D) {
  const size = Math.max(16, Math.min(viewport.value.width, viewport.value.height) * 0.026);
  const x = Math.max(36, viewport.value.width * 0.045);
  const y = Math.max(76, viewport.value.height * 0.13);
  context.save();
  context.fillStyle = "rgb(13 36 54 / 68%)";
  context.strokeStyle = "rgb(255 255 255 / 26%)";
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(x - size * 0.8, y - size * 1.4, size * 15.2, size * 3.4, size * 0.65);
  context.fill();
  context.stroke();

  context.fillStyle = "#f4fbff";
  context.font = `800 ${size}px Roboto, sans-serif`;
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(`Маршрут ${boatState.value.routeIndex + 1}/${boatRouteSegments.length}: ${currentRoute.value.title}`, x, y - size * 0.45);
  context.fillStyle = boatState.value.hull <= 1 ? "#ffd2c5" : "#e5ffe8";
  context.fillText(`Прочность: ${boatState.value.hull}/${boatState.value.maxHull}`, x, y + size * 0.82);
  context.restore();
}

function draw(context: CanvasRenderingContext2D) {
  drawRiver(context);
  for (const decoration of decorations) drawDecoration(context, decoration);
  drawHazards(context);
  drawGate(context);
  drawRipples(context);
  drawBoat(context);
  drawStatus(context);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  update(delta);
  if (ctx) draw(ctx);
  frame = requestAnimationFrame(tick);
}

watch(() => [session.status, soundEnabled.value] as const, ([status, enabled]) => {
  setBoatMusicActive(enabled, status === "running");
}, { immediate: true });

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  initDecorations();
  warmBoatAudio(soundEnabled.value);
  setBoatMusicActive(soundEnabled.value, session.status === "running");
  window.addEventListener("resize", resizeCanvas);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
  disposeBoatAudio();
});
</script>

<template>
  <div class="boat-shell">
    <canvas ref="canvasRef" class="boat-canvas" aria-label="Игра Лодочка: проведи лодку через пороги" />

    <GameHud
      title="Лодочка"
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
      title="Лодочка"
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
.boat-shell {
  background: #d9ead0;
  block-size: 100dvh;
  inline-size: 100dvw;
  overflow: hidden;
  position: relative;
}

.boat-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>

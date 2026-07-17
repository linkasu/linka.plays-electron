<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeGazeMazeAudio, playGazeMazeStepMelody, warmGazeMazeAudio } from "./audio";
import { gazeMazeLevels as levels, isMazeDeadEnd, mazeNeighborIds, resolveAdjacentMazeTarget, type MazeNode, type MazePoint as Point } from "./model";

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession, finishSession } = useGameSessionFor("gaze-maze", {
  maxSteps: 18,
  overrides: { preset: "gentle", targetScale: 1.35, sound: true, hints: "high" },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const currentLevelIndex = ref(0);
const currentNodeId = ref(levels[0].startId);
const feedbackText = ref("Помоги гномику пройти к конфете. Можно идти туда и обратно.");
const isSpeaking = ref(false);
const resultVisible = computed(() => session.status === "finished");
const promptAudio = useGamePromptAudio({ gameId: "gaze-maze", soundEnabled: toRef(session.settings, "sound") });

let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let stage = { x: 0, y: 0, width: 1, height: 1 };
let hoverNodeId: string | undefined;
let enteredAt = 0;
let dwellProgress = 0;
let cooldownUntil = 0;
let lastTime = performance.now();
let moveFromId: string | undefined;
let moveToId: string | undefined;
let moveStartedAt = 0;
let pendingMoveNode: MazeNode | undefined;

const moveDurationMs = 780;

const currentLevel = computed(() => levels[currentLevelIndex.value]);
const currentNode = computed(() => nodeById(currentNodeId.value));
const adjacentIds = computed(() => new Set(neighborIds(currentNodeId.value)));

function nodeById(id: string) {
  const node = currentLevel.value.nodes.find((item) => item.id === id);
  if (!node) throw new Error(`Unknown gaze maze node: ${id}`);
  return node;
}

async function playTts(assetId: string, delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait([assetId], delayMs);
  isSpeaking.value = false;
}

function neighborIds(id: string) {
  return mazeNeighborIds(currentLevel.value, id);
}

function isDeadEnd(node: MazeNode) {
  return isMazeDeadEnd(currentLevel.value, node);
}

function nodePoint(node: MazeNode): Point {
  return {
    x: stage.x + stage.width * node.x / 100,
    y: stage.y + stage.height * node.y / 100
  };
}

function nodeRadius() {
  return Math.max(42, Math.min(76, Math.min(stage.width, stage.height) * 0.092 * session.settings.targetScale));
}

function nodeScale(node: MazeNode) {
  if (node.kind === "exit") return 1.42;
  if (node.kind === "start") return 1.12;
  return 1;
}

function nodeHitRadius(node: MazeNode) {
  return nodeRadius() * nodeScale(node) * 1.2;
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
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function isMoving(now = performance.now()) {
  return moveToId !== undefined && now - moveStartedAt < moveDurationMs;
}

function easeMove(progress: number) {
  return progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
}

function pathControls(from: Point, to: Point) {
  const midX = (from.x + to.x) / 2;
  return {
    first: { x: midX, y: from.y },
    second: { x: midX, y: to.y }
  };
}

function cubicPoint(from: Point, first: Point, second: Point, to: Point, progress: number) {
  const inverse = 1 - progress;
  return {
    x: inverse ** 3 * from.x + 3 * inverse ** 2 * progress * first.x + 3 * inverse * progress ** 2 * second.x + progress ** 3 * to.x,
    y: inverse ** 3 * from.y + 3 * inverse ** 2 * progress * first.y + 3 * inverse * progress ** 2 * second.y + progress ** 3 * to.y
  };
}

function cubicTangent(from: Point, first: Point, second: Point, to: Point, progress: number) {
  const inverse = 1 - progress;
  return {
    x: 3 * inverse ** 2 * (first.x - from.x) + 6 * inverse * progress * (second.x - first.x) + 3 * progress ** 2 * (to.x - second.x),
    y: 3 * inverse ** 2 * (first.y - from.y) + 6 * inverse * progress * (second.y - first.y) + 3 * progress ** 2 * (to.y - second.y)
  };
}

function setNodeFeedback(node: MazeNode) {
  if (isDeadEnd(node)) {
    feedbackText.value = "Это тупик. Гномик может вернуться назад.";
    void playTts("gaze-maze.deadend", 80);
    return;
  }

  const choices = neighborIds(node.id).map((id) => nodeById(id).label.toLowerCase());
  feedbackText.value = `Гномик на месте: ${node.label.toLowerCase()}. Можно идти: ${choices.join(" или ")}.`;
}

function beginMove(node: MazeNode, now: number) {
  moveFromId = currentNodeId.value;
  moveToId = node.id;
  moveStartedAt = now;
  pendingMoveNode = node;
  feedbackText.value = node.id === currentLevel.value.exitId
    ? "Гномик бежит к большой конфете."
    : isDeadEnd(node)
      ? "Гномик заглядывает в тупик."
      : "Гномик перебегает к соседней конфете.";
}

function completeMove() {
  if (!moveToId || !pendingMoveNode) return;

  const arrivedNode = pendingMoveNode;
  currentNodeId.value = arrivedNode.id;
  moveFromId = undefined;
  moveToId = undefined;
  pendingMoveNode = undefined;

  if (arrivedNode.id === currentLevel.value.exitId) {
    if (currentLevelIndex.value >= levels.length - 1) {
      feedbackText.value = "Гномик нашёл большую конфету. Лабиринты пройдены.";
      void playTts("gaze-maze.complete", 80);
      finishSession("game-complete");
      return;
    }
    currentLevelIndex.value += 1;
    currentNodeId.value = currentLevel.value.startId;
    feedbackText.value = `Новый уровень: ${currentLevel.value.title}. Иди по соседним конфетам.`;
    void playTts("gaze-maze.next-level", 80);
    return;
  }

  setNodeFeedback(arrivedNode);
}

function selectNode(node: MazeNode) {
  const now = performance.now();
  if (session.status !== "running" || isSpeaking.value || !adjacentIds.value.has(node.id) || now < cooldownUntil || isMoving(now)) return;
  cooldownUntil = now + 650;
  resetDwell();

  void playGazeMazeStepMelody(session.settings.sound);
  recordSuccess({ selectedNodeId: node.id, levelId: currentLevel.value.id, isExit: node.id === currentLevel.value.exitId });
  beginMove(node, now);
}

function nodeAt(point: Point) {
  return resolveAdjacentMazeTarget(currentLevel.value, currentNodeId.value, point, (node) => ({
    center: nodePoint(node),
    hitRadius: nodeHitRadius(node)
  }));
}

function resetDwell() {
  hoverNodeId = undefined;
  enteredAt = 0;
  dwellProgress = 0;
}

function updateDwell(now: number) {
  if (session.status !== "running" || isSpeaking.value || !pointer.value.valid || now < cooldownUntil || isMoving(now)) {
    resetDwell();
    return;
  }

  const node = nodeAt(pointer.value);
  if (!node) {
    resetDwell();
    return;
  }

  if (hoverNodeId !== node.id) {
    hoverNodeId = node.id;
    enteredAt = now;
    dwellProgress = 0;
    return;
  }

  dwellProgress = Math.min(1, (now - enteredAt) / session.settings.dwellMs);
  if (dwellProgress >= 1) selectNode(node);
}

function onCanvasClick(event: MouseEvent) {
  const node = nodeAt({ x: event.clientX, y: event.clientY });
  if (node) selectNode(node);
}

function restart() {
  promptAudio.cancelPending();
  isSpeaking.value = false;
  currentLevelIndex.value = 0;
  currentNodeId.value = levels[0].startId;
  feedbackText.value = "Помоги гномику пройти к конфете. Можно идти туда и обратно.";
  moveFromId = undefined;
  moveToId = undefined;
  pendingMoveNode = undefined;
  resetDwell();
  startSession();
  void playTts("gaze-maze.prompt", 450);
}

function drawBackground(context: CanvasRenderingContext2D) {
  const gradient = context.createLinearGradient(0, 0, window.innerWidth, window.innerHeight);
  gradient.addColorStop(0, "#fff4c8");
  gradient.addColorStop(0.48, "#eef9f4");
  gradient.addColorStop(1, "#f7edff");
  context.fillStyle = gradient;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  context.save();
  context.globalAlpha = 0.32;
  for (let i = 0; i < 9; i += 1) {
    const x = (i * 217) % window.innerWidth;
    const y = 90 + (i * 83) % Math.max(160, window.innerHeight - 180);
    context.fillStyle = i % 2 ? "#ffffff" : "#ffd5e7";
    context.beginPath();
    context.ellipse(x, y, 70, 22, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function updateStage() {
  const marginX = Math.max(28, Math.min(82, window.innerWidth * 0.065));
  const top = window.innerHeight < 680 ? 104 : Math.max(118, window.innerHeight * 0.16);
  const bottom = window.innerHeight < 680 ? 42 : Math.max(54, window.innerHeight * 0.07);
  stage = {
    x: marginX,
    y: top,
    width: window.innerWidth - marginX * 2,
    height: Math.max(300, window.innerHeight - top - bottom)
  };
}

function drawSceneChrome(context: CanvasRenderingContext2D) {
  context.save();
  context.fillStyle = "rgb(255 255 255 / 68%)";
  roundRect(context, Math.max(16, window.innerWidth * 0.03), window.innerHeight - 66, window.innerWidth - Math.max(32, window.innerWidth * 0.06), 42, 21);
  context.fill();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#32463f";
  context.font = `700 ${window.innerWidth < 900 ? 15 : 18}px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  context.fillText(`${currentLevel.value.title}. ${feedbackText.value}`, window.innerWidth / 2, window.innerHeight - 45, window.innerWidth - 72);
  context.restore();
}

function drawCandyPath(context: CanvasRenderingContext2D) {
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const [fromId, toId] of currentLevel.value.edges) {
    const from = nodePoint(nodeById(fromId));
    const to = nodePoint(nodeById(toId));
    const active = fromId === currentNodeId.value || toId === currentNodeId.value;
    const deadEndPath = isDeadEnd(nodeById(fromId)) || isDeadEnd(nodeById(toId));
    context.strokeStyle = active ? "rgb(255 187 104 / 88%)" : deadEndPath ? "rgb(212 185 223 / 68%)" : "rgb(192 211 225 / 70%)";
    context.lineWidth = active ? 22 : deadEndPath ? 15 : 18;
    context.beginPath();
    context.moveTo(from.x, from.y);
    const controls = pathControls(from, to);
    context.bezierCurveTo(controls.first.x, controls.first.y, controls.second.x, controls.second.y, to.x, to.y);
    context.stroke();
    context.strokeStyle = "rgb(255 255 255 / 78%)";
    context.lineWidth = active ? 10 : 8;
    context.stroke();
  }
}

function drawCandyNode(context: CanvasRenderingContext2D, node: MazeNode, now: number) {
  const center = nodePoint(node);
  const radius = nodeRadius();
  const isCurrent = node.id === currentNodeId.value;
  const isAdjacent = adjacentIds.value.has(node.id);
  const isHover = hoverNodeId === node.id;
  const deadEnd = isDeadEnd(node);
  const pulse = Math.sin(now * 0.004) * 0.04;
  const drawRadius = radius * nodeScale(node) * (isCurrent ? 1.12 : isAdjacent ? 1.02 + pulse : 0.92);

  context.save();
  context.translate(center.x, center.y);
  context.rotate(node.kind === "exit" ? 0 : Math.sin(now * 0.0015 + node.x) * 0.05);
  context.shadowColor = isAdjacent ? "rgb(255 162 74 / 45%)" : "rgb(62 83 104 / 16%)";
  context.shadowBlur = isAdjacent ? 22 : 10;
  context.fillStyle = isCurrent ? "#fff0b6" : deadEnd ? "#f7e9ff" : isAdjacent ? "#fff8df" : "#f7fbff";
  context.strokeStyle = isCurrent ? "#243631" : deadEnd && isAdjacent ? "#c278d3" : isAdjacent ? "#f3a95b" : "#b8cbd1";
  context.lineWidth = isCurrent ? 5 : isAdjacent ? 4 : 3;
  context.beginPath();
  context.arc(0, 0, drawRadius, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = deadEnd ? "#b46fd0" : isAdjacent ? "#ef6f8f" : "#7aa59c";
  context.beginPath();
  context.arc(-drawRadius * 0.32, -drawRadius * 0.18, drawRadius * 0.16, 0, Math.PI * 2);
  context.arc(drawRadius * 0.25, drawRadius * 0.18, drawRadius * 0.13, 0, Math.PI * 2);
  context.fill();

  if (node.kind === "exit") {
    context.fillStyle = "#243631";
    context.font = `800 ${Math.round(drawRadius * 0.58)}px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("🍬", 0, -drawRadius * 0.03);
  } else if (node.kind === "start") {
    context.fillStyle = "#7b6ec8";
    context.font = `800 ${Math.round(drawRadius * 0.42)}px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("дом", 0, drawRadius * 0.02);
  } else if (deadEnd) {
    context.strokeStyle = "rgb(130 86 155 / 72%)";
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(-drawRadius * 0.3, -drawRadius * 0.28);
    context.lineTo(drawRadius * 0.3, drawRadius * 0.28);
    context.moveTo(drawRadius * 0.3, -drawRadius * 0.28);
    context.lineTo(-drawRadius * 0.3, drawRadius * 0.28);
    context.stroke();
  }

  if (isHover && dwellProgress > 0) {
    context.strokeStyle = "#ff8a3d";
    context.lineWidth = 6;
    context.beginPath();
    context.arc(0, 0, drawRadius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dwellProgress);
    context.stroke();
  }
  context.restore();
}

function drawGnome(context: CanvasRenderingContext2D, now: number) {
  const fromNode = moveFromId ? nodeById(moveFromId) : currentNode.value;
  const toNode = moveToId ? nodeById(moveToId) : fromNode;
  const from = nodePoint(fromNode);
  const to = nodePoint(toNode);
  const rawProgress = moveToId ? Math.min(1, Math.max(0, (now - moveStartedAt) / moveDurationMs)) : 1;
  const progress = easeMove(rawProgress);
  const controls = pathControls(from, to);
  const center = moveToId ? cubicPoint(from, controls.first, controls.second, to, progress) : from;
  const tangent = moveToId ? cubicTangent(from, controls.first, controls.second, to, progress) : { x: 1, y: 0 };
  const radius = nodeRadius();
  const runBounce = moveToId ? Math.abs(Math.sin(progress * Math.PI * 4)) * 8 : Math.sin(now * 0.004) * 4;
  const facing = tangent.x >= 0 ? 1 : -1;
  context.save();
  context.translate(center.x, center.y - radius * 0.95 - runBounce);
  context.scale(facing, 1);
  context.fillStyle = "#db4b56";
  context.beginPath();
  context.moveTo(0, -radius * 0.58);
  context.lineTo(-radius * 0.42, radius * 0.05);
  context.lineTo(radius * 0.42, radius * 0.05);
  context.closePath();
  context.fill();
  context.fillStyle = "#ffd5b8";
  context.beginPath();
  context.arc(0, radius * 0.1, radius * 0.34, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#4d3528";
  context.beginPath();
  context.arc(-radius * 0.11, radius * 0.05, radius * 0.035, 0, Math.PI * 2);
  context.arc(radius * 0.11, radius * 0.05, radius * 0.035, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.ellipse(0, radius * 0.24, radius * 0.22, radius * 0.1, 0, 0, Math.PI * 2);
  context.fill();

  if (moveToId) {
    context.strokeStyle = "#314d45";
    context.lineWidth = 3;
    context.lineCap = "round";
    const legSwing = Math.sin(progress * Math.PI * 6) * radius * 0.12;
    context.beginPath();
    context.moveTo(-radius * 0.13, radius * 0.42);
    context.lineTo(-radius * 0.24 - legSwing, radius * 0.58);
    context.moveTo(radius * 0.13, radius * 0.42);
    context.lineTo(radius * 0.24 + legSwing, radius * 0.58);
    context.stroke();
  }
  context.restore();
}

function draw(now: number) {
  if (!ctx) return;
  drawBackground(ctx);
  updateStage();
  drawSceneChrome(ctx);
  drawCandyPath(ctx);
  for (const node of currentLevel.value.nodes) drawCandyNode(ctx, node, now);
  drawGnome(ctx, now);
}

function tick(now: number) {
  const delta = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  if (moveToId && now - moveStartedAt >= moveDurationMs) completeMove();
  if (delta >= 0) updateDwell(now);
  draw(now);
  frame = requestAnimationFrame(tick);
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  promptAudio.warm();
  warmGazeMazeAudio(session.settings.sound);
  window.addEventListener("resize", resizeCanvas);
  frame = requestAnimationFrame(tick);
  void playTts("gaze-maze.prompt", 450);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
  promptAudio.cancelPending();
  disposeGazeMazeAudio();
});
</script>

<template>
  <div class="gaze-maze-shell">
    <canvas ref="canvasRef" class="gaze-maze-canvas" @click="onCanvasClick" />
    <GameHud title="Конфетный лабиринт" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <GameResultDialog :model-value="resultVisible" title="Конфетный лабиринт" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.gaze-maze-shell {
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.gaze-maze-canvas {
  cursor: pointer;
  display: block;
  inset: 0;
  position: absolute;
  z-index: 0;
}

:deep(.game-hud) {
  z-index: 40;
}
</style>

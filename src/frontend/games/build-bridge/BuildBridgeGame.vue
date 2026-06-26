<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";
import { resolveMenuRoute } from "../../core/menuMode";
import { bridgePieceById, bridgePieceTargetId, bridgeSlotTargetId, buildBridgeMaxSteps, buildBridgePieces, buildBridgeSlots, canPlaceBridgePieceAtSlot, nextBridgePieceOfKind, placedPieceIds, type BridgePiece, type BridgePieceKind, type BridgePlacement, type BridgeSlot } from "./model";

type Point = { x: number; y: number };
type Rect = Point & { width: number; height: number };
type Layout = {
  panel: Rect;
  header: Rect;
  bridge: Rect;
  cards: Rect;
  columns: number;
  rows: number;
};
type KindTarget = Rect & { pieceKind: BridgePieceKind; label: string };
type SlotTarget = Rect & { slot: BridgeSlot };
type Target = (KindTarget & { kind: "piece-kind" }) | (SlotTarget & { kind: "slot" });
type BridgeGeometry = {
  inner: Rect;
  river: Rect;
  leftBank: Rect;
  rightBank: Rect;
  bankTopY: number;
  riverBottom: number;
  deckY: number;
  deckHeight: number;
  deckStartX: number;
  deckEndX: number;
  deckWidth: number;
  segmentWidth: number;
  supportXs: number[];
};
type FallingPiece = {
  id: string;
  piece: BridgePiece;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  age: number;
  bounces: number;
};

const bridgeFeedback = createStandardGameFeedback();
const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("build-bridge", {
  maxSteps: buildBridgeMaxSteps,
  finishOnMaxSteps: false,
  finishOnMistakes: false,
  finishOnTimeout: false
});

const placements = ref<BridgePlacement[]>([]);
const selectedPieceId = ref<string>();
const fallingPieces = reactive<FallingPiece[]>([]);
const message = ref("Сначала выбери: опора или доска. Потом покажи место на мосту.");
const isSpeaking = ref(false);
const promptAudio = useGamePromptAudio({ gameId: "build-bridge", soundEnabled: toRef(session.settings, "sound") });
const selectedPiece = computed(() => selectedPieceId.value ? bridgePieceById(selectedPieceId.value) : undefined);

let targets: Target[] = [];
let activeTargetId = "";
let activeStartedAt = 0;
let activeProgress = 0;
let cooldownUntil = 0;
let fallingSequence = 0;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundedRect(ctx: CanvasRenderingContext2D, rect: Rect, radius: number) {
  const r = Math.min(radius, rect.width / 2, rect.height / 2);
  ctx.beginPath();
  ctx.moveTo(rect.x + r, rect.y);
  ctx.lineTo(rect.x + rect.width - r, rect.y);
  ctx.quadraticCurveTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + r);
  ctx.lineTo(rect.x + rect.width, rect.y + rect.height - r);
  ctx.quadraticCurveTo(rect.x + rect.width, rect.y + rect.height, rect.x + rect.width - r, rect.y + rect.height);
  ctx.lineTo(rect.x + r, rect.y + rect.height);
  ctx.quadraticCurveTo(rect.x, rect.y + rect.height, rect.x, rect.y + rect.height - r);
  ctx.lineTo(rect.x, rect.y + r);
  ctx.quadraticCurveTo(rect.x, rect.y, rect.x + r, rect.y);
}

function fillRoundedRect(ctx: CanvasRenderingContext2D, rect: Rect, radius: number, color: string | CanvasGradient) {
  roundedRect(ctx, rect, radius);
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeRoundedRect(ctx: CanvasRenderingContext2D, rect: Rect, radius: number, color: string, lineWidth = 2) {
  roundedRect(ctx, rect, radius);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, options: { size: number; weight?: number; color?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline }) {
  ctx.fillStyle = options.color ?? "#1d2a32";
  ctx.font = `${options.weight ?? 700} ${options.size}px Roboto, Arial, sans-serif`;
  ctx.textAlign = options.align ?? "center";
  ctx.textBaseline = options.baseline ?? "middle";
  ctx.fillText(text, x, y);
}

function computeLayout(): Layout {
  const w = width.value;
  const h = height.value;
  const marginX = clamp(w * 0.02, 16, 44);
  const top = clamp(h * 0.1, 68, 112);
  const bottom = clamp(h * 0.025, 12, 28);
  const panel: Rect = { x: marginX, y: top, width: w - marginX * 2, height: h - top - bottom };
  const gap = clamp(h * 0.014, 8, 18);
  const headerHeight = h < 680 ? 44 : clamp(h * 0.12, 72, 104);
  const bridgeHeight = clamp(panel.height * (h < 680 ? 0.3 : 0.36), 156, 320);
  const header: Rect = { x: panel.x + 20, y: panel.y + 14, width: panel.width - 40, height: headerHeight };
  const bridge: Rect = { x: panel.x + 24, y: header.y + header.height + gap, width: panel.width - 48, height: bridgeHeight };
  const cardsY = bridge.y + bridge.height + gap;
  const cards: Rect = { x: panel.x + 24, y: cardsY, width: panel.width - 48, height: Math.max(180, panel.y + panel.height - cardsY - 18) };
  return { panel, header, bridge, cards, columns: 4, rows: 2 };
}

function placedSet() {
  return new Set(placedPieceIds(placements.value));
}

function targetPayload(targetId: string, now: number, progress: number, reason?: "left" | "invalid-gaze" | "disabled") {
  return {
    targetId,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: activeStartedAt ? now - activeStartedAt : 0,
    progress,
    pointer: { ...pointer.value },
    reason
  };
}

function resetDwell(now: number, reason?: "left" | "invalid-gaze" | "disabled") {
  if (activeTargetId && reason) recordEvent("target-cancel", targetPayload(activeTargetId, now, activeProgress, reason));
  activeTargetId = "";
  activeStartedAt = 0;
  activeProgress = 0;
}

async function playAudio(assetIds: string[], delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(assetIds, delayMs, 170);
  isSpeaking.value = false;
}

function restart() {
  promptAudio.cancelPending();
  placements.value = [];
  selectedPieceId.value = undefined;
  fallingPieces.splice(0);
  message.value = "Сначала выбери: опора или доска. Потом покажи место на мосту.";
  isSpeaking.value = false;
  activeTargetId = "";
  activeStartedAt = 0;
  activeProgress = 0;
  cooldownUntil = 0;
  startSession();
  void playAudio(["build-bridge.prompt"], 450);
}

function hitTestTarget(point: Point) {
  return targets.find((target) => (
    point.x >= target.x
    && point.x <= target.x + target.width
    && point.y >= target.y
    && point.y <= target.y + target.height
  ));
}

function spawnFallingPiece(piece: BridgePiece, source: Rect) {
  const centerX = source.x + source.width * 0.5;
  fallingSequence += 1;
  fallingPieces.push({
    id: `falling-${piece.id}-${fallingSequence}`,
    piece,
    x: centerX,
    y: source.y + source.height * 0.48,
    width: piece.kind === "support" ? Math.min(72, source.width * 0.34) : Math.min(118, source.width * 0.5),
    height: piece.kind === "support" ? Math.min(104, source.height * 0.56) : Math.min(38, source.height * 0.2),
    vx: (centerX < width.value * 0.5 ? -1 : 1) * clamp(width.value * 0.12, 80, 180),
    vy: -clamp(height.value * 0.22, 110, 210),
    angle: (Math.random() - 0.5) * 0.4,
    angularVelocity: (Math.random() > 0.5 ? 1 : -1) * (2.1 + Math.random() * 2.6),
    age: 0,
    bounces: 0
  });
  if (fallingPieces.length > 10) fallingPieces.shift();
}

function selectPieceKind(target: KindTarget) {
  const piece = nextBridgePieceOfKind(target.pieceKind, placedPieceIds(placements.value));
  if (!piece) {
    message.value = target.pieceKind === "support" ? "Все опоры уже стоят." : "Все доски уже уложены.";
    return;
  }
  const targetId = bridgePieceTargetId(piece);
  selectedPieceId.value = piece.id;
  recordEvent("hint", { targetId, action: "piece-kind-selected", pieceKind: target.pieceKind, pieceId: piece.id });
  message.value = "Теперь выбери место на мосту.";
  void playAudio(["build-bridge.place"], 80);
}

function placeSelectedPiece(target: SlotTarget) {
  const piece = selectedPiece.value;
  if (!piece) return;

  const targetId = bridgeSlotTargetId(target.slot);
  const stable = canPlaceBridgePieceAtSlot(piece.id, target.slot.id, placements.value);
  if (stable) {
    placements.value = [...placements.value, { pieceId: piece.id, slotId: target.slot.id }];
    selectedPieceId.value = undefined;
    recordSuccess({ targetId, answerId: piece.id, slotId: target.slot.id, action: "placed-piece" });
    message.value = placements.value.length >= buildBridgeMaxSteps ? "Мост готов. Все детали нашли опору." : "Деталь держится. Выбери следующую деталь.";
    void bridgeFeedback.playSuccess(session.settings.sound);
    if (placements.value.length >= buildBridgeMaxSteps && session.status === "running") {
      void playAudio(["build-bridge.correct", "build-bridge.complete"], 80).then(() => finishSession("game-complete"));
    } else {
      void playAudio(["build-bridge.correct"], 80);
    }
    return;
  }

  spawnFallingPiece(piece, target);
  selectedPieceId.value = undefined;
  message.value = "Деталь упала. Выбери деталь снова.";
  void bridgeFeedback.playMistake(session.settings.sound);
  recordMistake({ targetId, expectedTargetId: bridgePieceTargetId(piece), answerId: piece.id, slotId: target.slot.id, action: "piece-fell", isCorrect: false });
  recordEvent("hint", { targetId, action: "piece-fell", pieceId: piece.id, slotId: target.slot.id, supportedBy: target.slot.supportedBy });
  void playAudio(["build-bridge.mistake"], 80);
}

function updateDwell(now: number) {
  if (session.status !== "running" || isSpeaking.value || now < cooldownUntil) {
    resetDwell(now, activeTargetId ? "disabled" : undefined);
    return;
  }
  if (!pointer.value.valid) {
    resetDwell(now, activeTargetId ? "invalid-gaze" : undefined);
    return;
  }

  const target = hitTestTarget(pointer.value);
  if (!target) {
    resetDwell(now, activeTargetId ? "left" : undefined);
    return;
  }

  const targetId = target.kind === "piece-kind" ? `build-bridge:kind:${target.pieceKind}` : bridgeSlotTargetId(target.slot);
  if (activeTargetId !== targetId) {
    resetDwell(now);
    activeTargetId = targetId;
    activeStartedAt = now;
    activeProgress = 0;
    recordEvent("target-enter", targetPayload(targetId, now, 0));
  }

  activeProgress = Math.min(1, (now - activeStartedAt) / session.settings.dwellMs);
  if (activeProgress >= 1) {
    recordEvent("target-click", targetPayload(targetId, now, 1));
    if (target.kind === "piece-kind") selectPieceKind(target);
    else placeSelectedPiece(target);
    resetDwell(now);
    cooldownUntil = now + 650;
  }
}

function updatePhysics(delta: number) {
  const floor = height.value - clamp(height.value * 0.055, 24, 52);
  const gravity = clamp(height.value * 1.9, 980, 1900);
  for (let index = fallingPieces.length - 1; index >= 0; index -= 1) {
    const body = fallingPieces[index];
    body.age += delta;
    body.vy += gravity * delta;
    body.x += body.vx * delta;
    body.y += body.vy * delta;
    body.angle += body.angularVelocity * delta;

    const halfHeight = body.height * 0.5;
    if (body.y + halfHeight > floor) {
      body.y = floor - halfHeight;
      body.vy = -Math.abs(body.vy) * 0.34;
      body.vx *= 0.72;
      body.angularVelocity *= 0.58;
      body.bounces += 1;
      if (Math.abs(body.vy) < 55) body.vy = 0;
    }

    if (body.x < -160 || body.x > width.value + 160 || body.age > 5.2) fallingPieces.splice(index, 1);
  }
}

function update(delta: number, now: number) {
  if (session.status === "running") updateDwell(now);
  if (session.status !== "paused") updatePhysics(delta);
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, width.value, height.value);
  sky.addColorStop(0, "#dff7fb");
  sky.addColorStop(0.55, "#fff8df");
  sky.addColorStop(1, "#eef7f6");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);
}

function drawHeader(ctx: CanvasRenderingContext2D, layout: Layout) {
  const centerX = layout.header.x + layout.header.width * 0.5;
  if (height.value >= 680) drawText(ctx, "ПОСЛЕДОВАТЕЛЬНОСТЬ ДЕТАЛЕЙ", centerX, layout.header.y + 18, { size: 13, weight: 700, color: "#8e76c7" });
  drawText(ctx, "Построй мост", centerX, layout.header.y + (height.value < 680 ? 22 : 56), { size: clamp(width.value * 0.034, 28, 54), weight: 800, color: "#40524f" });
  if (height.value >= 680) drawText(ctx, message.value, centerX, layout.header.y + layout.header.height - 16, { size: clamp(width.value * 0.012, 15, 22), weight: 500, color: "#768481" });
}

function bridgeInnerRect(rect: Rect): Rect {
  return { x: rect.x + 18, y: rect.y + 18, width: rect.width - 36, height: rect.height - 36 };
}

function bridgeGeometry(rect: Rect): BridgeGeometry {
  const inner = bridgeInnerRect(rect);
  const river: Rect = { x: inner.x, y: inner.y, width: inner.width, height: inner.height };
  const bankHeight = clamp(inner.height * 0.28, 42, 78);
  const bankTopY = river.y + river.height - bankHeight;
  const deckHeight = clamp(inner.height * 0.11, 24, 38);
  const deckY = bankTopY - clamp(inner.height * 0.32, 54, 90);
  const deckStartX = river.x + river.width * 0.28;
  const deckEndX = river.x + river.width * 0.72;
  const deckWidth = deckEndX - deckStartX;
  const segmentWidth = deckWidth / 5;

  return {
    inner,
    river,
    leftBank: { x: river.x, y: bankTopY, width: river.width * 0.2, height: bankHeight + 12 },
    rightBank: { x: river.x + river.width * 0.8, y: bankTopY, width: river.width * 0.2, height: bankHeight + 12 },
    bankTopY,
    riverBottom: river.y + river.height - 14,
    deckY,
    deckHeight,
    deckStartX,
    deckEndX,
    deckWidth,
    segmentWidth,
    supportXs: [deckStartX + segmentWidth, deckStartX + segmentWidth * 2, deckStartX + segmentWidth * 3, deckStartX + segmentWidth * 4]
  };
}

function drawWater(ctx: CanvasRenderingContext2D, rect: Rect) {
  fillRoundedRect(ctx, rect, 24, "#d9f1fb");
  const geometry = bridgeGeometry(rect);
  const { river } = geometry;
  const water = ctx.createLinearGradient(river.x, river.y, river.x + river.width, river.y + river.height);
  water.addColorStop(0, "#78d5f6");
  water.addColorStop(1, "#45b8df");
  fillRoundedRect(ctx, river, 22, water);
  ctx.save();
  roundedRect(ctx, river, 22);
  ctx.clip();
  ctx.strokeStyle = "rgb(255 255 255 / 34%)";
  ctx.lineWidth = 8;
  for (let x = river.x - river.height; x < river.x + river.width; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, river.y + river.height);
    ctx.lineTo(x + river.height * 0.44, river.y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgb(37 108 128 / 16%)";
  ctx.fillRect(river.x, geometry.riverBottom - 12, river.width, 26);
  ctx.fillStyle = "#b8d98f";
  ctx.fillRect(geometry.leftBank.x, geometry.leftBank.y, geometry.leftBank.width, geometry.leftBank.height);
  ctx.fillRect(geometry.rightBank.x, geometry.rightBank.y, geometry.rightBank.width, geometry.rightBank.height);
  ctx.fillStyle = "#99c16d";
  ctx.fillRect(geometry.leftBank.x, geometry.leftBank.y, geometry.leftBank.width, 6);
  ctx.fillRect(geometry.rightBank.x, geometry.rightBank.y, geometry.rightBank.width, 6);
  ctx.restore();
}

function supportOrder(pieceId: string) {
  if (pieceId === "support-left") return 1;
  if (pieceId === "support-center") return 2;
  if (pieceId === "support-right") return 3;
  return 4;
}

function slotRect(bridge: Rect, slot: BridgeSlot): Rect {
  const geometry = bridgeGeometry(bridge);
  if (slot.kind === "support") {
    const x = geometry.supportXs[supportOrder(slot.acceptsPieceId) - 1];
    const supportWidth = clamp(geometry.segmentWidth * 0.34, 42, 72);
    const topY = geometry.deckY + geometry.deckHeight - 3;
    return { x: x - supportWidth * 0.5, y: topY, width: supportWidth, height: geometry.riverBottom - topY };
  }

  const planks = buildBridgeSlots.filter((item) => item.kind === "plank");
  const index = planks.findIndex((item) => item.id === slot.id);
  const overlap = clamp(geometry.segmentWidth * 0.02, 2, 5);
  return {
    x: geometry.deckStartX + geometry.segmentWidth * index - (index > 0 ? overlap * 0.5 : 0),
    y: geometry.deckY,
    width: geometry.segmentWidth + (index > 0 ? overlap * 0.5 : 0) + (index < planks.length - 1 ? overlap * 0.5 : 0),
    height: geometry.deckHeight
  };
}

function slotTargetRect(bridge: Rect, slot: BridgeSlot): Rect {
  const rect = slotRect(bridge, slot);
  if (slot.kind === "support") {
    return {
      x: rect.x - rect.width * 0.18,
      y: rect.y - rect.height * 0.08,
      width: rect.width * 1.36,
      height: rect.height * 1.16
    };
  }
  const extraX = Math.max(16, rect.width * 0.18);
  const extraTop = Math.max(44, rect.height * 1.5);
  const extraBottom = Math.max(48, rect.height * 1.6);
  return {
    x: rect.x - extraX,
    y: rect.y - extraTop,
    width: rect.width + extraX * 2,
    height: rect.height + extraTop + extraBottom
  };
}

function drawSupport(ctx: CanvasRenderingContext2D, x: number, baseY: number, scale: number, color = "#607d8b") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(x - scale * 0.42, baseY - scale * 1.4, scale * 0.84, scale * 0.16);
  for (const offset of [-0.24, 0, 0.24]) fillRoundedRect(ctx, { x: x + offset * scale - scale * 0.055, y: baseY - scale * 1.24, width: scale * 0.11, height: scale * 1.08 }, scale * 0.05, color);
  ctx.fillRect(x - scale * 0.34, baseY - scale * 0.1, scale * 0.68, scale * 0.12);
  ctx.restore();
}

function drawBridgeSupport(ctx: CanvasRenderingContext2D, rect: Rect, color = "#607d8b") {
  const centerX = rect.x + rect.width * 0.5;
  const topY = rect.y + 4;
  const bedY = rect.y + rect.height;
  const capWidth = rect.width * 1.35;
  const pillarWidth = Math.max(8, rect.width * 0.13);
  ctx.save();
  fillRoundedRect(ctx, { x: centerX - capWidth * 0.5, y: topY - 8, width: capWidth, height: 12 }, 6, "rgb(67 86 92 / 82%)");
  ctx.fillStyle = color;
  for (const offset of [-0.24, 0, 0.24]) {
    fillRoundedRect(ctx, { x: centerX + offset * rect.width - pillarWidth * 0.5, y: topY + 5, width: pillarWidth, height: Math.max(22, bedY - topY - 31) }, 5, color);
  }
  fillRoundedRect(ctx, { x: centerX - capWidth * 0.44, y: bedY - 30, width: capWidth * 0.88, height: 12 }, 6, "rgb(67 86 92 / 78%)");
  fillRoundedRect(ctx, { x: centerX - capWidth * 0.62, y: bedY - 14, width: capWidth * 1.24, height: 18 }, 9, "rgb(82 94 86 / 58%)");
  ctx.restore();
}

function drawDeckSegment(ctx: CanvasRenderingContext2D, rect: Rect, color: string) {
  fillRoundedRect(ctx, rect, Math.min(8, rect.height * 0.24), color);
  ctx.fillStyle = "rgb(255 255 255 / 10%)";
  ctx.fillRect(rect.x + 5, rect.y + 4, Math.max(0, rect.width - 10), Math.max(2, rect.height * 0.16));
  ctx.strokeStyle = "rgb(74 47 37 / 34%)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawBridgeRamps(ctx: CanvasRenderingContext2D, rect: Rect) {
  const geometry = bridgeGeometry(rect);
  const rampColor = "#8a6454";
  const edgeColor = "rgb(74 47 37 / 45%)";
  const leftGroundX = geometry.leftBank.x + geometry.leftBank.width - 4;
  const rightGroundX = geometry.rightBank.x + 4;
  const leftDeckX = geometry.deckStartX + clamp(geometry.segmentWidth * 0.16, 10, 22);
  const rightDeckX = geometry.deckEndX - clamp(geometry.segmentWidth * 0.16, 10, 22);
  const deckBottom = geometry.deckY + geometry.deckHeight;

  ctx.save();
  ctx.fillStyle = rampColor;
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(leftGroundX, geometry.bankTopY - 2);
  ctx.lineTo(leftDeckX, geometry.deckY + 2);
  ctx.lineTo(leftDeckX, deckBottom - 2);
  ctx.lineTo(leftGroundX, geometry.bankTopY + geometry.deckHeight - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(rightDeckX, geometry.deckY + 2);
  ctx.lineTo(rightGroundX, geometry.bankTopY - 2);
  ctx.lineTo(rightGroundX, geometry.bankTopY + geometry.deckHeight - 2);
  ctx.lineTo(rightDeckX, deckBottom - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPlank(ctx: CanvasRenderingContext2D, rect: Rect, color: string) {
  fillRoundedRect(ctx, rect, Math.min(12, rect.height * 0.28), color);
  ctx.strokeStyle = "rgb(86 56 44 / 28%)";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawPlacedBridge(ctx: CanvasRenderingContext2D, rect: Rect) {
  const sortedPlacements = [...placements.value].sort((a, b) => {
    const pieceA = bridgePieceById(a.pieceId);
    const pieceB = bridgePieceById(b.pieceId);
    if (pieceA?.kind === pieceB?.kind) return 0;
    return pieceA?.kind === "support" ? -1 : 1;
  });

  for (const placement of sortedPlacements) {
    const piece = bridgePieceById(placement.pieceId);
    const slot = buildBridgeSlots.find((item) => item.id === placement.slotId);
    if (!piece || !slot) continue;
    const rectForSlot = slotRect(rect, slot);
    if (piece.kind === "support") drawBridgeSupport(ctx, rectForSlot, piece.color);
    else drawDeckSegment(ctx, rectForSlot, piece.color);
  }
}

function drawBridgeFootings(ctx: CanvasRenderingContext2D, rect: Rect) {
  const geometry = bridgeGeometry(rect);
  for (const slot of buildBridgeSlots.filter((item) => item.kind === "support")) {
    const ghost = slotRect(rect, slot);
    const centerX = ghost.x + ghost.width * 0.5;
    fillRoundedRect(ctx, { x: centerX - ghost.width * 0.62, y: geometry.riverBottom - 18, width: ghost.width * 1.24, height: 20 }, 10, "rgb(70 86 80 / 34%)");
  }
}

function drawBridgeSlots(ctx: CanvasRenderingContext2D, rect: Rect) {
  if (!selectedPiece.value) return;
  for (const slot of buildBridgeSlots) {
    const compatibleKind = selectedPiece.value.kind === slot.kind;
    if (!compatibleKind) continue;
    if (placements.value.some((placement) => placement.slotId === slot.id)) continue;
    const slotArea = slotTargetRect(rect, slot);
    const stable = canPlaceBridgePieceAtSlot(selectedPiece.value.id, slot.id, placements.value);
    ctx.save();
    ctx.globalAlpha = stable ? 0.88 : 0.42;
    fillRoundedRect(ctx, slotArea, slotArea.height * 0.18, stable ? "rgb(27 143 118 / 18%)" : "rgb(141 78 56 / 18%)");
    strokeRoundedRect(ctx, slotArea, slotArea.height * 0.18, stable ? "#1b8f76" : "#8d6e63", stable ? 4 : 2);
    if (!stable) {
      ctx.setLineDash([8, 8]);
      strokeRoundedRect(ctx, slotArea, slotArea.height * 0.18, "#8d6e63", 2);
    }
    ctx.restore();
    targets.push({ kind: "slot", ...slotArea, slot });
  }
}

function drawFinishedMessage(ctx: CanvasRenderingContext2D, rect: Rect) {
  if (session.status !== "finished") return;
  const bannerWidth = clamp(rect.width * 0.36, 260, 460);
  const bannerHeight = clamp(rect.height * 0.22, 54, 74);
  const banner: Rect = { x: rect.x + rect.width * 0.5 - bannerWidth * 0.5, y: rect.y + 18, width: bannerWidth, height: bannerHeight };
  fillRoundedRect(ctx, banner, 24, "rgb(238 248 236 / 92%)");
  strokeRoundedRect(ctx, banner, 24, "rgb(65 118 94 / 25%)", 2);
  drawText(ctx, "Мост готов", banner.x + banner.width * 0.5, banner.y + banner.height * 0.42, { size: clamp(rect.width * 0.018, 20, 30), weight: 800, color: "#3f5f51" });
  drawText(ctx, "Все доски нашли опору", banner.x + banner.width * 0.5, banner.y + banner.height * 0.74, { size: clamp(rect.width * 0.011, 13, 17), weight: 600, color: "#5b756d" });
}

function drawBridgeScene(ctx: CanvasRenderingContext2D, rect: Rect) {
  drawWater(ctx, rect);
  drawBridgeFootings(ctx, rect);
  drawBridgeRamps(ctx, rect);
  drawPlacedBridge(ctx, rect);
  drawBridgeSlots(ctx, rect);
  const bridgeHint = session.status === "finished" ? "Мост собран" : selectedPiece.value ? `Поставь: ${selectedPiece.value.label}` : "Сначала выбери деталь";
  drawText(ctx, bridgeHint, rect.x + rect.width * 0.5, rect.y + rect.height - 24, { size: clamp(rect.width * 0.018, 13, 20), weight: 600, color: "#5d7775" });
  drawFinishedMessage(ctx, rect);
}

function drawPieceIcon(ctx: CanvasRenderingContext2D, piece: BridgePiece, center: Point, scale: number) {
  if (piece.kind === "support") {
    drawSupport(ctx, center.x, center.y + scale * 0.62, scale, piece.color);
    return;
  }
  drawPlank(ctx, { x: center.x - scale * 0.58, y: center.y - scale * 0.12, width: scale * 1.16, height: scale * 0.24 }, piece.color);
}

function drawKindChoiceCard(ctx: CanvasRenderingContext2D, rect: Rect, kind: BridgePieceKind) {
  const nextPiece = nextBridgePieceOfKind(kind, placedPieceIds(placements.value));
  const isSelected = selectedPiece.value?.kind === kind;
  const label = kind === "support" ? "Опора" : "Доска";
  const radius = clamp(rect.height * 0.12, 16, 28);
  fillRoundedRect(ctx, rect, radius, isSelected ? "#dff3f0" : "#fffaf1");
  strokeRoundedRect(ctx, rect, radius, isSelected ? "#1b8f76" : "rgb(86 99 98 / 16%)", isSelected ? 4 : 1.5);
  if (!nextPiece) {
    ctx.save();
    ctx.globalAlpha = 0.32;
    fillRoundedRect(ctx, rect, radius, "#e3ece9");
    ctx.restore();
  }

  const iconScale = clamp(Math.min(rect.width, rect.height) * 0.3, 32, 72);
  drawPieceIcon(ctx, nextPiece ?? buildBridgePieces.find((piece) => piece.kind === kind)!, { x: rect.x + rect.width * 0.5, y: rect.y + rect.height * 0.35 }, iconScale);
  drawText(ctx, label, rect.x + rect.width * 0.5, rect.y + rect.height * 0.68, { size: clamp(rect.height * 0.15, 20, 34), weight: 800 });
  drawText(ctx, nextPiece ? `следующая: ${nextPiece.label}` : "готово", rect.x + rect.width * 0.5, rect.y + rect.height * 0.84, { size: clamp(rect.height * 0.075, 12, 17), weight: 500, color: "#52605d" });

  if (nextPiece && !selectedPiece.value) targets.push({ kind: "piece-kind", ...rect, pieceKind: kind, label });
}

function drawTargets(ctx: CanvasRenderingContext2D, layout: Layout) {
  const gap = clamp(Math.min(width.value, height.value) * 0.018, 8, 18);
  const cellWidth = (layout.cards.width - gap) / 2;
  drawKindChoiceCard(ctx, { x: layout.cards.x, y: layout.cards.y, width: cellWidth, height: layout.cards.height }, "support");
  drawKindChoiceCard(ctx, { x: layout.cards.x + cellWidth + gap, y: layout.cards.y, width: cellWidth, height: layout.cards.height }, "plank");
}

function drawFallingPieces(ctx: CanvasRenderingContext2D) {
  for (const body of fallingPieces) {
    ctx.save();
    ctx.translate(body.x, body.y);
    ctx.rotate(body.angle);
    ctx.globalAlpha = clamp(1 - Math.max(0, body.age - 4.1), 0, 1);
    if (body.piece.kind === "support") drawSupport(ctx, 0, body.height * 0.5, body.width * 0.72, body.piece.color);
    else drawPlank(ctx, { x: -body.width * 0.5, y: -body.height * 0.5, width: body.width, height: body.height }, body.piece.color);
    ctx.restore();
  }
}

function drawDwellProgress(ctx: CanvasRenderingContext2D) {
  if (!activeTargetId || !activeProgress) return;
  const target = targets.find((item) => (item.kind === "piece-kind" ? `build-bridge:kind:${item.pieceKind}` : bridgeSlotTargetId(item.slot)) === activeTargetId);
  if (!target) return;
  const radius = Math.min(target.width, target.height) * 0.22;
  const x = target.x + target.width * 0.5;
  const y = target.y + target.height * 0.5;
  ctx.save();
  ctx.lineWidth = 9;
  ctx.strokeStyle = "rgb(255 188 89 / 28%)";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#ffb74d";
  ctx.beginPath();
  ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * activeProgress);
  ctx.stroke();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D) {
  const layout = computeLayout();
  targets = [];
  drawBackground(ctx);
  fillRoundedRect(ctx, layout.panel, 28, "#fffaf1");
  ctx.shadowColor = "rgb(42 54 56 / 22%)";
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  strokeRoundedRect(ctx, layout.panel, 28, "rgb(0 0 0 / 6%)", 1);
  ctx.shadowColor = "transparent";
  drawHeader(ctx, layout);
  drawBridgeScene(ctx, layout.bridge);
  drawTargets(ctx, layout);
  drawFallingPieces(ctx);
  drawDwellProgress(ctx);
}

useGameLoop({ context, update, draw });

onMounted(() => {
  promptAudio.warm();
  bridgeFeedback.warm(session.settings.sound);
  void playAudio(["build-bridge.prompt"], 450);
});

onUnmounted(() => {
  promptAudio.cancelPending();
  bridgeFeedback.dispose();
});
</script>

<template>
  <div class="build-bridge-shell">
    <canvas ref="canvasRef" class="bridge-canvas" aria-label="Строим мост" />
    <GameHud title="Строим мост" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <GameResultDialog :model-value="session.status === 'finished'" title="Строим мост" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.build-bridge-shell {
  background: #e8f6f4;
  block-size: 100dvh;
  inline-size: 100vw;
  overflow: hidden;
}

.bridge-canvas {
  display: block;
  inset: 0;
  position: fixed;
}
</style>

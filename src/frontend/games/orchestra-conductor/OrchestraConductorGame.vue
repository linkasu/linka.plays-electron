<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeOrchestraConductorAudio, playOrchestraConductorBeat, playOrchestraConductorComplete, warmOrchestraConductorAudio } from "./audio";
import {
  beatProgress,
  clamp,
  createOrchestraArcPoints,
  distance,
  nextReachedBeat,
  orchestraConductorMaxBeats,
  pointAtArcProgress,
  projectPointToArc,
  type ArcProjection,
  type Point
} from "./model";

type OrchestraSection = {
  label: string;
  shortLabel: string;
  hue: number;
  tone: string;
};

type BeatResponse = Point & {
  id: string;
  beat: number;
  label: string;
  hue: number;
  age: number;
  life: number;
};

const sections: OrchestraSection[] = [
  { label: "Контрабасы", shortLabel: "бас", hue: 207, tone: "глубже" },
  { label: "Виолончели", shortLabel: "челло", hue: 184, tone: "теплее" },
  { label: "Альты", shortLabel: "альты", hue: 158, tone: "мягче" },
  { label: "Скрипки", shortLabel: "скрипки", hue: 132, tone: "светлее" },
  { label: "Флейты", shortLabel: "флейты", hue: 42, tone: "воздушнее" },
  { label: "Арфа", shortLabel: "арфа", hue: 26, tone: "искристее" },
  { label: "Колокольчики", shortLabel: "звон", hue: 286, tone: "тише" },
  { label: "Хор", shortLabel: "хор", hue: 326, tone: "полнее" }
];

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordHint, recordSuccess, startSession } = useGameSessionFor("orchestra-conductor", {
  maxSteps: orchestraConductorMaxBeats,
  overrides: { preset: "gentle", dwellMs: 600, targetScale: 1.55, motionSpeed: 0.5, distractors: "none", hints: "high", sound: false },
  finishOnMistakes: false
});

const progress = ref(0);
const visualProgress = ref(0);
const batonRatio = ref(0);
const audioEnabled = ref(false);
const feedbackMessage = ref("Веди палочку взглядом по широкой дуге. Оркестр вступает мягко на больших beat-зонах.");
const conductor = reactive({ pulse: 0, confidence: 0, guide: 0, glow: 0 });
const sectionEnergy = reactive(sections.map(() => 0));
const responses = reactive<BeatResponse[]>([]);
const resultVisible = computed(() => session.status === "finished");
const progressPercent = computed(() => Math.round(visualProgress.value * 100));
const nextSection = computed(() => sections[session.step]);
const guidanceText = computed(() => {
  if (session.status === "paused") return "Пауза. Оркестр ждёт спокойно.";
  if (session.status === "finished") return "Дуга завершена. Оркестр сыграл короткий спокойный ответ.";
  if (!pointer.value.valid) return "Можно вести палочку взглядом или мышью. Широкая дуга ждёт движения.";
  if (conductor.guide > 0.45) return "Верни палочку к светлой дуге. Прогресс не сбрасывается.";
  return nextSection.value ? `Следующий мягкий вступ: ${nextSection.value.label}.` : "Оркестр звучит визуально и спокойно.";
});

let trackingArc = false;
let lastHintAt = 0;

function arcPoints() {
  return createOrchestraArcPoints(width.value, height.value);
}

function arcTolerance() {
  const viewportLimit = Math.min(width.value, height.value) * 0.13;
  return Math.min(118, Math.max(78, Math.min(viewportLimit, 66 * session.settings.targetScale)));
}

function beatRadius() {
  return arcTolerance() * 0.72;
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

function targetPayload(targetId: string, arcProgress: number, projection?: ArcProjection, reason?: "left" | "invalid-gaze") {
  return {
    targetId,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: session.settings.dwellMs,
    progress: arcProgress,
    arcProgress,
    pointer: copyPointer(),
    distanceToArc: projection?.distance,
    reason
  };
}

function responseId(beat: number) {
  return `orchestra-conductor-response-${beat}-${Date.now()}`;
}

function addBeatResponse(beat: number) {
  const section = sections[beat - 1];
  const point = pointAtArcProgress(arcPoints(), beatProgress(beat, session.maxSteps));
  responses.push({
    id: responseId(beat),
    beat,
    label: section.shortLabel,
    hue: section.hue,
    x: point.x,
    y: point.y,
    age: 0,
    life: beat === session.maxSteps ? 2.4 : 1.7
  });
  if (responses.length > 18) responses.splice(0, responses.length - 18);
  sectionEnergy[beat - 1] = 1;
  conductor.glow = 1;
}

function triggerBeat(beat: number, projection?: ArcProjection) {
  const section = sections[beat - 1];
  const targetId = `orchestra-conductor-beat-${beat}`;
  recordEvent("target-click", targetPayload(targetId, progress.value, projection));
  recordSuccess({ targetId, beat, section: section.label, arcProgress: progress.value });
  addBeatResponse(beat);
  feedbackMessage.value = beat >= session.maxSteps
    ? "Оркестр завершил дугу коротким спокойным аккордом."
    : `${section.label} вступают ${section.tone}. Веди палочку дальше по дуге.`;

  if (beat >= session.maxSteps) void playOrchestraConductorComplete(audioEnabled.value);
  else void playOrchestraConductorBeat(audioEnabled.value, beat);
}

function updateTracking(nearArc: boolean, projection?: ArcProjection) {
  if (nearArc && !trackingArc) {
    trackingArc = true;
    recordEvent("target-enter", targetPayload("orchestra-conductor-arc", progress.value, projection));
    return;
  }

  if (!nearArc && trackingArc) {
    trackingArc = false;
    recordEvent("target-cancel", targetPayload("orchestra-conductor-arc", progress.value, projection, pointer.value.valid ? "left" : "invalid-gaze"));
  }
}

function updateBeatProgress(projection?: ArcProjection) {
  while (session.step < session.maxSteps) {
    const beat = nextReachedBeat(progress.value, session.step + 1, session.maxSteps);
    if (!beat) break;
    triggerBeat(beat, projection);
  }
}

function updateResponses(delta: number) {
  for (let index = responses.length - 1; index >= 0; index -= 1) {
    const response = responses[index];
    response.age += delta;
    if (response.age >= response.life) responses.splice(index, 1);
  }

  for (let index = 0; index < sectionEnergy.length; index += 1) {
    sectionEnergy[index] = Math.max(0, sectionEnergy[index] - delta * 0.52);
  }
  conductor.glow = Math.max(0, conductor.glow - delta * 0.62);
}

function updateConductor(delta: number, now: number) {
  const points = arcPoints();
  const projection = pointer.value.valid ? projectPointToArc(pointer.value, points) : undefined;
  const tolerance = arcTolerance();
  const onArc = Boolean(projection && projection.distance <= tolerance);
  const nearArc = Boolean(projection && projection.distance <= tolerance * 1.55);
  const targetRatio = nearArc && projection ? projection.ratio : progress.value;

  updateTracking(nearArc, projection);

  conductor.confidence += ((onArc ? 1 : nearArc ? 0.45 : 0) - conductor.confidence) * Math.min(1, delta * 4.2);
  conductor.guide += ((nearArc ? 0 : 1) - conductor.guide) * Math.min(1, delta * 2.1);
  batonRatio.value += (targetRatio - batonRatio.value) * Math.min(1, delta * (nearArc ? 7.2 : 2.6));

  if (projection && nearArc && projection.ratio > progress.value + 0.002) {
    const speed = (onArc ? 0.5 : 0.18) * session.settings.motionSpeed;
    progress.value = Math.min(projection.ratio, progress.value + speed * delta);
  }

  if (!nearArc && now - lastHintAt > 3600) {
    lastHintAt = now;
    recordHint({ kind: "orchestra-conductor-arc-guide", arcProgress: progress.value, pointer: copyPointer(), distanceToArc: projection?.distance });
  }

  updateBeatProgress(projection);
}

function update(rawDelta: number, now: number) {
  const delta = session.status === "paused" ? 0 : rawDelta;
  conductor.pulse += delta;
  visualProgress.value += (progress.value - visualProgress.value) * Math.min(1, delta * 4.8);
  updateResponses(delta);

  if (session.status === "running") updateConductor(delta, now);
}

function strokeArc(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  ctx.stroke();
}

function strokePartialArc(ctx: CanvasRenderingContext2D, points: Point[], ratio: number) {
  const target = arcLengthForDraw(points) * clamp(ratio, 0, 1);
  let walked = 0;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = distance(start, end);
    if (walked + segmentLength <= target) {
      ctx.lineTo(end.x, end.y);
      walked += segmentLength;
      continue;
    }

    const local = segmentLength <= 0 ? 0 : (target - walked) / segmentLength;
    ctx.lineTo(start.x + (end.x - start.x) * local, start.y + (end.y - start.y) * local);
    break;
  }
  ctx.stroke();
}

function arcLengthForDraw(points: Point[]) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) length += distance(points[index - 1], points[index]);
  return Math.max(1, length);
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height.value);
  gradient.addColorStop(0, "#eef7ff");
  gradient.addColorStop(0.5, "#f7f2ff");
  gradient.addColorStop(1, "#fff8ed");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.save();
  ctx.strokeStyle = "rgb(99 116 152 / 10%)";
  ctx.lineWidth = 2;
  const staffTop = Math.max(140, height.value * 0.24);
  for (let line = 0; line < 5; line += 1) {
    const y = staffTop + line * 18;
    ctx.beginPath();
    ctx.moveTo(width.value * 0.08, y);
    ctx.bezierCurveTo(width.value * 0.32, y - 22, width.value * 0.68, y + 22, width.value * 0.92, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOrchestra(ctx: CanvasRenderingContext2D) {
  const baseY = height.value - Math.max(54, height.value * 0.08);
  const left = width.value * 0.13;
  const right = width.value * 0.87;
  const seatRadius = Math.min(52, Math.max(34, width.value / 28));

  ctx.save();
  ctx.fillStyle = "rgb(255 255 255 / 54%)";
  ctx.strokeStyle = "rgb(116 95 148 / 12%)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(width.value * 0.5, baseY + 16, Math.max(220, width.value * 0.42), Math.max(58, height.value * 0.09), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    const t = sections.length <= 1 ? 0 : index / (sections.length - 1);
    const x = left + (right - left) * t;
    const y = baseY - Math.sin(t * Math.PI) * Math.max(42, height.value * 0.07);
    const complete = session.step > index;
    const energy = Math.max(sectionEnergy[index], complete ? 0.32 : 0);
    const radius = seatRadius * (1 + energy * 0.14);

    ctx.fillStyle = `hsl(${section.hue} 78% ${complete ? 82 : 90}% / ${complete ? 0.86 : 0.58})`;
    ctx.strokeStyle = `hsl(${section.hue} 70% 48% / ${complete ? 0.56 : 0.22})`;
    ctx.lineWidth = Math.max(2, radius * 0.06);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (energy > 0.02) {
      ctx.strokeStyle = `hsl(${section.hue} 86% 58% / ${0.28 * energy})`;
      ctx.lineWidth = Math.max(3, radius * 0.08);
      ctx.beginPath();
      ctx.arc(x, y, radius * (1.28 + energy * 0.34), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = complete ? "rgb(55 70 95 / 82%)" : "rgb(86 99 124 / 58%)";
    ctx.font = `800 ${Math.max(12, radius * 0.32)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(section.shortLabel, x, y + 1);
  }
  ctx.restore();
}

function drawArc(ctx: CanvasRenderingContext2D, points: Point[]) {
  const widthPx = arcTolerance() * 1.16;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgb(112 126 168 / 12%)";
  ctx.lineWidth = widthPx + 34;
  strokeArc(ctx, points);

  ctx.strokeStyle = "rgb(255 255 255 / 72%)";
  ctx.lineWidth = widthPx;
  strokeArc(ctx, points);

  ctx.strokeStyle = "rgb(128 142 190 / 22%)";
  ctx.lineWidth = Math.max(3, widthPx * 0.055);
  ctx.setLineDash([Math.max(14, widthPx * 0.16), Math.max(20, widthPx * 0.22)]);
  strokeArc(ctx, points);
  ctx.setLineDash([]);

  ctx.strokeStyle = "rgb(130 176 211 / 58%)";
  ctx.lineWidth = widthPx * 0.36;
  strokePartialArc(ctx, points, visualProgress.value);
  ctx.restore();
}

function drawBeatZones(ctx: CanvasRenderingContext2D, points: Point[]) {
  const radiusBase = beatRadius();
  ctx.save();
  for (let beat = 1; beat <= session.maxSteps; beat += 1) {
    const section = sections[beat - 1];
    const point = pointAtArcProgress(points, beatProgress(beat, session.maxSteps));
    const done = session.step >= beat;
    const next = session.step + 1 === beat && session.status === "running";
    const pulse = next ? 1 + Math.sin(conductor.pulse * 3.2) * 0.06 : 1;
    const radius = radiusBase * (done ? 0.86 : 0.74) * pulse;

    ctx.fillStyle = done ? `hsl(${section.hue} 86% 86% / 0.9)` : "rgb(255 255 255 / 64%)";
    ctx.strokeStyle = done ? `hsl(${section.hue} 72% 52% / 0.7)` : next ? "rgb(92 124 176 / 54%)" : "rgb(104 118 152 / 22%)";
    ctx.lineWidth = Math.max(3, radius * 0.08);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = done ? "rgb(48 70 96 / 86%)" : "rgb(77 88 116 / 64%)";
    ctx.font = `900 ${Math.max(16, radius * 0.38)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(done ? "✓" : String(beat), point.x, point.y - radius * 0.1);
    ctx.font = `800 ${Math.max(10, radius * 0.2)}px system-ui, sans-serif`;
    ctx.fillText(section.shortLabel, point.x, point.y + radius * 0.32);
  }
  ctx.restore();
}

function drawResponses(ctx: CanvasRenderingContext2D) {
  ctx.save();
  for (const response of responses) {
    const ratio = response.age / response.life;
    const alpha = Math.max(0, 1 - ratio);
    const radius = beatRadius() * (0.8 + ratio * 1.6);

    ctx.strokeStyle = `hsl(${response.hue} 86% 58% / ${0.34 * alpha})`;
    ctx.lineWidth = Math.max(3, beatRadius() * 0.06);
    ctx.beginPath();
    ctx.arc(response.x, response.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `hsl(${response.hue} 80% 52% / ${0.52 * alpha})`;
    ctx.font = `800 ${Math.max(14, beatRadius() * 0.26)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(response.label, response.x, response.y - radius * 0.48);
  }
  ctx.restore();
}

function drawBaton(ctx: CanvasRenderingContext2D, points: Point[]) {
  const point = pointAtArcProgress(points, batonRatio.value);
  const previous = pointAtArcProgress(points, clamp(batonRatio.value - 0.012, 0, 1));
  const next = pointAtArcProgress(points, clamp(batonRatio.value + 0.012, 0, 1));
  const angle = Math.atan2(next.y - previous.y, next.x - previous.x) - Math.PI * 0.12;
  const length = Math.min(146, Math.max(92, Math.min(width.value, height.value) * 0.15));
  const glowRadius = arcTolerance() * (0.72 + conductor.confidence * 0.48 + conductor.glow * 0.16);

  ctx.save();
  const glow = ctx.createRadialGradient(point.x, point.y, 4, point.x, point.y, glowRadius);
  glow.addColorStop(0, `rgb(255 255 255 / ${0.76 + conductor.confidence * 0.18})`);
  glow.addColorStop(0.55, "rgb(150 189 224 / 36%)");
  glow.addColorStop(1, "rgb(150 189 224 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(point.x, point.y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  if (conductor.guide > 0.05) {
    ctx.globalAlpha = conductor.guide * 0.56;
    ctx.strokeStyle = "rgb(94 105 148 / 42%)";
    ctx.lineWidth = Math.max(3, arcTolerance() * 0.05);
    ctx.beginPath();
    ctx.arc(point.x, point.y, arcTolerance() * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.translate(point.x, point.y);
  ctx.rotate(angle);
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgb(71 84 116 / 72%)";
  ctx.lineWidth = Math.max(5, length * 0.055);
  ctx.beginPath();
  ctx.moveTo(-length * 0.28, 0);
  ctx.lineTo(length * 0.72, 0);
  ctx.stroke();

  ctx.strokeStyle = "rgb(255 255 255 / 86%)";
  ctx.lineWidth = Math.max(2, length * 0.018);
  ctx.beginPath();
  ctx.moveTo(-length * 0.22, -length * 0.035);
  ctx.lineTo(length * 0.66, -length * 0.035);
  ctx.stroke();

  ctx.fillStyle = "#8a6fba";
  ctx.beginPath();
  ctx.arc(-length * 0.36, 0, length * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D) {
  const points = arcPoints();
  drawBackground(ctx);
  drawOrchestra(ctx);
  drawArc(ctx, points);
  drawBeatZones(ctx, points);
  drawResponses(ctx);
  drawBaton(ctx, points);
}

function resetConductor() {
  progress.value = 0;
  visualProgress.value = 0;
  batonRatio.value = 0;
  conductor.confidence = 0;
  conductor.guide = 0;
  conductor.glow = 0;
  sectionEnergy.splice(0, sectionEnergy.length, ...sections.map(() => 0));
  responses.splice(0);
  trackingArc = false;
  lastHintAt = 0;
  feedbackMessage.value = "Веди палочку взглядом по широкой дуге. Оркестр вступает мягко на больших beat-зонах.";
}

function restart() {
  resetConductor();
  startSession();
}

function toggleAudio() {
  audioEnabled.value = !audioEnabled.value;
  if (audioEnabled.value) {
    warmOrchestraConductorAudio(true);
    feedbackMessage.value = "Тихие короткие ноты включены. Если звук недоступен, игра продолжится визуально.";
  } else {
    feedbackMessage.value = "Звук выключен. Оркестр продолжает отвечать визуально.";
  }
}

useGameLoop({ context, update, draw });

onUnmounted(() => {
  disposeOrchestraConductorAudio();
});
</script>

<template>
  <div class="orchestra-conductor-shell">
    <canvas ref="canvasRef" class="orchestra-conductor-canvas" aria-label="Оркестр-дирижёр: веди палочку по широкой дуге и проходи beat-зоны" />

    <GameHud
      title="Оркестр-дирижёр"
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

    <v-card class="conductor-guidance pa-4" color="surface" rounded="xl" variant="flat">
      <div class="d-flex align-center justify-space-between ga-3 mb-3">
        <div>
          <div class="text-overline text-primary mb-1">Плавная дуга и ритм</div>
          <div class="text-body-1 font-weight-medium">{{ guidanceText }}</div>
        </div>
        <v-btn
          :prepend-icon="audioEnabled ? 'mdi-volume-low' : 'mdi-volume-off'"
          color="primary"
          rounded="xl"
          size="small"
          variant="tonal"
          @click="toggleAudio"
        >
          {{ audioEnabled ? "Тихий звук" : "Без звука" }}
        </v-btn>
      </div>
      <v-progress-linear :model-value="progressPercent" color="primary" height="8" rounded />
      <div class="text-caption text-medium-emphasis mt-2">Beat: {{ session.step }} / {{ session.maxSteps }}</div>
      <v-alert class="mt-3" color="primary" icon="mdi-music-clef-treble" rounded="xl" variant="tonal">
        {{ feedbackMessage }}
      </v-alert>
    </v-card>

    <GameResultDialog
      :model-value="resultVisible"
      title="Оркестр-дирижёр"
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
.orchestra-conductor-shell {
  background: #f7f2ff;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.orchestra-conductor-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.conductor-guidance {
  box-shadow: 0 18px 48px rgb(92 78 138 / 14%);
  inline-size: min(500px, calc(100vw - 32px));
  inset-block-start: clamp(104px, 14vh, 148px);
  inset-inline-end: max(16px, env(safe-area-inset-right));
  opacity: 0.94;
  position: absolute;
  z-index: 4;
}

@media (max-width: 720px) {
  .conductor-guidance {
    inset-block-start: auto;
    inset-block-end: max(16px, env(safe-area-inset-bottom));
    inset-inline: 16px;
    inline-size: auto;
  }
}
</style>

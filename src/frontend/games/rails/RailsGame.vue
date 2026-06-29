<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";

type Point = {
  x: number;
  y: number;
};

type RailSample = Point & {
  ratio: number;
  angle: number;
};

type Projection = Point & {
  distance: number;
  ratio: number;
};

type TrainChoice = {
  id: string;
  title: string;
  label: string;
  body: string;
  accent: string;
  icon: string;
};

const trainChoices: TrainChoice[] = [
  { id: "blue", title: "Синий", label: "спокойный синий", body: "#6177d8", accent: "#dbe4ff", icon: "mdi-train" },
  { id: "green", title: "Зелёный", label: "мягкий зелёный", body: "#43a878", accent: "#dcf7e9", icon: "mdi-train-car" },
  { id: "orange", title: "Тёплый", label: "тёплый поезд", body: "#df8b3f", accent: "#fff0d8", icon: "mdi-train" }
];

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordHint, recordSuccess, startSession } = useGameSessionFor("rails", {
  maxSteps: 8,
  overrides: { preset: "gentle", dwellMs: 700, targetScale: 1.35, motionSpeed: 0.52, distractors: "none", hints: "high" },
  finishOnMistakes: false
});

const selectedTrain = ref<TrainChoice>();
const train = reactive({ ratio: 0, visualRatio: 0, dwellMs: 0, confidence: 0, hint: 0, phase: 0 });
const resultVisible = computed(() => session.status === "finished");
const progressPercent = computed(() => Math.round(train.visualRatio * 100));
const activeStation = computed(() => Math.min(session.maxSteps, session.step + 1));
const stationDwellPercent = computed(() => Math.round(Math.min(1, train.dwellMs / session.settings.dwellMs) * 100));
const guidanceText = computed(() => {
  if (!selectedTrain.value) return "Выбери поезд взглядом, затем веди его по плавным рельсам.";
  if (session.status === "paused") return "Пауза. Поезд спокойно ждёт на рельсах.";
  if (!pointer.value.valid) return "Можно вести поезд взглядом или мышью. Рельсы спокойно ждут.";
  if (train.dwellMs > 0) return `Станция ${activeStation.value}: удержи взгляд ещё немного, ${stationDwellPercent.value}%.`;
  if (train.hint > 0.35) return "Верни взгляд к светлым рельсам или ближайшей станции. Поезд спокойно остаётся на пути.";
  return `Веди ${selectedTrain.value.label} к станции ${activeStation.value}.`;
});

let tracking = false;
let stationEnteredAt = 0;
let lastHintAt = 0;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function railWidth() {
  const viewportLimit = Math.min(width.value, height.value) * 0.15;
  return Math.min(132, Math.max(86, Math.min(viewportLimit, 82 * session.settings.targetScale)));
}

function trainSize() {
  const viewportLimit = Math.min(width.value, height.value) * 0.13;
  return Math.min(118, Math.max(74, Math.min(viewportLimit, 76 * session.settings.targetScale)));
}

function controlPoints(): Point[] {
  const left = Math.max(78, width.value * 0.12);
  const right = width.value - left;
  const top = Math.max(150, height.value * 0.2);
  const bottom = height.value - Math.max(88, height.value * 0.12);
  const travel = Math.max(320, bottom - top);

  if (width.value < 720) {
    const center = width.value * 0.5;
    const mobileLeft = Math.max(72, width.value * 0.22);
    const mobileRight = width.value - mobileLeft;
    return [
      { x: center, y: top },
      { x: mobileRight, y: top + travel * 0.14 },
      { x: mobileRight, y: top + travel * 0.38 },
      { x: mobileLeft, y: top + travel * 0.52 },
      { x: mobileLeft, y: top + travel * 0.78 },
      { x: center, y: bottom }
    ];
  }

  return [
    { x: left, y: top + travel * 0.04 },
    { x: width.value * 0.45, y: top + travel * 0.03 },
    { x: right, y: top + travel * 0.24 },
    { x: width.value * 0.68, y: top + travel * 0.52 },
    { x: left, y: top + travel * 0.56 },
    { x: width.value * 0.32, y: top + travel * 0.86 },
    { x: right, y: bottom }
  ];
}

function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
  };
}

function railSamples(): RailSample[] {
  const points = controlPoints();
  const raw: Point[] = [];
  const steps = 34;

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    for (let step = 0; step <= steps; step += 1) {
      if (index > 0 && step === 0) continue;
      raw.push(catmullRom(p0, p1, p2, p3, step / steps));
    }
  }

  const lengths = [0];
  for (let index = 1; index < raw.length; index += 1) lengths[index] = lengths[index - 1] + distance(raw[index - 1], raw[index]);
  const total = Math.max(1, lengths[lengths.length - 1]);

  return raw.map((point, index) => {
    const previous = raw[Math.max(0, index - 1)];
    const next = raw[Math.min(raw.length - 1, index + 1)];
    return {
      ...point,
      ratio: lengths[index] / total,
      angle: Math.atan2(next.y - previous.y, next.x - previous.x)
    };
  });
}

function pointAtRatio(samples: RailSample[], ratio: number): RailSample {
  const target = clamp(ratio, 0, 1);
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const next = samples[index];
    if (target <= next.ratio) {
      const span = Math.max(0.0001, next.ratio - previous.ratio);
      const local = (target - previous.ratio) / span;
      return {
        x: previous.x + (next.x - previous.x) * local,
        y: previous.y + (next.y - previous.y) * local,
        ratio: target,
        angle: previous.angle + (next.angle - previous.angle) * local
      };
    }
  }
  return samples[samples.length - 1];
}

function projectToRail(point: Point, samples: RailSample[]): Projection {
  let best: Projection = { ...samples[0], distance: Number.POSITIVE_INFINITY };

  for (let index = 1; index < samples.length; index += 1) {
    const start = samples[index - 1];
    const end = samples[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared <= 0 ? 0 : clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
    const candidate = { x: start.x + dx * t, y: start.y + dy * t };
    const candidateDistance = distance(point, candidate);
    if (candidateDistance < best.distance) {
      best = {
        ...candidate,
        distance: candidateDistance,
        ratio: start.ratio + (end.ratio - start.ratio) * t
      };
    }
  }

  return best;
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

function stationTargetId(station: number) {
  return `rails:station:${station}`;
}

function stationPayload(station: number, progress: number, now: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: stationTargetId(station),
    station,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: stationEnteredAt ? now - stationEnteredAt : 0,
    progress,
    railProgress: train.ratio,
    pointer: copyPointer(),
    reason
  };
}

function resetStationDwell(now: number, reason?: "left" | "invalid-gaze") {
  if (stationEnteredAt && reason) recordEvent("target-cancel", stationPayload(activeStation.value, train.dwellMs / session.settings.dwellMs, now, reason));
  stationEnteredAt = 0;
  train.dwellMs = 0;
}

function chooseTrain(choice: TrainChoice) {
  if (session.status !== "running") return;
  selectedTrain.value = choice;
  recordEvent("target-click", { targetId: `rails:train:${choice.id}`, trainId: choice.id, dwellMs: session.settings.dwellMs, pointer: copyPointer() });
}

function resetRail() {
  selectedTrain.value = undefined;
  train.ratio = 0;
  train.visualRatio = 0;
  train.dwellMs = 0;
  train.confidence = 0;
  train.hint = 0;
  train.phase = 0;
  tracking = false;
  stationEnteredAt = 0;
  lastHintAt = 0;
}

function restart() {
  resetRail();
  startSession();
}

function updateTracking(nearRail: boolean, projection: Projection | undefined) {
  if (nearRail && !tracking) {
    tracking = true;
    recordEvent("target-enter", { targetId: "rails:rail", railProgress: train.ratio, pointer: copyPointer(), distanceToRail: projection?.distance });
    return;
  }

  if (!nearRail && tracking) {
    tracking = false;
    recordEvent("target-cancel", { targetId: "rails:rail", railProgress: train.ratio, pointer: copyPointer(), distanceToRail: projection?.distance, reason: pointer.value.valid ? "left" : "invalid-gaze" });
  }
}

function updateStation(delta: number, now: number, samples: RailSample[]) {
  if (session.step >= session.maxSteps) return;

  const station = activeStation.value;
  const stationRatio = station / session.maxSteps;
  const stationPoint = pointAtRatio(samples, stationRatio);
  const atStation = train.ratio >= stationRatio - 0.003;
  const focusDistance = pointer.value.valid ? distance(pointer.value, stationPoint) : Number.POSITIVE_INFINITY;
  const stationFocus = atStation && focusDistance <= railWidth() * 0.9;

  if (!stationFocus) {
    if (stationEnteredAt) resetStationDwell(now, pointer.value.valid ? "left" : "invalid-gaze");
    return;
  }

  if (!stationEnteredAt) {
    stationEnteredAt = now;
    train.dwellMs = 0;
    recordEvent("target-enter", stationPayload(station, 0, now));
  }

  train.dwellMs = Math.min(session.settings.dwellMs, train.dwellMs + delta * 1000);
  if (train.dwellMs < session.settings.dwellMs) return;

  recordEvent("target-click", stationPayload(station, 1, now));
  recordSuccess({ targetId: stationTargetId(station), station, railProgress: train.ratio });
  stationEnteredAt = 0;
  train.dwellMs = 0;
}

function update(delta: number, now: number) {
  train.phase += session.settings.reduceMotion ? 0 : delta * 1.25;
  train.visualRatio += (train.ratio - train.visualRatio) * Math.min(1, delta * 5.4);

  if (session.status !== "running" || !selectedTrain.value) return;

  const samples = railSamples();
  const projection = pointer.value.valid ? projectToRail(pointer.value, samples) : undefined;
  const laneWidth = railWidth();
  const nearRail = Boolean(projection && projection.distance <= laneWidth * 0.95);
  const onRail = Boolean(projection && projection.distance <= laneWidth * 0.54);
  const targetRatio = Math.min(1, activeStation.value / session.maxSteps);
  const canMoveForward = Boolean(projection && nearRail && projection.ratio > train.ratio + 0.002);

  updateTracking(nearRail, projection);

  const confidenceTarget = onRail ? 1 : nearRail ? 0.55 : 0;
  const hintTarget = nearRail || !pointer.value.valid ? 0 : 1;
  train.confidence += (confidenceTarget - train.confidence) * Math.min(1, delta * 4.4);
  train.hint += (hintTarget - train.hint) * Math.min(1, delta * 2.8);

  if (canMoveForward && projection) {
    const speed = (onRail ? 0.3 : 0.12) * session.settings.motionSpeed;
    const desiredRatio = Math.min(targetRatio, projection.ratio);
    train.ratio = Math.min(targetRatio, train.ratio + Math.min(Math.max(0, desiredRatio - train.ratio), speed * delta));
  }

  if (!nearRail && pointer.value.valid && now - lastHintAt > 3200) {
    lastHintAt = now;
    recordHint({ targetId: "rails:rail", railProgress: train.ratio, pointer: copyPointer(), distanceToRail: projection?.distance });
  }

  updateStation(delta, now, samples);
}

function drawRailPath(context: CanvasRenderingContext2D, samples: RailSample[]) {
  context.beginPath();
  context.moveTo(samples[0].x, samples[0].y);
  for (const sample of samples.slice(1)) context.lineTo(sample.x, sample.y);
}

function drawOffsetRail(context: CanvasRenderingContext2D, samples: RailSample[], offset: number) {
  context.beginPath();
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const x = sample.x + Math.cos(sample.angle + Math.PI / 2) * offset;
    const y = sample.y + Math.sin(sample.angle + Math.PI / 2) * offset;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const sky = context.createLinearGradient(0, 0, 0, height.value);
  sky.addColorStop(0, "#eef8ff");
  sky.addColorStop(0.62, "#f6fbf3");
  sky.addColorStop(1, "#efe4ce");
  context.fillStyle = sky;
  context.fillRect(0, 0, width.value, height.value);

  context.save();
  context.globalAlpha = 0.42;
  for (let index = 0; index < 5; index += 1) {
    const x = width.value * (0.08 + index * 0.24);
    const y = height.value * (0.22 + (index % 2) * 0.18 + Math.sin(now * 0.00016 + index) * 0.018);
    const glow = context.createRadialGradient(x, y, 0, x, y, Math.max(width.value, height.value) * 0.22);
    glow.addColorStop(0, index % 2 === 0 ? "rgb(255 255 255 / 70%)" : "rgb(215 232 255 / 52%)");
    glow.addColorStop(1, "rgb(255 255 255 / 0%)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width.value, height.value);
  }
  context.restore();
}

function drawRails(context: CanvasRenderingContext2D, samples: RailSample[]) {
  const widthPx = railWidth();
  const gauge = widthPx * 0.28;

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "rgb(103 82 62 / 16%)";
  context.lineWidth = widthPx + 28;
  drawRailPath(context, samples);
  context.stroke();

  context.strokeStyle = "rgb(232 216 184 / 88%)";
  context.lineWidth = widthPx;
  drawRailPath(context, samples);
  context.stroke();

  context.strokeStyle = "rgb(128 91 58 / 50%)";
  context.lineWidth = Math.max(6, widthPx * 0.08);
  for (let index = 6; index < samples.length; index += 9) {
    const sample = samples[index];
    const normal = sample.angle + Math.PI / 2;
    context.beginPath();
    context.moveTo(sample.x - Math.cos(normal) * widthPx * 0.44, sample.y - Math.sin(normal) * widthPx * 0.44);
    context.lineTo(sample.x + Math.cos(normal) * widthPx * 0.44, sample.y + Math.sin(normal) * widthPx * 0.44);
    context.stroke();
  }

  context.strokeStyle = "rgb(104 119 130 / 82%)";
  context.lineWidth = Math.max(5, widthPx * 0.07);
  drawOffsetRail(context, samples, -gauge);
  context.stroke();
  drawOffsetRail(context, samples, gauge);
  context.stroke();

  context.strokeStyle = "rgb(255 255 255 / 68%)";
  context.lineWidth = Math.max(2, widthPx * 0.025);
  drawOffsetRail(context, samples, -gauge - widthPx * 0.035);
  context.stroke();
  drawOffsetRail(context, samples, gauge - widthPx * 0.035);
  context.stroke();

  context.strokeStyle = "rgb(94 139 184 / 64%)";
  context.lineWidth = Math.max(8, widthPx * 0.16);
  drawRailPath(context, samples.slice(0, Math.max(2, Math.round(samples.length * train.visualRatio))));
  context.stroke();
  context.restore();
}

function drawStations(context: CanvasRenderingContext2D, samples: RailSample[]) {
  const baseRadius = railWidth() * 0.22;
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "700 17px system-ui, sans-serif";

  for (let station = 1; station <= session.maxSteps; station += 1) {
    const point = pointAtRatio(samples, station / session.maxSteps);
    const done = station <= session.step;
    const active = station === activeStation.value && session.status === "running";
    const pulse = active ? 1 + Math.sin(train.phase * 4) * 0.05 : 1;
    const radius = baseRadius * (active ? 1.18 : 1) * pulse;

    context.fillStyle = done ? "rgb(234 250 242 / 94%)" : active ? "rgb(255 248 213 / 95%)" : "rgb(255 255 255 / 84%)";
    context.strokeStyle = done ? "rgb(67 168 120 / 88%)" : active ? "rgb(223 139 63 / 88%)" : "rgb(120 137 150 / 42%)";
    context.lineWidth = Math.max(3, railWidth() * 0.035);
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    if (active && train.dwellMs > 0) {
      context.strokeStyle = "rgb(80 125 220 / 86%)";
      context.lineWidth = Math.max(5, railWidth() * 0.055);
      context.beginPath();
      context.arc(point.x, point.y, radius + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, train.dwellMs / session.settings.dwellMs));
      context.stroke();
    }

    context.fillStyle = done ? "rgb(54 129 95)" : "rgb(76 88 104)";
    context.fillText(done ? "✓" : String(station), point.x, point.y);
  }

  context.restore();
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, rectWidth: number, rectHeight: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + rectWidth - radius, y);
  context.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + radius);
  context.lineTo(x + rectWidth, y + rectHeight - radius);
  context.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - radius, y + rectHeight);
  context.lineTo(x + radius, y + rectHeight);
  context.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function drawTrain(context: CanvasRenderingContext2D, samples: RailSample[]) {
  const choice = selectedTrain.value;
  if (!choice) return;

  const point = pointAtRatio(samples, train.visualRatio);
  const size = trainSize();
  const bob = Math.sin(train.phase * 4.2) * size * 0.015;

  context.save();
  context.translate(point.x, point.y + bob);
  context.rotate(point.angle);
  context.shadowColor = choice.body;
  context.shadowBlur = 18 + train.confidence * 12;

  context.fillStyle = choice.body;
  roundedRect(context, -size * 0.52, -size * 0.28, size * 1.04, size * 0.56, size * 0.16);
  context.fill();

  context.shadowBlur = 0;
  context.fillStyle = choice.accent;
  roundedRect(context, -size * 0.34, -size * 0.18, size * 0.42, size * 0.24, size * 0.07);
  context.fill();
  roundedRect(context, size * 0.13, -size * 0.18, size * 0.24, size * 0.24, size * 0.07);
  context.fill();

  context.fillStyle = "rgb(42 55 68 / 82%)";
  context.beginPath();
  context.arc(-size * 0.28, size * 0.28, size * 0.09, 0, Math.PI * 2);
  context.arc(size * 0.3, size * 0.28, size * 0.09, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgb(255 255 255 / 92%)";
  context.beginPath();
  context.arc(size * 0.46, 0, size * 0.09, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawHint(context: CanvasRenderingContext2D, samples: RailSample[]) {
  if (train.hint < 0.05 || !selectedTrain.value) return;
  const point = pointAtRatio(samples, train.visualRatio);
  const radius = railWidth() * (0.62 + Math.sin(train.phase * 2.4) * 0.04);
  context.save();
  context.globalAlpha = train.hint * 0.68;
  context.strokeStyle = "rgb(80 125 220 / 58%)";
  context.lineWidth = Math.max(4, railWidth() * 0.04);
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function draw(context: CanvasRenderingContext2D, _delta: number, now: number) {
  const samples = railSamples();
  const visualNow = session.settings.reduceMotion ? 0 : now;
  drawBackground(context, visualNow);
  drawRails(context, samples);
  drawStations(context, samples);
  drawHint(context, samples);
  drawTrain(context, samples);
}

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="rails-shell">
    <canvas ref="canvasRef" class="rails-canvas" />

    <GameHud title="Рельсы" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-card class="rails-guidance pa-4" color="surface" rounded="xl" variant="flat">
      <div class="text-overline text-primary mb-1">Плавное ведение</div>
      <div class="text-body-1 font-weight-medium">{{ guidanceText }}</div>
      <v-progress-linear class="mt-3" :model-value="progressPercent" color="primary" height="0.5rem" rounded />
      <div class="text-caption text-medium-emphasis mt-2">Прогресс: {{ progressPercent }}% · станция {{ activeStation }} из {{ session.maxSteps }}</div>
    </v-card>

    <v-container v-if="!selectedTrain && session.status !== 'finished'" class="rails-picker d-flex align-center justify-center" fluid>
      <v-card class="rails-picker-card pa-4 pa-md-6" color="surface" rounded="xl" elevation="10">
        <div class="text-overline text-secondary text-center mb-2">Выбор поезда</div>
        <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-2">Рельсы</h1>
        <p class="text-body-1 text-md-h6 text-medium-emphasis text-center mb-5">
          Выбери поезд взглядом. Потом веди его по светлым рельсам через станции. Поезд спокойно остаётся на пути.
        </p>

        <v-row>
          <v-col v-for="choice in trainChoices" :key="choice.id" cols="12" sm="4">
            <GameDwellButton :target-id="`rails:train:${choice.id}`" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" min-height="10.625rem" color="surface" @select="chooseTrain(choice)">
              <template #default="{ active, progress }">
                <v-icon :icon="choice.icon" size="3.375rem" :style="{ color: active ? '#ffffff' : choice.body }" />
                <div class="train-choice-title text-h6 font-weight-bold mt-3">{{ choice.title }}</div>
                <div class="train-choice-caption text-body-2 mt-1">{{ active ? `${Math.round(progress * 100)}%` : choice.label }}</div>
              </template>
            </GameDwellButton>
          </v-col>
        </v-row>
      </v-card>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Рельсы" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.rails-shell {
  background: #eef8ff;
  block-size: 100dvh;
  inline-size: 100dvw;
  overflow: hidden;
  position: relative;
}

.rails-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.rails-guidance {
  box-shadow: 0 1rem 2.75rem rgb(83 113 138 / 14%);
  inline-size: min(27.5rem, calc(100dvw - 2rem));
  inset-block-start: clamp(6.5rem, 14vh, 9.25rem);
  inset-inline-end: max(1rem, env(safe-area-inset-right));
  opacity: 0.94;
  position: absolute;
  z-index: 4;
}

.rails-picker {
  inset: 0;
  position: absolute;
  z-index: 5;
}

.rails-picker-card {
  inline-size: min(57.5rem, calc(100dvw - 2rem));
}

.train-choice-title,
.train-choice-caption {
  color: #17212b !important;
}

.rails-picker-card :deep(.dwell-button--active) .train-choice-title,
.rails-picker-card :deep(.dwell-button--active) .train-choice-caption {
  color: #ffffff !important;
}

@media (max-width: 45rem) {
  .rails-guidance {
    inset-block-start: auto;
    inset-block-end: max(1rem, env(safe-area-inset-bottom));
    inset-inline: 1rem;
    inline-size: auto;
  }
}
</style>

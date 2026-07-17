<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

type DebugSample = {
  x: number;
  y: number;
  valid: boolean;
  source: GazePoint["source"];
  timestamp: number;
  trackerTimestamp?: number;
};

type PointReport = {
  index: number;
  target: { x: number; y: number };
  mean?: { x: number; y: number };
  offset?: { x: number; y: number };
  errorPx?: number;
  validRatio: number;
  samples: number;
  totalSamples: number;
  rawSamples: DebugSample[];
};

type DebugReport = {
  ok: boolean;
  reason: string;
  points: PointReport[];
  meanErrorPx?: number;
  maxErrorPx?: number;
  validRatio: number;
  totalSamples: number;
  durationMs: number;
  viewport: { width: number; height: number; devicePixelRatio: number };
  diagnostics?: TobiiDiagnosticsSnapshot;
};

const router = useRouter();

const viewport = ref({ width: window.innerWidth, height: window.innerHeight });
const tobiiPoint = ref<GazePoint>();
const running = ref(false);
const startedAt = ref(0);
const pointStartedAt = ref(0);
const elapsedMs = ref(0);
const samples = ref<DebugSample[]>([]);
const pointReports = ref<PointReport[]>([]);
const targetIndex = ref(0);
const report = ref<DebugReport>();
const reportDialog = ref(false);
const copyMessage = ref("");
const diagnostics = ref<TobiiDiagnosticsSnapshot>();

const targetFractions = [
  { x: 0.12, y: 0.12 }, { x: 0.5, y: 0.12 }, { x: 0.88, y: 0.12 },
  { x: 0.12, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.88, y: 0.5 },
  { x: 0.12, y: 0.88 }, { x: 0.5, y: 0.88 }, { x: 0.88, y: 0.88 }
];
const pointDurationMs = 1600;
const targetZone = 100;
const tobiiFreshMs = 700;
let frame = 0;
let sampleTimer: number | undefined;
let disposeGaze: Dispose | undefined;
let finishingPoint = false;

const target = computed(() => ({
  x: targetFractions[targetIndex.value].x * viewport.value.width,
  y: targetFractions[targetIndex.value].y * viewport.value.height
}));
const progress = computed(() => Math.min(100, ((targetIndex.value + Math.min(1, elapsedMs.value / pointDurationMs)) / targetFractions.length) * 100));
const validSamples = computed(() => samples.value.filter((sample) => sample.valid));
const hasFreshTobii = computed(() => {
  if (!tobiiPoint.value?.valid) return false;
  return Date.now() - (tobiiPoint.value.timestamp ?? 0) <= tobiiFreshMs;
});
const activePoint = computed<GazePoint>(() => tobiiPoint.value ?? {
  x: target.value.x,
  y: target.value.y,
  valid: false,
  source: "tobii",
  timestamp: Date.now()
});
const liveOffset = computed(() => ({
  x: activePoint.value.x - target.value.x,
  y: activePoint.value.y - target.value.y
}));
const reportText = computed(() => (report.value ? JSON.stringify(report.value, null, 2) : ""));

function updateViewport() {
  viewport.value = { width: window.innerWidth, height: window.innerHeight };
}

function formatNumber(value: number | undefined, digits = 0) {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return value.toFixed(digits);
}

async function refreshDiagnostics() {
  if (!window.linkaTobii?.getDiagnostics) return;
  try {
    diagnostics.value = await window.linkaTobii.getDiagnostics();
  } catch {
    diagnostics.value = undefined;
  }
}

function onTobiiGaze(point: GazePoint) {
  tobiiPoint.value = {
    ...point,
    timestamp: point.timestamp ?? Date.now()
  };
}

function recordSample() {
  const point = tobiiPoint.value;
  samples.value.push({
    x: point?.x ?? target.value.x,
    y: point?.y ?? target.value.y,
    valid: hasFreshTobii.value && point?.valid === true,
    source: "tobii",
    timestamp: Date.now(),
    trackerTimestamp: point?.timestamp
  });
}

function buildPointReport(index: number): PointReport {
  const valid = validSamples.value;
  const validRatio = samples.value.length ? valid.length / samples.value.length : 0;
  const pointReport: PointReport = {
    index,
    samples: valid.length,
    totalSamples: samples.value.length,
    rawSamples: samples.value,
    target: { ...target.value },
    validRatio
  };
  if (!valid.length) return pointReport;

  const sum = valid.reduce((acc, sample) => ({ x: acc.x + sample.x, y: acc.y + sample.y }), { x: 0, y: 0 });
  const mean = { x: sum.x / valid.length, y: sum.y / valid.length };
  const offset = { x: mean.x - target.value.x, y: mean.y - target.value.y };
  return {
    ...pointReport,
    mean,
    offset,
    errorPx: Math.hypot(offset.x, offset.y)
  };
}

function buildReport(): DebugReport {
  const reports = pointReports.value;
  const errors = reports.map((point) => point.errorPx).filter((value): value is number => value !== undefined);
  const totalSamples = reports.reduce((sum, point) => sum + point.totalSamples, 0);
  const validSampleCount = reports.reduce((sum, point) => sum + point.samples, 0);
  const validRatio = totalSamples ? validSampleCount / totalSamples : 0;
  const meanErrorPx = errors.length ? errors.reduce((sum, error) => sum + error, 0) / errors.length : undefined;
  const maxErrorPx = errors.length ? Math.max(...errors) : undefined;
  const ok = reports.length === targetFractions.length
    && reports.every((point) => point.errorPx !== undefined && point.errorPx <= targetZone / 2 && point.validRatio >= 0.6);
  return {
    ok,
    reason: ok
      ? "Все девять точек достигнуты с достаточной точностью."
      : "Одна или несколько зон недоступны или заметно смещены.",
    points: reports,
    meanErrorPx,
    maxErrorPx,
    validRatio,
    totalSamples,
    durationMs: Date.now() - startedAt.value,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1
    },
    diagnostics: diagnostics.value
  };
}

function stopTimers() {
  window.cancelAnimationFrame(frame);
  if (sampleTimer !== undefined) window.clearInterval(sampleTimer);
  sampleTimer = undefined;
}

function finishMeasurement() {
  running.value = false;
  stopTimers();
  report.value = buildReport();
  reportDialog.value = true;
  void refreshDiagnostics().then(() => {
    if (report.value) report.value = { ...report.value, diagnostics: diagnostics.value };
  });
}

function finishCurrentPoint() {
  if (finishingPoint) return;
  finishingPoint = true;
  pointReports.value.push(buildPointReport(targetIndex.value));
  if (targetIndex.value >= targetFractions.length - 1) {
    finishMeasurement();
    finishingPoint = false;
    return;
  }

  targetIndex.value += 1;
  samples.value = [];
  elapsedMs.value = 0;
  pointStartedAt.value = Date.now();
  finishingPoint = false;
}

function tick() {
  if (!running.value) return;
  elapsedMs.value = Date.now() - pointStartedAt.value;
  if (elapsedMs.value >= pointDurationMs) finishCurrentPoint();
  if (!running.value) return;
  frame = window.requestAnimationFrame(tick);
}

function startMeasurement() {
  if (!hasFreshTobii.value) {
    copyMessage.value = "Нет свежих данных Tobii. Мышь в проверке не используется.";
    return;
  }
  stopTimers();
  updateViewport();
  reportDialog.value = false;
  samples.value = [];
  pointReports.value = [];
  targetIndex.value = 0;
  report.value = undefined;
  copyMessage.value = "";
  elapsedMs.value = 0;
  startedAt.value = Date.now();
  pointStartedAt.value = startedAt.value;
  running.value = true;
  finishingPoint = false;
  void refreshDiagnostics();
  recordSample();
  sampleTimer = window.setInterval(recordSample, 33);
  frame = window.requestAnimationFrame(tick);
}

async function copyReport() {
  if (!reportText.value) return;
  await navigator.clipboard.writeText(reportText.value);
  copyMessage.value = "Отчёт скопирован";
}

onMounted(() => {
  window.addEventListener("resize", updateViewport, { passive: true });
  disposeGaze = window.linkaTobii?.onGaze(onTobiiGaze);
  updateViewport();
  void refreshDiagnostics();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateViewport);
  disposeGaze?.();
  stopTimers();
});
</script>

<template>
  <div class="gaze-debug">
    <svg class="debug-stage" :viewBox="`0 0 ${viewport.width} ${viewport.height}`" preserveAspectRatio="none" aria-hidden="true">
      <rect :x="target.x - targetZone / 2" :y="target.y - targetZone / 2" :width="targetZone" :height="targetZone" rx="10" class="target-zone" />
      <line :x1="target.x - 68" :y1="target.y" :x2="target.x + 68" :y2="target.y" class="target-line" />
      <line :x1="target.x" :y1="target.y - 68" :x2="target.x" :y2="target.y + 68" class="target-line" />
      <circle :cx="target.x" :cy="target.y" r="42" class="target-ring" />
      <circle :cx="target.x" :cy="target.y" r="10" class="target-dot" />
      <circle v-if="activePoint.valid" :cx="activePoint.x" :cy="activePoint.y" r="12" class="gaze-dot" :class="`is-${activePoint.source}`" />
    </svg>

    <v-card class="debug-panel ma-4" rounded="xl" elevation="8">
      <v-card-title class="text-h6 pb-1">Debug взгляда</v-card-title>
      <v-card-text>
        <div class="text-body-2 text-medium-emphasis mb-3">
          Смотрите на девять мишеней по очереди. Каждая точка измеряется 1,6 секунды; мышь в результат не попадает.
        </div>
        <v-alert v-if="copyMessage && !reportDialog" class="mb-3" type="warning" variant="tonal">{{ copyMessage }}</v-alert>
        <v-progress-linear class="mb-3" :model-value="progress" height="0.75rem" rounded color="primary" />
        <v-row dense>
          <v-col cols="6">
            <div class="text-caption text-medium-emphasis">Точка</div>
            <div class="text-body-2">{{ formatNumber(activePoint.x) }}, {{ formatNumber(activePoint.y) }} / {{ activePoint.source }} / {{ activePoint.valid ? "valid" : "invalid" }}</div>
          </v-col>
          <v-col cols="6">
            <div class="text-caption text-medium-emphasis">Смещение сейчас</div>
            <div class="text-body-2">{{ formatNumber(liveOffset.x) }}, {{ formatNumber(liveOffset.y) }}</div>
          </v-col>
          <v-col cols="6">
            <div class="text-caption text-medium-emphasis">Samples</div>
            <div class="text-body-2">{{ validSamples.length }} valid / {{ samples.length }} total</div>
          </v-col>
          <v-col cols="6">
            <div class="text-caption text-medium-emphasis">Цель</div>
            <div class="text-body-2">{{ targetIndex + 1 }} / {{ targetFractions.length }}: {{ formatNumber(target.x) }}, {{ formatNumber(target.y) }}</div>
          </v-col>
          <v-col cols="6">
            <div class="text-caption text-medium-emphasis">Tobii direct</div>
            <div class="text-body-2">{{ tobiiPoint ? `${formatNumber(tobiiPoint.x)}, ${formatNumber(tobiiPoint.y)} / ${tobiiPoint.valid ? "valid" : "invalid"}` : "нет данных" }}</div>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions class="pa-4 pt-0 flex-wrap ga-2">
        <v-btn color="primary" :disabled="running || !hasFreshTobii" @click="startMeasurement">Проверить 9 точек</v-btn>
        <v-btn variant="tonal" @click="router.push('/tobii-calibration')">К Tobii</v-btn>
        <v-btn variant="text" @click="router.push('/')">В начало</v-btn>
      </v-card-actions>
    </v-card>

    <v-dialog v-model="reportDialog" max-width="min(44rem, 92vw)">
      <v-card rounded="xl">
        <v-card-title>{{ report?.ok ? "Замер готов" : "Нужно отправить разработчику" }}</v-card-title>
        <v-card-text>
          <v-alert :type="report?.ok ? 'success' : 'warning'" variant="tonal" class="mb-4">
            {{ report?.reason }}
          </v-alert>
          <v-row dense>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Средняя ошибка</div>
              <div class="text-body-2">{{ formatNumber(report?.meanErrorPx, 1) }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Максимальная ошибка</div>
              <div class="text-body-2">{{ formatNumber(report?.maxErrorPx, 1) }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Valid ratio</div>
              <div class="text-body-2">{{ formatNumber((report?.validRatio ?? 0) * 100, 0) }}%</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Viewport</div>
              <div class="text-body-2">{{ report?.viewport.width }} x {{ report?.viewport.height }} / DPR {{ report?.viewport.devicePixelRatio }}</div>
            </v-col>
          </v-row>
          <v-table class="mt-4" density="compact">
            <thead>
              <tr><th>Точка</th><th>Цель</th><th>Ошибка</th><th>Valid</th></tr>
            </thead>
            <tbody>
              <tr v-for="point in report?.points ?? []" :key="point.index">
                <td>{{ point.index + 1 }}</td>
                <td>{{ formatNumber(point.target.x) }}, {{ formatNumber(point.target.y) }}</td>
                <td>{{ formatNumber(point.errorPx, 1) }}</td>
                <td>{{ formatNumber(point.validRatio * 100, 0) }}%</td>
              </tr>
            </tbody>
          </v-table>
          <v-textarea class="mt-4" :model-value="reportText" label="Отчёт" rows="8" readonly variant="outlined" />
          <v-alert v-if="copyMessage" class="mt-2" type="success" variant="tonal">{{ copyMessage }}</v-alert>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0 flex-wrap ga-2">
          <v-btn color="primary" @click="copyReport">Скопировать отчёт</v-btn>
          <v-btn variant="tonal" @click="startMeasurement">Повторить</v-btn>
          <v-btn variant="text" @click="reportDialog = false">Закрыть</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.gaze-debug {
  min-block-size: 100dvh;
  overflow: hidden;
  position: relative;
  background:
    radial-gradient(circle at 50% 50%, rgb(255 244 210 / 72%), rgb(202 232 244 / 88%) 42%, rgb(157 207 230 / 96%) 100%),
    rgb(var(--v-theme-background));
}

.debug-stage {
  block-size: 100dvh;
  inline-size: 100vw;
  inset: 0;
  position: fixed;
}

.target-zone {
  fill: rgb(255 255 255 / 18%);
  stroke: rgb(40 92 158 / 44%);
  stroke-dasharray: 10 8;
  stroke-width: 2;
}

.target-line {
  stroke: rgb(40 92 158 / 55%);
  stroke-linecap: round;
  stroke-width: 2;
}

.target-ring {
  fill: rgb(255 255 255 / 28%);
  stroke: rgb(255 255 255 / 80%);
  stroke-width: 4;
}

.target-dot {
  fill: rgb(255 138 61 / 94%);
  stroke: rgb(255 255 255 / 86%);
  stroke-width: 3;
}

.gaze-dot {
  fill: rgb(108 92 231 / 92%);
  stroke: rgb(255 255 255 / 86%);
  stroke-width: 4;
}

.gaze-dot.is-mouse {
  fill: rgb(255 138 61 / 92%);
}

.debug-panel {
  inline-size: min(42rem, calc(100vw - 2rem));
  position: relative;
  z-index: 2;
}
</style>

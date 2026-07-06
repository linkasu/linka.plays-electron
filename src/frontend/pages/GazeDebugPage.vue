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

type DebugReport = {
  ok: boolean;
  reason: string;
  target: { x: number; y: number };
  mean?: { x: number; y: number };
  offset?: { x: number; y: number };
  spread?: { minX: number; maxX: number; minY: number; maxY: number };
  samples: number;
  totalSamples: number;
  rawSamples: DebugSample[];
  durationMs: number;
  viewport: { width: number; height: number; devicePixelRatio: number };
  diagnostics?: TobiiDiagnosticsSnapshot;
};

const router = useRouter();

const target = ref({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
const viewport = ref({ width: window.innerWidth, height: window.innerHeight });
const mousePoint = ref<GazePoint>({
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  valid: false,
  source: "mouse",
  timestamp: Date.now()
});
const tobiiPoint = ref<GazePoint>();
const running = ref(false);
const startedAt = ref(0);
const elapsedMs = ref(0);
const samples = ref<DebugSample[]>([]);
const report = ref<DebugReport>();
const reportDialog = ref(false);
const copyMessage = ref("");
const diagnostics = ref<TobiiDiagnosticsSnapshot>();

const durationMs = 5000;
const targetZone = 100;
const tobiiFreshMs = 700;
let frame = 0;
let sampleTimer: number | undefined;
let finishTimer: number | undefined;
let disposeGaze: Dispose | undefined;

const progress = computed(() => Math.min(100, (elapsedMs.value / durationMs) * 100));
const validSamples = computed(() => samples.value.filter((sample) => sample.valid));
const hasFreshTobii = computed(() => {
  if (!tobiiPoint.value?.valid) return false;
  return Date.now() - (tobiiPoint.value.timestamp ?? 0) <= tobiiFreshMs;
});
const activePoint = computed(() => (hasFreshTobii.value ? tobiiPoint.value! : mousePoint.value));
const liveOffset = computed(() => ({
  x: activePoint.value.x - target.value.x,
  y: activePoint.value.y - target.value.y
}));
const reportText = computed(() => (report.value ? JSON.stringify(report.value, null, 2) : ""));

function updateViewport() {
  viewport.value = { width: window.innerWidth, height: window.innerHeight };
  target.value = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
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

function onPointerMove(event: PointerEvent) {
  mousePoint.value = {
    x: event.clientX,
    y: event.clientY,
    valid: true,
    source: "mouse",
    timestamp: Date.now()
  };
}

function onTobiiGaze(point: GazePoint) {
  tobiiPoint.value = {
    ...point,
    timestamp: point.timestamp ?? Date.now()
  };
}

function recordSample() {
  const point = activePoint.value;
  samples.value.push({
    x: point.x,
    y: point.y,
    valid: point.valid,
    source: point.source,
    timestamp: Date.now(),
    trackerTimestamp: point.timestamp
  });
}

function buildReport(): DebugReport {
  const valid = validSamples.value;
  const base = {
    samples: valid.length,
    totalSamples: samples.value.length,
    rawSamples: samples.value,
    durationMs: elapsedMs.value,
    target: { ...target.value },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1
    },
    diagnostics: diagnostics.value
  };
  if (valid.length === 0) {
    return {
      ...base,
      ok: false,
      reason: "За время замера не было валидных точек взгляда"
    };
  }

  const sum = valid.reduce((acc, sample) => ({ x: acc.x + sample.x, y: acc.y + sample.y }), { x: 0, y: 0 });
  const mean = { x: sum.x / valid.length, y: sum.y / valid.length };
  const offset = { x: mean.x - target.value.x, y: mean.y - target.value.y };
  const spread = valid.reduce(
    (acc, sample) => ({
      minX: Math.min(acc.minX, sample.x),
      maxX: Math.max(acc.maxX, sample.x),
      minY: Math.min(acc.minY, sample.y),
      maxY: Math.max(acc.maxY, sample.y)
    }),
    { minX: valid[0].x, maxX: valid[0].x, minY: valid[0].y, maxY: valid[0].y }
  );
  const ok = Math.abs(offset.x) <= targetZone / 2 && Math.abs(offset.y) <= targetZone / 2;
  return {
    ...base,
    ok,
    reason: ok ? "Средняя точка взгляда попала в зону 100x100 вокруг мишени" : "Средняя точка взгляда смещена относительно мишени",
    mean,
    offset,
    spread
  };
}

function stopTimers() {
  window.cancelAnimationFrame(frame);
  if (sampleTimer !== undefined) window.clearInterval(sampleTimer);
  if (finishTimer !== undefined) window.clearTimeout(finishTimer);
  sampleTimer = undefined;
  finishTimer = undefined;
}

function finishMeasurement() {
  running.value = false;
  stopTimers();
  elapsedMs.value = durationMs;
  report.value = buildReport();
  reportDialog.value = true;
  void refreshDiagnostics().then(() => {
    if (report.value) report.value = { ...report.value, diagnostics: diagnostics.value };
  });
}

function tick() {
  if (!running.value) return;
  elapsedMs.value = Date.now() - startedAt.value;
  if (elapsedMs.value >= durationMs) finishMeasurement();
  if (!running.value) return;
  frame = window.requestAnimationFrame(tick);
}

function startMeasurement() {
  stopTimers();
  updateViewport();
  reportDialog.value = false;
  samples.value = [];
  report.value = undefined;
  copyMessage.value = "";
  elapsedMs.value = 0;
  startedAt.value = Date.now();
  running.value = true;
  void refreshDiagnostics();
  recordSample();
  sampleTimer = window.setInterval(recordSample, 33);
  finishTimer = window.setTimeout(finishMeasurement, durationMs);
  frame = window.requestAnimationFrame(tick);
}

async function copyReport() {
  if (!reportText.value) return;
  await navigator.clipboard.writeText(reportText.value);
  copyMessage.value = "Отчёт скопирован";
}

onMounted(() => {
  window.addEventListener("resize", updateViewport, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  disposeGaze = window.linkaTobii?.onGaze(onTobiiGaze);
  updateViewport();
  void refreshDiagnostics();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateViewport);
  window.removeEventListener("pointermove", onPointerMove);
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
          Нажмите старт и смотрите в центр мишени 5 секунд. После замера средняя точка сравнивается с зоной 100x100 вокруг мишени.
        </div>
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
            <div class="text-caption text-medium-emphasis">Центр</div>
            <div class="text-body-2">{{ formatNumber(target.x) }}, {{ formatNumber(target.y) }}</div>
          </v-col>
          <v-col cols="6">
            <div class="text-caption text-medium-emphasis">Tobii direct</div>
            <div class="text-body-2">{{ tobiiPoint ? `${formatNumber(tobiiPoint.x)}, ${formatNumber(tobiiPoint.y)} / ${tobiiPoint.valid ? "valid" : "invalid"}` : "нет данных" }}</div>
          </v-col>
          <v-col cols="6">
            <div class="text-caption text-medium-emphasis">Mouse fallback</div>
            <div class="text-body-2">{{ formatNumber(mousePoint.x) }}, {{ formatNumber(mousePoint.y) }} / {{ mousePoint.valid ? "valid" : "invalid" }}</div>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions class="pa-4 pt-0 flex-wrap ga-2">
        <v-btn color="primary" :disabled="running" @click="startMeasurement">Начать 5 секунд</v-btn>
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
              <div class="text-caption text-medium-emphasis">Средняя точка</div>
              <div class="text-body-2">{{ formatNumber(report?.mean?.x, 1) }}, {{ formatNumber(report?.mean?.y, 1) }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Ошибка dx/dy</div>
              <div class="text-body-2">{{ formatNumber(report?.offset?.x, 1) }}, {{ formatNumber(report?.offset?.y, 1) }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Samples</div>
              <div class="text-body-2">{{ report?.samples ?? 0 }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Viewport</div>
              <div class="text-body-2">{{ report?.viewport.width }} x {{ report?.viewport.height }} / DPR {{ report?.viewport.devicePixelRatio }}</div>
            </v-col>
          </v-row>
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

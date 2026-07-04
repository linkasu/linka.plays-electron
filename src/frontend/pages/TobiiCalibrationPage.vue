<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { resolveMenuRoute } from "../core/menuMode";

type CalibrationPhase = "idle" | "start" | "look" | "finish";
type CalibrationPointState = "idle" | "holding" | "bursting" | "done";
type CalibrationPoint = { x: number; y: number };

const router = useRouter();
const calibrationBusy = ref(false);
const calibrationActive = ref(false);
const calibrationMessage = ref("");
const calibrationError = ref("");
const phase = ref<CalibrationPhase>("idle");
const activeGroupIndex = ref(0);
const activePointIndex = ref<number | null>(null);
const pointStates = ref<CalibrationPointState[]>([]);
const holdProgress = ref(0);
const completingPoint = ref(false);
const tobiiStatus = ref<TobiiStatus>();
const gazePoint = ref<GazePoint>();

const holdMs = 1600;
const burstMs = 280;
const groupPauseMs = 120;
const targetHitRadius = 360;
let holdFrame: number | undefined;
let disposeStatus: Dispose | undefined;
let disposeGaze: Dispose | undefined;

const calibrationGroups: CalibrationPoint[][] = [
  [
    { x: 0.5, y: 0.22 },
    { x: 0.24, y: 0.72 },
    { x: 0.76, y: 0.72 }
  ],
  [
    { x: 0.24, y: 0.28 },
    { x: 0.76, y: 0.28 },
    { x: 0.5, y: 0.78 }
  ]
];

const currentGroup = computed(() => calibrationGroups[activeGroupIndex.value]);
const currentTargetIndex = computed(() => {
  const index = pointStates.value.findIndex((state) => state !== "done");
  return index >= 0 ? index : null;
});
const canUseTobii = computed(() => tobiiStatus.value?.state === "connected" || tobiiStatus.value?.state === "tracking");
const tobiiStatusMessage = computed(() => tobiiStatus.value?.message || "Проверяю состояние Tobii...");
const tobiiStatusAlertType = computed(() => {
  if (!tobiiStatus.value) return "info";
  if (canUseTobii.value) return "success";
  if (["service_starting", "connecting", "reconnecting", "waiting_device"].includes(tobiiStatus.value.state)) return "warning";
  return "error";
});
const gazeMarkerStyle = computed(() => ({
  left: `${gazePoint.value?.x ?? -100}px`,
  top: `${gazePoint.value?.y ?? -100}px`
}));

async function startTobiiCalibration() {
  if (calibrationBusy.value || !window.linkaTobii) return;
  calibrationBusy.value = true;
  calibrationActive.value = true;
  calibrationError.value = "";
  calibrationMessage.value = "";
  activeGroupIndex.value = 0;
  activePointIndex.value = null;
  holdProgress.value = 0;
  completingPoint.value = false;
  resetPointStates();

  try {
    phase.value = "start";
    await window.linkaTobii.startCalibration();
    phase.value = "look";
  } catch (error) {
    failCalibration(error);
  }
}

function cancelTobiiCalibration() {
  stopHoldTimer();
  calibrationActive.value = false;
  calibrationBusy.value = false;
  phase.value = "idle";
  activePointIndex.value = null;
  completingPoint.value = false;
  calibrationMessage.value = "Калибровка Tobii отменена.";
}

async function applySavedCalibration() {
  if (!window.linkaTobii) return;
  calibrationBusy.value = true;
  calibrationError.value = "";
  try {
    const applied = await window.linkaTobii.applySavedCalibration();
    calibrationMessage.value = applied ? "Сохранённая калибровка применена." : "Сохранённая калибровка пока не найдена.";
  } catch (error) {
    calibrationError.value = error instanceof Error ? error.message : String(error);
  } finally {
    calibrationBusy.value = false;
  }
}

async function restartService() {
  if (!window.linkaTobii) return;
  calibrationError.value = "";
  calibrationMessage.value = "Перезапускаю службу Tobii...";
  try {
    await window.linkaTobii.restartService();
  } catch (error) {
    calibrationError.value = error instanceof Error ? error.message : String(error);
  }
}

function targetStyle(point: CalibrationPoint, index: number) {
  const progress = activePointIndex.value === index ? holdProgress.value : 0;
  return {
    left: `${point.x * 100}%`,
    top: `${point.y * 100}%`,
    "--hold-progress": `${progress}%`
  };
}

function targetClasses(index: number) {
  const state = pointStates.value[index] || "idle";
  return {
    [`is-${state}`]: true,
    "is-active": activePointIndex.value === index,
    "is-current": currentTargetIndex.value === index,
    "is-disabled": isPointDisabled(index)
  };
}

function isPointDisabled(index: number) {
  if (phase.value !== "look") return true;
  if (completingPoint.value) return true;
  if (currentTargetIndex.value !== index) return true;
  const state = pointStates.value[index];
  if (state === "done" || state === "bursting") return true;
  return activePointIndex.value !== null && activePointIndex.value !== index;
}

function onGaze(point: GazePoint) {
  gazePoint.value = point;
  if (!calibrationActive.value || phase.value !== "look" || !point.valid) {
    resetActivePoint();
    return;
  }

  const hitIndex = findHitTarget(point);
  if (hitIndex === undefined) {
    resetActivePoint();
    return;
  }
  if (isPointDisabled(hitIndex)) return;
  if (activePointIndex.value === hitIndex && pointStates.value[hitIndex] === "holding") return;

  stopHoldTimer();
  activePointIndex.value = hitIndex;
  holdProgress.value = 0;
  setPointState(hitIndex, "holding");
  startHoldTimer(hitIndex);
}

function findHitTarget(point: GazePoint) {
  const targets = Array.from(document.querySelectorAll<HTMLElement>(".calibration-target.is-current:not(.is-done)"));
  const target = targets.find((element) => {
    const rect = element.getBoundingClientRect();
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    return Math.hypot(point.x - centerX, point.y - centerY) <= targetHitRadius;
  });
  if (!target?.dataset.index) return undefined;
  return Number(target.dataset.index);
}

function resetActivePoint() {
  if (activePointIndex.value === null) return;
  const index = activePointIndex.value;
  if (pointStates.value[index] !== "holding") return;
  stopHoldTimer();
  activePointIndex.value = null;
  holdProgress.value = 0;
  setPointState(index, "idle");
}

function startHoldTimer(index: number) {
  const startedAt = performance.now();
  const tick = (now: number) => {
    if (activePointIndex.value !== index || pointStates.value[index] !== "holding") return;
    const elapsed = now - startedAt;
    holdProgress.value = Math.min(100, elapsed / holdMs * 100);
    if (elapsed >= holdMs) {
      void completePoint(index);
      return;
    }
    holdFrame = window.requestAnimationFrame(tick);
  };
  holdFrame = window.requestAnimationFrame(tick);
}

async function completePoint(index: number) {
  if (completingPoint.value || !window.linkaTobii) return;
  completingPoint.value = true;
  stopHoldTimer();
  activePointIndex.value = null;
  holdProgress.value = 100;
  setPointState(index, "bursting");

  try {
    await Promise.all([
      window.linkaTobii.addCalibrationPoint(currentGroup.value[index]),
      wait(burstMs)
    ]);
    setPointState(index, "done");
    completingPoint.value = false;
    await continueAfterPoint();
  } catch (error) {
    failCalibration(error);
  }
}

async function continueAfterPoint() {
  if (!pointStates.value.every((state) => state === "done")) return;
  if (activeGroupIndex.value < calibrationGroups.length - 1) {
    await wait(groupPauseMs);
    activeGroupIndex.value += 1;
    resetPointStates();
    return;
  }

  phase.value = "finish";
  try {
    await window.linkaTobii?.finishCalibration();
    calibrationMessage.value = "Калибровка Tobii сохранена и применена.";
    calibrationActive.value = false;
    phase.value = "idle";
  } catch (error) {
    failCalibration(error);
    return;
  } finally {
    calibrationBusy.value = false;
    completingPoint.value = false;
  }
}

function resetPointStates() {
  pointStates.value = currentGroup.value.map(() => "idle");
}

function setPointState(index: number, state: CalibrationPointState) {
  pointStates.value = pointStates.value.map((current, currentIndex) => currentIndex === index ? state : current);
}

function stopHoldTimer() {
  if (holdFrame === undefined) return;
  window.cancelAnimationFrame(holdFrame);
  holdFrame = undefined;
}

function failCalibration(error: unknown) {
  stopHoldTimer();
  calibrationError.value = error instanceof Error ? error.message : String(error);
  calibrationActive.value = false;
  calibrationBusy.value = false;
  completingPoint.value = false;
  activePointIndex.value = null;
  phase.value = "idle";
}

function wait(durationMs: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, durationMs));
}

function onKeydown(event: KeyboardEvent) {
  if (!calibrationActive.value || event.key !== "Escape") return;
  event.preventDefault();
  cancelTobiiCalibration();
}

async function loadTobiiStatus() {
  try {
    tobiiStatus.value = await window.linkaTobii?.getStatus();
  } catch (error) {
    tobiiStatus.value = {
      state: "service_unavailable",
      mode: "socket-service",
      message: error instanceof Error ? error.message : String(error),
      deviceFound: false,
      updatedAt: Date.now()
    };
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  void loadTobiiStatus();
  disposeStatus = window.linkaTobii?.onStatus((status) => {
    tobiiStatus.value = status;
  });
  disposeGaze = window.linkaTobii?.onGaze(onGaze);
});

onBeforeUnmount(() => {
  stopHoldTimer();
  window.removeEventListener("keydown", onKeydown);
  disposeStatus?.();
  disposeGaze?.();
});
</script>

<template>
  <div class="tobii-calibration">
    <v-container v-if="!calibrationActive" class="panel-container py-10">
      <v-card rounded="xl" elevation="8">
        <v-card-title class="text-h5 pa-6 pb-2">
          Калибровка Tobii Eye Tracker 5
        </v-card-title>
        <v-card-text class="text-body-1 px-6">
          Смотрите на точку и удерживайте взгляд, пока кольцо не заполнится. Если отвести взгляд раньше времени, точка начнётся заново. Для отмены нажмите Escape.
          <v-alert class="mt-4" :type="tobiiStatusAlertType" variant="tonal">
            <div>{{ tobiiStatusMessage }}</div>
            <div v-if="tobiiStatus?.lastError">Ошибка: {{ tobiiStatus.lastError }}</div>
          </v-alert>
          <v-alert v-if="calibrationMessage" class="mt-4" type="info" variant="tonal">
            {{ calibrationMessage }}
          </v-alert>
          <v-alert v-if="calibrationError" class="mt-4" type="error" variant="tonal">
            {{ calibrationError }}
          </v-alert>
        </v-card-text>
        <v-card-actions class="pa-6 pt-2">
          <v-btn color="primary" :disabled="!canUseTobii" :loading="calibrationBusy" @click="startTobiiCalibration">
            Начать калибровку
          </v-btn>
          <v-btn :disabled="!canUseTobii" :loading="calibrationBusy" @click="applySavedCalibration">
            Применить сохранённую
          </v-btn>
          <v-btn :loading="calibrationBusy" @click="restartService">
            Перезапустить Tobii
          </v-btn>
          <v-spacer />
          <v-btn @click="router.push(resolveMenuRoute())">
            В меню
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-container>

    <div v-else class="calibration-stage" :class="{ 'is-finishing': phase === 'finish' }">
      <div v-if="gazePoint?.valid" class="debug-gaze-marker" :style="gazeMarkerStyle" />
      <div
        v-for="(point, index) in currentGroup"
        v-show="pointStates[index] !== 'done' && currentTargetIndex === index"
        :key="`${activeGroupIndex}-${index}`"
        class="calibration-target"
        :class="targetClasses(index)"
        :data-index="index"
        :style="targetStyle(point, index)"
      >
        <div class="target-sparks" aria-hidden="true">
          <span v-for="spark in 10" :key="spark" class="target-spark" />
        </div>
        <div class="target-ring">
          <div class="target-dot" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tobii-calibration {
  min-height: 100vh;
  width: 100%;
}

.panel-container {
  max-width: 820px;
}

.calibration-stage {
  position: fixed;
  inset: 0;
  z-index: 1000;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 45%, rgb(42 101 255 / 24%) 0%, rgb(6 17 45 / 92%) 45%, #020817 100%),
    #020817;
  color: #fff;
  transition: opacity 240ms ease;
}

.calibration-stage.is-finishing {
  opacity: 0.5;
}

.debug-gaze-marker {
  position: fixed;
  z-index: 3;
  width: 22px;
  height: 22px;
  transform: translate(-50%, -50%);
  border: 3px solid #f44336;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgb(255 255 255 / 90%);
  pointer-events: none;
}

.calibration-target {
  position: fixed;
  width: 360px;
  height: 360px;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  border-radius: 50%;
  pointer-events: none;
  transition: opacity 180ms ease, transform 180ms ease, filter 180ms ease;
}

.calibration-target.is-disabled:not(.is-holding):not(.is-bursting) {
  opacity: 0.36;
}

.calibration-target.is-done {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.7);
}

.target-ring {
  position: relative;
  width: 76px;
  height: 76px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: conic-gradient(#4dffea var(--hold-progress), rgb(77 255 234 / 26%) 0);
  box-shadow: 0 0 28px rgb(77 255 234 / 70%), 0 0 76px rgb(54 116 255 / 38%);
}

.target-ring::before {
  content: "";
  position: absolute;
  inset: 10px;
  border-radius: 50%;
  background: #04122e;
  box-shadow: inset 0 0 18px rgb(77 255 234 / 18%);
}

.is-holding.target-ring {
  animation: target-spin 720ms linear infinite;
}

.is-bursting.target-ring {
  animation: target-burst 280ms ease-out forwards;
}

.target-dot {
  position: relative;
  z-index: 1;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ffec5c;
  box-shadow: 0 0 0 8px rgb(255 236 92 / 22%), 0 0 24px rgb(255 236 92 / 90%);
}

.is-bursting.target-dot {
  animation: dot-burst 280ms ease-out forwards;
}

.target-sparks {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.target-spark {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 7px;
  height: 7px;
  margin: -3.5px 0 0 -3.5px;
  border-radius: 50%;
  background: #ffec5c;
  opacity: 0;
  transform: rotate(var(--spark-angle)) translateX(24px) scale(0.4);
  box-shadow: 0 0 14px rgb(255 236 92 / 95%);
}

.is-holding.target-spark {
  animation: spark-orbit 720ms linear infinite;
}

.is-bursting.target-spark {
  animation: spark-burst 280ms ease-out forwards;
}

.target-spark:nth-child(1) { --spark-angle: 0deg; }
.target-spark:nth-child(2) { --spark-angle: 36deg; }
.target-spark:nth-child(3) { --spark-angle: 72deg; }
.target-spark:nth-child(4) { --spark-angle: 108deg; }
.target-spark:nth-child(5) { --spark-angle: 144deg; }
.target-spark:nth-child(6) { --spark-angle: 180deg; }
.target-spark:nth-child(7) { --spark-angle: 216deg; }
.target-spark:nth-child(8) { --spark-angle: 252deg; }
.target-spark:nth-child(9) { --spark-angle: 288deg; }
.target-spark:nth-child(10) { --spark-angle: 324deg; }

@keyframes target-spin {
  to { transform: rotate(360deg); }
}

@keyframes target-burst {
  0% { opacity: 1; transform: scale(1); }
  70% { opacity: 0.85; transform: scale(1.5); }
  100% { opacity: 0; transform: scale(2.1); }
}

@keyframes dot-burst {
  to { opacity: 0; transform: scale(0.2); }
}

@keyframes spark-orbit {
  0% { opacity: 0.25; transform: rotate(var(--spark-angle)) translateX(22px) scale(0.35); }
  50% { opacity: 1; transform: rotate(calc(var(--spark-angle) + 180deg)) translateX(34px) scale(0.8); }
  100% { opacity: 0.25; transform: rotate(calc(var(--spark-angle) + 360deg)) translateX(22px) scale(0.35); }
}

@keyframes spark-burst {
  0% { opacity: 1; transform: rotate(var(--spark-angle)) translateX(28px) scale(0.7); }
  100% { opacity: 0; transform: rotate(var(--spark-angle)) translateX(74px) scale(0.15); }
}
</style>

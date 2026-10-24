import { onMounted, onUnmounted, ref } from "vue";
import {
  applyGazeCorrection,
  correctionFitsWindow,
  currentGazeWindow,
  gazeCorrection,
} from "../core/gazeCorrection";

const pointer = ref<GazePoint>({
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  valid: false,
  source: "mouse",
  timestamp: Date.now(),
});

let subscribers = 0;
let disposeGaze: Dispose | undefined;
let staleFrame = 0;
const gazeTtlMs = 350;
const mouseTakeoverMs = 1200;
const smoothingTauMs = 45;
let lastMouseAt = 0;

export function smoothingAlpha(deltaMs: number, tauMs = smoothingTauMs) {
  return 1 - Math.exp(-Math.max(0, deltaMs) / Math.max(1, tauMs));
}

export function mouseOwnsPointer(mouseAt: number, gazeAt: number, takeoverMs = mouseTakeoverMs) {
  return mouseAt > 0 && gazeAt - mouseAt < takeoverMs;
}

function clampToViewport(point: { x: number; y: number }) {
  return {
    x: Math.max(0, Math.min(window.innerWidth, point.x)),
    y: Math.max(0, Math.min(window.innerHeight, point.y)),
  };
}

function setPointer(nextPoint: GazePoint) {
  const next = clampToViewport(nextPoint);
  pointer.value = {
    ...nextPoint,
    x: next.x,
    y: next.y,
    timestamp: nextPoint.timestamp ?? Date.now(),
  };
}

function onPointerMove(event: PointerEvent) {
  lastMouseAt = Date.now();
  setPointer({
    x: event.clientX,
    y: event.clientY,
    valid: true,
    source: "mouse",
    timestamp: Date.now(),
  });
}

function invalidatePointer() {
  lastMouseAt = 0;
  pointer.value = { ...pointer.value, valid: false, timestamp: Date.now() };
}

function onVisibilityChange() {
  if (document.hidden) invalidatePointer();
}

function onGaze(point: GazePoint) {
  const timestamp = point.timestamp ?? Date.now();
  if (mouseOwnsPointer(lastMouseAt, timestamp)) return;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    pointer.value = { ...pointer.value, valid: false, source: "tobii", timestamp };
    return;
  }

  // The correction measured on the gaze debug page (see core/gazeCorrection),
  // only in the window it was measured in.
  const gazeWindow = currentGazeWindow();
  const correction = correctionFitsWindow(gazeCorrection.value?.window, gazeWindow)
    ? gazeCorrection.value
    : undefined;
  const corrected = applyGazeCorrection(correction, point, gazeWindow);
  const previous = pointer.value;
  const sameSource = previous.source === "tobii";
  const alpha = smoothingAlpha(timestamp - (previous.timestamp ?? timestamp));
  const x = sameSource ? previous.x + (corrected.x - previous.x) * alpha : corrected.x;
  const y = sameSource ? previous.y + (corrected.y - previous.y) * alpha : corrected.y;
  setPointer({
    x,
    y,
    valid: point.valid,
    source: "tobii",
    timestamp,
  });
}

function checkStaleGaze() {
  if (
    pointer.value.source === "tobii" &&
    pointer.value.valid &&
    Date.now() - (pointer.value.timestamp ?? 0) > gazeTtlMs
  ) {
    pointer.value = { ...pointer.value, valid: false, timestamp: Date.now() };
  }
  staleFrame = window.requestAnimationFrame(checkStaleGaze);
}

function attachListeners() {
  if (subscribers > 0) return;
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("blur", invalidatePointer);
  document.addEventListener("visibilitychange", onVisibilityChange);
  disposeGaze = window.linkaTobii?.onGaze(onGaze);
  staleFrame = window.requestAnimationFrame(checkStaleGaze);
}

function detachListeners() {
  if (subscribers > 0) return;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("blur", invalidatePointer);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  disposeGaze?.();
  disposeGaze = undefined;
  window.cancelAnimationFrame(staleFrame);
}

export function useGazePointer() {
  onMounted(() => {
    attachListeners();
    subscribers += 1;
  });

  onUnmounted(() => {
    subscribers = Math.max(0, subscribers - 1);
    detachListeners();
  });

  return { pointer };
}

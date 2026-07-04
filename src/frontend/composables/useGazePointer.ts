import { onMounted, onUnmounted, ref } from "vue";

const pointer = ref<GazePoint>({
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  valid: false,
  source: "mouse",
  timestamp: Date.now()
});

let subscribers = 0;
let disposeGaze: Dispose | undefined;
let staleFrame = 0;
const gazeTtlMs = 350;
const smoothing = 0.38;

function clampToViewport(point: { x: number; y: number }) {
  return {
    x: Math.max(0, Math.min(window.innerWidth, point.x)),
    y: Math.max(0, Math.min(window.innerHeight, point.y))
  };
}

function setPointer(nextPoint: GazePoint) {
  const next = clampToViewport(nextPoint);
  pointer.value = {
   ...nextPoint,
    x: next.x,
    y: next.y,
    timestamp: nextPoint.timestamp ?? Date.now()
  };
}

function onPointerMove(event: PointerEvent) {
  setPointer({
    x: event.clientX,
    y: event.clientY,
    valid: true,
    source: "mouse",
    timestamp: Date.now()
  });
}

function onGaze(point: GazePoint) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    pointer.value = { ...pointer.value, valid: false, source: "tobii", timestamp: point.timestamp ?? Date.now() };
    return;
  }

  const previous = pointer.value;
  const sameSource = previous.source === "tobii";
  const x = sameSource ? previous.x + (point.x - previous.x) * smoothing : point.x;
  const y = sameSource ? previous.y + (point.y - previous.y) * smoothing : point.y;
  setPointer({
    x,
    y,
    valid: point.valid,
    source: "tobii",
    timestamp: point.timestamp ?? Date.now()
  });
}

function checkStaleGaze() {
  if (pointer.value.source === "tobii" && pointer.value.valid && Date.now() - (pointer.value.timestamp ?? 0) > gazeTtlMs) {
    pointer.value = { ...pointer.value, valid: false, timestamp: Date.now() };
  }
  staleFrame = window.requestAnimationFrame(checkStaleGaze);
}

function attachListeners() {
  if (subscribers > 0) return;
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  disposeGaze = window.linkaTobii?.onGaze(onGaze);
  staleFrame = window.requestAnimationFrame(checkStaleGaze);
}

function detachListeners() {
  if (subscribers > 0) return;
  window.removeEventListener("pointermove", onPointerMove);
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

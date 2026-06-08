import { onMounted, onUnmounted, ref } from "vue";

export function useGazePointer() {
  const pointer = ref<GazePoint>({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    valid: false,
    source: "mouse"
  });
  let disposeGaze: Dispose | undefined;

  const onPointerMove = (event: PointerEvent) => {
    pointer.value = {
      x: event.clientX,
      y: event.clientY,
      valid: true,
      source: "mouse"
    };
  };

  onMounted(() => {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    disposeGaze = window.linkaTobii?.onGaze((point) => {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        pointer.value = { ...pointer.value, valid: false, source: "tobii" };
        return;
      }
      pointer.value = {
        x: point.x,
        y: point.y,
        valid: point.valid,
        source: "tobii"
      };
    });
  });

  onUnmounted(() => {
    window.removeEventListener("pointermove", onPointerMove);
    disposeGaze?.();
  });

  return { pointer };
}

import { nextTick, onMounted, onUnmounted, ref, type Ref } from "vue";

export function useCanvasStage() {
  const canvasRef = ref<HTMLCanvasElement>();
  const context = ref<CanvasRenderingContext2D>();
  const width = ref(window.innerWidth);
  const height = ref(window.innerHeight);
  const dpr = ref(window.devicePixelRatio || 1);

  function resizeCanvas() {
    const canvas = canvasRef.value;
    if (!canvas) return;
    dpr.value = window.devicePixelRatio || 1;
    width.value = window.innerWidth;
    height.value = window.innerHeight;
    canvas.width = Math.round(width.value * dpr.value);
    canvas.height = Math.round(height.value * dpr.value);
    canvas.style.width = `${width.value}px`;
    canvas.style.height = `${height.value}px`;
    context.value = canvas.getContext("2d") ?? undefined;
    context.value?.setTransform(dpr.value, 0, 0, dpr.value, 0, 0);
  }

  onMounted(async () => {
    await nextTick();
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
  });

  onUnmounted(() => {
    window.removeEventListener("resize", resizeCanvas);
  });

  return { canvasRef, context, width, height, dpr, resizeCanvas };
}

export function useGameLoop(options: {
  context: Ref<CanvasRenderingContext2D | undefined>;
  update?: (delta: number, now: number) => void;
  draw: (context: CanvasRenderingContext2D, delta: number, now: number) => void;
  active?: Ref<boolean>;
}) {
  let frame = 0;
  let lastTime = performance.now();

  function tick(now: number) {
    const delta = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    if (options.active?.value !== false) {
      options.update?.(delta, now);
      if (options.context.value) options.draw(options.context.value, delta, now);
    }
    frame = requestAnimationFrame(tick);
  }

  onMounted(() => {
    lastTime = performance.now();
    frame = requestAnimationFrame(tick);
  });

  onUnmounted(() => {
    cancelAnimationFrame(frame);
  });
}

export function safeGameArea(width: number, height: number) {
  return {
    x: 32,
    y: 112,
    width: Math.max(240, width - 64),
    height: Math.max(240, height - 176)
  };
}

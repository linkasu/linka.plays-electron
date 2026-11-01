import { nextTick, onMounted, onUnmounted, ref } from "vue";

export function useGameHudClearance() {
  const hudBottom = ref(0);
  let observer: ResizeObserver | undefined;
  const measure = () => {
    hudBottom.value = document.querySelector(".game-hud")?.getBoundingClientRect().bottom ?? 0;
  };
  onMounted(async () => {
    await nextTick();
    measure();
    const hud = document.querySelector(".game-hud");
    if (hud) {
      observer = new ResizeObserver(measure);
      observer.observe(hud);
    }
    window.addEventListener("resize", measure);
  });
  onUnmounted(() => {
    observer?.disconnect();
    window.removeEventListener("resize", measure);
  });
  return hudBottom;
}

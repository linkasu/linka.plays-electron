import { onMounted, onUnmounted, ref } from "vue";

const fallbackStatus: TobiiStatus = {
  state: "unsupported",
  mode: "unsupported",
  message: "Electron IPC недоступен, используется мышь.",
  deviceFound: false,
  updatedAt: Date.now()
};

export function useTobiiStatus() {
  const status = ref<TobiiStatus>(fallbackStatus);
  let dispose: Dispose | undefined;

  onMounted(() => {
    if (!window.linkaTobii) return;
    window.linkaTobii.rendererReady();
    window.linkaTobii.getStatus().then((nextStatus) => {
      status.value = nextStatus;
    }).catch(() => {
      status.value = fallbackStatus;
    });
    dispose = window.linkaTobii.onStatus((nextStatus) => {
      status.value = nextStatus;
    });
  });

  onUnmounted(() => {
    dispose?.();
  });

  return { status };
}

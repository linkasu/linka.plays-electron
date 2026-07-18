import { onMounted, onUnmounted, ref } from "vue";
import { recordMetricsEvent } from "../core/telemetry";

const fallbackStatus: TobiiStatus = {
  state: "unsupported",
  mode: "unsupported",
  message: "Electron IPC недоступен, используется мышь.",
  deviceFound: false,
  updatedAt: Date.now()
};
let lastReportedState: TobiiStatusState | undefined;

function reportState(status: TobiiStatus) {
  if (lastReportedState === status.state) return;
  lastReportedState = status.state;
  recordMetricsEvent({ eventName: "tobii_state_changed", properties: { state: status.state } });
}

export function useTobiiStatus() {
  const status = ref<TobiiStatus>(fallbackStatus);
  let dispose: Dispose | undefined;

  onMounted(() => {
    if (!window.linkaTobii) return;
    window.linkaTobii.rendererReady();
    window.linkaTobii.getStatus().then((nextStatus) => {
      status.value = nextStatus;
      reportState(nextStatus);
    }).catch(() => {
      status.value = fallbackStatus;
      reportState(fallbackStatus);
    });
    dispose = window.linkaTobii.onStatus((nextStatus) => {
      status.value = nextStatus;
      reportState(nextStatus);
    });
  });

  onUnmounted(() => {
    dispose?.();
  });

  return { status };
}

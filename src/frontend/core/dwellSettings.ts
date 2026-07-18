import { readonly, ref } from "vue";
import { recordMetricsEvent } from "./telemetry";

export const DEFAULT_DWELL_MS = 750;
export const MIN_DWELL_MS = 500;
export const MAX_DWELL_MS = 1500;
export const DWELL_STEP_MS = 50;

const dwellStorageKey = "linka-gaze-dwell-ms";

export function normalizeDwellMs(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_DWELL_MS;
  const steppedValue = Math.round(numericValue / DWELL_STEP_MS) * DWELL_STEP_MS;
  return Math.min(MAX_DWELL_MS, Math.max(MIN_DWELL_MS, steppedValue));
}

function loadDwellMs() {
  try {
    const storedValue = window.localStorage.getItem(dwellStorageKey);
    return {
      explicit: storedValue !== null,
      value: normalizeDwellMs(storedValue ?? DEFAULT_DWELL_MS)
    };
  } catch {
    return { explicit: false, value: DEFAULT_DWELL_MS };
  }
}

export function persistDwellMs(value: number, storage: Pick<Storage, "setItem">) {
  storage.setItem(dwellStorageKey, String(value));
}

const loadedDwellMs = typeof window === "undefined" ? { explicit: false, value: DEFAULT_DWELL_MS } : loadDwellMs();
const dwellMs = ref(loadedDwellMs.value);
const explicitDwellMs = ref(loadedDwellMs.explicit);

export function setDwellMs(value: unknown) {
  const nextDwellMs = normalizeDwellMs(value);
  const changed = dwellMs.value !== nextDwellMs;
  dwellMs.value = nextDwellMs;
  explicitDwellMs.value = true;
  try {
    persistDwellMs(dwellMs.value, window.localStorage);
  } catch {
    // The setting remains active for this run when storage is unavailable.
  }
  if (changed) recordMetricsEvent({ eventName: "settings_changed", properties: { settingKey: "dwell_ms", number: dwellMs.value } });
}

export function clearDwellMsOverride() {
  const changed = dwellMs.value !== DEFAULT_DWELL_MS;
  dwellMs.value = DEFAULT_DWELL_MS;
  explicitDwellMs.value = false;
  try {
    window.localStorage.removeItem(dwellStorageKey);
  } catch {
    // Per-game defaults remain active when storage is unavailable.
  }
  if (changed) recordMetricsEvent({ eventName: "settings_changed", properties: { settingKey: "dwell_ms", number: dwellMs.value } });
}

export function resolveDwellMs(fallback = DEFAULT_DWELL_MS) {
  return explicitDwellMs.value ? dwellMs.value : normalizeDwellMs(fallback);
}

export function useDwellSettings() {
  return {
    dwellMs: readonly(dwellMs),
    setDwellMs,
    clearDwellMsOverride
  };
}

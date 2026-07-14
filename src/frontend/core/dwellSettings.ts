import { readonly, ref } from "vue";

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
    return normalizeDwellMs(window.localStorage.getItem(dwellStorageKey) ?? DEFAULT_DWELL_MS);
  } catch {
    return DEFAULT_DWELL_MS;
  }
}

export function persistDwellMs(value: number, storage: Pick<Storage, "setItem">) {
  storage.setItem(dwellStorageKey, String(value));
}

const dwellMs = ref(typeof window === "undefined" ? DEFAULT_DWELL_MS : loadDwellMs());

export function setDwellMs(value: unknown) {
  dwellMs.value = normalizeDwellMs(value);
  try {
    persistDwellMs(dwellMs.value, window.localStorage);
  } catch {
    // The setting remains active for this run when storage is unavailable.
  }
}

export function resolveDwellMs() {
  return dwellMs.value;
}

export function useDwellSettings() {
  return {
    dwellMs: readonly(dwellMs),
    setDwellMs
  };
}

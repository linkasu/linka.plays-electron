import type { TelemetryPrivacyPreference } from "./privacyPreference";

export function isTelemetryEnabled(isPackaged: boolean, forceValue = process.env.LINKA_METRICS_FORCE) {
  return isPackaged || forceValue === "1";
}

export function shouldStartTelemetry(isPackaged: boolean, preference: TelemetryPrivacyPreference, forceValue = process.env.LINKA_METRICS_FORCE) {
  return preference === "enabled" && isTelemetryEnabled(isPackaged, forceValue);
}

export function retryDelayMs(attempt: number, random = Math.random()) {
  const exponential = Math.min(5 * 60_000, 1000 * 2 ** Math.min(Math.max(0, attempt), 9));
  return Math.round(exponential * (0.75 + Math.min(1, Math.max(0, random)) * 0.5));
}

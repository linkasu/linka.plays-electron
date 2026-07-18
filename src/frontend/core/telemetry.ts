export function recordMetricsEvent(event: MetricsEvent) {
  window.linkaMetrics?.recordEvent(event);
}

export function recordMetricsSummary(summary: MetricsSessionSummary) {
  window.linkaMetrics?.recordSessionSummary(summary);
}

export function installGlobalMetricsErrorHandlers() {
  window.addEventListener("error", (event) => {
    void recordErrorFingerprint("renderer.window", errorConstructor(event.error)).catch(() => undefined);
  });
  window.addEventListener("unhandledrejection", (event) => {
    void recordErrorFingerprint("renderer.promise", errorConstructor(event.reason)).catch(() => undefined);
  });
}

async function recordErrorFingerprint(component: string, constructorName: string) {
  const bytes = new TextEncoder().encode(`${component}:${normalizeIdentifier(constructorName)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const fingerprint = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  recordMetricsEvent({ eventName: "error", properties: { fingerprint: `sha256:${fingerprint}`, component } });
}

function errorConstructor(value: unknown) {
  if (value && typeof value === "object") {
    const constructor = (value as { constructor?: { name?: unknown } }).constructor;
    if (constructor && typeof constructor.name === "string") return constructor.name;
  }
  return typeof value === "string" ? "String" : typeof value;
}

function normalizeIdentifier(value: string) {
  return value.replace(/[^A-Za-z0-9._:+-]+/g, "-").slice(0, 96) || "unknown";
}

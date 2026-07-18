import { createHash, randomUUID } from "crypto";
import { app, safeStorage } from "electron";
import { chmod, mkdir, open, readFile, rename, rm } from "fs/promises";
import { release } from "os";
import { join } from "path";
import { isTelemetryEnabled, retryDelayMs } from "./policy";
import { sanitizeRendererSessionSummary, sanitizeRendererTelemetryEvent, toStoredGameSummary } from "./sanitizer";
import { FileTelemetrySpool } from "./spool";
import type { AppMetadata, SanitizedRendererEvent, StoredSessionSummary, StoredTelemetryEvent, TelemetryEventName } from "./types";

const defaultEndpoint = "https://plays-metric.nkolinka.ru";
const lowPriorityEvents = new Set<TelemetryEventName>(["level_entered", "level_cancelled", "level_clicked", "target_entered", "target_cancelled", "target_clicked", "success", "mistake", "hint_used", "difficulty_changed"]);
const identityRejectionStatuses = new Set([401, 403]);
const invalidBatchStatuses = new Set([400, 413, 422]);

type InstallationIdentity = { installationId: string; token: string };
type ActiveGameSession = {
  id: string;
  gameId: string;
  startedAt: string;
  startedAtMs: number;
  mode?: string;
  category?: string;
  pausedAtMs?: number;
  pausedMs: number;
  steps: number;
  successes: number;
  mistakes: number;
  hints: number;
  targetCancels: number;
  difficultyChanges: number;
  inputMethods: Set<string>;
  dwellTotalMs: number;
  dwellCount: number;
  configuredDwellMs?: number;
  endedAt?: string;
  finishReason?: string;
  interruptionReason?: string;
  result?: string;
};

type TelemetryOptions = {
  enabled: boolean;
  endpoint: string;
  userDataPath: string;
  appMetadata: AppMetadata;
};

export class MetricsTelemetry {
  readonly appSessionId = randomUUID();
  private readonly spool: FileTelemetrySpool;
  private readonly identityPath: string;
  private readonly appStartedAt = Date.now();
  private identity?: InstallationIdentity;
  private initialized = false;
  private flushTimer?: NodeJS.Timeout;
  private flushInProgress = false;
  private retryAttempt = 0;
  private batchRecordLimit = 500;
  private appForeground = true;
  private appPausedAt?: number;
  private appPausedMs = 0;
  private shuttingDown = false;
  private configuredDwellMs?: number;
  private sessionFinalization = Promise.resolve();
  private shutdownPromise?: Promise<void>;
  private readonly activeSessions = new Map<string, ActiveGameSession>();
  private readonly summarizedSessions = new Set<string>();
  private lastUpdaterState?: string;

  constructor(private readonly options: TelemetryOptions) {
    const telemetryDirectory = join(options.userDataPath, "telemetry-v1");
    this.spool = new FileTelemetrySpool(join(telemetryDirectory, "spool"));
    this.identityPath = join(telemetryDirectory, "installation.json");
  }

  async initialize() {
    if (!this.options.enabled) return;
    await this.spool.initialize();
    this.identity = await this.loadIdentity();
    await this.recordInternalEvent("app_started", {});
    this.initialized = true;
    this.requestFlush(0);
  }

  recordRendererEvent(input: unknown) {
    if (!this.options.enabled || this.shuttingDown) return false;
    const sanitized = sanitizeRendererTelemetryEvent(input);
    if (!sanitized) return false;
    if (sanitized.game_session_id && this.summarizedSessions.has(sanitized.game_session_id)) return true;
    this.trackGameEvent(sanitized);
    void this.enqueueEvent(sanitized.event_name, sanitized.properties, sanitized.game_session_id).catch(() => undefined);
    return true;
  }

  recordRendererSummary(input: unknown) {
    if (!this.options.enabled || this.shuttingDown) return false;
    const sanitized = sanitizeRendererSessionSummary(input);
    if (!sanitized || this.summarizedSessions.has(sanitized.gameSessionId)) return Boolean(sanitized);
    const finalization = this.sessionFinalization.then(async () => {
      if (this.summarizedSessions.has(sanitized.gameSessionId)) return;
      await this.enqueueSummary(toStoredGameSummary(sanitized, this.appSessionId, this.options.appMetadata));
      this.markSummarized(sanitized.gameSessionId);
      this.activeSessions.delete(sanitized.gameSessionId);
    });
    this.sessionFinalization = finalization.then(() => undefined, () => undefined);
    void finalization.catch(() => undefined);
    return true;
  }

  async recordInternalEvent(eventName: TelemetryEventName, properties: Record<string, unknown>, gameSessionId?: string) {
    if (!this.options.enabled) return;
    await this.enqueueEvent(eventName, properties, gameSessionId);
  }

  recordUpdaterState(state: "idle" | "checking" | "available" | "downloading" | "downloaded" | "installing" | "error", version?: string) {
    if (!this.options.enabled || this.lastUpdaterState === state) return;
    this.lastUpdaterState = state;
    void this.recordInternalEvent("updater_state_changed", { state, ...(version ? { version: safeValue(version) } : {}) }).catch(() => undefined);
  }

  setAppForeground(foreground: boolean) {
    if (!this.options.enabled || foreground === this.appForeground || this.shuttingDown) return;
    const now = Date.now();
    this.appForeground = foreground;
    if (foreground) {
      if (this.appPausedAt) this.appPausedMs += now - this.appPausedAt;
      this.appPausedAt = undefined;
      void this.recordInternalEvent("app_foregrounded", {}).catch(() => undefined);
    } else {
      this.appPausedAt = now;
      void this.recordInternalEvent("app_backgrounded", {}).catch(() => undefined);
    }
  }

  recordError(component: string, error: unknown) {
    if (!this.options.enabled) return;
    const constructorName = normalizeErrorConstructor(error);
    const fingerprint = `sha256:${createHash("sha256").update(`${component}:${constructorName}`).digest("hex")}`;
    void this.recordInternalEvent("error", { fingerprint, component: safeValue(component) }).catch(() => undefined);
  }

  interruptActiveSessions(reason: "route-leave" | "window-close" | "app-quit" | "update-restart" | "renderer-crash") {
    if (!this.options.enabled) return Promise.resolve();
    const finalization = this.sessionFinalization.then(() => this.finalizeActiveSessions(reason));
    this.sessionFinalization = finalization.then(() => undefined, () => undefined);
    return finalization;
  }

  private async finalizeActiveSessions(reason: "route-leave" | "window-close" | "app-quit" | "update-restart" | "renderer-crash") {
    for (const session of [...this.activeSessions.values()]) {
      if (!session.endedAt) {
        session.endedAt = new Date().toISOString();
        session.interruptionReason = reason;
        session.result = "interrupted";
        await this.enqueueEvent("game_session_interrupted", { game_id: session.gameId, reason }, session.id);
      }
      await this.enqueueSummary(this.createSyntheticSummary(session));
      this.markSummarized(session.id);
      this.activeSessions.delete(session.id);
    }
  }

  shutdown(reason: "app-quit" | "update-restart") {
    if (!this.options.enabled) return Promise.resolve();
    if (this.shutdownPromise) return this.shutdownPromise;
    this.shuttingDown = true;
    this.shutdownPromise = this.finishShutdown(reason);
    return this.shutdownPromise;
  }

  private async finishShutdown(reason: "app-quit" | "update-restart") {
    if (this.appPausedAt) this.appPausedMs += Date.now() - this.appPausedAt;
    this.appPausedAt = undefined;
    await this.interruptActiveSessions(reason);
    await this.enqueueEvent("app_closed", {});
    const endedAt = Math.max(this.appStartedAt, Date.now());
    await this.enqueueSummary({
      session_id: this.appSessionId,
      session_type: "app",
      app_session_id: this.appSessionId,
      started_at: new Date(this.appStartedAt).toISOString(),
      ended_at: new Date(endedAt).toISOString(),
      duration_ms: Math.min(604800000, Math.max(0, endedAt - this.appStartedAt - this.appPausedMs)),
      paused_ms: this.appPausedMs || undefined,
      finish_reason: reason,
      success_count: 0,
      mistake_count: 0,
      hint_count: 0,
      app: this.options.appMetadata
    });
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
  }

  private async enqueueEvent(eventName: TelemetryEventName, properties: Record<string, unknown>, gameSessionId?: string) {
    const payload: StoredTelemetryEvent = {
      event_id: randomUUID(),
      event_name: eventName,
      occurred_at: new Date().toISOString(),
      app_session_id: this.appSessionId,
      ...(gameSessionId ? { game_session_id: gameSessionId } : {}),
      app: this.options.appMetadata,
      properties
    };
    await this.spool.enqueue({
      id: payload.event_id,
      createdAt: Date.now(),
      kind: "event",
      priority: lowPriorityEvents.has(eventName) ? "low" : "normal",
      payload
    });
    if (!this.shuttingDown) this.requestFlush(0);
  }

  private async enqueueSummary(payload: StoredSessionSummary) {
    await this.spool.enqueue({ id: payload.session_id, createdAt: Date.now(), kind: "summary", priority: "summary", payload });
    if (!this.shuttingDown) this.requestFlush(0);
  }

  private requestFlush(delay: number) {
    if (!this.options.enabled || !this.initialized || this.shuttingDown || this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      void this.flush();
    }, delay);
    this.flushTimer.unref();
  }

  private async flush() {
    if (this.flushInProgress || this.shuttingDown) return;
    this.flushInProgress = true;
    try {
      if (!this.identity) this.identity = await this.registerInstallation();
      const batch = await this.spool.getBatch(this.identity.installationId, this.batchRecordLimit);
      if (!batch) {
        await this.enqueueDroppedNotice();
        this.retryAttempt = 0;
        return;
      }
      const response = await fetch(endpointURL(this.options.endpoint, "/v1/events"), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.identity.token}` },
        body: batch.body,
        signal: AbortSignal.timeout(15_000)
      });
      await response.body?.cancel();
      if (identityRejectionStatuses.has(response.status)) {
        this.identity = undefined;
        await rm(this.identityPath, { force: true });
        throw new Error("installation identity rejected");
      }
      if (invalidBatchStatuses.has(response.status)) {
        if (batch.recordCount > 1) {
          this.batchRecordLimit = Math.max(1, Math.floor(batch.recordCount / 2));
        } else {
          await this.spool.discard(batch.files, "invalid");
          this.batchRecordLimit = 500;
        }
        this.retryAttempt = 0;
        this.requestFlush(0);
        return;
      }
      if (!response.ok) throw new Error("metrics batch rejected");
      await this.spool.acknowledge(batch.files);
      await this.enqueueDroppedNotice();
      this.batchRecordLimit = 500;
      this.retryAttempt = 0;
      this.requestFlush(0);
    } catch {
      this.requestFlush(retryDelayMs(this.retryAttempt));
      this.retryAttempt += 1;
    } finally {
      this.flushInProgress = false;
    }
  }

  private async registerInstallation() {
    const response = await fetch(endpointURL(this.options.endpoint, "/v1/installations"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("installation registration rejected");
    }
    const body = await response.json() as { installation_id?: unknown; token?: unknown };
    if (!isUUID(body.installation_id) || typeof body.token !== "string" || body.token.length < 32 || body.token.length > 1024) throw new Error("invalid installation registration");
    const identity = { installationId: body.installation_id, token: body.token };
    await this.saveIdentity(identity);
    await this.enqueueEvent("installation_created", {});
    return identity;
  }

  private async enqueueDroppedNotice() {
    const pending = await this.spool.pendingDroppedCounts();
    for (const reason of ["capacity", "invalid"] as const) {
      const count = pending[reason];
      if (count <= 0) continue;
      await this.enqueueEvent("queue_dropped", { dropped_count: count, reason });
      await this.spool.clearPendingDroppedCount(reason, count);
    }
  }

  private trackGameEvent(event: SanitizedRendererEvent) {
    const id = event.game_session_id;
    const properties = event.properties;
    if (event.event_name === "settings_changed" && properties.setting_key === "dwell_ms" && typeof properties.number === "number") this.configuredDwellMs = properties.number;
    if (!id) return;
    if (event.event_name === "game_session_started") {
      this.activeSessions.set(id, {
        id,
        gameId: String(properties.game_id),
        startedAt: new Date().toISOString(),
        startedAtMs: Date.now(),
        mode: optionalString(properties.mode),
        category: optionalString(properties.game_category),
        pausedMs: 0,
        steps: 0,
        successes: 0,
        mistakes: 0,
        hints: 0,
        targetCancels: 0,
        difficultyChanges: 0,
        inputMethods: new Set(),
        dwellTotalMs: 0,
        dwellCount: 0,
        configuredDwellMs: this.configuredDwellMs
      });
      return;
    }
    const session = this.activeSessions.get(id);
    if (!session) return;
    const now = Date.now();
    if (event.event_name === "game_session_paused" && !session.pausedAtMs) session.pausedAtMs = now;
    if (event.event_name === "game_session_resumed" && session.pausedAtMs) {
      session.pausedMs += now - session.pausedAtMs;
      session.pausedAtMs = undefined;
    }
    const inputMethod = optionalString(properties.input_method);
    if (inputMethod) session.inputMethods.add(inputMethod);
    if (event.event_name === "success") {
      session.successes += 1;
      session.steps = Math.max(session.steps, session.successes, Number(properties.level_index));
    }
    if (event.event_name === "mistake") session.mistakes += 1;
    if (event.event_name === "hint_used") session.hints += 1;
    if (event.event_name === "target_cancelled" && properties.reason !== "disabled") session.targetCancels += 1;
    if (event.event_name === "difficulty_changed") session.difficultyChanges += 1;
    if (event.event_name === "target_clicked" && properties.input_method === "gaze" && typeof properties.elapsed_ms === "number") {
      session.dwellTotalMs += properties.elapsed_ms;
      session.dwellCount += 1;
    }
    if (event.event_name === "game_session_finished") {
      session.endedAt = new Date(now).toISOString();
      session.finishReason = String(properties.reason);
      session.result = optionalString(properties.result);
    }
    if (event.event_name === "game_session_interrupted") {
      session.endedAt = new Date(now).toISOString();
      session.interruptionReason = String(properties.reason);
      session.result = "interrupted";
    }
  }

  private createSyntheticSummary(session: ActiveGameSession): StoredSessionSummary {
    const endedAt = Math.max(session.startedAtMs, session.endedAt ? Date.parse(session.endedAt) : Date.now());
    const pausedMs = session.pausedMs + (session.pausedAtMs ? Math.max(0, endedAt - session.pausedAtMs) : 0);
    const inputMethods = [...session.inputMethods];
    return {
      session_id: session.id,
      session_type: "game",
      app_session_id: this.appSessionId,
      game_session_id: session.id,
      game_id: session.gameId,
      started_at: session.startedAt,
      ended_at: new Date(endedAt).toISOString(),
      duration_ms: Math.min(604800000, Math.max(0, endedAt - session.startedAtMs - pausedMs)),
      paused_ms: pausedMs || undefined,
      menu_mode: session.mode,
      game_category: session.category,
      input_method: inputMethods.length > 1 ? "mixed" : inputMethods[0],
      finish_reason: session.finishReason,
      steps_completed: session.steps,
      success_count: session.successes,
      mistake_count: session.mistakes,
      hint_count: session.hints,
      target_cancel_count: session.targetCancels || undefined,
      difficulty_changes: session.difficultyChanges || undefined,
      mean_dwell_ms: session.dwellCount ? session.dwellTotalMs / session.dwellCount : undefined,
      configured_dwell_ms: session.configuredDwellMs,
      result: session.result,
      interruption_reason: session.interruptionReason,
      app: this.options.appMetadata
    };
  }

  private markSummarized(id: string) {
    this.summarizedSessions.add(id);
    if (this.summarizedSessions.size > 1000) this.summarizedSessions.delete(this.summarizedSessions.values().next().value!);
  }

  private async loadIdentity(): Promise<InstallationIdentity | undefined> {
    try {
      const stored = JSON.parse(await readFile(this.identityPath, "utf8")) as { installation_id?: unknown; token?: unknown; protected?: unknown };
      if (!isUUID(stored.installation_id) || typeof stored.token !== "string") return undefined;
      if (stored.protected === true) {
        if (!safeStorage.isEncryptionAvailable()) return undefined;
        return { installationId: stored.installation_id, token: safeStorage.decryptString(Buffer.from(stored.token, "base64")) };
      }
      if (stored.protected === false) return { installationId: stored.installation_id, token: stored.token };
      return undefined;
    } catch {
      return undefined;
    }
  }

  private async saveIdentity(identity: InstallationIdentity) {
    const telemetryDirectory = join(this.options.userDataPath, "telemetry-v1");
    await mkdir(telemetryDirectory, { recursive: true, mode: 0o700 });
    await chmod(telemetryDirectory, 0o700);
    let protectedToken = safeStorage.isEncryptionAvailable();
    let token = identity.token;
    if (protectedToken) {
      try {
        token = safeStorage.encryptString(identity.token).toString("base64");
      } catch {
        protectedToken = false;
      }
    }
    const temporary = `${this.identityPath}.${randomUUID()}.tmp`;
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify({ installation_id: identity.installationId, token, protected: protectedToken }), "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    await rm(this.identityPath, { force: true });
    await rename(temporary, this.identityPath);
    await chmod(this.identityPath, 0o600);
  }
}

export function createMetricsTelemetry() {
  const platform: AppMetadata["platform"] = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "macos" : "linux";
  const version = safeValue(app.getVersion());
  return new MetricsTelemetry({
    enabled: isTelemetryEnabled(app.isPackaged),
    endpoint: process.env.LINKA_METRICS_URL ?? defaultEndpoint,
    userDataPath: app.getPath("userData"),
    appMetadata: {
      version,
      build: version,
      platform,
      os_version: safeValue(release()),
      locale: safeValue(app.getLocale())
    }
  });
}

function endpointURL(base: string, path: string) {
  const url = new URL(base);
  if (!oneOf(url.protocol, "https:", "http:") || url.username || url.password) throw new Error("invalid metrics endpoint");
  url.pathname = `${url.pathname.replace(/\/$/, "")}${path}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function safeValue(value: string) {
  const normalized = value.replace(/[^A-Za-z0-9._:+-]+/g, "-").replace(/^[^A-Za-z0-9]+/, "").slice(0, 96);
  return normalized || "unknown";
}

function normalizeErrorConstructor(error: unknown) {
  if (error && typeof error === "object" && "constructor" in error) {
    const constructor = (error as { constructor?: { name?: unknown } }).constructor;
    if (constructor && typeof constructor.name === "string") return safeValue(constructor.name);
  }
  return typeof error === "string" ? "String" : safeValue(typeof error);
}

function isUUID(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function oneOf<T extends string>(value: string, ...allowed: T[]): value is T {
  return allowed.includes(value as T);
}

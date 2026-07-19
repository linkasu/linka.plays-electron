import { createHash, randomUUID } from "crypto";
import { app } from "electron";
import { rm } from "fs/promises";
import { release } from "os";
import { join } from "path";
import { PublicInstallationIdentityClient, TelemetryDeniedError, type TelemetryRequest } from "./identity";
import { isTelemetryEnabled, retryDelayMs } from "./policy";
import { sanitizeRendererSessionSummary, sanitizeRendererTelemetryEvent, toStoredGameSummary } from "./sanitizer";
import { FileTelemetrySpool } from "./spool";
import type { AppMetadata, SanitizedRendererEvent, StoredSessionSummary, StoredTelemetryEvent, TelemetryEventName } from "./types";
import { shouldQueueV2Event } from "./v2";

const defaultMetricsEndpoint = "https://metrics.nkolinka.ru";
const defaultIdentityEndpoint = "https://api.identity.linka.su";
const defaultPolicyVersion = "2026-07-19-v3";
const lowPriorityEvents = new Set<TelemetryEventName>(["level_entered", "level_cancelled", "level_clicked", "target_entered", "target_cancelled", "target_clicked", "success", "mistake", "hint_used", "difficulty_changed"]);

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
  metricsEndpoint: string;
  identityEndpoint: string;
  policyVersion: string;
  userDataPath: string;
  appMetadata: AppMetadata;
};

export class MetricsTelemetry {
  readonly appSessionId = randomUUID();
  private readonly spool: FileTelemetrySpool;
  private readonly telemetryDirectory: string;
  private readonly identityClient: PublicInstallationIdentityClient;
  private appStartedAt = 0;
  private initialized = false;
  private collectionEnabled = true;
  private flushTimer?: NodeJS.Timeout;
  private flushPromise?: Promise<void>;
  private pendingFlushDelay?: number;
  private flushInProgress = false;
  private requestController?: AbortController;
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
    this.telemetryDirectory = join(options.userDataPath, "telemetry-v1");
    this.spool = new FileTelemetrySpool(join(this.telemetryDirectory, "spool"));
    this.identityClient = new PublicInstallationIdentityClient({ directory: this.telemetryDirectory, endpoint: options.identityEndpoint, platform: options.appMetadata.platform, policyVersion: options.policyVersion });
  }

  async initialize() {
    if (!this.options.enabled || !this.collectionEnabled || this.initialized) return;
    await this.spool.initialize();
    if (!this.collectionEnabled) return;
    this.appStartedAt = Date.now();
    this.initialized = true;
    try {
      await this.recordInternalEvent("app_started", {});
    } catch (error) {
      this.initialized = false;
      throw error;
    }
    this.requestFlush(0);
  }

  recordRendererEvent(input: unknown) {
    if (!this.acceptsEvents()) return false;
    const sanitized = sanitizeRendererTelemetryEvent(input);
    if (!sanitized) return false;
    if (sanitized.game_session_id && this.summarizedSessions.has(sanitized.game_session_id)) return true;
    this.trackGameEvent(sanitized);
    if (sanitized.event_name === "target_cancelled" && sanitized.properties.reason === "disabled") return true;
    void this.enqueueEvent(sanitized.event_name, this.enrichGameProperties(sanitized), sanitized.game_session_id).catch(() => undefined);
    return true;
  }

  recordRendererSummary(input: unknown) {
    if (!this.acceptsEvents()) return false;
    const sanitized = sanitizeRendererSessionSummary(input);
    if (!sanitized || this.summarizedSessions.has(sanitized.gameSessionId)) return Boolean(sanitized);
    const finalization = this.sessionFinalization.then(async () => {
      if (!this.acceptsEvents()) return;
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
    if (!this.acceptsEvents()) return;
    await this.enqueueEvent(eventName, properties, gameSessionId);
  }

  recordUpdaterState(state: "idle" | "checking" | "available" | "downloading" | "downloaded" | "installing" | "error", version?: string) {
    if (!this.acceptsEvents() || this.lastUpdaterState === state) return;
    this.lastUpdaterState = state;
    void this.recordInternalEvent("updater_state_changed", { state, ...(version ? { version: safeValue(version) } : {}) }).catch(() => undefined);
  }

  setAppForeground(foreground: boolean) {
    if (!this.acceptsEvents() || foreground === this.appForeground) return;
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
    if (!this.acceptsEvents()) return;
    const constructorName = normalizeErrorConstructor(error);
    const fingerprint = `sha256:${createHash("sha256").update(`${component}:${constructorName}`).digest("hex")}`;
    void this.recordInternalEvent("error", { fingerprint, component: safeValue(component) }).catch(() => undefined);
  }

  interruptActiveSessions(reason: "route-leave" | "window-close" | "app-quit" | "update-restart" | "renderer-crash") {
    if (!this.isActive()) return Promise.resolve();
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
    if (!this.isActive()) return Promise.resolve();
    if (this.shutdownPromise) return this.shutdownPromise;
    this.shuttingDown = true;
    this.requestController?.abort();
    this.shutdownPromise = this.finishShutdown(reason);
    return this.shutdownPromise;
  }

  stopCollection() {
    this.collectionEnabled = false;
    this.initialized = false;
    this.shuttingDown = true;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    this.pendingFlushDelay = undefined;
    this.requestController?.abort();
  }

  async disableAndClear() {
    this.stopCollection();
    this.activeSessions.clear();
    this.summarizedSessions.clear();
    await this.sessionFinalization.catch(() => undefined);
    await this.flushPromise?.catch(() => undefined);
    await this.spool.clear();
    const denied = await this.identityClient.deny((input, init) => this.requestJSON(input, init)).catch(() => false);
    if (!denied) throw new Error("telemetry denial was not delivered");
    await rm(this.telemetryDirectory, { recursive: true, force: true });
  }

  private async finishShutdown(reason: "app-quit" | "update-restart") {
    if (this.appPausedAt) this.appPausedMs += Date.now() - this.appPausedAt;
    this.appPausedAt = undefined;
    await this.interruptActiveSessions(reason);
    await this.enqueueEvent("app_closed", {});
    const endedAt = Math.max(this.appStartedAt, Date.now());
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
  }

  private async enqueueEvent(eventName: TelemetryEventName, properties: Record<string, unknown>, gameSessionId?: string) {
    if (!shouldQueueV2Event(eventName)) return;
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
    if (!this.acceptsEvents()) return;
    if (this.flushPromise) {
      this.pendingFlushDelay = this.pendingFlushDelay === undefined ? delay : Math.min(this.pendingFlushDelay, delay);
      return;
    }
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      const flush = this.flush();
      this.flushPromise = flush;
      void flush.finally(() => {
        if (this.flushPromise !== flush) return;
        this.flushPromise = undefined;
        const nextDelay = this.pendingFlushDelay;
        this.pendingFlushDelay = undefined;
        if (nextDelay !== undefined) this.requestFlush(nextDelay);
      });
    }, delay);
    this.flushTimer.unref();
  }

  private async flush() {
    if (this.flushInProgress || !this.acceptsEvents()) return;
    this.flushInProgress = true;
    try {
      const identity = await this.identityClient.getAccess((input, init) => this.requestJSON(input, init));
      if (!this.acceptsEvents()) return;
      const batch = await this.spool.getBatch(identity.installationKey, this.batchRecordLimit);
      if (!this.acceptsEvents()) return;
      if (!batch) {
        await this.enqueueDroppedNotice();
        this.retryAttempt = 0;
        return;
      }
      const response = await this.requestWithTimeout(endpointURL(this.options.metricsEndpoint, "/v2/batches"), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${identity.accessToken!.token}`, "idempotency-key": batch.batchId },
        body: batch.body
      }, async (result) => {
        const body = await readJSON(result);
        return { ok: result.ok, status: result.status, body };
      });
      if (!this.acceptsEvents()) return;
      if (response.status === 401) {
        await this.identityClient.invalidateAccess();
        this.retryAttempt = 0;
        this.requestFlush(0);
        return;
      }
      if (response.status === 403 && isErrorCode(response.body, "telemetry_suppressed")) throw new TelemetryDeniedError();
      if (response.status === 413) {
        if (batch.recordCount > 1) {
          this.batchRecordLimit = Math.max(1, Math.floor(batch.recordCount / 2));
          await this.spool.releaseBatch();
          this.retryAttempt = 0;
          this.requestFlush(0);
          return;
        }
        throw new Error("single-record metrics batch rejected as too large");
      }
      if (response.status !== 202 || !isBatchAcknowledgement(response.body, batch.batchId, batch.recordCount)) throw new Error("metrics batch rejected");
      await this.spool.acknowledge(batch.files);
      await this.enqueueDroppedNotice();
      this.batchRecordLimit = 500;
      this.retryAttempt = 0;
      this.requestFlush(0);
    } catch (error) {
      if (error instanceof TelemetryDeniedError) {
        this.collectionEnabled = false;
        this.initialized = false;
        await this.spool.clear();
        return;
      }
      this.requestFlush(retryDelayMs(this.retryAttempt));
      this.retryAttempt += 1;
    } finally {
      this.flushInProgress = false;
    }
  }

  private requestJSON(input: string, init: RequestInit) {
    return this.requestWithTimeout(input, init, async (response) => ({ ok: response.ok, status: response.status, body: await readJSON(response) }));
  }

  private async requestWithTimeout<Result>(input: string, init: RequestInit, consume: (response: Response) => Promise<Result>) {
    const controller = new AbortController();
    this.requestController = controller;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    timeout.unref();
    const aborted = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener("abort", () => reject(abortError()), { once: true });
    });
    const operation = (async () => consume(await fetch(input, { ...init, signal: controller.signal })))();
    void operation.catch(() => undefined);
    try {
      return await Promise.race([operation, aborted]);
    } finally {
      clearTimeout(timeout);
      if (this.requestController === controller) this.requestController = undefined;
    }
  }

  private async enqueueDroppedNotice() {
    const pending = await this.spool.pendingDroppedCounts();
    for (const reason of ["capacity", "expired", "invalid"] as const) {
      let remaining = pending[reason];
      while (remaining > 0) {
        const count = Math.min(1_000_000, remaining);
        await this.enqueueEvent("queue_dropped", { dropped_count: count, reason });
        await this.spool.clearPendingDroppedCount(reason, count);
        remaining -= count;
      }
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

  private enrichGameProperties(event: SanitizedRendererEvent) {
    if (!event.game_session_id) return event.properties;
    const session = this.activeSessions.get(event.game_session_id);
    if (!session) return event.properties;
    const methods = [...session.inputMethods];
    return {
      ...event.properties,
      game_category: event.properties.game_category ?? session.category,
      input_method: event.properties.input_method ?? (methods.length > 1 ? "mixed" : methods[0] ?? "unknown")
    };
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

  private isActive() {
    return this.options.enabled && this.collectionEnabled && this.initialized;
  }

  private acceptsEvents() {
    return this.isActive() && !this.shuttingDown;
  }
}

export async function clearMetricsTelemetryData(userDataPath: string, preference: "unknown" | "disabled" = "unknown") {
  const directory = join(userDataPath, "telemetry-v1");
  if (preference === "unknown") {
    await rm(directory, { recursive: true, force: true });
    return;
  }
  const identity = new PublicInstallationIdentityClient({ directory, endpoint: process.env.LINKA_IDENTITY_URL ?? defaultIdentityEndpoint, platform: currentPlatform(), policyVersion: defaultPolicyVersion });
  await rm(join(directory, "spool"), { recursive: true, force: true });
  const denied = await identity.deny(standaloneJSONRequest).catch(() => false);
  if (!denied) throw new Error("telemetry denial was not delivered");
  await rm(directory, { recursive: true, force: true });
}

export function createMetricsTelemetry() {
  const platform = currentPlatform();
  const version = safeValue(app.getVersion());
  return new MetricsTelemetry({
    enabled: isTelemetryEnabled(app.isPackaged),
    metricsEndpoint: process.env.LINKA_METRICS_URL ?? defaultMetricsEndpoint,
    identityEndpoint: process.env.LINKA_IDENTITY_URL ?? defaultIdentityEndpoint,
    policyVersion: defaultPolicyVersion,
    userDataPath: app.getPath("userData"),
    appMetadata: {
      version,
      build: version,
      platform,
      os_version: safeValue(release()),
      locale: normalizeLocale(app.getLocale())
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

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function oneOf<T extends string>(value: string, ...allowed: T[]): value is T {
  return allowed.includes(value as T);
}

function abortError() {
  const error = new Error("telemetry request aborted");
  error.name = "AbortError";
  return error;
}

function currentPlatform(): AppMetadata["platform"] {
  return process.platform === "win32" ? "windows" : process.platform === "darwin" ? "macos" : "linux";
}

function normalizeLocale(locale: string) {
  return locale === "ru" || locale === "ru-RU" || locale === "en" || locale === "en-US" ? locale : "other";
}

function isErrorCode(value: unknown, code: string) {
  return typeof value === "object" && value !== null && "error" in value && (value as { error?: unknown }).error === code;
}

function isBatchAcknowledgement(value: unknown, batchId: string, recordCount: number) {
  return typeof value === "object" && value !== null && "batch_id" in value && "accepted_records" in value && "replayed" in value &&
    (value as { batch_id?: unknown }).batch_id === batchId && (value as { accepted_records?: unknown }).accepted_records === recordCount && typeof (value as { replayed?: unknown }).replayed === "boolean";
}

async function readJSON(response: Response) {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

const standaloneJSONRequest: TelemetryRequest = async (input, init) => {
  const response = await fetch(input, { ...init, signal: AbortSignal.timeout(15_000) });
  return { ok: response.ok, status: response.status, body: await readJSON(response) };
};

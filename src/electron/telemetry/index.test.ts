import { randomUUID } from "crypto";
import { mkdtemp, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MetricsTelemetry } from ".";
import { FileTelemetrySpool } from "./spool";
import type { AppMetadata } from "./types";

vi.mock("electron", () => ({
  app: {},
  safeStorage: { isEncryptionAvailable: () => false }
}));

const directories: string[] = [];
const appMetadata: AppMetadata = { version: "1.0.0", build: "1.0.0", platform: "linux", os_version: "1.0", locale: "ru-RU" };
const installationKey = "a".repeat(64);
const refreshToken = "refresh." + "r".repeat(120);
const accessToken = "access." + "a".repeat(120);
const realSetTimeout = globalThis.setTimeout;

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createTelemetry() {
  const userDataPath = await mkdtemp(join(tmpdir(), "linka-metrics-client-"));
  directories.push(userDataPath);
  return {
    userDataPath,
    telemetry: new MetricsTelemetry({ enabled: true, metricsEndpoint: "https://metrics.example.test", identityEndpoint: "https://identity.example.test", policyVersion: "2026-07-19-v3", userDataPath, appMetadata })
  };
}

async function readRecords(userDataPath: string) {
  const spool = new FileTelemetrySpool(join(userDataPath, "telemetry-v1", "spool"));
  await spool.initialize();
  return spool.listRecords();
}

describe("MetricsTelemetry lifecycle", () => {
  it("serializes renderer summary before interruption finalization", async () => {
    vi.useFakeTimers();
    const { telemetry, userDataPath } = await createTelemetry();
    await telemetry.initialize();
    const gameSessionId = randomUUID();
    telemetry.recordRendererEvent({
      eventName: "game_session_started",
      gameSessionId,
      properties: { gameId: "aquarium", gameCategory: "gaze-basics" }
    });
    telemetry.recordRendererSummary({
      gameSessionId,
      gameId: "aquarium",
      startedAt: "2026-07-18T10:00:00.000Z",
      endedAt: "2026-07-18T10:00:10.000Z",
      durationMs: 10000,
      successCount: 1,
      mistakeCount: 0,
      hintCount: 0,
      result: "completed"
    });

    await telemetry.interruptActiveSessions("app-quit");

    const records = await readRecords(userDataPath);
    expect(records.filter((record) => record.kind === "summary")).toHaveLength(1);
    expect(records.some((record) => record.kind === "event" && "event_name" in record.payload && record.payload.event_name === "game_session_interrupted")).toBe(false);
  });

  it("shares one shutdown and writes one app close event", async () => {
    vi.useFakeTimers();
    const { telemetry, userDataPath } = await createTelemetry();
    await telemetry.initialize();

    const first = telemetry.shutdown("app-quit");
    const second = telemetry.shutdown("update-restart");
    expect(second).toBe(first);
    expect(telemetry.recordRendererEvent({ eventName: "page_viewed", properties: { page: "start" } })).toBe(false);
    expect(telemetry.recordRendererSummary({
      gameSessionId: randomUUID(),
      gameId: "aquarium",
      startedAt: "2026-07-18T10:00:00.000Z",
      endedAt: "2026-07-18T10:00:10.000Z",
      durationMs: 10000,
      successCount: 1,
      mistakeCount: 0,
      hintCount: 0
    })).toBe(false);
    await first;

    const records = await readRecords(userDataPath);
    expect(records.filter((record) => record.kind === "summary" && "session_type" in record.payload && record.payload.session_type === "app")).toHaveLength(0);
    expect(records.filter((record) => record.kind === "event" && "event_name" in record.payload && record.payload.event_name === "app_closed")).toHaveLength(1);
  });

  it("does not create telemetry storage before initialization", async () => {
    const { telemetry, userDataPath } = await createTelemetry();

    expect(telemetry.recordRendererEvent({ eventName: "page_viewed", properties: { page: "start" } })).toBe(false);
    await expect(stat(join(userDataPath, "telemetry-v1"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("stops collection and clears queued data when disabled", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { telemetry, userDataPath } = await createTelemetry();
    await telemetry.initialize();
    telemetry.recordRendererEvent({ eventName: "page_viewed", properties: { page: "start" } });

    await telemetry.disableAndClear();

    expect(telemetry.recordRendererEvent({ eventName: "page_viewed", properties: { page: "start" } })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(stat(join(userDataPath, "telemetry-v1"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("aborts a request whose response body hangs when telemetry is disabled", async () => {
    vi.useFakeTimers();
    let requestCount = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      requestCount += 1;
      if (requestCount === 1) return hangingRegistrationResponse();
      if (String(input).endsWith("/v1/public/installations")) return registrationResponse();
      return new Response(JSON.stringify({ installation_key: installationKey, product: "linka-plays", preference: "denied", policy_version: "2026-07-19-v3", recorded_at: new Date().toISOString() }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { telemetry, userDataPath } = await createTelemetry();
    await telemetry.initialize();
    const flush = (telemetry as unknown as { flush: () => Promise<void> }).flush();
    await waitForFetch(fetchMock);
    expect(fetchMock).toHaveBeenCalledOnce();

    await expect(telemetry.disableAndClear()).resolves.toBeUndefined();
    await expect(flush).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await expect(stat(join(userDataPath, "telemetry-v1"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not wait for a hanging events response body when disabled", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith("/v1/public/installations")) {
        return registrationResponse();
      }
      if (String(input).endsWith("/v1/public/installations/telemetry-preference")) {
        return new Response(JSON.stringify({ installation_key: installationKey, product: "linka-plays", preference: "denied", policy_version: "2026-07-19-v3", recorded_at: new Date().toISOString() }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      return hangingEventsResponse();
    });
    vi.stubGlobal("fetch", fetchMock);
    const { telemetry } = await createTelemetry();
    await telemetry.initialize();
    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await expect(telemetry.disableAndClear()).resolves.toBeUndefined();
  });

  it("aborts a hanging response body and completes shutdown", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => hangingRegistrationResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { telemetry } = await createTelemetry();
    await telemetry.initialize();
    const flush = (telemetry as unknown as { flush: () => Promise<void> }).flush();
    await waitForFetch(fetchMock);
    expect(fetchMock).toHaveBeenCalledOnce();

    await expect(telemetry.shutdown("app-quit")).resolves.toBeUndefined();
    await expect(flush).resolves.toBeUndefined();
  });

  it("keeps the HTTP timeout active while reading the response body", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => hangingRegistrationResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { telemetry } = await createTelemetry();
    await telemetry.initialize();
    const flush = (telemetry as unknown as { flush: () => Promise<void> }).flush();
    await waitForFetch(fetchMock);
    expect(fetchMock).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(15_000);
    await expect(flush).resolves.toBeUndefined();
  });

  it("splits a rejected oversized batch without discarding records", async () => {
    vi.useFakeTimers();
    const eventBodies: Array<{ batch_id: string; records: Array<{ kind: string }> }> = [];
    let eventRequest = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/public/installations")) {
        return registrationResponse();
      }
      if (url.endsWith("/v2/batches")) {
        const batch = JSON.parse(String(init?.body)) as { batch_id: string; records: Array<{ kind: string }> };
        eventBodies.push(batch);
        eventRequest += 1;
        return eventRequest === 1
          ? new Response(JSON.stringify({ error: "body_too_large" }), { status: 413 })
          : batchResponse(batch);
      }
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { telemetry } = await createTelemetry();

    await telemetry.initialize();
    telemetry.recordRendererEvent({ eventName: "page_viewed", properties: { page: "start" } });
    const flush = () => (telemetry as unknown as { flush: () => Promise<void> }).flush();
    await flush();
    await flush();
    await flush();

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain("https://metrics.example.test/v2/batches");
    expect(eventBodies.map((body) => body.records.length)).toEqual([2, 1, 1]);
    expect(eventBodies[1].batch_id).not.toBe(eventBodies[0].batch_id);
    await telemetry.shutdown("app-quit");
  });

  it.each([400, 409, 422, 202])("preserves the exact batch after ambiguous HTTP %s", async (status) => {
    vi.useFakeTimers();
    const bodies: string[] = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).endsWith("/v1/public/installations")) return registrationResponse();
      if (String(input).endsWith("/v2/batches")) {
        bodies.push(String(init?.body));
        return status === 202
          ? new Response(JSON.stringify({ batch_id: randomUUID(), accepted_records: 2, replayed: false }), { status })
          : new Response(JSON.stringify({ error: "ambiguous_rejection" }), { status });
      }
      throw new Error(`unexpected request: ${input}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { telemetry, userDataPath } = await createTelemetry();
    await telemetry.initialize();
    telemetry.recordRendererEvent({ eventName: "page_viewed", properties: { page: "start" } });
    const flush = () => (telemetry as unknown as { flush: () => Promise<void> }).flush();

    await flush();
    await flush();

    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toBe(bodies[0]);
    expect(await readRecords(userDataPath)).toHaveLength(2);
    await telemetry.shutdown("app-quit");
  });
});

function hangingRegistrationResponse() {
  return {
    ok: true,
    status: 201,
    text: () => new Promise<never>(() => undefined)
  } as unknown as Response;
}

function hangingEventsResponse() {
  return {
    ok: true,
    status: 202,
    text: () => new Promise<never>(() => undefined)
  } as unknown as Response;
}

function registrationResponse() {
  return new Response(JSON.stringify({
    installation_key: installationKey,
    product: "linka-plays",
    platform: "linux",
    preference: "allowed",
    policy_version: "2026-07-19-v3",
    recorded_at: new Date().toISOString(),
    refresh_token: refreshToken,
    refresh_expires_at: new Date(Date.now() + 86400000).toISOString(),
    metrics_token: { access_token: accessToken, token_type: "Bearer", expires_at: new Date(Date.now() + 300000).toISOString() }
  }), { status: 201, headers: { "content-type": "application/json" } });
}

function batchResponse(batch: { batch_id: string; records: unknown[] }) {
  return new Response(JSON.stringify({ batch_id: batch.batch_id, accepted_records: batch.records.length, replayed: false }), { status: 202 });
}

async function waitForFetch(mock: { mock: { calls: unknown[][] } }) {
  for (let attempt = 0; attempt < 100 && mock.mock.calls.length === 0; attempt += 1) {
    await new Promise<void>((resolve) => realSetTimeout(resolve, 10));
  }
  if (mock.mock.calls.length === 0) throw new Error("fetch was not called");
}

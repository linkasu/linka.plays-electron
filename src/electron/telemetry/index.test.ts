import { randomUUID } from "crypto";
import { mkdtemp, rm } from "fs/promises";
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
    telemetry: new MetricsTelemetry({ enabled: true, endpoint: "https://example.test", userDataPath, appMetadata })
  };
}

async function readRecords(userDataPath: string) {
  const spool = new FileTelemetrySpool(join(userDataPath, "telemetry-v1", "spool"));
  await spool.initialize();
  return spool.listRecords();
}

describe("MetricsTelemetry lifecycle", () => {
  it("serializes renderer summary before interruption finalization", async () => {
    const { telemetry, userDataPath } = await createTelemetry();
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

  it("shares one shutdown and writes one app summary", async () => {
    const { telemetry, userDataPath } = await createTelemetry();

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
    expect(records.filter((record) => record.kind === "summary" && "session_type" in record.payload && record.payload.session_type === "app")).toHaveLength(1);
    expect(records.filter((record) => record.kind === "event" && "event_name" in record.payload && record.payload.event_name === "app_closed")).toHaveLength(1);
  });

  it.each([400, 413, 422])("isolates one invalid record after HTTP %s and continues delivery", async (rejectionStatus) => {
    vi.useFakeTimers();
    const installationId = randomUUID();
    const eventBodies: Array<{ events: Array<{ event_name: string }> }> = [];
    let eventRequest = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/installations")) {
        return new Response(JSON.stringify({ installation_id: installationId, token: "a".repeat(64) }), {
          status: 201,
          headers: { "content-type": "application/json" }
        });
      }
      if (url.endsWith("/v1/events")) {
        eventBodies.push(JSON.parse(String(init?.body)) as { events: Array<{ event_name: string }> });
        eventRequest += 1;
        return new Response(null, { status: eventRequest <= 2 ? rejectionStatus : 202 });
      }
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { telemetry } = await createTelemetry();

    await telemetry.initialize();
    const flush = () => (telemetry as unknown as { flush: () => Promise<void> }).flush();
    await flush();
    await flush();
    await flush();
    await flush();

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain("https://example.test/v1/events");
    expect(eventBodies).toHaveLength(4);
    expect(eventBodies.slice(0, 3).map((body) => body.events.length)).toEqual([2, 1, 1]);
    expect(eventBodies[3].events[0]?.event_name).toBe("queue_dropped");
    await telemetry.shutdown("app-quit");
  });
});

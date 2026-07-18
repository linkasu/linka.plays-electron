import { randomUUID } from "crypto";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { FileTelemetrySpool } from "./spool";
import type { AppMetadata, SpoolRecord, StoredTelemetryEvent } from "./types";

const directories: string[] = [];
const app: AppMetadata = { version: "1.0.0", build: "1.0.0", platform: "linux", os_version: "1.0", locale: "ru-RU" };

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function makeEvent(createdAt: number, priority: SpoolRecord["priority"] = "low"): SpoolRecord {
  const payload: StoredTelemetryEvent = {
    event_id: randomUUID(),
    event_name: "page_viewed",
    occurred_at: "2026-07-18T10:00:00.000Z",
    app_session_id: randomUUID(),
    app,
    properties: { page: `page-${createdAt}-${"a".repeat(80)}` }
  };
  return { id: payload.event_id, createdAt, kind: "event", priority, payload };
}

describe("FileTelemetrySpool", () => {
  it("persists records across instances and acknowledges only sent files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "linka-metrics-"));
    directories.push(directory);
    const first = new FileTelemetrySpool(directory);
    await first.initialize();
    await first.enqueue(makeEvent(1));
    await first.enqueue(makeEvent(2));

    const second = new FileTelemetrySpool(directory);
    await second.initialize();
    const batch = await second.getBatch(randomUUID(), 1);
    expect(batch?.recordCount).toBe(1);
    await second.acknowledge(batch?.files ?? []);
    expect(await second.listRecords()).toHaveLength(1);
  });

  it("drops old low-priority events before summaries at capacity", async () => {
    const directory = await mkdtemp(join(tmpdir(), "linka-metrics-"));
    directories.push(directory);
    const spool = new FileTelemetrySpool(directory, 1000);
    await spool.initialize();
    await spool.enqueue(makeEvent(1, "low"));
    const summary: SpoolRecord = {
      id: randomUUID(),
      createdAt: 2,
      kind: "summary",
      priority: "summary",
      payload: {
        session_id: randomUUID(), session_type: "app", app_session_id: randomUUID(), started_at: "2026-07-18T10:00:00.000Z", ended_at: "2026-07-18T10:00:01.000Z",
        duration_ms: 1000, success_count: 0, mistake_count: 0, hint_count: 0, app
      }
    };
    await spool.enqueue(summary);
    for (let index = 3; index < 9; index += 1) await spool.enqueue(makeEvent(index, "low"));

    const records = await spool.listRecords();
    expect(records.some((record) => record.kind === "summary")).toBe(true);
    expect(await spool.pendingDroppedCount()).toBeGreaterThan(0);
  });

  it("never exceeds the backend batch record or byte limits", async () => {
    const directory = await mkdtemp(join(tmpdir(), "linka-metrics-"));
    directories.push(directory);
    const spool = new FileTelemetrySpool(directory);
    await spool.initialize();
    for (let index = 0; index < 510; index += 1) await spool.enqueue(makeEvent(index));

    const batch = await spool.getBatch(randomUUID());
    expect(batch?.recordCount).toBe(500);
    expect(Buffer.byteLength(batch?.body ?? "", "utf8")).toBeLessThanOrEqual(512 * 1024);
  }, 15000);

  it("counts permanently rejected records and unblocks the next record", async () => {
    const directory = await mkdtemp(join(tmpdir(), "linka-metrics-"));
    directories.push(directory);
    const spool = new FileTelemetrySpool(directory);
    await spool.initialize();
    await spool.enqueue(makeEvent(1));
    await spool.enqueue(makeEvent(2));

    const first = await spool.getBatch(randomUUID(), 1);
    await spool.discard(first?.files ?? [], "invalid");

    expect((await spool.getBatch(randomUUID(), 1))?.recordCount).toBe(1);
    expect(await spool.pendingDroppedCounts()).toEqual({ capacity: 0, invalid: 1 });
  });
});

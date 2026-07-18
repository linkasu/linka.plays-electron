import { randomUUID } from "crypto";
import { chmod, mkdir, open, readFile, readdir, rename, rm, stat } from "fs/promises";
import { join } from "path";
import type { SpoolRecord, StoredSessionSummary, StoredTelemetryEvent } from "./types";

const recordSuffix = ".record.json";
const pendingDropsFile = "pending-drops.json";
type DropReason = "capacity" | "invalid";
type PendingDrops = Record<DropReason, number>;

export type TelemetryBatch = {
  schema_version: 1;
  events: Array<StoredTelemetryEvent & { installation_id: string }>;
  session_summaries?: Array<StoredSessionSummary & { installation_id: string }>;
};

export type SpoolBatch = {
  body: string;
  files: string[];
  recordCount: number;
};

export class FileTelemetrySpool {
  private operation = Promise.resolve();
  private totalBytes?: number;

  constructor(private readonly directory: string, private readonly capBytes = 200 * 1024 * 1024) {}

  initialize() {
    return this.exclusive(async () => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      await chmod(this.directory, 0o700);
      const entries = await readdir(this.directory);
      await Promise.all(entries.filter((name) => name.endsWith(".tmp")).map((name) => rm(join(this.directory, name), { force: true })));
      this.totalBytes = await this.calculateRecordBytes();
    });
  }

  enqueue(record: SpoolRecord) {
    return this.exclusive(async () => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const fileName = `${String(record.createdAt).padStart(13, "0")}-${randomUUID()}-${record.kind}-${record.priority}${recordSuffix}`;
      const contents = JSON.stringify(record);
      await this.atomicWrite(fileName, contents);
      if (this.totalBytes === undefined) this.totalBytes = await this.calculateRecordBytes();
      else this.totalBytes += Buffer.byteLength(contents, "utf8");
      return this.enforceCapacity();
    });
  }

  getBatch(installationId: string, maxRecords = 500, maxBytes = 512 * 1024) {
    return this.exclusive(async (): Promise<SpoolBatch | undefined> => {
      const files = (await readdir(this.directory)).filter((name) => name.endsWith(recordSuffix)).sort();
      const selected: string[] = [];
      const events: TelemetryBatch["events"] = [];
      const summaries: NonNullable<TelemetryBatch["session_summaries"]> = [];

      for (const fileName of files) {
        if (selected.length >= maxRecords) break;
        const record = await this.readRecord(fileName);
        if (!record) continue;
        const nextEvents = record.kind === "event" ? [...events, { ...(record.payload as StoredTelemetryEvent), installation_id: installationId }] : events;
        const nextSummaries = record.kind === "summary" ? [...summaries, { ...(record.payload as StoredSessionSummary), installation_id: installationId }] : summaries;
        const body = JSON.stringify({ schema_version: 1, events: nextEvents, ...(nextSummaries.length ? { session_summaries: nextSummaries } : {}) });
        if (Buffer.byteLength(body, "utf8") > maxBytes) break;
        selected.push(fileName);
        if (record.kind === "event") events.push(nextEvents.at(-1)!);
        else summaries.push(nextSummaries.at(-1)!);
      }

      if (selected.length === 0) return undefined;
      const batch: TelemetryBatch = { schema_version: 1, events, ...(summaries.length ? { session_summaries: summaries } : {}) };
      return { body: JSON.stringify(batch), files: selected, recordCount: selected.length };
    });
  }

  acknowledge(files: string[]) {
    return this.exclusive(() => this.removeFiles(files));
  }

  discard(files: string[], reason: DropReason) {
    return this.exclusive(async () => {
      await this.removeFiles(files);
      await this.addPendingDrops(reason, files.length);
    });
  }

  pendingDroppedCount() {
    return this.exclusive(async () => {
      const pending = await this.readPendingDrops();
      return pending.capacity + pending.invalid;
    });
  }

  pendingDroppedCounts() {
    return this.exclusive(() => this.readPendingDrops());
  }

  clearPendingDroppedCount(reason: DropReason, count: number) {
    return this.exclusive(async () => {
      const pending = await this.readPendingDrops();
      pending[reason] = Math.max(0, pending[reason] - count);
      await this.writePendingDrops(pending);
    });
  }

  listRecords() {
    return this.exclusive(async () => {
      const files = (await readdir(this.directory)).filter((name) => name.endsWith(recordSuffix)).sort();
      const records = await Promise.all(files.map((fileName) => this.readRecord(fileName)));
      return records.filter((record): record is SpoolRecord => Boolean(record));
    });
  }

  clear() {
    return this.exclusive(async () => {
      await rm(this.directory, { recursive: true, force: true });
      this.totalBytes = 0;
    });
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const result = this.operation.then(task, task);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }

  private async enforceCapacity() {
    if (this.totalBytes === undefined) this.totalBytes = await this.calculateRecordBytes();
    if (this.totalBytes <= this.capBytes) return 0;
    const entries = (await readdir(this.directory)).filter((name) => name.endsWith(recordSuffix));
    const files = await Promise.all(entries.map(async (name) => ({ name, size: (await stat(join(this.directory, name))).size })));

    const ordered = files.sort((left, right) => {
      const rank = (name: string) => name.includes("-low.record.json") ? 0 : name.includes("-normal.record.json") ? 1 : 2;
      return rank(left.name) - rank(right.name) || left.name.localeCompare(right.name);
    });
    let dropped = 0;
    for (const file of ordered) {
      if (this.totalBytes <= this.capBytes) break;
      await rm(join(this.directory, file.name), { force: true });
      this.totalBytes -= file.size;
      dropped += 1;
    }
    if (dropped > 0) await this.addPendingDrops("capacity", dropped);
    return dropped;
  }

  private async removeFiles(files: string[]) {
    for (const fileName of files) {
      const size = await this.fileSize(fileName);
      await rm(join(this.directory, fileName), { force: true });
      if (this.totalBytes !== undefined) this.totalBytes = Math.max(0, this.totalBytes - size);
    }
  }

  private async readRecord(fileName: string) {
    try {
      const parsed = JSON.parse(await readFile(join(this.directory, fileName), "utf8")) as SpoolRecord;
      if (!parsed || (parsed.kind !== "event" && parsed.kind !== "summary") || typeof parsed.id !== "string") throw new Error("invalid spool record");
      return parsed;
    } catch {
      const size = await this.fileSize(fileName);
      await rm(join(this.directory, fileName), { force: true });
      if (this.totalBytes !== undefined) this.totalBytes = Math.max(0, this.totalBytes - size);
      await this.addPendingDrops("invalid", 1);
      return undefined;
    }
  }

  private async readPendingDrops() {
    try {
      const parsed = JSON.parse(await readFile(join(this.directory, pendingDropsFile), "utf8")) as Partial<PendingDrops>;
      return {
        capacity: validCount(parsed.capacity),
        invalid: validCount(parsed.invalid)
      };
    } catch {
      return { capacity: 0, invalid: 0 };
    }
  }

  private async writePendingDrops(pending: PendingDrops) {
    if (pending.capacity <= 0 && pending.invalid <= 0) {
      await rm(join(this.directory, pendingDropsFile), { force: true });
      return;
    }
    await this.atomicWrite(pendingDropsFile, JSON.stringify(pending));
  }

  private async addPendingDrops(reason: DropReason, count: number) {
    const pending = await this.readPendingDrops();
    pending[reason] += count;
    await this.writePendingDrops(pending);
  }

  private async atomicWrite(fileName: string, contents: string) {
    const temporary = join(this.directory, `${fileName}.${randomUUID()}.tmp`);
    const destination = join(this.directory, fileName);
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(contents, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, destination);
    await chmod(destination, 0o600);
    try {
      const directory = await open(this.directory, "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } catch {
      // Directory fsync is not available on every supported filesystem.
    }
  }

  private async calculateRecordBytes() {
    const entries = (await readdir(this.directory)).filter((name) => name.endsWith(recordSuffix));
    const sizes = await Promise.all(entries.map((name) => this.fileSize(name)));
    return sizes.reduce((sum, size) => sum + size, 0);
  }

  private async fileSize(fileName: string) {
    try {
      return (await stat(join(this.directory, fileName))).size;
    } catch {
      return 0;
    }
  }
}

function validCount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

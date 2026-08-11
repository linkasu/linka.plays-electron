import { randomUUID } from "crypto";
import { chmod, mkdir, open, readFile, readdir, rename, rm, stat } from "fs/promises";
import { join } from "path";
import type { SpoolRecord, StoredSessionSummary, StoredTelemetryEvent } from "./types";
import { projectV2Record, type MetricsStream } from "./v2";

const recordSuffix = ".record.json";
const pendingDropsFile = "pending-drops.json";
const activeBatchFile = "active-batch.json";
const maximumBatchAgeMs = 7 * 24 * 60 * 60 * 1000;
const maximumRecordAgeMs = 30 * 24 * 60 * 60 * 1000;
type DropReason = "capacity" | "expired" | "invalid";
type PendingDrops = Record<DropReason, number>;

export type TelemetryBatch = {
  schema_version: 2;
  batch_id: string;
  scope: { product: "linka-plays"; subject_key: string };
  stream: MetricsStream;
  sent_at: string;
  records: Array<Record<string, unknown>>;
};

export type SpoolBatch = {
  batchId: string;
  body: string;
  files: string[];
  recordCount: number;
};

type StoredBatch = SpoolBatch & { sentAt: string; subjectKey: string };

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

  getBatch(subjectKey: string, maxRecords = 500, maxBytes = 512 * 1024) {
    return this.exclusive(async (): Promise<SpoolBatch | undefined> => {
      const active = await this.readActiveBatch(subjectKey);
      if (active) return active;
      const files = (await readdir(this.directory)).filter((name) => name.endsWith(recordSuffix)).sort();
      const selected: string[] = [];
      const records: TelemetryBatch["records"] = [];
      const dropped: PendingDrops = { capacity: 0, expired: 0, invalid: 0 };
      const batchId = randomUUID();
      const sentAt = new Date().toISOString();
      let stream: MetricsStream | undefined;

      for (const fileName of files) {
        if (selected.length >= maxRecords) break;
        const record = await this.readRecord(fileName);
        if (!record) continue;
        const occurredAt = record.kind === "event" ? (record.payload as StoredTelemetryEvent).occurred_at : (record.payload as StoredSessionSummary).ended_at;
        if (!Number.isFinite(Date.parse(occurredAt)) || Date.parse(occurredAt) < Date.now() - maximumRecordAgeMs) {
          await this.removeFiles([fileName]);
          dropped.expired += 1;
          continue;
        }
        const projected = projectV2Record(record);
        if (!projected) {
          await this.removeFiles([fileName]);
          dropped.invalid += 1;
          continue;
        }
        if (stream && projected.stream !== stream) continue;
        stream = projected.stream;
        const nextRecords = [...records, projected.value];
        const body = JSON.stringify(createBatch(batchId, subjectKey, stream, sentAt, nextRecords));
        if (Buffer.byteLength(body, "utf8") > maxBytes) {
          if (records.length > 0) break;
          await this.removeFiles([fileName]);
          dropped.invalid += 1;
          continue;
        }
        selected.push(fileName);
        records.push(projected.value);
      }

      for (const reason of ["expired", "invalid"] as const) {
        if (dropped[reason] > 0) await this.addPendingDrops(reason, dropped[reason]);
      }
      if (selected.length === 0) return undefined;
      const body = JSON.stringify(createBatch(batchId, subjectKey, stream!, sentAt, records));
      const batch: StoredBatch = { batchId, body, files: selected, recordCount: selected.length, sentAt, subjectKey };
      await this.atomicWrite(activeBatchFile, JSON.stringify(batch));
      return { batchId, body, files: selected, recordCount: selected.length };
    });
  }

  acknowledge(files: string[]) {
    return this.exclusive(async () => {
      await this.removeFiles(files);
      await rm(join(this.directory, activeBatchFile), { force: true });
    });
  }

  discard(files: string[], reason: DropReason) {
    return this.exclusive(async () => {
      await this.removeFiles(files);
      await rm(join(this.directory, activeBatchFile), { force: true });
      await this.addPendingDrops(reason, files.length);
    });
  }

  releaseBatch() {
    return this.exclusive(() => rm(join(this.directory, activeBatchFile), { force: true }));
  }

  pendingDroppedCount() {
    return this.exclusive(async () => {
      const pending = await this.readPendingDrops();
      return pending.capacity + pending.expired + pending.invalid;
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
        expired: validCount(parsed.expired),
        invalid: validCount(parsed.invalid)
      };
    } catch {
      return { capacity: 0, expired: 0, invalid: 0 };
    }
  }

  private async writePendingDrops(pending: PendingDrops) {
    if (pending.capacity <= 0 && pending.expired <= 0 && pending.invalid <= 0) {
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

  private async readActiveBatch(subjectKey: string): Promise<SpoolBatch | undefined> {
    try {
      const batch = JSON.parse(await readFile(join(this.directory, activeBatchFile), "utf8")) as Partial<StoredBatch>;
      if (!isUUID(batch.batchId) || typeof batch.body !== "string" || !Array.isArray(batch.files) || !batch.files.every((file) => typeof file === "string" && file.endsWith(recordSuffix)) || batch.recordCount !== batch.files.length || typeof batch.sentAt !== "string" || batch.subjectKey !== subjectKey) throw new Error("invalid active batch");
      if (Date.parse(batch.sentAt) < Date.now() - maximumBatchAgeMs) throw new Error("expired active batch");
      const existing = await Promise.all(batch.files.map(async (file) => this.fileSize(file)));
      if (existing.some((size) => size === 0)) throw new Error("active batch record is missing");
      return { batchId: batch.batchId, body: batch.body, files: batch.files, recordCount: batch.recordCount };
    } catch {
      await rm(join(this.directory, activeBatchFile), { force: true });
      return undefined;
    }
  }

  private async fileSize(fileName: string) {
    try {
      return (await stat(join(this.directory, fileName))).size;
    } catch {
      return 0;
    }
  }
}

function createBatch(batchId: string, subjectKey: string, stream: MetricsStream, sentAt: string, records: Array<Record<string, unknown>>): TelemetryBatch {
  return { schema_version: 2, batch_id: batchId, scope: { product: "linka-plays", subject_key: subjectKey }, stream, sent_at: sentAt, records };
}

function validCount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function isUUID(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

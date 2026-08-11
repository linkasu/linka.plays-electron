import { randomUUID } from "crypto";
import { chmod, mkdir, open, readFile, readdir, rename, rm } from "fs/promises";
import { basename, join } from "path";

export type TelemetryPrivacyPreference = "unknown" | "enabled" | "disabled";
export type TelemetryPrivacyDecision = Exclude<TelemetryPrivacyPreference, "unknown">;

export function parseTelemetryPrivacyPreference(value: unknown): TelemetryPrivacyPreference {
  return value === "enabled" || value === "disabled" ? value : "unknown";
}

export function isTelemetryPrivacyDecision(value: unknown): value is TelemetryPrivacyDecision {
  return value === "enabled" || value === "disabled";
}

export class TelemetryPrivacyPreferenceStore {
  private readonly path: string;

  constructor(private readonly userDataPath: string) {
    this.path = join(userDataPath, "privacy-preferences.json");
  }

  async read(): Promise<TelemetryPrivacyPreference> {
    try {
      const stored = JSON.parse(await readRecoverable(this.userDataPath, this.path)) as { telemetry?: unknown };
      return parseTelemetryPrivacyPreference(stored.telemetry);
    } catch {
      return "unknown";
    }
  }

  async write(preference: TelemetryPrivacyDecision) {
    await mkdir(this.userDataPath, { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(JSON.stringify({ telemetry: preference }), "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    if (process.platform === "win32") await rm(this.path, { force: true });
    await rename(temporary, this.path);
    await chmod(this.path, 0o600);
    try {
      const directory = await open(this.userDataPath, "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } catch {
      // Directory fsync is unavailable on some supported filesystems.
    }
  }
}

async function readRecoverable(directory: string, destination: string) {
  try {
    return await readFile(destination, "utf8");
  } catch (error) {
    if (process.platform !== "win32") throw error;
    const prefix = `${basename(destination)}.`;
    const candidates = (await readdir(directory)).filter((name) => name.startsWith(prefix) && name.endsWith(".tmp")).sort().reverse();
    for (const candidate of candidates) {
      try {
        const temporary = join(directory, candidate);
        const contents = await readFile(temporary, "utf8");
        await rename(temporary, destination);
        return contents;
      } catch {
        // Try the next complete temporary file.
      }
    }
    throw error;
  }
}

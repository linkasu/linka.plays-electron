import { randomUUID } from "crypto";
import { chmod, mkdir, open, readFile, rename, rm } from "fs/promises";
import { join } from "path";

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
      const stored = JSON.parse(await readFile(this.path, "utf8")) as { telemetry?: unknown };
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
    await rm(this.path, { force: true });
    await rename(temporary, this.path);
    await chmod(this.path, 0o600);
  }
}

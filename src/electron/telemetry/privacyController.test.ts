import { mkdir, mkdtemp, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TelemetryPrivacyController } from "./privacyController";
import { TelemetryPrivacyPreferenceStore } from "./privacyPreference";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createUserData() {
  const userDataPath = await mkdtemp(join(tmpdir(), "linka-privacy-controller-"));
  directories.push(userDataPath);
  return userDataPath;
}

describe("TelemetryPrivacyController", () => {
  it("deletes a pre-0.1.18 queue and installation when preference is absent", async () => {
    const userDataPath = await createUserData();
    const telemetryPath = join(userDataPath, "telemetry-v1");
    await mkdir(join(telemetryPath, "spool"), { recursive: true });
    await writeFile(join(telemetryPath, "spool", "legacy.record.json"), "legacy queue");
    await writeFile(join(telemetryPath, "installation.json"), "legacy installation");
    const createTelemetry = vi.fn();
    const controller = new TelemetryPrivacyController({
      store: new TelemetryPrivacyPreferenceStore(userDataPath),
      canStartTelemetry: () => true,
      createTelemetry,
      clearTelemetryData: () => rm(telemetryPath, { recursive: true, force: true })
    });

    await expect(controller.initialize()).resolves.toBe("unknown");

    expect(createTelemetry).not.toHaveBeenCalled();
    await expect(stat(telemetryPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("serializes decisions and rejects IPC transitions after the shutdown gate closes", async () => {
    let releaseEnabledWrite: () => void = () => undefined;
    const enabledWrite = new Promise<void>((resolve) => { releaseEnabledWrite = resolve; });
    const writes: string[] = [];
    const runtime = {
      initialize: vi.fn(async () => undefined),
      disableAndClear: vi.fn(async () => undefined)
    };
    const controller = new TelemetryPrivacyController({
      store: {
        read: async () => "unknown",
        write: async (preference) => {
          writes.push(preference);
          if (preference === "enabled") await enabledWrite;
        }
      },
      canStartTelemetry: () => true,
      createTelemetry: () => runtime,
      clearTelemetryData: vi.fn(async () => undefined)
    });

    const enabled = controller.setPreference("enabled");
    await vi.waitFor(() => expect(writes).toEqual(["enabled"]));
    const disabled = controller.setPreference("disabled");
    const closing = controller.closeGate();
    await expect(controller.setPreference("enabled")).rejects.toThrow("privacy transitions are closed");
    expect(writes).toEqual(["enabled"]);

    releaseEnabledWrite();
    await expect(enabled).resolves.toBe("enabled");
    await expect(disabled).resolves.toBe("disabled");
    await closing;

    expect(writes).toEqual(["enabled", "disabled"]);
    expect(runtime.initialize).toHaveBeenCalledOnce();
    expect(runtime.disableAndClear).toHaveBeenCalledOnce();
    expect(controller.getPreference()).toBe("disabled");
    expect(controller.telemetry).toBeUndefined();
  });
});

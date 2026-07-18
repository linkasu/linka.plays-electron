import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({ handle: vi.fn() }));

vi.mock("electron", () => ({ ipcMain: { handle: electronMock.handle } }));

import { registerPrivacyIpcHandlers } from "./privacyIpc";

type InvokeHandler = (event: unknown, ...args: unknown[]) => unknown;

beforeEach(() => {
  electronMock.handle.mockReset();
});

describe("privacy IPC", () => {
  it("returns the current preference and accepts explicit decisions", async () => {
    const setTelemetryPreference = vi.fn(async (preference: "enabled" | "disabled") => preference);
    registerPrivacyIpcHandlers({ getTelemetryPreference: () => "unknown", setTelemetryPreference });
    const handlers = new Map(electronMock.handle.mock.calls.map(([channel, handler]) => [channel, handler as InvokeHandler]));

    expect(handlers.get("privacy:telemetry:get")?.({})).toBe("unknown");
    await expect(handlers.get("privacy:telemetry:set")?.({}, "enabled")).resolves.toBe("enabled");
    expect(setTelemetryPreference).toHaveBeenCalledWith("enabled");
  });

  it("rejects unknown as a renderer decision", () => {
    registerPrivacyIpcHandlers({ getTelemetryPreference: () => "unknown", setTelemetryPreference: (preference) => preference });
    const setHandler = electronMock.handle.mock.calls.find(([channel]) => channel === "privacy:telemetry:set")?.[1] as InvokeHandler;

    expect(() => setHandler({}, "unknown")).toThrow("invalid telemetry privacy preference");
  });
});

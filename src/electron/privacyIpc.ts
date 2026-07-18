import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { isTelemetryPrivacyDecision, type TelemetryPrivacyDecision, type TelemetryPrivacyPreference } from "./telemetry/privacyPreference";

type PrivacyIpcHandlers = {
  getTelemetryPreference: () => TelemetryPrivacyPreference | Promise<TelemetryPrivacyPreference>;
  setTelemetryPreference: (preference: TelemetryPrivacyDecision) => TelemetryPrivacyPreference | Promise<TelemetryPrivacyPreference>;
};

type IpcRegistrar = {
  handle: (channel: string, listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) => void;
};

export function registerPrivacyIpcHandlers(handlers: PrivacyIpcHandlers, registrar: IpcRegistrar = ipcMain) {
  registrar.handle("privacy:telemetry:get", () => handlers.getTelemetryPreference());
  registrar.handle("privacy:telemetry:set", (_event, preference) => {
    if (!isTelemetryPrivacyDecision(preference)) throw new TypeError("invalid telemetry privacy preference");
    return handlers.setTelemetryPreference(preference);
  });
}

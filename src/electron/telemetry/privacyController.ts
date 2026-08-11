import type { TelemetryPrivacyDecision, TelemetryPrivacyPreference } from "./privacyPreference";

type PrivacyPreferenceStore = {
  read: () => Promise<TelemetryPrivacyPreference>;
  write: (preference: TelemetryPrivacyDecision) => Promise<void>;
};

type TelemetryRuntime = {
  initialize: () => Promise<void>;
  stopCollection: () => void;
  disableAndClear: () => Promise<void>;
};

type TelemetryPrivacyControllerOptions<Telemetry extends TelemetryRuntime> = {
  store: PrivacyPreferenceStore;
  canStartTelemetry: () => boolean;
  createTelemetry: () => Telemetry;
  clearTelemetryData: (preference: "unknown" | "disabled") => Promise<void>;
};

export class TelemetryPrivacyController<Telemetry extends TelemetryRuntime> {
  private preference: TelemetryPrivacyPreference = "unknown";
  private currentTelemetry?: Telemetry;
  private transition = Promise.resolve();
  private acceptingTransitions = true;

  constructor(private readonly options: TelemetryPrivacyControllerOptions<Telemetry>) {}

  get telemetry() {
    return this.currentTelemetry;
  }

  getPreference() {
    return this.preference;
  }

  initialize() {
    return this.enqueue(async () => {
      this.preference = await this.options.store.read();
      if (this.preference === "enabled") {
        await this.startTelemetry();
      } else {
        await this.options.clearTelemetryData(this.preference);
      }
      return this.preference;
    });
  }

  setPreference(preference: TelemetryPrivacyDecision) {
    if (!this.acceptingTransitions) return Promise.reject(new Error("privacy transitions are closed"));
    return this.enqueue(async () => {
      if (preference === this.preference && preference === "enabled" && (this.currentTelemetry || !this.options.canStartTelemetry())) return preference;

      if (preference === "disabled") {
        const telemetry = this.currentTelemetry;
        telemetry?.stopCollection();
        await this.options.store.write(preference);
        this.preference = preference;
        this.currentTelemetry = undefined;
        await (telemetry?.disableAndClear() ?? this.options.clearTelemetryData("disabled")).catch(() => undefined);
        return preference;
      }

      // A 0.1.17 queue predates consent. It must never be delivered after the first opt-in.
      await this.options.clearTelemetryData("disabled");
      await this.options.store.write(preference);
      this.preference = preference;
      await this.startTelemetry();
      return preference;
    });
  }

  closeGate() {
    this.acceptingTransitions = false;
    return this.transition;
  }

  private async startTelemetry() {
    if (!this.options.canStartTelemetry() || this.currentTelemetry) return;
    const telemetry = this.options.createTelemetry();
    this.currentTelemetry = telemetry;
    try {
      await telemetry.initialize();
    } catch (error) {
      this.currentTelemetry = undefined;
      throw error;
    }
  }

  private enqueue<Result>(operation: () => Promise<Result>) {
    const result = this.transition.then(operation);
    this.transition = result.then(() => undefined, () => undefined);
    return result;
  }
}

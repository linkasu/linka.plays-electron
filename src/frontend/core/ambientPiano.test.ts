import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createAmbientPiano, type AmbientPianoConfig } from "./ambientPiano";

type MockPiano = {
  ready: Promise<void>;
  start: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
};

const smplrMocks = vi.hoisted(() => ({
  readyDelayMs: 0,
  instruments: [] as MockPiano[]
}));

const ttsMocks = vi.hoisted(() => ({
  active: false,
  listeners: new Set<(active: boolean) => void>()
}));

vi.mock("smplr", () => ({
  Reverb: vi.fn(() => ({})),
  SplendidGrandPiano: vi.fn(() => {
    const instrument = {
      output: { addEffect: vi.fn() },
      ready: new Promise<void>((resolve) => window.setTimeout(resolve, smplrMocks.readyDelayMs)),
      start: vi.fn(),
      dispose: vi.fn()
    };
    smplrMocks.instruments.push(instrument);
    return instrument;
  })
}));

vi.mock("./ttsAudio", () => ({
  isTtsPlaybackActive: () => ttsMocks.active,
  subscribeTtsPlayback: (listener: (active: boolean) => void) => {
    ttsMocks.listeners.add(listener);
    listener(ttsMocks.active);
    return () => ttsMocks.listeners.delete(listener);
  }
}));

class MockAudioParam {
  value = 1;
  cancelScheduledValues = vi.fn();
  setTargetAtTime = vi.fn();
  setValueAtTime = vi.fn();
}

class MockGainNode {
  gain = new MockAudioParam();
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  static suspendDelayMs = 0;

  state: AudioContextState = "suspended";
  currentTime = 0;
  destination = {} as AudioDestinationNode;
  gain = new MockGainNode();
  createGain = vi.fn(() => this.gain as unknown as GainNode);
  resume = vi.fn(async () => {
    this.state = "running";
  });
  suspend = vi.fn(async () => {
    if (MockAudioContext.suspendDelayMs > 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, MockAudioContext.suspendDelayMs));
    }
    this.state = "suspended";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });

  constructor() {
    MockAudioContext.instances.push(this);
  }
}

const originalAudioContext = window.AudioContext;
const config: AmbientPianoConfig = {
  notesToLoad: [60, 64],
  loopNotes: [60, 64],
  cueNotes: [67],
  reverbName: "test-room",
  reverbAmount: 0.1,
  volume: 80,
  velocity: 50,
  decayTime: 2,
  velocityRange: [1, 64],
  loopLookaheadSeconds: 0.5,
  loopStepSeconds: 1,
  loopAccentEvery: 2,
  loopAccentDurationSeconds: 1,
  loopBaseDurationSeconds: 1,
  loopAccentVelocity: 44,
  loopBaseVelocity: 36,
  activeGain: 1,
  fadeInSeconds: 1,
  fadeOutSeconds: 1
};

function emitTtsPlayback(active: boolean) {
  ttsMocks.active = active;
  for (const listener of ttsMocks.listeners) listener(active);
}

beforeEach(() => {
  vi.useFakeTimers();
  smplrMocks.readyDelayMs = 0;
  smplrMocks.instruments.length = 0;
  ttsMocks.active = false;
  ttsMocks.listeners.clear();
  MockAudioContext.instances.length = 0;
  MockAudioContext.suspendDelayMs = 0;
  Object.defineProperty(window, "AudioContext", { configurable: true, value: MockAudioContext });
});

afterAll(() => {
  vi.useRealTimers();
  Object.defineProperty(window, "AudioContext", { configurable: true, value: originalAudioContext });
});

describe("ambient piano lifecycle", () => {
  it("warms silently and starts one quiet loop only after activation", async () => {
    const ambient = createAmbientPiano(config);

    ambient.warm(true);
    await vi.runAllTimersAsync();

    const context = MockAudioContext.instances[0];
    const instrument = smplrMocks.instruments[0];
    expect(context.resume).not.toHaveBeenCalled();
    expect(instrument.start).not.toHaveBeenCalled();

    ambient.setActive(true, true);
    await vi.runAllTimersAsync();
    ambient.tick(true);
    ambient.tick(true);

    expect(context.resume).toHaveBeenCalledOnce();
    expect(instrument.start).toHaveBeenCalledTimes(config.loopNotes?.length ?? 0);
    expect(context.gain.gain.setTargetAtTime).toHaveBeenCalledWith(0.22, 0, config.fadeInSeconds / 3);

    ambient.dispose();
  });

  it("closes and cannot revive a context disposed while samples are loading", async () => {
    smplrMocks.readyDelayMs = 1000;
    const ambient = createAmbientPiano(config);

    ambient.setActive(true, true);
    await vi.advanceTimersByTimeAsync(0);
    const firstContext = MockAudioContext.instances[0];
    const firstInstrument = smplrMocks.instruments[0];

    ambient.setActive(true, false);
    expect(firstInstrument.dispose).toHaveBeenCalledOnce();
    expect(firstContext.close).toHaveBeenCalledOnce();
    expect(ttsMocks.listeners.size).toBe(0);

    await vi.advanceTimersByTimeAsync(1000);
    expect(firstInstrument.start).not.toHaveBeenCalled();

    ambient.setActive(true, true);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1000);
    expect(MockAudioContext.instances).toHaveLength(2);
    expect(smplrMocks.instruments[1].start).toHaveBeenCalledTimes(config.loopNotes?.length ?? 0);

    ambient.dispose();
  });

  it("silences and suspends the loop for TTS, then closes it on pause", async () => {
    const ambient = createAmbientPiano(config);
    ambient.setActive(true, true);
    await vi.runAllTimersAsync();

    const context = MockAudioContext.instances[0];
    const instrument = smplrMocks.instruments[0];
    const scheduledNotes = instrument.start.mock.calls.length;

    emitTtsPlayback(true);
    ambient.tick(true);

    expect(context.gain.gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
    expect(context.suspend).toHaveBeenCalledOnce();
    expect(instrument.start).toHaveBeenCalledTimes(scheduledNotes);

    emitTtsPlayback(false);
    await vi.runAllTimersAsync();
    expect(context.resume).toHaveBeenCalledTimes(2);

    ambient.setActive(true, false);
    expect(context.close).toHaveBeenCalledOnce();
    expect(instrument.dispose).toHaveBeenCalledOnce();
  });

  it("resumes after a delayed suspend when TTS ends immediately", async () => {
    const ambient = createAmbientPiano(config);
    ambient.setActive(true, true);
    await vi.runAllTimersAsync();

    const context = MockAudioContext.instances[0];
    MockAudioContext.suspendDelayMs = 1000;

    emitTtsPlayback(true);
    emitTtsPlayback(false);
    await vi.advanceTimersByTimeAsync(1000);

    expect(context.suspend).toHaveBeenCalledOnce();
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(context.state).toBe("running");

    ambient.dispose();
  });

  it("does not resume a disposed context after a delayed TTS suspend", async () => {
    const ambient = createAmbientPiano(config);
    ambient.setActive(true, true);
    await vi.runAllTimersAsync();

    const context = MockAudioContext.instances[0];
    MockAudioContext.suspendDelayMs = 1000;

    emitTtsPlayback(true);
    emitTtsPlayback(false);
    ambient.dispose();
    await vi.advanceTimersByTimeAsync(1000);

    expect(context.suspend).toHaveBeenCalledOnce();
    expect(context.resume).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("degrades scheduling errors to silence", async () => {
    const ambient = createAmbientPiano(config);
    ambient.warm(true);
    await vi.runAllTimersAsync();

    const context = MockAudioContext.instances[0];
    const instrument = smplrMocks.instruments[0];
    instrument.start.mockImplementationOnce(() => {
      throw new Error("sample scheduling failed");
    });

    ambient.setActive(true, true);
    await vi.runAllTimersAsync();

    expect(context.close).toHaveBeenCalledOnce();
    expect(instrument.dispose).toHaveBeenCalledOnce();
    expect(context.gain.gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
  });
});

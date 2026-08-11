import { afterEach, describe, expect, it, vi } from "vitest";
import { disposeSoftPiano, warmSoftPiano } from "./softPiano";

const pianoMocks = vi.hoisted(() => ({
  closeContext: vi.fn(() => Promise.resolve()),
  disposePiano: vi.fn(),
  resolveReady: undefined as (() => void) | undefined
}));

vi.mock("smplr", () => ({
  Reverb: vi.fn(() => ({})),
  SplendidGrandPiano: vi.fn(() => ({
    dispose: pianoMocks.disposePiano,
    output: { addEffect: vi.fn() },
    ready: new Promise<void>((resolve) => {
      pianoMocks.resolveReady = resolve;
    }),
    start: vi.fn()
  }))
}));

class FakeAudioContext {
  currentTime = 0;
  destination = {} as AudioDestinationNode;
  state = "running" as AudioContextState;

  close = pianoMocks.closeContext;
  createGain = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } } as unknown as GainNode));
}

afterEach(() => {
  disposeSoftPiano();
  pianoMocks.closeContext.mockClear();
  pianoMocks.disposePiano.mockClear();
  pianoMocks.resolveReady = undefined;
  vi.unstubAllGlobals();
});

describe("soft piano lifecycle", () => {
  it("waits for a pending instrument load before closing its audio context", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);

    warmSoftPiano(true, [60]);
    await Promise.resolve();
    disposeSoftPiano();

    expect(pianoMocks.closeContext).not.toHaveBeenCalled();
    pianoMocks.resolveReady?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(pianoMocks.disposePiano).toHaveBeenCalledOnce();
    expect(pianoMocks.closeContext).toHaveBeenCalledOnce();
  });
});

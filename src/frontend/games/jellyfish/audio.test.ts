import { nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { disposeJellyfishAudio, scheduleJellyfishAmbient } from "./audio";

const pianoMocks = vi.hoisted(() => ({
  dispose: vi.fn(),
  play: vi.fn(() => Promise.resolve()),
  warm: vi.fn()
}));

vi.mock("../../core/softPiano", () => ({
  disposeSoftPiano: pianoMocks.dispose,
  playSoftPianoMelody: pianoMocks.play,
  warmSoftPiano: pianoMocks.warm
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  pianoMocks.dispose.mockClear();
  pianoMocks.play.mockClear();
});

afterEach(() => {
  disposeJellyfishAudio();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("jellyfish ambient lifecycle", () => {
  it("owns one timer only while the game is running", async () => {
    const running = ref(false);
    scheduleJellyfishAmbient(true, () => running.value);

    expect(vi.getTimerCount()).toBe(0);
    expect(pianoMocks.dispose).toHaveBeenCalledOnce();

    running.value = true;
    await nextTick();
    expect(vi.getTimerCount()).toBe(1);

    running.value = false;
    await nextTick();
    expect(vi.getTimerCount()).toBe(0);
    expect(pianoMocks.dispose).toHaveBeenCalledTimes(2);

    running.value = true;
    await nextTick();
    await vi.advanceTimersByTimeAsync(9000);
    expect(pianoMocks.play).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);
  });
});

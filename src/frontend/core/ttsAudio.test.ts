import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  disposeTtsAssets,
  isTtsPlaybackActive,
  playTtsAsset,
  playTtsAssetAndWait,
  stopTtsPlayback,
  subscribeTtsPlayback,
  type TtsAsset,
} from "./ttsAudio";

class MockAudio extends EventTarget {
  static instances: MockAudio[] = [];

  preload = "";
  volume = 1;
  currentTime = 0;
  duration = Number.NaN;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  load = vi.fn();
  removeAttribute = vi.fn();

  constructor(public src: string) {
    super();
    MockAudio.instances.push(this);
  }
}

const originalAudio = window.Audio;
const asset: TtsAsset = {
  id: "test.prompt",
  game: "test",
  text: "Тест",
  path: "/audio/test.mp3",
};

beforeEach(() => {
  MockAudio.instances.length = 0;
  Object.defineProperty(window, "Audio", { configurable: true, value: MockAudio });
});

afterEach(() => {
  stopTtsPlayback();
  disposeTtsAssets([asset]);
});

afterAll(() => {
  Object.defineProperty(window, "Audio", { configurable: true, value: originalAudio });
});

describe("TTS playback focus", () => {
  it("notifies ambient observers for the exact playback lifetime", () => {
    const states: boolean[] = [];
    const unsubscribe = subscribeTtsPlayback((active) => states.push(active));

    playTtsAsset(true, asset);
    expect(isTtsPlaybackActive()).toBe(true);
    expect(states).toEqual([false, true]);

    MockAudio.instances[0].dispatchEvent(new Event("ended"));
    expect(isTtsPlaybackActive()).toBe(false);
    expect(states).toEqual([false, true, false]);
    unsubscribe();
  });

  it("releases audio focus when playback fails", async () => {
    playTtsAsset(true, asset);
    MockAudio.instances[0].play.mockRejectedValueOnce(new Error("autoplay blocked"));
    stopTtsPlayback();

    playTtsAsset(true, asset);
    await Promise.resolve();
    await Promise.resolve();

    expect(isTtsPlaybackActive()).toBe(false);
  });
});

describe("TTS playback waiting", () => {
  afterEach(() => vi.useRealTimers());

  it("waits for a recording longer than the old 6 s guard", async () => {
    vi.useFakeTimers();
    let done = false;
    const playing = playTtsAssetAndWait(true, asset).then(() => {
      done = true;
    });
    const audio = MockAudio.instances[0];
    audio.duration = 7.9;
    audio.dispatchEvent(new Event("loadedmetadata"));

    await vi.advanceTimersByTimeAsync(6500);
    expect(done).toBe(false);

    audio.dispatchEvent(new Event("ended"));
    await playing;
    expect(done).toBe(true);
  });

  it("still gives up on a recording that never ends", async () => {
    vi.useFakeTimers();
    let done = false;
    void playTtsAssetAndWait(true, asset).then(() => {
      done = true;
    });

    await vi.advanceTimersByTimeAsync(6100);
    expect(done).toBe(true);
  });
});

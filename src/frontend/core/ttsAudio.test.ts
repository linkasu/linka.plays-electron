import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { disposeTtsAssets, isTtsPlaybackActive, playTtsAsset, stopTtsPlayback, subscribeTtsPlayback, type TtsAsset } from "./ttsAudio";

class MockAudio extends EventTarget {
  static instances: MockAudio[] = [];

  preload = "";
  volume = 1;
  currentTime = 0;
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
  path: "/audio/test.mp3"
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

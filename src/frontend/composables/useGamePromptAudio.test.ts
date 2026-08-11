import { createApp, defineComponent, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useGamePromptAudio } from "./useGamePromptAudio";

vi.mock("../core/ttsAudio", () => ({
  disposeTtsAssets: vi.fn(),
  playTtsAsset: vi.fn(),
  playTtsAssetAndWait: vi.fn(() => Promise.resolve()),
  stopTtsPlayback: vi.fn(),
  warmTtsAssets: vi.fn()
}));

describe("useGamePromptAudio", () => {
  it("reports a cancelled sequence immediately when its pending delay is cancelled", async () => {
    let promptAudio: ReturnType<typeof useGamePromptAudio> | undefined;
    let playback: ReturnType<ReturnType<typeof useGamePromptAudio>["playSequenceAndWait"]> | undefined;
    const root = document.createElement("div");
    document.body.append(root);
    const app = createApp(defineComponent({
      setup() {
        promptAudio = useGamePromptAudio({ gameId: "patterns", soundEnabled: ref(true) });
        playback = promptAudio.playSequenceAndWait(["patterns.prompt"], 10_000);
        return () => null;
      }
    }));

    app.mount(root);
    try {
      promptAudio?.cancelPending();
      await expect(playback).resolves.toBe("cancelled");
    } finally {
      app.unmount();
      root.remove();
    }
  });
});

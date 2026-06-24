import { computed, onUnmounted, watch, type Ref } from "vue";
import { disposeTtsAssets, playTtsAsset, playTtsAssetAndWait, stopTtsPlayback, warmTtsAssets, type TtsAsset } from "../core/ttsAudio";
import ttsAssetsData from "../data/ttsAssets.json";

const allAssets = ttsAssetsData as TtsAsset[];

export type UseGamePromptAudioOptions = {
  gameId: string;
  soundEnabled: Ref<boolean>;
  volume?: number;
  warmAssetIds?: string[];
};

export type UseGamePromptAudio = {
  warm: () => void;
  play: (assetId: string, delayMs?: number) => void;
  playSequence: (assetIds: string[], delayMs?: number, gapMs?: number) => void;
  playSequenceAndWait: (assetIds: string[], delayMs?: number, gapMs?: number) => Promise<void>;
  cancelPending: () => void;
  dispose: () => void;
  assets: TtsAsset[];
};

export function useGamePromptAudio(options: UseGamePromptAudioOptions): UseGamePromptAudio {
  const assets = allAssets.filter((asset) => asset.game === options.gameId);
  const volume = options.volume ?? 0.36;
  const enabled = computed(() => options.soundEnabled.value);
  const pendingTimers = new Set<number>();
  let sequenceToken = 0;
  const warmAssetIds = options.warmAssetIds ? new Set(options.warmAssetIds) : undefined;
  const warmAssets = warmAssetIds ? assets.filter((asset) => warmAssetIds.has(asset.id)) : assets;

  function cancelPending() {
    sequenceToken += 1;
    for (const id of pendingTimers) window.clearTimeout(id);
    pendingTimers.clear();
    stopTtsPlayback();
  }

  function findAsset(id: string) {
    return assets.find((asset) => asset.id === id);
  }

  function warm() {
    warmTtsAssets(enabled.value, warmAssets);
  }

  function play(assetId: string, delayMs = 0) {
    const asset = findAsset(assetId);
    if (!asset) return;
    if (delayMs <= 0) {
      playTtsAsset(enabled.value, asset, volume);
      return;
    }
    const timer = window.setTimeout(() => {
      pendingTimers.delete(timer);
      playTtsAsset(enabled.value, asset, volume);
    }, delayMs);
    pendingTimers.add(timer);
  }

  function wait(delayMs: number) {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, delayMs);
    });
  }

  async function playSequenceAndWait(assetIds: string[], delayMs = 0, gapMs = 140) {
    cancelPending();
    const token = ++sequenceToken;
    const sequenceAssets = assetIds.map(findAsset).filter((asset): asset is TtsAsset => Boolean(asset));
    if (!sequenceAssets.length) return;

    if (delayMs > 0) await wait(delayMs);
    for (const asset of sequenceAssets) {
      if (token !== sequenceToken) return;
      await playTtsAssetAndWait(enabled.value, asset, volume);
      if (gapMs > 0) await wait(gapMs);
    }
  }

  function playSequence(assetIds: string[], delayMs = 0, gapMs = 140) {
    void playSequenceAndWait(assetIds, delayMs, gapMs);
  }

  function dispose() {
    cancelPending();
    disposeTtsAssets(assets);
  }

  watch(enabled, (next) => {
    if (next) warmTtsAssets(true, warmAssets);
  });

  onUnmounted(() => {
    dispose();
  });

  return { warm, play, playSequence, playSequenceAndWait, cancelPending, dispose, assets };
}

import { computed, onUnmounted, watch, type Ref } from "vue";
import { disposeTtsAssets, playTtsAsset, warmTtsAssets, type TtsAsset } from "../core/ttsAudio";
import ttsAssetsData from "../data/ttsAssets.json";

const allAssets = ttsAssetsData as TtsAsset[];

export type UseGamePromptAudioOptions = {
  gameId: string;
  soundEnabled: Ref<boolean>;
  volume?: number;
};

export type UseGamePromptAudio = {
  warm: () => void;
  play: (assetId: string, delayMs?: number) => void;
  cancelPending: () => void;
  dispose: () => void;
  assets: TtsAsset[];
};

export function useGamePromptAudio(options: UseGamePromptAudioOptions): UseGamePromptAudio {
  const assets = allAssets.filter((asset) => asset.game === options.gameId);
  const volume = options.volume ?? 0.36;
  const enabled = computed(() => options.soundEnabled.value);
  const pendingTimers = new Set<number>();

  function cancelPending() {
    for (const id of pendingTimers) window.clearTimeout(id);
    pendingTimers.clear();
  }

  function findAsset(id: string) {
    return assets.find((asset) => asset.id === id);
  }

  function warm() {
    warmTtsAssets(enabled.value, assets);
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

  function dispose() {
    cancelPending();
    disposeTtsAssets(assets);
  }

  watch(enabled, (next) => {
    if (next) warmTtsAssets(true, assets);
  });

  onUnmounted(() => {
    dispose();
  });

  return { warm, play, cancelPending, dispose, assets };
}

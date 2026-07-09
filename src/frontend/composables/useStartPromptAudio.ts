import { onMounted, onUnmounted, type Ref } from "vue";
import { useGamePromptAudio } from "./useGamePromptAudio";

export type UseStartPromptAudioOptions = {
  gameId: string;
  soundEnabled: Ref<boolean>;
  assetId?: string;
  delayMs?: number;
  volume?: number;
};

export function useStartPromptAudio(options: UseStartPromptAudioOptions) {
  const assetId = options.assetId ?? `${options.gameId}.prompt`;
  const promptAudio = useGamePromptAudio({
    gameId: options.gameId,
    soundEnabled: options.soundEnabled,
    volume: options.volume,
    warmAssetIds: [assetId]
  });

  function play(delayMs = options.delayMs ?? 450) {
    promptAudio.play(assetId, delayMs);
  }

  onMounted(() => {
    promptAudio.warm();
    play();
  });

  onUnmounted(() => {
    promptAudio.cancelPending();
  });

  return { ...promptAudio, playStartPrompt: play };
}

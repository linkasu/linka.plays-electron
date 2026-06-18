import { onMounted, onUnmounted, watch, type Ref } from "vue";
import { createStandardGameFeedback } from "../core/gameFeedbackAudio";

export function useStandardGameFeedback(soundEnabled: Ref<boolean>) {
  const feedback = createStandardGameFeedback();

  function warm() {
    feedback.warm(soundEnabled.value);
  }

  function playSuccess() {
    return feedback.playSuccess(soundEnabled.value);
  }

  function playMistake() {
    return feedback.playMistake(soundEnabled.value);
  }

  onMounted(() => {
    warm();
  });

  watch(soundEnabled, (enabled) => {
    feedback.warm(enabled);
  });

  onUnmounted(() => {
    feedback.dispose();
  });

  return { warm, playSuccess, playMistake, dispose: feedback.dispose };
}

import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";

const feedback = createStandardGameFeedback();

export function resetHideAndSeekAudioSession() {
  // Standard feedback has no per-session random state.
}

export function warmHideAndSeekAudio(enabled: boolean) {
  feedback.warm(enabled);
}

export function playHideAndSeekSuccessMelody(enabled: boolean) {
  return feedback.playSuccess(enabled);
}

export function playHideAndSeekMistakeMelody(enabled: boolean) {
  return feedback.playMistake(enabled);
}

export function disposeHideAndSeekAudio() {
  feedback.dispose();
}

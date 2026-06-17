import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";

const feedback = createStandardGameFeedback();

export function warmTypeWordAudio(enabled: boolean) {
  feedback.warm(enabled);
}

export function playTypeWordSuccessMelody(enabled: boolean) {
  return feedback.playSuccess(enabled);
}

export function playTypeWordMistakeMelody(enabled: boolean) {
  return feedback.playMistake(enabled);
}

export function disposeTypeWordAudio() {
  feedback.dispose();
}

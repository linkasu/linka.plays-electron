import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";

const feedback = createStandardGameFeedback();

export function warmLetterHuntAudio(enabled: boolean) {
  feedback.warm(enabled);
}

export function playLetterHuntSuccessMelody(enabled: boolean) {
  return feedback.playSuccess(enabled);
}

export function playLetterHuntMistakeMelody(enabled: boolean) {
  return feedback.playMistake(enabled);
}

export function disposeLetterHuntAudio() {
  feedback.dispose();
}

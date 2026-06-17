import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";

const feedback = createStandardGameFeedback();

export function warmEatOrNotEatAudio(enabled: boolean) {
  feedback.warm(enabled);
}

export function playEatOrNotEatMistakeMelody(enabled: boolean) {
  return feedback.playMistake(enabled);
}

export function disposeEatOrNotEatAudio() {
  feedback.dispose();
}

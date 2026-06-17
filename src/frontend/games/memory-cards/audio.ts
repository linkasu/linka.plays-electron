import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";

const feedback = createStandardGameFeedback();

export function warmMemoryCardsAudio(enabled: boolean) {
  feedback.warm(enabled);
}

export function playMemoryCardsMatchMelody(enabled: boolean) {
  return feedback.playSuccess(enabled);
}

export function playMemoryCardsMismatchMelody(enabled: boolean) {
  return feedback.playMistake(enabled);
}

export function disposeMemoryCardsAudio() {
  feedback.dispose();
}

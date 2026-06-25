import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";

const feedback = createStandardGameFeedback();

export function warmPatternsAudio(enabled: boolean) {
  feedback.warm(enabled);
}

export function playPatternsSuccessMelody(enabled: boolean) {
  return feedback.playSuccess(enabled);
}

export function playPatternsMistakeMelody(enabled: boolean) {
  return feedback.playMistake(enabled);
}

export function disposePatternsAudio() {
  feedback.dispose();
}

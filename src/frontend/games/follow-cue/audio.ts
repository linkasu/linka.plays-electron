import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";

const feedback = createStandardGameFeedback();

export function warmFollowCueAudio(enabled: boolean) {
  feedback.warm(enabled);
}

export function playFollowCueSuccessMelody(enabled: boolean) {
  return feedback.playSuccess(enabled);
}

export function playFollowCueMistakeMelody(enabled: boolean) {
  return feedback.playMistake(enabled);
}

export function disposeFollowCueAudio() {
  feedback.dispose();
}

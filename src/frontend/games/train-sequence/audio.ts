import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";

const feedback = createStandardGameFeedback();

export function warmTrainSequenceAudio(enabled: boolean) {
  feedback.warm(enabled);
}

export function playTrainSequenceSuccessMelody(enabled: boolean) {
  return feedback.playSuccess(enabled);
}

export function playTrainSequenceMistakeMelody(enabled: boolean) {
  return feedback.playMistake(enabled);
}

export function playTrainSequenceCompleteMelody(enabled: boolean) {
  return feedback.playSuccess(enabled);
}

export function disposeTrainSequenceAudio() {
  feedback.dispose();
}

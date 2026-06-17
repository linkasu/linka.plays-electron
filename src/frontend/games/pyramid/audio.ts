import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";

const feedback = createStandardGameFeedback();

export function warmPyramidAudio(enabled: boolean) {
  feedback.warm(enabled);
}

export function playPyramidPlaceMelody(enabled: boolean) {
  return feedback.playSuccess(enabled);
}

export function playPyramidMistakeMelody(enabled: boolean) {
  return feedback.playMistake(enabled);
}

export function playPyramidCompleteMelody(enabled: boolean) {
  return feedback.playSuccess(enabled);
}

export function disposePyramidAudio() {
  feedback.dispose();
}

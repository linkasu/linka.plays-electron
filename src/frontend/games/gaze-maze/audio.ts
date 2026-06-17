import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";

const feedback = createStandardGameFeedback();

export function warmGazeMazeAudio(enabled: boolean) {
  feedback.warm(enabled);
}

export function playGazeMazeStepMelody(enabled: boolean) {
  return feedback.playSuccess(enabled);
}

export function playGazeMazeHintMelody(enabled: boolean) {
  return feedback.playMistake(enabled);
}

export function disposeGazeMazeAudio() {
  feedback.dispose();
}

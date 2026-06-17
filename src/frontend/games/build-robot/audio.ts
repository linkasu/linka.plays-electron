import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";

const feedback = createStandardGameFeedback();

export function warmBuildRobotAudio(enabled: boolean) {
  feedback.warm(enabled);
}

export function playBuildRobotSuccessMelody(enabled: boolean) {
  return feedback.playSuccess(enabled);
}

export function playBuildRobotMistakeMelody(enabled: boolean) {
  return feedback.playMistake(enabled);
}

export function disposeBuildRobotAudio() {
  feedback.dispose();
}

import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";

const feedback = createStandardGameFeedback();

export function warmLeavesWindAudio(enabled: boolean) {
  feedback.warm(enabled);
}

export function playLeavesWindFlowCue(enabled: boolean) {
  return feedback.playSuccess(enabled).catch(() => undefined);
}

export function disposeLeavesWindAudio() {
  feedback.dispose();
}

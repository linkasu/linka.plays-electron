import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";

const feedback = createStandardGameFeedback();

export function warmDressCharacterAudio(enabled: boolean) {
  feedback.warm(enabled);
}

export function playDressCharacterSuccessMelody(enabled: boolean) {
  return feedback.playSuccess(enabled);
}

export function playDressCharacterHintMelody(enabled: boolean) {
  return feedback.playMistake(enabled);
}

export function disposeDressCharacterAudio() {
  feedback.dispose();
}

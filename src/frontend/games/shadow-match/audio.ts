import { createGameFeedback } from "../../core/gameFeedbackAudio";

export const shadowMatchFeedback = createGameFeedback({
  notesToLoad: [55, 59, 62, 64, 67, 71, 74],
  success: {
    sampled: [
      { note: 55, at: 0, duration: 0.78, velocity: 30 },
      { note: 62, at: 0.16, duration: 0.74, velocity: 27 },
      { note: 71, at: 0.34, duration: 0.84, velocity: 29 }
    ],
    fallback: [
      { frequency: 196, at: 0, duration: 0.74, peak: 0.038 },
      { frequency: 293.66, at: 0.16, duration: 0.7, peak: 0.032 },
      { frequency: 493.88, at: 0.34, duration: 0.8, peak: 0.034 }
    ],
    lengthSeconds: 1.18
  },
  mistake: {
    sampled: [
      { note: 64, at: 0, duration: 0.56, velocity: 20 },
      { note: 59, at: 0.2, duration: 0.7, velocity: 18 }
    ],
    fallback: [
      { frequency: 329.63, at: 0, duration: 0.52, peak: 0.024 },
      { frequency: 246.94, at: 0.2, duration: 0.66, peak: 0.022 }
    ],
    lengthSeconds: 0.94
  }
});

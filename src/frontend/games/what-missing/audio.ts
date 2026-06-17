import { createGameFeedback } from "../../core/gameFeedbackAudio";

export const whatMissingFeedback = createGameFeedback({
  notesToLoad: [55, 60, 64, 67, 72],
  success: {
    sampled: [
      { note: 60, at: 0, duration: 0.7, velocity: 26 },
      { note: 67, at: 0.18, duration: 0.76, velocity: 24 },
      { note: 72, at: 0.38, duration: 0.82, velocity: 22 }
    ],
    fallback: [
      { frequency: 261.63, at: 0, duration: 0.66, peak: 0.032 },
      { frequency: 392, at: 0.18, duration: 0.72, peak: 0.028 },
      { frequency: 523.25, at: 0.38, duration: 0.78, peak: 0.024 }
    ],
    lengthSeconds: 1.2
  },
  mistake: {
    sampled: [
      { note: 64, at: 0, duration: 0.52, velocity: 18 },
      { note: 55, at: 0.22, duration: 0.66, velocity: 16 }
    ],
    fallback: [
      { frequency: 329.63, at: 0, duration: 0.5, peak: 0.022 },
      { frequency: 196, at: 0.22, duration: 0.62, peak: 0.018 }
    ],
    lengthSeconds: 0.9
  }
});

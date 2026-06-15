import { createGameFeedback } from "../../core/gameFeedbackAudio";

export const colorCircleFeedback = createGameFeedback({
  notesToLoad: [55, 60, 64, 67, 72],
  success: {
    lengthSeconds: 0.82,
    sampled: [
      { note: "C4", at: 0, duration: 0.54, velocity: 54 },
      { note: "E4", at: 0.18, duration: 0.56, velocity: 50 },
      { note: "G4", at: 0.36, duration: 0.58, velocity: 46 }
    ],
    fallback: [
      { frequency: 261.63, at: 0, duration: 0.44, peak: 0.095 },
      { frequency: 329.63, at: 0.18, duration: 0.46, peak: 0.085 },
      { frequency: 392, at: 0.36, duration: 0.48, peak: 0.075 }
    ]
  },
  mistake: {
    lengthSeconds: 0.78,
    sampled: [
      { note: "G4", at: 0, duration: 0.52, velocity: 46 },
      { note: "G3", at: 0.24, duration: 0.56, velocity: 42 }
    ],
    fallback: [
      { frequency: 392, at: 0, duration: 0.42, peak: 0.075 },
      { frequency: 196, at: 0.24, duration: 0.46, peak: 0.065 }
    ]
  }
});

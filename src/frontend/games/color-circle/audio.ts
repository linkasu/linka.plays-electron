import { createSoftPianoCuePlayer } from "../../core/softPianoCues";
import type { SoftPianoMelody } from "../../core/softPiano";

type ColorCircleCue = "success" | "mistake";

const notesToLoad = [55, 60, 64, 67, 72];

const cues: Record<ColorCircleCue, SoftPianoMelody> = {
  success: {
    notesToLoad,
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
    notesToLoad,
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
};

const player = createSoftPianoCuePlayer(cues, notesToLoad);

export function warmColorCircleAudio(enabled: boolean) {
  player.warm(enabled);
}

export function playColorCircleSuccessMelody(enabled: boolean) {
  return player.play(enabled, "success");
}

export function playColorCircleMistakeMelody(enabled: boolean) {
  return player.play(enabled, "mistake");
}

export function disposeColorCircleAudio() {
  player.dispose();
}

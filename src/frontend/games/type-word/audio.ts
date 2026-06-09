import { createSoftPianoCuePlayer } from "../../core/softPianoCues";
import type { SoftPianoMelody } from "../../core/softPiano";

type TypeWordCue = "success" | "mistake";

const notesToLoad = [55, 60, 64, 67, 72];

const cues: Record<TypeWordCue, SoftPianoMelody> = {
  success: {
    notesToLoad,
    lengthSeconds: 0.86,
    sampled: [
      { note: "C4", at: 0, duration: 0.58, velocity: 38 },
      { note: "E4", at: 0.2, duration: 0.6, velocity: 34 },
      { note: "C5", at: 0.42, duration: 0.62, velocity: 30 }
    ],
    fallback: [
      { frequency: 261.63, at: 0, duration: 0.48, peak: 0.058 },
      { frequency: 329.63, at: 0.2, duration: 0.5, peak: 0.05 },
      { frequency: 523.25, at: 0.42, duration: 0.52, peak: 0.042 }
    ]
  },
  mistake: {
    notesToLoad,
    lengthSeconds: 0.72,
    sampled: [
      { note: "G4", at: 0, duration: 0.5, velocity: 30 },
      { note: "C4", at: 0.22, duration: 0.52, velocity: 28 }
    ],
    fallback: [
      { frequency: 392, at: 0, duration: 0.4, peak: 0.04 },
      { frequency: 261.63, at: 0.22, duration: 0.42, peak: 0.034 }
    ]
  }
};

const player = createSoftPianoCuePlayer(cues, notesToLoad);

export function warmTypeWordAudio(enabled: boolean) {
  player.warm(enabled);
}

export function playTypeWordSuccessMelody(enabled: boolean) {
  return player.play(enabled, "success");
}

export function playTypeWordMistakeMelody(enabled: boolean) {
  return player.play(enabled, "mistake");
}

export function disposeTypeWordAudio() {
  player.dispose();
}

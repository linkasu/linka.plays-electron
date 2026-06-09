import { createSoftPianoCuePlayer } from "../../core/softPianoCues";
import type { SoftPianoMelody } from "../../core/softPiano";

type EatOrNotEatCue = "mistake";

const notesToLoad = [55, 60, 64];

const cues: Record<EatOrNotEatCue, SoftPianoMelody> = {
  mistake: {
    notesToLoad,
    lengthSeconds: 0.9,
    sampled: [
      { note: "E4", at: 0, duration: 0.58, velocity: 52 },
      { note: "C4", at: 0.22, duration: 0.62, velocity: 48 },
      { note: "G3", at: 0.46, duration: 0.58, velocity: 42 }
    ],
    fallback: [
      { frequency: 329.63, at: 0, duration: 0.48, peak: 0.092 },
      { frequency: 261.63, at: 0.22, duration: 0.52, peak: 0.08 },
      { frequency: 196, at: 0.46, duration: 0.5, peak: 0.062 }
    ]
  }
};

const player = createSoftPianoCuePlayer(cues, notesToLoad);

export function warmEatOrNotEatAudio(enabled: boolean) {
  player.warm(enabled);
}

export function playEatOrNotEatMistakeMelody(enabled: boolean) {
  return player.play(enabled, "mistake");
}

export function disposeEatOrNotEatAudio() {
  player.dispose();
}

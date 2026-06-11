import { createSoftPianoCuePlayer } from "../../core/softPianoCues";
import type { SoftPianoMelody } from "../../core/softPiano";

const hootMelody: SoftPianoMelody = {
  notesToLoad: [48, 52, 55, 60],
  lengthSeconds: 2.45,
  sampled: [
    { note: "C3", at: 0, duration: 1.15, velocity: 54 },
    { note: "G3", at: 0.46, duration: 1.2, velocity: 44 },
    { note: "E3", at: 1.08, duration: 1.25, velocity: 38 }
  ],
  fallback: [
    { frequency: 130.81, at: 0, duration: 1.05, peak: 0.13 },
    { frequency: 196, at: 0.46, duration: 1.08, peak: 0.1 },
    { frequency: 164.81, at: 1.08, duration: 1.12, peak: 0.08 }
  ]
};

const player = createSoftPianoCuePlayer({ hoot: hootMelody }, hootMelody.notesToLoad ?? []);

export function warmWakeOwlAudio(enabled: boolean) {
  player.warm(enabled);
}

export function playWakeOwlHoot(enabled: boolean) {
  return player.play(enabled, "hoot").catch(() => undefined);
}

export function disposeWakeOwlAudio() {
  player.dispose();
}

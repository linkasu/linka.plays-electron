import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano, type SoftPianoMelody } from "../../core/softPiano";

const notesToLoad = [55, 59, 62, 64, 67, 71];

const stepMelody: SoftPianoMelody = {
  notesToLoad,
  sampled: [
    { note: 55, at: 0, duration: 0.7, velocity: 27 },
    { note: 62, at: 0.15, duration: 0.68, velocity: 24 },
    { note: 67, at: 0.32, duration: 0.76, velocity: 26 }
  ],
  fallback: [
    { frequency: 196, at: 0, duration: 0.66, peak: 0.034 },
    { frequency: 293.66, at: 0.15, duration: 0.64, peak: 0.028 },
    { frequency: 392, at: 0.32, duration: 0.72, peak: 0.03 }
  ],
  lengthSeconds: 1.08
};

const hintMelody: SoftPianoMelody = {
  notesToLoad,
  sampled: [
    { note: 64, at: 0, duration: 0.5, velocity: 18 },
    { note: 59, at: 0.2, duration: 0.68, velocity: 17 }
  ],
  fallback: [
    { frequency: 329.63, at: 0, duration: 0.48, peak: 0.022 },
    { frequency: 246.94, at: 0.2, duration: 0.64, peak: 0.02 }
  ],
  lengthSeconds: 0.88
};

export function warmGazeMazeAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoad);
}

export function playGazeMazeStepMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, stepMelody);
}

export function playGazeMazeHintMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, hintMelody);
}

export function disposeGazeMazeAudio() {
  disposeSoftPiano();
}

import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano, type SoftPianoMelody } from "../../core/softPiano";

const notesToLoad = [55, 59, 62, 64, 67, 71];

const successMelody: SoftPianoMelody = {
  notesToLoad,
  sampled: [
    { note: 55, at: 0, duration: 0.82, velocity: 34 },
    { note: 62, at: 0.1, duration: 0.72, velocity: 30 },
    { note: 67, at: 0.22, duration: 0.92, velocity: 32 }
  ],
  fallback: [
    { frequency: 196, at: 0, duration: 0.78, peak: 0.045 },
    { frequency: 293.66, at: 0.1, duration: 0.72, peak: 0.038 },
    { frequency: 392, at: 0.22, duration: 0.88, peak: 0.04 }
  ],
  lengthSeconds: 1.18
};

const mistakeMelody: SoftPianoMelody = {
  notesToLoad,
  sampled: [
    { note: 64, at: 0, duration: 0.62, velocity: 24 },
    { note: 59, at: 0.16, duration: 0.72, velocity: 22 }
  ],
  fallback: [
    { frequency: 329.63, at: 0, duration: 0.58, peak: 0.028 },
    { frequency: 246.94, at: 0.16, duration: 0.68, peak: 0.026 }
  ],
  lengthSeconds: 0.95
};

export function warmFollowCueAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoad);
}

export function playFollowCueSuccessMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, successMelody);
}

export function playFollowCueMistakeMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, mistakeMelody);
}

export function disposeFollowCueAudio() {
  disposeSoftPiano();
}

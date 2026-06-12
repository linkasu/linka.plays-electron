import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano, type SoftPianoMelody } from "../../core/softPiano";

const notesToLoad = [55, 59, 62, 64, 67, 71, 74];

const successMelody: SoftPianoMelody = {
  notesToLoad,
  sampled: [
    { note: 55, at: 0, duration: 0.76, velocity: 32 },
    { note: 62, at: 0.12, duration: 0.72, velocity: 28 },
    { note: 71, at: 0.28, duration: 0.82, velocity: 30 }
  ],
  fallback: [
    { frequency: 196, at: 0, duration: 0.72, peak: 0.04 },
    { frequency: 293.66, at: 0.12, duration: 0.68, peak: 0.034 },
    { frequency: 493.88, at: 0.28, duration: 0.78, peak: 0.036 }
  ],
  lengthSeconds: 1.12
};

const mistakeMelody: SoftPianoMelody = {
  notesToLoad,
  sampled: [
    { note: 64, at: 0, duration: 0.58, velocity: 22 },
    { note: 59, at: 0.18, duration: 0.68, velocity: 20 }
  ],
  fallback: [
    { frequency: 329.63, at: 0, duration: 0.54, peak: 0.026 },
    { frequency: 246.94, at: 0.18, duration: 0.64, peak: 0.024 }
  ],
  lengthSeconds: 0.92
};

export function warmFindDigitAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoad);
}

export function playFindDigitSuccessMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, successMelody);
}

export function playFindDigitMistakeMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, mistakeMelody);
}

export function disposeFindDigitAudio() {
  disposeSoftPiano();
}

import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano, type SoftPianoMelody } from "../../core/softPiano";

const notesToLoad = [55, 59, 62, 64, 67, 71];

const successMelody: SoftPianoMelody = {
  notesToLoad,
  sampled: [
    { note: 55, at: 0, duration: 0.74, velocity: 29 },
    { note: 62, at: 0.16, duration: 0.72, velocity: 26 },
    { note: 67, at: 0.34, duration: 0.78, velocity: 28 }
  ],
  fallback: [
    { frequency: 196, at: 0, duration: 0.7, peak: 0.036 },
    { frequency: 293.66, at: 0.16, duration: 0.68, peak: 0.03 },
    { frequency: 392, at: 0.34, duration: 0.74, peak: 0.032 }
  ],
  lengthSeconds: 1.12
};

const mistakeMelody: SoftPianoMelody = {
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

export function warmFindEmotionAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoad);
}

export function playFindEmotionSuccessMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, successMelody);
}

export function playFindEmotionMistakeMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, mistakeMelody);
}

export function disposeFindEmotionAudio() {
  disposeSoftPiano();
}

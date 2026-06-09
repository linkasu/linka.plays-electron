import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano, type SoftPianoMelody } from "../../core/softPiano";

const notesToLoad = [55, 60, 64, 67, 72];

const placeMelody: SoftPianoMelody = {
  notesToLoad,
  lengthSeconds: 0.72,
  sampled: [
    { note: "C4", at: 0, duration: 0.56, velocity: 44 },
    { note: "G4", at: 0.2, duration: 0.58, velocity: 38 }
  ],
  fallback: [
    { frequency: 261.63, at: 0, duration: 0.48, peak: 0.072 },
    { frequency: 392, at: 0.2, duration: 0.5, peak: 0.056 }
  ]
};

const softMistakeMelody: SoftPianoMelody = {
  notesToLoad,
  lengthSeconds: 0.86,
  sampled: [
    { note: "G4", at: 0, duration: 0.58, velocity: 36 },
    { note: "G3", at: 0.26, duration: 0.62, velocity: 34 }
  ],
  fallback: [
    { frequency: 392, at: 0, duration: 0.48, peak: 0.054 },
    { frequency: 196, at: 0.26, duration: 0.54, peak: 0.046 }
  ]
};

const completeMelody: SoftPianoMelody = {
  notesToLoad,
  lengthSeconds: 1.08,
  sampled: [
    { note: "C4", at: 0, duration: 0.72, velocity: 42 },
    { note: "E4", at: 0.24, duration: 0.72, velocity: 40 },
    { note: "C5", at: 0.48, duration: 0.76, velocity: 34 }
  ],
  fallback: [
    { frequency: 261.63, at: 0, duration: 0.62, peak: 0.064 },
    { frequency: 329.63, at: 0.24, duration: 0.62, peak: 0.058 },
    { frequency: 523.25, at: 0.48, duration: 0.66, peak: 0.048 }
  ]
};

export function warmPyramidAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoad);
}

export function playPyramidPlaceMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, placeMelody);
}

export function playPyramidMistakeMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, softMistakeMelody);
}

export function playPyramidCompleteMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, completeMelody);
}

export function disposePyramidAudio() {
  disposeSoftPiano();
}

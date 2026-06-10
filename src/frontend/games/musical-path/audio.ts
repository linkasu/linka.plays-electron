import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano, type SoftPianoMelody } from "../../core/softPiano";

const notesToLoad = [60, 62, 64, 67, 69, 72];

const noteMelodies: SoftPianoMelody[] = [
  makeNoteMelody("C4", 261.63, 0.034),
  makeNoteMelody("D4", 293.66, 0.032),
  makeNoteMelody("E4", 329.63, 0.03),
  makeNoteMelody("G4", 392, 0.028),
  makeNoteMelody("A4", 440, 0.026),
  makeNoteMelody("C5", 523.25, 0.024)
];

const completeMelody: SoftPianoMelody = {
  notesToLoad,
  lengthSeconds: 1.1,
  sampled: [
    { note: "C4", at: 0, duration: 0.72, velocity: 24 },
    { note: "E4", at: 0.24, duration: 0.72, velocity: 22 },
    { note: "C5", at: 0.48, duration: 0.8, velocity: 20 }
  ],
  fallback: [
    { frequency: 261.63, at: 0, duration: 0.62, peak: 0.032 },
    { frequency: 329.63, at: 0.24, duration: 0.62, peak: 0.028 },
    { frequency: 523.25, at: 0.48, duration: 0.7, peak: 0.022 }
  ]
};

function makeNoteMelody(note: string, frequency: number, peak: number): SoftPianoMelody {
  return {
    notesToLoad,
    lengthSeconds: 0.62,
    sampled: [
      { note, at: 0, duration: 0.56, velocity: 24 }
    ],
    fallback: [
      { frequency, at: 0, duration: 0.5, peak }
    ]
  };
}

export function warmMusicalPathAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoad);
}

export function playMusicalPathNote(enabled: boolean, index: number) {
  return playSoftPianoMelody(enabled, noteMelodies[index % noteMelodies.length]).catch(() => undefined);
}

export function playMusicalPathComplete(enabled: boolean) {
  return playSoftPianoMelody(enabled, completeMelody).catch(() => undefined);
}

export function disposeMusicalPathAudio() {
  disposeSoftPiano();
}

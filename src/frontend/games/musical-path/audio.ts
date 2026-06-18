import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano, type SoftPianoMelody } from "../../core/softPiano";

const notesToLoad = [60, 62, 64, 65, 67, 69, 71, 72];

const noteMelodies: SoftPianoMelody[] = [
  makeNoteMelody("C4", 261.63, 0.108),
  makeNoteMelody("D4", 293.66, 0.104),
  makeNoteMelody("E4", 329.63, 0.1),
  makeNoteMelody("F4", 349.23, 0.096),
  makeNoteMelody("G4", 392, 0.092),
  makeNoteMelody("A4", 440, 0.088),
  makeNoteMelody("B4", 493.88, 0.084),
  makeNoteMelody("C5", 523.25, 0.08)
];

const completeMelody: SoftPianoMelody = {
  notesToLoad,
  lengthSeconds: 1.1,
  sampled: [
    { note: "C4", at: 0, duration: 0.72, velocity: 58 },
    { note: "E4", at: 0.24, duration: 0.72, velocity: 54 },
    { note: "C5", at: 0.48, duration: 0.8, velocity: 50 }
  ],
  fallback: [
    { frequency: 261.63, at: 0, duration: 0.62, peak: 0.096 },
    { frequency: 329.63, at: 0.24, duration: 0.62, peak: 0.084 },
    { frequency: 523.25, at: 0.48, duration: 0.7, peak: 0.066 }
  ]
};

const mistakeMelody: SoftPianoMelody = {
  notesToLoad,
  lengthSeconds: 0.9,
  sampled: [
    { note: "E4", at: 0, duration: 0.5, velocity: 40 },
    { note: "C4", at: 0.24, duration: 0.62, velocity: 34 }
  ],
  fallback: [
    { frequency: 329.63, at: 0, duration: 0.46, peak: 0.064 },
    { frequency: 261.63, at: 0.24, duration: 0.58, peak: 0.052 }
  ]
};

function makeNoteMelody(note: string, frequency: number, peak: number): SoftPianoMelody {
  return {
    notesToLoad,
    lengthSeconds: 0.62,
    sampled: [
      { note, at: 0, duration: 0.56, velocity: 64 }
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

export function playMusicalPathMistake(enabled: boolean) {
  return playSoftPianoMelody(enabled, mistakeMelody).catch(() => undefined);
}

export function disposeMusicalPathAudio() {
  disposeSoftPiano();
}

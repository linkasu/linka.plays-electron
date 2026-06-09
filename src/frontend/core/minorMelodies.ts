import type { SoftPianoMelody } from "./softPiano";

export type MinorMelody = SoftPianoMelody & {
  id: string;
  title: string;
};

const sharedMinorPianoNotes = [55, 57, 58, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76];

export const softMinorMelodies: MinorMelody[] = [
  {
    id: "a-minor-hush",
    title: "A minor hush",
    notesToLoad: sharedMinorPianoNotes,
    lengthSeconds: 3.65,
    sampled: [
      { note: "A3", at: 0, duration: 1.55, velocity: 54 },
      { note: "C4", at: 0.6, duration: 1.6, velocity: 56 },
      { note: "E4", at: 1.26, duration: 1.65, velocity: 52 },
      { note: "A4", at: 2.08, duration: 1.75, velocity: 44 }
    ],
    fallback: [
      { frequency: 220, at: 0, duration: 1.42, peak: 0.122 },
      { frequency: 261.63, at: 0.6, duration: 1.48, peak: 0.112 },
      { frequency: 329.63, at: 1.26, duration: 1.52, peak: 0.096 },
      { frequency: 440, at: 2.08, duration: 1.62, peak: 0.078 }
    ]
  },
  {
    id: "d-minor-soft-step",
    title: "D minor soft step",
    notesToLoad: sharedMinorPianoNotes,
    lengthSeconds: 3.55,
    sampled: [
      { note: "D4", at: 0, duration: 1.48, velocity: 54 },
      { note: "F4", at: 0.58, duration: 1.55, velocity: 56 },
      { note: "A4", at: 1.2, duration: 1.6, velocity: 50 },
      { note: "D5", at: 2, duration: 1.68, velocity: 42 }
    ],
    fallback: [
      { frequency: 293.66, at: 0, duration: 1.36, peak: 0.118 },
      { frequency: 349.23, at: 0.58, duration: 1.42, peak: 0.108 },
      { frequency: 440, at: 1.2, duration: 1.48, peak: 0.092 },
      { frequency: 587.33, at: 2, duration: 1.56, peak: 0.074 }
    ]
  },
  {
    id: "e-minor-warm-shadow",
    title: "E minor warm shadow",
    notesToLoad: sharedMinorPianoNotes,
    lengthSeconds: 3.7,
    sampled: [
      { note: "E4", at: 0, duration: 1.58, velocity: 52 },
      { note: "G4", at: 0.64, duration: 1.62, velocity: 54 },
      { note: "B4", at: 1.34, duration: 1.68, velocity: 50 },
      { note: "E5", at: 2.18, duration: 1.78, velocity: 42 }
    ],
    fallback: [
      { frequency: 329.63, at: 0, duration: 1.44, peak: 0.116 },
      { frequency: 392, at: 0.64, duration: 1.5, peak: 0.106 },
      { frequency: 493.88, at: 1.34, duration: 1.54, peak: 0.09 },
      { frequency: 659.25, at: 2.18, duration: 1.64, peak: 0.072 }
    ]
  },
  {
    id: "g-minor-gentle-cloud",
    title: "G minor gentle cloud",
    notesToLoad: sharedMinorPianoNotes,
    lengthSeconds: 3.6,
    sampled: [
      { note: "G3", at: 0, duration: 1.5, velocity: 52 },
      { note: "A#3", at: 0.62, duration: 1.55, velocity: 54 },
      { note: "D4", at: 1.24, duration: 1.6, velocity: 50 },
      { note: "G4", at: 2.04, duration: 1.7, velocity: 42 }
    ],
    fallback: [
      { frequency: 196, at: 0, duration: 1.38, peak: 0.114 },
      { frequency: 233.08, at: 0.62, duration: 1.42, peak: 0.106 },
      { frequency: 293.66, at: 1.24, duration: 1.48, peak: 0.09 },
      { frequency: 392, at: 2.04, duration: 1.58, peak: 0.072 }
    ]
  }
];

export function notesToLoadForMinorMelodies(melodies = softMinorMelodies) {
  return [...new Set(melodies.flatMap((melody) => melody.notesToLoad ?? []))].sort((a, b) => a - b);
}

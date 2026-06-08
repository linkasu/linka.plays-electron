import type { SoftPianoMelody } from "./softPiano";

export type MajorMelody = SoftPianoMelody & {
  id: string;
  title: string;
};

const sharedMajorPianoNotes = [55, 57, 59, 60, 62, 64, 65, 66, 67, 69, 71, 72, 74, 76];

export const softMajorMelodies: MajorMelody[] = [
  {
    id: "c-major-awaken",
    title: "C major awaken",
    notesToLoad: sharedMajorPianoNotes,
    lengthSeconds: 3.5,
    sampled: [
      { note: "C4", at: 0, duration: 1.5, velocity: 64 },
      { note: "E4", at: 0.56, duration: 1.6, velocity: 66 },
      { note: "G4", at: 1.14, duration: 1.7, velocity: 60 },
      { note: "C5", at: 1.96, duration: 1.9, velocity: 52 }
    ],
    fallback: [
      { frequency: 261.63, at: 0, duration: 1.35, peak: 0.16 },
      { frequency: 329.63, at: 0.56, duration: 1.45, peak: 0.145 },
      { frequency: 392, at: 1.14, duration: 1.55, peak: 0.126 },
      { frequency: 523.25, at: 1.96, duration: 1.7, peak: 0.1 }
    ]
  },
  {
    id: "g-major-lift",
    title: "G major lift",
    notesToLoad: sharedMajorPianoNotes,
    lengthSeconds: 3.4,
    sampled: [
      { note: "G3", at: 0, duration: 1.45, velocity: 60 },
      { note: "B3", at: 0.58, duration: 1.5, velocity: 62 },
      { note: "D4", at: 1.16, duration: 1.6, velocity: 60 },
      { note: "G4", at: 1.9, duration: 1.75, velocity: 50 }
    ],
    fallback: [
      { frequency: 196, at: 0, duration: 1.3, peak: 0.145 },
      { frequency: 246.94, at: 0.58, duration: 1.38, peak: 0.135 },
      { frequency: 293.66, at: 1.16, duration: 1.48, peak: 0.126 },
      { frequency: 392, at: 1.9, duration: 1.62, peak: 0.1 }
    ]
  },
  {
    id: "f-major-sway",
    title: "F major sway",
    notesToLoad: sharedMajorPianoNotes,
    lengthSeconds: 3.6,
    sampled: [
      { note: "F4", at: 0, duration: 1.55, velocity: 60 },
      { note: "A4", at: 0.62, duration: 1.55, velocity: 62 },
      { note: "C5", at: 1.28, duration: 1.55, velocity: 56 },
      { note: "A4", at: 2.05, duration: 1.65, velocity: 48 }
    ],
    fallback: [
      { frequency: 349.23, at: 0, duration: 1.42, peak: 0.14 },
      { frequency: 440, at: 0.62, duration: 1.42, peak: 0.13 },
      { frequency: 523.25, at: 1.28, duration: 1.42, peak: 0.108 },
      { frequency: 440, at: 2.05, duration: 1.52, peak: 0.09 }
    ]
  },
  {
    id: "d-major-glow",
    title: "D major glow",
    notesToLoad: sharedMajorPianoNotes,
    lengthSeconds: 3.45,
    sampled: [
      { note: "D4", at: 0, duration: 1.45, velocity: 58 },
      { note: "F#4", at: 0.56, duration: 1.55, velocity: 60 },
      { note: "A4", at: 1.18, duration: 1.55, velocity: 56 },
      { note: "D5", at: 1.94, duration: 1.7, velocity: 48 }
    ],
    fallback: [
      { frequency: 293.66, at: 0, duration: 1.32, peak: 0.136 },
      { frequency: 369.99, at: 0.56, duration: 1.42, peak: 0.126 },
      { frequency: 440, at: 1.18, duration: 1.42, peak: 0.112 },
      { frequency: 587.33, at: 1.94, duration: 1.55, peak: 0.088 }
    ]
  },
  {
    id: "c-major-rest",
    title: "C major rest",
    notesToLoad: sharedMajorPianoNotes,
    lengthSeconds: 3.7,
    sampled: [
      { note: "E4", at: 0, duration: 1.6, velocity: 56 },
      { note: "G4", at: 0.7, duration: 1.7, velocity: 58 },
      { note: "C5", at: 1.46, duration: 1.8, velocity: 52 },
      { note: "G4", at: 2.28, duration: 1.7, velocity: 46 }
    ],
    fallback: [
      { frequency: 329.63, at: 0, duration: 1.46, peak: 0.125 },
      { frequency: 392, at: 0.7, duration: 1.55, peak: 0.116 },
      { frequency: 523.25, at: 1.46, duration: 1.65, peak: 0.098 },
      { frequency: 392, at: 2.28, duration: 1.55, peak: 0.082 }
    ]
  }
];

export function notesToLoadForMajorMelodies(melodies = softMajorMelodies) {
  return [...new Set(melodies.flatMap((melody) => melody.notesToLoad ?? []))].sort((a, b) => a - b);
}

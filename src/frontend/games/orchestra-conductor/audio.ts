import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano, type SoftPianoMelody } from "../../core/softPiano";

const notesToLoad = [55, 60, 64, 67, 72, 76];

const beatMelodies: SoftPianoMelody[] = [
  makeBeatMelody("G3", 196, 0.022),
  makeBeatMelody("C4", 261.63, 0.024),
  makeBeatMelody("E4", 329.63, 0.022),
  makeBeatMelody("G4", 392, 0.02),
  makeBeatMelody("C5", 523.25, 0.018),
  makeBeatMelody("E5", 659.25, 0.016)
];

const completeMelody: SoftPianoMelody = {
  notesToLoad,
  lengthSeconds: 1.15,
  sampled: [
    { note: "C4", at: 0, duration: 0.78, velocity: 22 },
    { note: "G4", at: 0.24, duration: 0.78, velocity: 20 },
    { note: "C5", at: 0.48, duration: 0.82, velocity: 18 }
  ],
  fallback: [
    { frequency: 261.63, at: 0, duration: 0.68, peak: 0.02 },
    { frequency: 392, at: 0.24, duration: 0.68, peak: 0.018 },
    { frequency: 523.25, at: 0.48, duration: 0.72, peak: 0.016 }
  ]
};

function makeBeatMelody(note: string, frequency: number, peak: number): SoftPianoMelody {
  return {
    notesToLoad,
    lengthSeconds: 0.58,
    sampled: [
      { note, at: 0, duration: 0.5, velocity: 20 }
    ],
    fallback: [
      { frequency, at: 0, duration: 0.48, peak }
    ]
  };
}

export function warmOrchestraConductorAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoad);
}

export function playOrchestraConductorBeat(enabled: boolean, beat: number) {
  return playSoftPianoMelody(enabled, beatMelodies[(beat - 1) % beatMelodies.length]).catch(() => undefined);
}

export function playOrchestraConductorComplete(enabled: boolean) {
  return playSoftPianoMelody(enabled, completeMelody).catch(() => undefined);
}

export function disposeOrchestraConductorAudio() {
  disposeSoftPiano();
}

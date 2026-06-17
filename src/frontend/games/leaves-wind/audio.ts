import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano, type SoftPianoMelody } from "../../core/softPiano";

const notesToLoad = [60, 64, 67, 69, 72];

const flowMelodies: SoftPianoMelody[] = [
  {
    notesToLoad,
    lengthSeconds: 0.82,
    sampled: [
      { note: "C4", at: 0, duration: 0.62, velocity: 18 },
      { note: "G4", at: 0.18, duration: 0.66, velocity: 16 },
      { note: "A4", at: 0.36, duration: 0.68, velocity: 14 }
    ],
    fallback: [
      { frequency: 261.63, at: 0, duration: 0.56, peak: 0.018 },
      { frequency: 392, at: 0.18, duration: 0.58, peak: 0.015 },
      { frequency: 440, at: 0.36, duration: 0.6, peak: 0.012 }
    ]
  },
  {
    notesToLoad,
    lengthSeconds: 0.86,
    sampled: [
      { note: "E4", at: 0, duration: 0.64, velocity: 18 },
      { note: "A4", at: 0.2, duration: 0.66, velocity: 15 },
      { note: "C5", at: 0.4, duration: 0.72, velocity: 13 }
    ],
    fallback: [
      { frequency: 329.63, at: 0, duration: 0.58, peak: 0.017 },
      { frequency: 440, at: 0.2, duration: 0.6, peak: 0.014 },
      { frequency: 523.25, at: 0.4, duration: 0.66, peak: 0.011 }
    ]
  }
];

let melodyIndex = 0;

export function warmLeavesWindAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoad);
}

export function playLeavesWindFlowCue(enabled: boolean) {
  const melody = flowMelodies[melodyIndex % flowMelodies.length];
  melodyIndex += 1;
  return playSoftPianoMelody(enabled, melody).catch(() => undefined);
}

export function disposeLeavesWindAudio() {
  melodyIndex = 0;
  disposeSoftPiano();
}

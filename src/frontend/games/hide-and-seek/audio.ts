import { createNonRepeatingRandomIndexGenerator } from "../../core/random";
import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano, type SoftPianoMelody } from "../../core/softPiano";

const notesToLoad = [57, 60, 64, 67, 69, 72];

const successMelodies: SoftPianoMelody[] = [
  {
    notesToLoad,
    lengthSeconds: 1.08,
    sampled: [
      { note: "C4", at: 0, duration: 0.78, velocity: 58 },
      { note: "E4", at: 0.22, duration: 0.78, velocity: 58 },
      { note: "G4", at: 0.44, duration: 0.82, velocity: 52 }
    ],
    fallback: [
      { frequency: 261.63, at: 0, duration: 0.68, peak: 0.116 },
      { frequency: 329.63, at: 0.22, duration: 0.68, peak: 0.104 },
      { frequency: 392, at: 0.44, duration: 0.72, peak: 0.086 }
    ]
  },
  {
    notesToLoad,
    lengthSeconds: 1.12,
    sampled: [
      { note: "G4", at: 0, duration: 0.76, velocity: 56 },
      { note: "C5", at: 0.26, duration: 0.82, velocity: 50 }
    ],
    fallback: [
      { frequency: 392, at: 0, duration: 0.66, peak: 0.108 },
      { frequency: 523.25, at: 0.26, duration: 0.72, peak: 0.084 }
    ]
  }
];

const mistakeMelodies: SoftPianoMelody[] = [
  {
    notesToLoad,
    lengthSeconds: 0.98,
    sampled: [
      { note: "A4", at: 0, duration: 0.72, velocity: 48 },
      { note: "C4", at: 0.28, duration: 0.72, velocity: 46 }
    ],
    fallback: [
      { frequency: 440, at: 0, duration: 0.62, peak: 0.084 },
      { frequency: 261.63, at: 0.28, duration: 0.62, peak: 0.072 }
    ]
  },
  {
    notesToLoad,
    lengthSeconds: 1.02,
    sampled: [
      { note: "E4", at: 0, duration: 0.72, velocity: 48 },
      { note: "A3", at: 0.3, duration: 0.76, velocity: 44 }
    ],
    fallback: [
      { frequency: 329.63, at: 0, duration: 0.62, peak: 0.082 },
      { frequency: 220, at: 0.3, duration: 0.66, peak: 0.07 }
    ]
  }
];

const successGenerator = createNonRepeatingRandomIndexGenerator(successMelodies.length);
const mistakeGenerator = createNonRepeatingRandomIndexGenerator(mistakeMelodies.length);

function nextSuccessMelody() {
  return successMelodies[successGenerator.next() ?? 0];
}

function nextMistakeMelody() {
  return mistakeMelodies[mistakeGenerator.next() ?? 0];
}

export function resetHideAndSeekAudioSession() {
  successGenerator.reset();
  mistakeGenerator.reset();
}

export function warmHideAndSeekAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoad);
}

export function playHideAndSeekSuccessMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, nextSuccessMelody());
}

export function playHideAndSeekMistakeMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, nextMistakeMelody());
}

export function disposeHideAndSeekAudio() {
  resetHideAndSeekAudioSession();
  disposeSoftPiano();
}

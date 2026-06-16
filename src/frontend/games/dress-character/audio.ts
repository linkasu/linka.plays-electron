import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano, type SoftPianoMelody } from "../../core/softPiano";

const notesToLoad = [53, 57, 60, 64, 67, 72];

const successMelody: SoftPianoMelody = {
  notesToLoad,
  sampled: [
    { note: 53, at: 0, duration: 0.66, velocity: 25 },
    { note: 60, at: 0.16, duration: 0.7, velocity: 24 },
    { note: 67, at: 0.36, duration: 0.8, velocity: 26 }
  ],
  fallback: [
    { frequency: 174.61, at: 0, duration: 0.62, peak: 0.03 },
    { frequency: 261.63, at: 0.16, duration: 0.66, peak: 0.027 },
    { frequency: 392, at: 0.36, duration: 0.74, peak: 0.028 }
  ],
  lengthSeconds: 1.16
};

const hintMelody: SoftPianoMelody = {
  notesToLoad,
  sampled: [
    { note: 64, at: 0, duration: 0.5, velocity: 17 },
    { note: 57, at: 0.22, duration: 0.62, velocity: 16 }
  ],
  fallback: [
    { frequency: 329.63, at: 0, duration: 0.46, peak: 0.019 },
    { frequency: 220, at: 0.22, duration: 0.58, peak: 0.017 }
  ],
  lengthSeconds: 0.84
};

export function warmDressCharacterAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoad);
}

export function playDressCharacterSuccessMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, successMelody);
}

export function playDressCharacterHintMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, hintMelody);
}

export function disposeDressCharacterAudio() {
  disposeSoftPiano();
}

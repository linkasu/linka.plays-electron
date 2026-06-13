import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano, type SoftPianoMelody } from "../../core/softPiano";

const notesToLoad = [52, 55, 59, 64, 67, 72];

const successMelody: SoftPianoMelody = {
  notesToLoad,
  sampled: [
    { note: 52, at: 0, duration: 0.62, velocity: 26 },
    { note: 59, at: 0.14, duration: 0.66, velocity: 24 },
    { note: 67, at: 0.32, duration: 0.74, velocity: 27 }
  ],
  fallback: [
    { frequency: 164.81, at: 0, duration: 0.58, peak: 0.032 },
    { frequency: 246.94, at: 0.14, duration: 0.62, peak: 0.028 },
    { frequency: 392, at: 0.32, duration: 0.68, peak: 0.03 }
  ],
  lengthSeconds: 1.04
};

const mistakeMelody: SoftPianoMelody = {
  notesToLoad,
  sampled: [
    { note: 64, at: 0, duration: 0.46, velocity: 17 },
    { note: 55, at: 0.2, duration: 0.62, velocity: 16 }
  ],
  fallback: [
    { frequency: 329.63, at: 0, duration: 0.44, peak: 0.02 },
    { frequency: 196, at: 0.2, duration: 0.58, peak: 0.018 }
  ],
  lengthSeconds: 0.82
};

export function warmBuildRobotAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoad);
}

export function playBuildRobotSuccessMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, successMelody);
}

export function playBuildRobotMistakeMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, mistakeMelody);
}

export function disposeBuildRobotAudio() {
  disposeSoftPiano();
}

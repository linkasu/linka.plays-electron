import { createAmbientPiano, type AmbientPianoPatternNote } from "../../core/ambientPiano";

const lanternPattern = [
  { note: 62, beat: 0, duration: 0.72, velocity: 46, grace: [57, 59] },
  { note: 66, beat: 0.48, duration: 0.78, velocity: 48 },
  { note: 69, beat: 0.96, duration: 0.92, velocity: 52, grace: [66] },
  { note: 74, beat: 1.62, duration: 1.22, velocity: 55 },
  { note: 69, beat: 2.38, duration: 0.88, velocity: 48 },
  { note: 66, beat: 2.92, duration: 0.78, velocity: 45 },
  { note: 64, beat: 3.42, duration: 0.7, velocity: 43, grace: [62] },
  { note: 66, beat: 3.9, duration: 1.1, velocity: 46 },
  { note: 59, beat: 5.0, duration: 0.8, velocity: 42, grace: [54] },
  { note: 62, beat: 5.48, duration: 0.74, velocity: 45 },
  { note: 66, beat: 5.96, duration: 0.9, velocity: 50, grace: [64] },
  { note: 69, beat: 6.58, duration: 1.24, velocity: 54 },
  { note: 66, beat: 7.34, duration: 0.82, velocity: 47 },
  { note: 62, beat: 7.88, duration: 1.16, velocity: 44 },
  { note: 57, beat: 9.0, duration: 0.82, velocity: 40, grace: [54] },
  { note: 59, beat: 9.5, duration: 0.74, velocity: 43 },
  { note: 62, beat: 9.98, duration: 0.78, velocity: 46 },
  { note: 66, beat: 10.48, duration: 0.92, velocity: 50, grace: [62, 64] },
  { note: 64, beat: 11.14, duration: 0.74, velocity: 44 },
  { note: 59, beat: 11.64, duration: 1.28, velocity: 42 }
] satisfies readonly AmbientPianoPatternNote[];

const piano = createAmbientPiano({
  notesToLoad: [50, 52, 54, 57, 59, 62, 64, 66, 69, 71, 74, 76, 78, 81, 83],
  patternNotes: lanternPattern,
  patternLengthSeconds: 13.2,
  cueNotes: [62, 66, 69, 74, 69, 66],
  reverbName: "paper-lanterns-soft-room",
  reverbAmount: 0.32,
  volume: 86,
  velocity: 58,
  decayTime: 2.45,
  velocityRange: [1, 76],
  loopLookaheadSeconds: 1.8,
  loopStepSeconds: 13.2,
  loopAccentEvery: 1,
  loopAccentDurationSeconds: 1,
  loopBaseDurationSeconds: 1,
  loopAccentVelocity: 1,
  loopBaseVelocity: 1,
  graceOffsetSeconds: -0.12,
  graceStepSeconds: 0.055,
  graceDurationSeconds: 0.2,
  graceMinVelocity: 42,
  graceVelocityOffset: -3,
  patternVelocityOffset: 8,
  cueStepSeconds: 0.13,
  cueDurationSeconds: [0.62, 0.62, 0.62, 1.05, 0.62, 0.62],
  cueVelocities: [66, 64, 62, 74, 58, 56],
  cueCooldownSeconds: 0.98,
  activeGain: 1,
  fadeInSeconds: 0.9,
  fadeOutSeconds: 1.5
});

export function warmPaperLanternsPiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setPaperLanternsPianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function tickPaperLanternsPiano(enabled: boolean) {
  piano.tick(enabled);
}

export function playPaperLanternsCue(enabled: boolean) {
  piano.playCue(enabled);
}

export function disposePaperLanternsPiano() {
  piano.dispose();
}

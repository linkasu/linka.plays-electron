import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [45, 47, 49, 52, 54, 56, 57, 59, 61, 64, 68, 73],
  loopNotes: [49, 56, 61, 49, 56, 61, 52, 56, 61, 52, 56, 61, 45, 52, 57, 45, 52, 57, 47, 54, 59, 47, 54, 59],
  cueNotes: [61, 64, 68, 73],
  reverbName: "moon-path-room",
  reverbAmount: 0.24,
  volume: 78,
  velocity: 58,
  decayTime: 3.9,
  velocityRange: [1, 64],
  loopLookaheadSeconds: 1.8,
  loopStepSeconds: 0.42,
  loopAccentEvery: 3,
  loopAccentDurationSeconds: 1.95,
  loopBaseDurationSeconds: 1.5,
  loopAccentVelocity: 64,
  loopBaseVelocity: 52,
  cueStepSeconds: 0.2,
  cueDurationSeconds: 1.2,
  cueStartVelocity: 68,
  cueVelocityStep: 4,
  cueCooldownSeconds: 1.05,
  activeGain: 1,
  fadeInSeconds: 1.2,
  fadeOutSeconds: 1.9
});

export function warmMoonPathPiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setMoonPathPianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function tickMoonPathPiano(enabled: boolean) {
  piano.tick(enabled);
}

export function playMoonPathCue(enabled: boolean) {
  piano.playCue(enabled);
}

export function disposeMoonPathPiano() {
  piano.dispose();
}

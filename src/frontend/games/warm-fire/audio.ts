import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [40, 43, 47, 50, 52, 55, 59, 62, 64, 67, 71, 74, 76],
  loopNotes: [40, 47, 52, 59, 55, 50, 43, 47, 55, 62, 59, 52, 47, 52, 59, 67, 64, 55, 50, 55, 62, 71, 67, 59],
  cueNotes: [52, 59, 64, 71, 76],
  reverbName: "warm-fire-soft-room",
  reverbAmount: 0.3,
  volume: 72,
  velocity: 48,
  decayTime: 4.2,
  velocityRange: [1, 72],
  loopLookaheadSeconds: 2,
  loopStepSeconds: 0.36,
  loopAccentEvery: 6,
  loopAccentDurationSeconds: 1.9,
  loopBaseDurationSeconds: 1.15,
  loopAccentVelocity: 54,
  loopBaseVelocity: 42,
  cueStepSeconds: 0.13,
  cueDurationSeconds: 1.05,
  cueStartVelocity: 68,
  cueVelocityStep: 3,
  cueCooldownSeconds: 0.86,
  activeGain: 0.55,
  fadeInSeconds: 1.2,
  fadeOutSeconds: 1.8
});

export function warmWarmFirePiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setWarmFirePianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function tickWarmFirePiano(enabled: boolean) {
  piano.tick(enabled);
}

export function playWarmFireCue(enabled: boolean) {
  piano.playCue(enabled);
}

export function disposeWarmFirePiano() {
  piano.dispose();
}

import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [55, 60, 64, 67, 72, 76],
  loopNotes: [60, 67, 72, 64, 67, 60, 55, 64],
  cueNotes: [67, 72, 76],
  reverbName: "catch-light-room",
  reverbAmount: 0.18,
  volume: 54,
  velocity: 44,
  decayTime: 2.6,
  velocityRange: [1, 66],
  loopLookaheadSeconds: 1.5,
  loopStepSeconds: 0.86,
  loopAccentEvery: 4,
  loopAccentDurationSeconds: 1.5,
  loopBaseDurationSeconds: 1.5,
  loopAccentVelocity: 38,
  loopBaseVelocity: 30,
  cueStepSeconds: 0.18,
  cueDurationSeconds: 1.05,
  cueStartVelocity: 44,
  cueVelocityStep: 4,
  cueCooldownSeconds: 0.82,
  activeGain: 0.82,
  fadeInSeconds: 1.2,
  fadeOutSeconds: 1.5
});

export function warmCatchLightPiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setCatchLightPianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function tickCatchLightPiano(enabled: boolean) {
  piano.tick(enabled);
}

export function playCatchLightCue(enabled: boolean) {
  piano.playCue(enabled);
}

export function disposeCatchLightPiano() {
  piano.dispose();
}

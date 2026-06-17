import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [41, 45, 48, 50, 52, 55, 57, 60, 64, 67, 69, 72],
  loopNotes: [41, 48, 55, 60, 55, 48, 45, 52, 57, 64, 57, 52, 41, 50, 57, 67, 64, 57, 45, 52, 60, 69, 64, 52],
  cueNotes: [60, 64, 67, 72],
  reverbName: "sea-shells-tide-room",
  reverbAmount: 0.3,
  volume: 76,
  velocity: 50,
  decayTime: 4.4,
  velocityRange: [1, 64],
  loopLookaheadSeconds: 1.9,
  loopStepSeconds: 0.4,
  loopAccentEvery: 6,
  loopAccentDurationSeconds: 1.7,
  loopBaseDurationSeconds: 1.1,
  loopAccentVelocity: 58,
  loopBaseVelocity: 46,
  cueStepSeconds: 0.17,
  cueDurationSeconds: 1.05,
  cueStartVelocity: 60,
  cueVelocityStep: 3,
  cueCooldownSeconds: 0.86,
  activeGain: 0.86,
  fadeInSeconds: 1.25,
  fadeOutSeconds: 1.6
});

export function warmSeaShellsPiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setSeaShellsPianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function tickSeaShellsPiano(enabled: boolean) {
  piano.tick(enabled);
}

export function playSeaShellsCue(enabled: boolean) {
  piano.playCue(enabled);
}

export function disposeSeaShellsPiano() {
  piano.dispose();
}

import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [50, 53, 55, 57, 60, 62, 65, 67, 69, 72, 74, 77, 81],
  loopNotes: [50, 57, 62, 69, 67, 62, 53, 60, 65, 72, 69, 65, 55, 62, 67, 74, 72, 67, 57, 65, 69, 77, 81, 74],
  cueNotes: [69, 74, 81, 77],
  reverbName: "soap-circles-room",
  reverbAmount: 0.22,
  volume: 76,
  velocity: 54,
  decayTime: 3.7,
  velocityRange: [1, 64],
  loopLookaheadSeconds: 1.8,
  loopStepSeconds: 0.4,
  loopAccentEvery: 6,
  loopAccentDurationSeconds: 1.7,
  loopBaseDurationSeconds: 1.12,
  loopAccentVelocity: 58,
  loopBaseVelocity: 48,
  cueStepSeconds: 0.16,
  cueDurationSeconds: 1.05,
  cueStartVelocity: 64,
  cueVelocityStep: 4,
  cueCooldownSeconds: 0.9,
  activeGain: 0.9,
  fadeInSeconds: 1.2,
  fadeOutSeconds: 1.7
});

export function warmSoapCirclesPiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setSoapCirclesPianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function tickSoapCirclesPiano(enabled: boolean) {
  piano.tick(enabled);
}

export function playSoapCircleCue(enabled: boolean) {
  piano.playCue(enabled);
}

export function disposeSoapCirclesPiano() {
  piano.dispose();
}

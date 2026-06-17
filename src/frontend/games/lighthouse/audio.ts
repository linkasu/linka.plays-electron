import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [43, 45, 47, 48, 50, 52, 55, 57, 59, 60, 64, 67, 72],
  loopNotes: [45, 52, 57, 60, 57, 52, 43, 50, 55, 59, 55, 50, 45, 52, 57, 64, 60, 57, 47, 55, 59, 67, 64, 59],
  cueNotes: [57, 60, 64, 72],
  reverbName: "lighthouse-room",
  reverbAmount: 0.18,
  volume: 78,
  velocity: 56,
  decayTime: 3.2,
  velocityRange: [1, 66],
  loopLookaheadSeconds: 1.7,
  loopStepSeconds: 0.36,
  loopAccentEvery: 6,
  loopAccentDurationSeconds: 1.35,
  loopBaseDurationSeconds: 0.95,
  loopAccentVelocity: 62,
  loopBaseVelocity: 50,
  cueStepSeconds: 0.16,
  cueDurationSeconds: 0.95,
  cueStartVelocity: 64,
  cueVelocityStep: 3,
  cueCooldownSeconds: 0.86,
  activeGain: 0.92,
  fadeInSeconds: 1.1,
  fadeOutSeconds: 1.5
});

export function warmLighthousePiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setLighthousePianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function tickLighthousePiano(enabled: boolean) {
  piano.tick(enabled);
}

export function playLighthouseCue(enabled: boolean) {
  piano.playCue(enabled);
}

export function disposeLighthousePiano() {
  piano.dispose();
}

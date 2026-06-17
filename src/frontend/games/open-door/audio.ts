import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [43, 47, 50, 52, 55, 59, 62, 64, 67, 71, 74, 76],
  loopNotes: [43, 50, 55, 62, 59, 55, 47, 52, 59, 64, 62, 52, 50, 55, 62, 67, 64, 59, 47, 55, 62, 71, 67, 62],
  cueNotes: [55, 62, 67, 76],
  reverbName: "open-door-soft-room",
  reverbAmount: 0.26,
  volume: 68,
  velocity: 44,
  decayTime: 3.7,
  velocityRange: [1, 68],
  loopLookaheadSeconds: 1.8,
  loopStepSeconds: 0.4,
  loopAccentEvery: 6,
  loopAccentDurationSeconds: 1.65,
  loopBaseDurationSeconds: 1.08,
  loopAccentVelocity: 50,
  loopBaseVelocity: 40,
  cueStepSeconds: 0.15,
  cueDurationSeconds: 0.95,
  cueStartVelocity: 64,
  cueVelocityStep: 2,
  cueCooldownSeconds: 0.82,
  activeGain: 0.48,
  fadeInSeconds: 1.1,
  fadeOutSeconds: 1.5
});

export function warmOpenDoorPiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setOpenDoorPianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function tickOpenDoorPiano(enabled: boolean) {
  piano.tick(enabled);
}

export function playOpenDoorCue(enabled: boolean) {
  piano.playCue(enabled);
}

export function disposeOpenDoorPiano() {
  piano.dispose();
}

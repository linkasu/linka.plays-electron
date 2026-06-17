import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [43, 47, 50, 52, 55, 59, 62, 64, 67, 71, 74, 76, 79],
  loopNotes: [43, 50, 55, 62, 59, 55, 47, 52, 59, 64, 67, 62, 50, 55, 62, 71, 67, 62, 47, 55, 59, 67, 74, 79],
  cueNotes: [62, 67, 74, 79],
  reverbName: "light-gallery-room",
  reverbAmount: 0.24,
  volume: 74,
  velocity: 54,
  decayTime: 4.1,
  velocityRange: [1, 64],
  loopLookaheadSeconds: 1.9,
  loopStepSeconds: 0.48,
  loopAccentEvery: 6,
  loopAccentDurationSeconds: 2.1,
  loopBaseDurationSeconds: 1.35,
  loopAccentVelocity: 58,
  loopBaseVelocity: 46,
  cueStepSeconds: 0.2,
  cueDurationSeconds: 1.25,
  cueStartVelocity: 62,
  cueVelocityStep: 4,
  cueCooldownSeconds: 1,
  activeGain: 0.9,
  fadeInSeconds: 1.2,
  fadeOutSeconds: 1.8
});

export function warmLightGalleryPiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setLightGalleryPianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function playLightGalleryCue(enabled: boolean) {
  piano.playCue(enabled);
}

export function tickLightGalleryPiano(enabled: boolean) {
  piano.tick(enabled);
}

export function disposeLightGalleryPiano() {
  piano.dispose();
}

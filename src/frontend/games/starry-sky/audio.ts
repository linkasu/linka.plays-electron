import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [45, 47, 49, 52, 54, 56, 57, 59, 61, 64, 68, 73],
  loopNotes: [49, 56, 61, 49, 56, 61, 52, 56, 61, 52, 56, 61, 45, 52, 57, 45, 52, 57, 47, 54, 59, 47, 54, 59],
  cueNotes: [61, 64, 68, 73],
  reverbName: "starry-sky-room",
  reverbAmount: 0.22,
  volume: 78,
  velocity: 58,
  decayTime: 3.8,
  velocityRange: [1, 58],
  loopLookaheadSeconds: 1.8,
  loopStepSeconds: 0.42,
  loopAccentEvery: 3,
  loopAccentDurationSeconds: 1.9,
  loopBaseDurationSeconds: 1.45,
  loopAccentVelocity: 64,
  loopBaseVelocity: 52,
  cueStepSeconds: 0.2,
  cueDurationSeconds: 1.2,
  cueStartVelocity: 68,
  cueVelocityStep: 4,
  cueCooldownSeconds: 1.05,
  activeGain: 1,
  fadeInSeconds: 1.2,
  fadeOutSeconds: 1.8
});

export function warmStarrySkyPiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setStarrySkyPianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function tickStarrySkyPiano(enabled: boolean) {
  piano.tick(enabled);
}

export function playStarrySkyCue(enabled: boolean) {
  piano.playCue(enabled);
}

export function disposeStarrySkyPiano() {
  piano.dispose();
}

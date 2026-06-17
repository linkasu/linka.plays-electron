import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [55, 59, 62, 67, 71, 74],
  loopNotes: [59, 67, 71, 74, 67, 62, 59, 55],
  cueNotes: [67, 71, 74, 79],
  reverbName: "firefly-meadow-room",
  reverbAmount: 0.22,
  volume: 54,
  velocity: 44,
  decayTime: 3,
  velocityRange: [1, 66],
  loopLookaheadSeconds: 1.6,
  loopStepSeconds: 0.96,
  loopAccentEvery: 4,
  loopAccentDurationSeconds: 1.85,
  loopBaseDurationSeconds: 1.85,
  loopAccentVelocity: 40,
  loopBaseVelocity: 32,
  cueStepSeconds: 0.16,
  cueDurationSeconds: 1.15,
  cueStartVelocity: 46,
  cueVelocityStep: 3,
  cueCooldownSeconds: 0.95,
  activeGain: 0.56,
  fadeInSeconds: 1.4,
  fadeOutSeconds: 1.8
});

export function warmFireflyMeadowPiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setFireflyMeadowPianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function tickFireflyMeadowPiano(enabled: boolean) {
  piano.tick(enabled);
}

export function playFireflyIgniteCue(enabled: boolean) {
  piano.playCue(enabled);
}

export function disposeFireflyMeadowPiano() {
  piano.dispose();
}

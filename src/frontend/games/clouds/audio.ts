import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [55, 60, 64, 67, 72],
  loopNotes: [60, 67, 64, 72, 67, 64, 60, 55],
  reverbName: "clouds-room",
  reverbAmount: 0.2,
  volume: 52,
  velocity: 42,
  decayTime: 2.8,
  velocityRange: [1, 64],
  loopLookaheadSeconds: 1.5,
  loopStepSeconds: 0.9,
  loopAccentEvery: 4,
  loopAccentDurationSeconds: 1.65,
  loopBaseDurationSeconds: 1.65,
  loopAccentVelocity: 38,
  loopBaseVelocity: 30,
  activeGain: 0.8,
  fadeInSeconds: 1.4,
  fadeOutSeconds: 1.8
});

export function warmCloudsPiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setCloudsPianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function tickCloudsPiano(enabled: boolean) {
  piano.tick(enabled);
}

export function disposeCloudsPiano() {
  piano.dispose();
}

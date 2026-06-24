import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [55, 60, 64, 67, 72],
  loopNotes: [60, 67, 64, 72, 67, 64, 60, 55],
  reverbName: "clouds-room",
  reverbAmount: 0.2,
  volume: 84,
  velocity: 48,
  decayTime: 2.8,
  velocityRange: [1, 64],
  loopLookaheadSeconds: 1.5,
  loopStepSeconds: 0.9,
  loopAccentEvery: 4,
  loopAccentDurationSeconds: 1.65,
  loopBaseDurationSeconds: 1.65,
  loopAccentVelocity: 48,
  loopBaseVelocity: 40,
  cueNotes: [60, 64, 67],
  cueStepSeconds: 0.2,
  cueDurationSeconds: [1.05, 1.1, 1.18],
  cueVelocities: [68, 62, 58],
  cueCooldownSeconds: 0.8,
  cueQuantizeToLoop: true,
  cueQuantizeDelaySteps: 1,
  activeGain: 1.08,
  fadeInSeconds: 1.4,
  fadeOutSeconds: 1.8
});

export function warmCloudsPiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setCloudsPianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function setCloudsPianoIntensity(enabled: boolean, intensity: number) {
  piano.setIntensity(enabled, intensity);
}

export function tickCloudsPiano(enabled: boolean) {
  piano.tick(enabled);
}

export function playCloudsPianoCue(enabled: boolean) {
  piano.playCue(enabled);
}

export function disposeCloudsPiano() {
  piano.dispose();
}

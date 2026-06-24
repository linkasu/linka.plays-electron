import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [55, 62, 67, 71, 74, 79],
  loopNotes: [55, 62, 67, 74, 71, 67, 62, 55],
  reverbName: "kite-sky-room",
  reverbAmount: 0.22,
  volume: 82,
  velocity: 44,
  decayTime: 3.2,
  velocityRange: [1, 64],
  loopLookaheadSeconds: 1.6,
  loopStepSeconds: 1.05,
  loopAccentEvery: 4,
  loopAccentDurationSeconds: 1.9,
  loopBaseDurationSeconds: 1.55,
  loopAccentVelocity: 48,
  loopBaseVelocity: 38,
  activeGain: 0.95,
  fadeInSeconds: 1.3,
  fadeOutSeconds: 1.8
});

export function warmKitePiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setKitePianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function setKitePianoIntensity(enabled: boolean, intensity: number) {
  piano.setIntensity(enabled, intensity);
}

export function tickKitePiano(enabled: boolean) {
  piano.tick(enabled);
}

export function disposeKitePiano() {
  piano.dispose();
}

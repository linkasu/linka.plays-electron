import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [42, 45, 49, 52, 54, 57, 61, 64, 66, 69, 73, 76],
  loopNotes: [42, 49, 54, 61, 66, 61, 45, 52, 57, 64, 69, 64, 49, 54, 61, 69, 73, 69, 45, 52, 57, 66, 76, 73],
  reverbName: "northern-lights-room",
  reverbAmount: 0.25,
  volume: 78,
  velocity: 54,
  decayTime: 4.4,
  velocityRange: [1, 64],
  loopLookaheadSeconds: 2,
  loopStepSeconds: 0.5,
  loopAccentEvery: 6,
  loopAccentDurationSeconds: 2.2,
  loopBaseDurationSeconds: 1.5,
  loopAccentVelocity: 60,
  loopBaseVelocity: 48,
  activeGain: 0.92,
  fadeInSeconds: 1.4,
  fadeOutSeconds: 1.9
});

export function warmNorthernLightsPiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setNorthernLightsPianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function tickNorthernLightsPiano(enabled: boolean) {
  piano.tick(enabled);
}

export function disposeNorthernLightsPiano() {
  piano.dispose();
}

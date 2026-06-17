import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [57, 60, 64, 67, 69, 72],
  loopNotes: [60, 64, 67, 72, 69, 67, 64, 57],
  reverbName: "breathing-flower-room",
  reverbAmount: 0.16,
  volume: 58,
  velocity: 48,
  decayTime: 2.4,
  velocityRange: [1, 70],
  loopLookaheadSeconds: 1.2,
  loopStepSeconds: 0.82,
  loopAccentEvery: 4,
  loopAccentDurationSeconds: 1.45,
  loopBaseDurationSeconds: 1.45,
  loopAccentVelocity: 42,
  loopBaseVelocity: 34,
  activeGain: 0.8,
  fadeInSeconds: 1.2,
  fadeOutSeconds: 1.8,
  rescheduleActive: true
});

export function warmBreathingFlowerPiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setBreathingFlowerPianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function tickBreathingFlowerPiano(enabled: boolean) {
  piano.tick(enabled);
}

export function disposeBreathingFlowerPiano() {
  piano.dispose();
}

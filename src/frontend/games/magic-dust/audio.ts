import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [53, 55, 57, 60, 62, 64, 66, 67, 69, 72, 76, 79, 81, 84],
  loopNotes: [53, 60, 67, 76, 72, 67, 62, 69, 76, 81, 79, 72, 57, 64, 69, 79, 76, 69, 60, 66, 72, 81, 84, 79],
  cueNotes: [72, 79, 84, 81],
  reverbName: "magic-dust-room",
  reverbAmount: 0.2,
  volume: 76,
  velocity: 56,
  decayTime: 3.9,
  velocityRange: [1, 64],
  loopLookaheadSeconds: 1.7,
  loopStepSeconds: 0.32,
  loopAccentEvery: 6,
  loopAccentDurationSeconds: 1.6,
  loopBaseDurationSeconds: 1.05,
  loopAccentVelocity: 58,
  loopBaseVelocity: 46,
  cueStepSeconds: 0.14,
  cueDurationSeconds: 1.1,
  cueStartVelocity: 64,
  cueVelocityStep: 3,
  cueCooldownSeconds: 0.8,
  activeGain: 0.92,
  fadeInSeconds: 1.1,
  fadeOutSeconds: 1.6
});

export function warmMagicDustPiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setMagicDustPianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function tickMagicDustPiano(enabled: boolean) {
  piano.tick(enabled);
}

export function playMagicDustCue(enabled: boolean) {
  piano.playCue(enabled);
}

export function disposeMagicDustPiano() {
  piano.dispose();
}

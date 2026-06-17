import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [34, 38, 41, 45, 48, 50, 53, 57, 60, 62, 65, 69],
  loopNotes: [34, 45, 53, 57, 53, 45, 38, 48, 57, 62, 57, 48, 41, 50, 60, 65, 60, 50, 38, 45, 53, 60, 57, 45],
  cueNotes: [53, 57, 60, 69],
  reverbName: "sand-garden-dune-room",
  reverbAmount: 0.28,
  volume: 76,
  velocity: 52,
  decayTime: 4.2,
  velocityRange: [1, 64],
  loopLookaheadSeconds: 1.8,
  loopStepSeconds: 0.42,
  loopAccentEvery: 6,
  loopAccentDurationSeconds: 1.8,
  loopBaseDurationSeconds: 1.2,
  loopAccentVelocity: 58,
  loopBaseVelocity: 46,
  cueStepSeconds: 0.18,
  cueDurationSeconds: 1.15,
  cueStartVelocity: 58,
  cueVelocityStep: 3,
  cueCooldownSeconds: 0.9,
  activeGain: 0.84,
  fadeInSeconds: 1.4,
  fadeOutSeconds: 1.7
});

export function warmSandGardenPiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setSandGardenPianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function tickSandGardenPiano(enabled: boolean) {
  piano.tick(enabled);
}

export function playSandGardenCue(enabled: boolean) {
  piano.playCue(enabled);
}

export function disposeSandGardenPiano() {
  piano.dispose();
}

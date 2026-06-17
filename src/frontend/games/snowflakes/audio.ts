import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [48, 52, 55, 57, 59, 60, 62, 64, 67, 69, 71, 72, 76, 79, 84],
  loopLayers: [
    { notes: [48, 55, 52, 57], stepSeconds: 1.6, durationSeconds: 2.4, velocity: 42 }
  ],
  loopNotes: [67, 67, 67, 64, 67, 72, 60, 62, 64, 65, 67, 69, 67, 64, 60, 64, 67, 71, 72, 76, 72, 69, 67, 64],
  cueNotes: [72, 76, 79, 84],
  reverbName: "snowflakes-room",
  reverbAmount: 0.18,
  volume: 78,
  velocity: 56,
  decayTime: 3.2,
  velocityRange: [1, 66],
  loopLookaheadSeconds: 1.8,
  loopStepSeconds: 0.4,
  loopAccentEvery: 6,
  loopAccentDurationSeconds: 1.15,
  loopBaseDurationSeconds: 0.78,
  loopAccentVelocity: 58,
  loopBaseVelocity: 48,
  cueStepSeconds: 0.12,
  cueDurationSeconds: 0.9,
  cueStartVelocity: 64,
  cueVelocityStep: 3,
  cueCooldownSeconds: 0.72,
  activeGain: 0.9,
  fadeInSeconds: 1.1,
  fadeOutSeconds: 1.7
});

export function warmSnowflakesPiano(enabled: boolean) {
  piano.warm(enabled);
}

export function setSnowflakesPianoActive(enabled: boolean, nextActive: boolean) {
  piano.setActive(enabled, nextActive);
}

export function tickSnowflakesPiano(enabled: boolean) {
  piano.tick(enabled);
}

export function playSnowflakeCue(enabled: boolean) {
  piano.playCue(enabled);
}

export function disposeSnowflakesPiano() {
  piano.dispose();
}

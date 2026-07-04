import { createAmbientPiano } from "../../core/ambientPiano";
import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";

const piano = createAmbientPiano({
  notesToLoad: [45, 48, 52, 55, 57, 60, 64, 67, 69, 72],
  loopNotes: [45, 52, 57, 64, 60, 57, 52, 48, 45, 55, 60, 67, 64, 60, 55, 52],
  cueNotes: [57, 60, 64, 69],
  reverbName: "boat-river-room",
  reverbAmount: 0.24,
  volume: 74,
  velocity: 42,
  decayTime: 3.6,
  velocityRange: [1, 64],
  loopLookaheadSeconds: 1.8,
  loopStepSeconds: 0.62,
  loopAccentEvery: 4,
  loopAccentDurationSeconds: 1.6,
  loopBaseDurationSeconds: 1.05,
  loopAccentVelocity: 48,
  loopBaseVelocity: 36,
  cueStepSeconds: 0.16,
  cueDurationSeconds: 0.95,
  cueStartVelocity: 54,
  cueVelocityStep: 3,
  cueCooldownSeconds: 0.8,
  activeGain: 0.72,
  fadeInSeconds: 1.25,
  fadeOutSeconds: 1.5
});

const feedback = createStandardGameFeedback();

export function warmBoatAudio(enabled: boolean) {
  piano.warm(enabled);
  feedback.warm(enabled);
}

export function setBoatMusicActive(enabled: boolean, active: boolean) {
  piano.setActive(enabled, active);
}

export function tickBoatMusic(enabled: boolean) {
  piano.tick(enabled);
}

export function playBoatSuccessCue(enabled: boolean) {
  piano.playCue(enabled);
}

export function playBoatDamageCue(enabled: boolean) {
  return feedback.playMistake(enabled);
}

export function disposeBoatAudio() {
  piano.dispose();
  feedback.dispose();
}

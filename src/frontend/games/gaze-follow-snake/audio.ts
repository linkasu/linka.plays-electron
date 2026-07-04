import { createAmbientPiano } from "../../core/ambientPiano";

const piano = createAmbientPiano({
  notesToLoad: [48, 52, 55, 57, 60, 64, 67, 69, 72],
  loopNotes: [48, 55, 60, 67, 64, 60, 55, 52, 48, 57, 60, 69, 67, 60, 57, 52],
  cueNotes: [60, 64, 67, 72],
  reverbName: "gaze-snake-meadow-room",
  reverbAmount: 0.26,
  volume: 72,
  velocity: 40,
  decayTime: 3.8,
  velocityRange: [1, 64],
  loopLookaheadSeconds: 1.7,
  loopStepSeconds: 0.72,
  loopAccentEvery: 4,
  loopAccentDurationSeconds: 1.75,
  loopBaseDurationSeconds: 1.15,
  loopAccentVelocity: 45,
  loopBaseVelocity: 35,
  cueStepSeconds: 0.16,
  cueDurationSeconds: 0.95,
  cueStartVelocity: 52,
  cueVelocityStep: 3,
  cueCooldownSeconds: 0.78,
  activeGain: 0.68,
  fadeInSeconds: 1.35,
  fadeOutSeconds: 1.6
});

export function warmGazeFollowSnakeAudio(enabled: boolean) {
  piano.warm(enabled);
}

export function setGazeFollowSnakeMusicActive(enabled: boolean, active: boolean) {
  piano.setActive(enabled, active);
}

export function tickGazeFollowSnakeMusic(enabled: boolean) {
  piano.tick(enabled);
}

export function playGazeFollowSnakeLeafCue(enabled: boolean) {
  piano.playCue(enabled);
}

export function disposeGazeFollowSnakeAudio() {
  piano.dispose();
}

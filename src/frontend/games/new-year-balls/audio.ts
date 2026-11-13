import { createTherapeuticMelodyPlayer } from "../../core/therapeuticMelodyPlayer";

const player = createTherapeuticMelodyPlayer();

export function resetNewYearBallsAudioSession() {
  player.reset();
}

export function warmNewYearBallsAudio(enabled: boolean) {
  player.warm(enabled);
}

export function playNewYearBallsMelody(enabled: boolean) {
  return player.play(enabled);
}

export function disposeNewYearBallsAudio() {
  player.dispose();
}

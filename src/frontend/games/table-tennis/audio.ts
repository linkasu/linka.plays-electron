import { createTherapeuticMelodyPlayer } from "../../core/therapeuticMelodyPlayer";

const player = createTherapeuticMelodyPlayer();

export function resetTennisAudioSession() {
  player.reset();
}

export function warmTennisAudio(enabled: boolean) {
  player.warm(enabled);
}

export function playTennisMelody(enabled: boolean) {
  return player.play(enabled);
}

export function disposeTennisAudio() {
  player.dispose();
}

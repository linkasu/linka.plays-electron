import { createTherapeuticMelodyPlayer } from "../../core/therapeuticMelodyPlayer";

const player = createTherapeuticMelodyPlayer();

export function resetButterflyAudioSession() {
  player.reset();
}

export function warmButterflyAudio(enabled: boolean) {
  player.warm(enabled);
}

export function playButterflyMelody(enabled: boolean) {
  return player.play(enabled);
}

export function disposeButterflyAudio() {
  player.dispose();
}

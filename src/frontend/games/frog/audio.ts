import { createTherapeuticMelodyPlayer } from "../../core/therapeuticMelodyPlayer";

const player = createTherapeuticMelodyPlayer();

export function resetFrogAudioSession() {
  player.reset();
}

export function warmFrogAudio(enabled: boolean) {
  player.warm(enabled);
}

export function playFrogMelody(enabled: boolean) {
  return player.play(enabled);
}

export function disposeFrogAudio() {
  player.dispose();
}

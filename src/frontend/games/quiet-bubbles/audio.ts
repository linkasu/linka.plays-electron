import { createTherapeuticMelodyPlayer } from "../../core/therapeuticMelodyPlayer";

const player = createTherapeuticMelodyPlayer();

export function resetQuietBubblesAudioSession() {
  player.reset();
}

export function warmQuietBubblesAudio(enabled: boolean) {
  player.warm(enabled);
}

export function playQuietBubbleMelody(enabled: boolean) {
  return player.play(enabled);
}

export function disposeQuietBubblesAudio() {
  player.dispose();
}

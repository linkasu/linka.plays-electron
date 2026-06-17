import { createTherapeuticMelodyPlayer } from "../../core/therapeuticMelodyPlayer";

const player = createTherapeuticMelodyPlayer();

export function resetFlowerAudioSession() {
  player.reset();
}

export function warmFlowerAudio(enabled: boolean) {
  player.warm(enabled);
}

export function playFlowerMelody(enabled: boolean) {
  return player.play(enabled);
}

export function disposeFlowerAudio() {
  player.dispose();
}

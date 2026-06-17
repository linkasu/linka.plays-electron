import { createTherapeuticMelodyPlayer } from "../../core/therapeuticMelodyPlayer";

const player = createTherapeuticMelodyPlayer();

export function resetAquariumAudioSession() {
  player.reset();
}

export function warmAquariumAudio(enabled: boolean) {
  player.warm(enabled);
}

export function playAquariumMelody(enabled: boolean) {
  return player.play(enabled);
}

export function disposeAquariumAudio() {
  player.dispose();
}

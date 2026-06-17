import { createTherapeuticMelodyPlayer } from "../../core/therapeuticMelodyPlayer";

const player = createTherapeuticMelodyPlayer();

export function resetFishAudioSession() {
  player.reset();
}

export function warmFishAudio(enabled: boolean) {
  player.warm(enabled);
}

export function playFishMelody(enabled: boolean) {
  return player.play(enabled);
}

export function disposeFishAudio() {
  player.dispose();
}

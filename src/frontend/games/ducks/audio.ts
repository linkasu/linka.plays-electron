import { createTherapeuticMelodyPlayer } from "../../core/therapeuticMelodyPlayer";

const player = createTherapeuticMelodyPlayer();

export function resetDuckAudioSession() {
  player.reset();
}

export function warmDuckAudio(enabled: boolean) {
  player.warm(enabled);
}

export function playDuckMelody(enabled: boolean) {
  return player.play(enabled);
}

export function disposeDuckAudio() {
  player.dispose();
}

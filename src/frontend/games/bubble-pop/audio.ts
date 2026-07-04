import { createTherapeuticMelodyPlayer } from "../../core/therapeuticMelodyPlayer";

const player = createTherapeuticMelodyPlayer();

export function resetBubblePopAudioSession() {
  player.reset();
}

export function warmBubblePopAudio(enabled: boolean) {
  player.warm(enabled);
}

export function playBubblePopMelody(enabled: boolean) {
  return player.play(enabled);
}

export function disposeBubblePopAudio() {
  player.dispose();
}

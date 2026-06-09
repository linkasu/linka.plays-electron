import { notesToLoadForMajorMelodies, softMajorMelodies } from "../../core/majorMelodies";
import { createNonRepeatingRandomIndexGenerator } from "../../core/random";
import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano } from "../../core/softPiano";

const melodyGenerator = createNonRepeatingRandomIndexGenerator(softMajorMelodies.length);

function nextFrogMelody() {
  return softMajorMelodies[melodyGenerator.next() ?? 0];
}

export function resetFrogAudioSession() {
  melodyGenerator.reset();
}

export function warmFrogAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoadForMajorMelodies());
}

export function playFrogMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, nextFrogMelody());
}

export function disposeFrogAudio() {
  resetFrogAudioSession();
  disposeSoftPiano();
}

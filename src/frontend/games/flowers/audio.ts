import { notesToLoadForMajorMelodies, softMajorMelodies } from "../../core/majorMelodies";
import { createNonRepeatingRandomIndexGenerator } from "../../core/random";
import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano } from "../../core/softPiano";

const melodyGenerator = createNonRepeatingRandomIndexGenerator(softMajorMelodies.length);

function nextFlowerMelody() {
  return softMajorMelodies[melodyGenerator.next() ?? 0];
}

export function resetFlowerAudioSession() {
  melodyGenerator.reset();
}

export function warmFlowerAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoadForMajorMelodies());
}

export function playFlowerMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, nextFlowerMelody());
}

export function disposeFlowerAudio() {
  resetFlowerAudioSession();
  disposeSoftPiano();
}

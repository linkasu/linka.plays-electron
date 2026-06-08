import { notesToLoadForMajorMelodies, softMajorMelodies } from "../../core/majorMelodies";
import { createNonRepeatingRandomIndexGenerator } from "../../core/random";
import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano } from "../../core/softPiano";

const melodyGenerator = createNonRepeatingRandomIndexGenerator(softMajorMelodies.length);

function nextButterflyMelody() {
  return softMajorMelodies[melodyGenerator.next() ?? 0];
}

export function resetButterflyAudioSession() {
  melodyGenerator.reset();
}

export function warmButterflyAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoadForMajorMelodies());
}

export function playButterflyMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, nextButterflyMelody());
}

export function disposeButterflyAudio() {
  resetButterflyAudioSession();
  disposeSoftPiano();
}

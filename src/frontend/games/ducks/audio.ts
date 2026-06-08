import { notesToLoadForMajorMelodies, softMajorMelodies } from "../../core/majorMelodies";
import { createNonRepeatingRandomIndexGenerator } from "../../core/random";
import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano } from "../../core/softPiano";

const melodyGenerator = createNonRepeatingRandomIndexGenerator(softMajorMelodies.length);

function nextDuckMelody() {
  return softMajorMelodies[melodyGenerator.next() ?? 0];
}

export function resetDuckAudioSession() {
  melodyGenerator.reset();
}

export function warmDuckAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoadForMajorMelodies());
}

export function playDuckMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, nextDuckMelody());
}

export function disposeDuckAudio() {
  resetDuckAudioSession();
  disposeSoftPiano();
}

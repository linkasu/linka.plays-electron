import { notesToLoadForMajorMelodies, softMajorMelodies } from "../../core/majorMelodies";
import { createNonRepeatingRandomIndexGenerator } from "../../core/random";
import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano } from "../../core/softPiano";

const melodyGenerator = createNonRepeatingRandomIndexGenerator(softMajorMelodies.length);

function nextFishMelody() {
  return softMajorMelodies[melodyGenerator.next() ?? 0];
}

export function resetFishAudioSession() {
  melodyGenerator.reset();
}

export function warmFishAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoadForMajorMelodies());
}

export function playFishMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, nextFishMelody());
}

export function disposeFishAudio() {
  resetFishAudioSession();
  disposeSoftPiano();
}

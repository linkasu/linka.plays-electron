import { createNonRepeatingRandomIndexGenerator } from "../../core/random";
import { notesToLoadForSoftTherapeuticMelodies, softTherapeuticMelodies } from "../../core/softMelodies";
import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano } from "../../core/softPiano";

const melodyGenerator = createNonRepeatingRandomIndexGenerator(softTherapeuticMelodies.length);

function nextFishMelody() {
  return softTherapeuticMelodies[melodyGenerator.next() ?? 0];
}

export function resetFishAudioSession() {
  melodyGenerator.reset();
}

export function warmFishAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoadForSoftTherapeuticMelodies());
}

export function playFishMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, nextFishMelody());
}

export function disposeFishAudio() {
  resetFishAudioSession();
  disposeSoftPiano();
}

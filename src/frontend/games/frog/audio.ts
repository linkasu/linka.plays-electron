import { createNonRepeatingRandomIndexGenerator } from "../../core/random";
import { notesToLoadForSoftTherapeuticMelodies, softTherapeuticMelodies } from "../../core/softMelodies";
import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano } from "../../core/softPiano";

const melodyGenerator = createNonRepeatingRandomIndexGenerator(softTherapeuticMelodies.length);

function nextFrogMelody() {
  return softTherapeuticMelodies[melodyGenerator.next() ?? 0];
}

export function resetFrogAudioSession() {
  melodyGenerator.reset();
}

export function warmFrogAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoadForSoftTherapeuticMelodies());
}

export function playFrogMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, nextFrogMelody());
}

export function disposeFrogAudio() {
  resetFrogAudioSession();
  disposeSoftPiano();
}

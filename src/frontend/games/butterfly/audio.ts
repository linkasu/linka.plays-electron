import { createNonRepeatingRandomIndexGenerator } from "../../core/random";
import { notesToLoadForSoftTherapeuticMelodies, softTherapeuticMelodies } from "../../core/softMelodies";
import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano } from "../../core/softPiano";

const melodyGenerator = createNonRepeatingRandomIndexGenerator(softTherapeuticMelodies.length);

function nextButterflyMelody() {
  return softTherapeuticMelodies[melodyGenerator.next() ?? 0];
}

export function resetButterflyAudioSession() {
  melodyGenerator.reset();
}

export function warmButterflyAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoadForSoftTherapeuticMelodies());
}

export function playButterflyMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, nextButterflyMelody());
}

export function disposeButterflyAudio() {
  resetButterflyAudioSession();
  disposeSoftPiano();
}

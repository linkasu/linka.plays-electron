import { createNonRepeatingRandomIndexGenerator } from "../../core/random";
import { notesToLoadForSoftTherapeuticMelodies, softTherapeuticMelodies } from "../../core/softMelodies";
import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano } from "../../core/softPiano";

const melodyGenerator = createNonRepeatingRandomIndexGenerator(softTherapeuticMelodies.length);

function nextFlowerMelody() {
  return softTherapeuticMelodies[melodyGenerator.next() ?? 0];
}

export function resetFlowerAudioSession() {
  melodyGenerator.reset();
}

export function warmFlowerAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoadForSoftTherapeuticMelodies());
}

export function playFlowerMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, nextFlowerMelody());
}

export function disposeFlowerAudio() {
  resetFlowerAudioSession();
  disposeSoftPiano();
}

import { createNonRepeatingRandomIndexGenerator } from "../../core/random";
import { notesToLoadForSoftTherapeuticMelodies, softTherapeuticMelodies } from "../../core/softMelodies";
import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano } from "../../core/softPiano";

const melodyGenerator = createNonRepeatingRandomIndexGenerator(softTherapeuticMelodies.length);

function nextAquariumMelody() {
  return softTherapeuticMelodies[melodyGenerator.next() ?? 0];
}

export function resetAquariumAudioSession() {
  melodyGenerator.reset();
}

export function warmAquariumAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoadForSoftTherapeuticMelodies());
}

export function playAquariumMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, nextAquariumMelody());
}

export function disposeAquariumAudio() {
  resetAquariumAudioSession();
  disposeSoftPiano();
}

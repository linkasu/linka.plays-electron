import { createNonRepeatingRandomIndexGenerator } from "../../core/random";
import { notesToLoadForSoftTherapeuticMelodies, softTherapeuticMelodies } from "../../core/softMelodies";
import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano } from "../../core/softPiano";

const melodyGenerator = createNonRepeatingRandomIndexGenerator(softTherapeuticMelodies.length);

function nextBubbleMelody() {
  return softTherapeuticMelodies[melodyGenerator.next() ?? 0];
}

export function resetQuietBubblesAudioSession() {
  melodyGenerator.reset();
}

export function warmQuietBubblesAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoadForSoftTherapeuticMelodies());
}

export function playQuietBubbleMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, nextBubbleMelody());
}

export function disposeQuietBubblesAudio() {
  resetQuietBubblesAudioSession();
  disposeSoftPiano();
}

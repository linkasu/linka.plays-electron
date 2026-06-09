import { createNonRepeatingRandomIndexGenerator } from "../../core/random";
import { notesToLoadForSoftTherapeuticMelodies, softTherapeuticMelodies } from "../../core/softMelodies";
import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano } from "../../core/softPiano";

const melodyGenerator = createNonRepeatingRandomIndexGenerator(softTherapeuticMelodies.length);

function nextDuckMelody() {
  return softTherapeuticMelodies[melodyGenerator.next() ?? 0];
}

export function resetDuckAudioSession() {
  melodyGenerator.reset();
}

export function warmDuckAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoadForSoftTherapeuticMelodies());
}

export function playDuckMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, nextDuckMelody());
}

export function disposeDuckAudio() {
  resetDuckAudioSession();
  disposeSoftPiano();
}

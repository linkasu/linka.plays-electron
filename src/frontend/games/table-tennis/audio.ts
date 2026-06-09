import { createNonRepeatingRandomIndexGenerator } from "../../core/random";
import { notesToLoadForSoftTherapeuticMelodies, softTherapeuticMelodies } from "../../core/softMelodies";
import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano } from "../../core/softPiano";

const melodyGenerator = createNonRepeatingRandomIndexGenerator(softTherapeuticMelodies.length);

function nextTennisMelody() {
  return softTherapeuticMelodies[melodyGenerator.next() ?? 0];
}

export function resetTennisAudioSession() {
  melodyGenerator.reset();
}

export function warmTennisAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoadForSoftTherapeuticMelodies());
}

export function playTennisMelody(enabled: boolean) {
  return playSoftPianoMelody(enabled, nextTennisMelody());
}

export function disposeTennisAudio() {
  resetTennisAudioSession();
  disposeSoftPiano();
}

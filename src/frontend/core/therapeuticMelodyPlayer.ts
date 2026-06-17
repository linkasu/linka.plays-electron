import { createNonRepeatingRandomIndexGenerator } from "./random";
import { notesToLoadForSoftTherapeuticMelodies, softTherapeuticMelodies } from "./softMelodies";
import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano } from "./softPiano";

export function createTherapeuticMelodyPlayer() {
  const melodyGenerator = createNonRepeatingRandomIndexGenerator(softTherapeuticMelodies.length);

  function nextMelody() {
    return softTherapeuticMelodies[melodyGenerator.next() ?? 0];
  }

  return {
    reset() {
      melodyGenerator.reset();
    },
    warm(enabled: boolean) {
      warmSoftPiano(enabled, notesToLoadForSoftTherapeuticMelodies());
    },
    play(enabled: boolean) {
      return playSoftPianoMelody(enabled, nextMelody());
    },
    dispose() {
      melodyGenerator.reset();
      disposeSoftPiano();
    }
  };
}

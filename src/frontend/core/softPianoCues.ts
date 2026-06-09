import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano, type SoftPianoMelody } from "./softPiano";

export function createSoftPianoCuePlayer<TCue extends string>(cues: Record<TCue, SoftPianoMelody>, notesToLoad: number[]) {
  return {
    warm(enabled: boolean) {
      warmSoftPiano(enabled, notesToLoad);
    },
    play(enabled: boolean, cue: TCue) {
      return playSoftPianoMelody(enabled, cues[cue]);
    },
    dispose() {
      disposeSoftPiano();
    }
  };
}

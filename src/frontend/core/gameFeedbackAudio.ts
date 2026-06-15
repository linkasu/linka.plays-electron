import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano, type SoftPianoMelody } from "./softPiano";

export type GameFeedbackConfig = {
  notesToLoad?: number[];
  success: Omit<SoftPianoMelody, "notesToLoad"> & { notesToLoad?: number[] };
  mistake: Omit<SoftPianoMelody, "notesToLoad"> & { notesToLoad?: number[] };
};

export type GameFeedback = {
  warm: (enabled: boolean) => void;
  playSuccess: (enabled: boolean) => Promise<void>;
  playMistake: (enabled: boolean) => Promise<void>;
  dispose: () => void;
};

export function createGameFeedback(config: GameFeedbackConfig): GameFeedback {
  const successNotes = config.success.notesToLoad ?? config.notesToLoad;
  const mistakeNotes = config.mistake.notesToLoad ?? config.notesToLoad;
  const success: SoftPianoMelody = { ...config.success, notesToLoad: successNotes };
  const mistake: SoftPianoMelody = { ...config.mistake, notesToLoad: mistakeNotes };
  const warmupNotes = config.notesToLoad ?? Array.from(new Set([...(successNotes ?? []), ...(mistakeNotes ?? [])]));

  return {
    warm(enabled: boolean) {
      warmSoftPiano(enabled, warmupNotes);
    },
    playSuccess(enabled: boolean) {
      return playSoftPianoMelody(enabled, success);
    },
    playMistake(enabled: boolean) {
      return playSoftPianoMelody(enabled, mistake);
    },
    dispose() {
      disposeSoftPiano();
    }
  };
}

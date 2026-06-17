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

export const standardGameFeedbackNotes = [55, 60, 63, 64, 67, 72];

export const standardMajorSuccessFeedback: Omit<SoftPianoMelody, "notesToLoad"> = {
  sampled: [
    { note: 60, at: 0, duration: 0.74, velocity: 44 },
    { note: 64, at: 0.16, duration: 0.78, velocity: 42 },
    { note: 67, at: 0.34, duration: 0.84, velocity: 40 },
    { note: 72, at: 0.54, duration: 0.94, velocity: 36 }
  ],
  fallback: [
    { frequency: 261.63, at: 0, duration: 0.7, peak: 0.06 },
    { frequency: 329.63, at: 0.16, duration: 0.74, peak: 0.054 },
    { frequency: 392, at: 0.34, duration: 0.8, peak: 0.05 },
    { frequency: 523.25, at: 0.54, duration: 0.9, peak: 0.044 }
  ],
  lengthSeconds: 1.48
};

export const standardMinorMistakeFeedback: Omit<SoftPianoMelody, "notesToLoad"> = {
  sampled: [
    { note: 63, at: 0, duration: 0.62, velocity: 36 },
    { note: 60, at: 0.22, duration: 0.72, velocity: 32 },
    { note: 55, at: 0.44, duration: 0.84, velocity: 30 }
  ],
  fallback: [
    { frequency: 311.13, at: 0, duration: 0.58, peak: 0.046 },
    { frequency: 261.63, at: 0.22, duration: 0.68, peak: 0.04 },
    { frequency: 196, at: 0.44, duration: 0.8, peak: 0.036 }
  ],
  lengthSeconds: 1.28
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

export function createStandardGameFeedback(): GameFeedback {
  return createGameFeedback({
    notesToLoad: standardGameFeedbackNotes,
    success: standardMajorSuccessFeedback,
    mistake: standardMinorMistakeFeedback
  });
}

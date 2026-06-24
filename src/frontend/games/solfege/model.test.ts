import { describe, expect, it } from "vitest";
import { generateSolfegeSequence, isExpectedSolfegeNote, nextSolfegeNote, nextSolfegeSequenceNote, playedSolfegeNotes, solfegeChoiceNotes, solfegeMaxSteps, solfegeNotes } from "./model";

describe("solfege model", () => {
  it("keeps one octave order stable", () => {
    expect(solfegeNotes).toHaveLength(solfegeMaxSteps);
    expect(solfegeNotes.map((note) => note.id)).toEqual([
      "do",
      "re",
      "mi",
      "fa",
      "sol",
      "la",
      "si",
      "do-high"
    ]);
  });

  it("returns played and next notes from the current step", () => {
    expect(playedSolfegeNotes(0)).toEqual([]);
    expect(playedSolfegeNotes(3).map((note) => note.id)).toEqual(["do", "re", "mi"]);
    expect(nextSolfegeNote(3)?.id).toBe("fa");
    expect(nextSolfegeNote(solfegeMaxSteps)).toBeUndefined();
  });

  it("generates a randomized full-octave sequence", () => {
    const randomValues = [0.99, 0.01, 0.42, 0.73, 0.15, 0.88, 0.33];
    let index = 0;
    const sequence = generateSolfegeSequence(() => randomValues[index++] ?? 0);

    expect(sequence).toHaveLength(solfegeMaxSteps);
    expect(new Set(sequence.map((note) => note.id))).toEqual(new Set(solfegeNotes.map((note) => note.id)));
    expect(sequence.map((note) => note.id)).not.toEqual(solfegeNotes.map((note) => note.id));
    expect(nextSolfegeSequenceNote(sequence, 0)).toBe(sequence[0]);
  });

  it("uses the whole octave as playable choices", () => {
    for (let step = 0; step < solfegeMaxSteps; step += 1) {
      const choices = solfegeChoiceNotes(step).map((note) => note.id);

      expect(choices).toContain(nextSolfegeNote(step)?.id);
      expect(new Set(choices).size).toBe(choices.length);
      expect(choices).toEqual(solfegeNotes.map((note) => note.id));
    }
  });

  it("checks the expected note for the step", () => {
    expect(isExpectedSolfegeNote("do", 0)).toBe(true);
    expect(isExpectedSolfegeNote("re", 0)).toBe(false);
  });
});

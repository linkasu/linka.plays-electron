import { describe, expect, it } from "vitest";
import { isExpectedSolfegeNote, solfegeChoiceNotes, solfegeGuidedProgress, solfegeGuidedStages, solfegeMaxSteps, solfegeNotes, solfegeSelectionOutcome } from "./model";

describe("solfege model", () => {
  it("keeps one octave order stable", () => {
    expect(solfegeNotes).toHaveLength(8);
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

  it("progresses from two demonstrated notes to three and four", () => {
    expect(solfegeGuidedStages.map((stage) => stage.sequence.length)).toEqual([2, 3, 4]);
    expect(solfegeGuidedStages.map((stage) => stage.sequence.map((note) => note.id))).toEqual([
      ["do", "re"],
      ["do", "re", "mi"],
      ["do", "re", "mi", "fa"]
    ]);
    expect(solfegeMaxSteps).toBe(9);
  });

  it("maps completed notes to the expected note in the current stage", () => {
    expect(solfegeGuidedProgress(0)).toMatchObject({ stageIndex: 0, noteIndex: 0, expectedNote: { id: "do" } });
    expect(solfegeGuidedProgress(1)).toMatchObject({ stageIndex: 0, noteIndex: 1, expectedNote: { id: "re" } });
    expect(solfegeGuidedProgress(2)).toMatchObject({ stageIndex: 1, noteIndex: 0, expectedNote: { id: "do" } });
    expect(solfegeGuidedProgress(5)).toMatchObject({ stageIndex: 2, noteIndex: 0, expectedNote: { id: "do" } });
    expect(solfegeGuidedProgress(solfegeMaxSteps)).toBeUndefined();
  });

  it("uses the whole octave as playable choices", () => {
    const choices = solfegeChoiceNotes().map((note) => note.id);

    expect(new Set(choices).size).toBe(choices.length);
    expect(choices).toEqual(solfegeNotes.map((note) => note.id));
  });

  it("checks the expected note for the step", () => {
    expect(isExpectedSolfegeNote("do", 0)).toBe(true);
    expect(isExpectedSolfegeNote("re", 0)).toBe(false);
    expect(isExpectedSolfegeNote("do", 2)).toBe(true);
    expect(isExpectedSolfegeNote("do", solfegeMaxSteps)).toBe(false);
  });

  it("never reports mistakes in free piano mode", () => {
    expect(solfegeSelectionOutcome("free", "si", "do")).toBe("free");
    expect(solfegeSelectionOutcome("guided", "si", "do")).toBe("mistake");
    expect(solfegeSelectionOutcome("guided", "do", "do")).toBe("correct");
  });
});

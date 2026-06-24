import { describe, expect, it } from "vitest";
import { generateMiniDialogRound, getMiniDialogChoice, getMiniDialogNextNodeId, getMiniDialogScenarioCoverage, isMiniDialogChoiceCorrect, miniDialogGraph, miniDialogPath, validateMiniDialogGraph } from "./model";

describe("mini-dialog graph", () => {
  it("creates a graph-backed round with a speaking character", () => {
    const round = generateMiniDialogRound(1, () => 0.99, "hello");

    expect(round.roundId).toBe("mini-dialog:hello:round:1");
    expect(round.character.name).toBe("Мира");
    expect(round.partnerLine).toContain("Привет");
    expect(round.prompt).toBeTruthy();
    expect(round.choices.length).toBeGreaterThanOrEqual(2);
    expect(round.choices.some(isMiniDialogChoiceCorrect)).toBe(true);
    expect(round.choices[round.correctIndex].expected).toBe(true);
  });

  it("keeps all expected replies connected to existing next nodes", () => {
    expect(validateMiniDialogGraph()).toEqual([]);

    for (const nodeId of miniDialogPath) {
      const node = miniDialogGraph[nodeId];
      for (const choice of node.choices.filter(isMiniDialogChoiceCorrect)) {
        expect(choice.nextNodeId).toBeTruthy();
        expect(miniDialogGraph[choice.nextNodeId!]).toBeTruthy();
      }
    }
  });

  it("gives feedback for every wrong reply", () => {
    for (const nodeId of miniDialogPath) {
      const wrongChoices = miniDialogGraph[nodeId].choices.filter((choice) => !isMiniDialogChoiceCorrect(choice));

      expect(wrongChoices.length).toBeGreaterThan(0);
      expect(wrongChoices.every((choice) => choice.feedback.length > 0)).toBe(true);
    }
  });

  it("uses random source for choice order", () => {
    const lowRandomRound = generateMiniDialogRound(1, () => 0, "hello");
    const highRandomRound = generateMiniDialogRound(1, () => 0.99, "hello");

    expect(lowRandomRound.choices.map((choice) => choice.id)).not.toEqual(highRandomRound.choices.map((choice) => choice.id));
  });

  it("covers greeting, feeling, activity, choice, and closing scenarios", () => {
    const scenarios = new Set(getMiniDialogScenarioCoverage());

    expect(scenarios).toEqual(new Set(["greeting", "feeling", "activity", "choice", "closing"]));
  });

  it("rejects unknown choice ids", () => {
    const round = generateMiniDialogRound(1, () => 0.99, "hello");

    expect(() => getMiniDialogChoice(round, "unknown")).toThrow("Нет реплики unknown");
  });

  it("returns next node only for connected expected replies", () => {
    const round = generateMiniDialogRound(1, () => 0.99, "hello");
    const hello = getMiniDialogChoice(round, "hello");
    const wrong = getMiniDialogChoice(round, "more");

    expect(getMiniDialogNextNodeId(hello)).toBe("feeling");
    expect(getMiniDialogNextNodeId(wrong)).toBeUndefined();
  });
});

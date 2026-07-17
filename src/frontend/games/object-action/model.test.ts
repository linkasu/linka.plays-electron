import { describe, expect, it } from "vitest";
import ttsAssets from "../../data/ttsAssets.json";
import { createObjectActionExplanation, generateObjectActionRound, isObjectActionCorrect, objectActionChoices, objectActionChoiceTargetId } from "./model";

describe("object-action model", () => {
  it("starts with unambiguous child-facing verbs", () => {
    expect(objectActionChoices.map((choice) => choice.title)).toEqual([
      "пить",
      "есть",
      "спать",
      "идти",
      "мыть",
      "рисовать",
      "катать"
    ]);
  });

  it("creates four visual scenes with exactly one correct action", () => {
    for (let index = 1; index <= objectActionChoices.length; index += 1) {
      const round = generateObjectActionRound(index);
      const matchingChoices = round.choices.filter((choice) => isObjectActionCorrect(round, choice));

      expect(round.choices).toHaveLength(4);
      expect(matchingChoices).toEqual([round.correctChoice]);
      expect(round.prompt).toBe(`Покажи действие: ${round.targetAction.title}.`);
      expect(round.choices.every((choice) => choice.actorEmoji && choice.propEmoji && choice.cueEmoji && choice.sceneLabel)).toBe(true);
    }
  });

  it("cycles through actions", () => {
    const afterLast = generateObjectActionRound(objectActionChoices.length + 1);

    expect(afterLast.targetAction).toBe(objectActionChoices[0]);
  });

  it("keeps choice ids unique", () => {
    for (let index = 1; index <= objectActionChoices.length; index += 1) {
      const round = generateObjectActionRound(index);
      expect(new Set(round.choices.map((choice) => choice.id)).size).toBe(round.choices.length);
    }
  });

  it("keeps gaze target ids stable for choices shared by consecutive rounds", () => {
    const firstRound = generateObjectActionRound(1);
    const secondRound = generateObjectActionRound(2);
    const sharedChoice = firstRound.choices.find((choice) => secondRound.choices.some((nextChoice) => nextChoice.id === choice.id));

    expect(sharedChoice).toBeDefined();
    expect(objectActionChoiceTargetId(sharedChoice!.id)).toBe(`object-action:choice:${sharedChoice!.id}`);
    expect(objectActionChoiceTargetId(sharedChoice!.id)).not.toContain(firstRound.roundId);
    expect(objectActionChoiceTargetId(sharedChoice!.id)).not.toContain(secondRound.roundId);
  });

  it("explains only the named action", () => {
    expect(createObjectActionExplanation(objectActionChoices[1])).toBe("Это действие — есть.");
  });

  it("uses existing matching TTS assets without the brush and comb mismatch", () => {
    const assetIds = new Set(ttsAssets.map((asset) => asset.id));
    const mappedAssets = objectActionChoices.flatMap((choice) => choice.successAssetId ?? []);

    expect(mappedAssets.every((id) => assetIds.has(id))).toBe(true);
    expect(objectActionChoices.some((choice) => choice.id === "comb" || choice.sceneLabel.includes("зуб"))).toBe(false);
  });
});

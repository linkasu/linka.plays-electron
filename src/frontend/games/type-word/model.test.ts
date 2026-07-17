import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import ttsAssetsData from "../../data/ttsAssets.json";
import wordImageManifest from "../../../../public/images/words/manifest.json";
import { createTypeWordDeck, evaluateTypeWordChoice, generateTypeWordRound, typeWordAudioAssetId } from "./model";

const imageIds = new Set(wordImageManifest.map((item) => item.id));
const wordAudioIds = new Set(ttsAssetsData.filter((asset) => asset.game === "word-categories").map((asset) => asset.id));

function roundForWord(word: string, preset: "gentle" | "standard" | "challenge" = "standard") {
  const settings = settingsFromPreset(preset);
  const item = createTypeWordDeck(settings, () => 0).find((candidate) => candidate.word === word);
  if (!item) throw new Error(`Test word is missing from the TypeWord deck: ${word}`);
  return generateTypeWordRound(settings, item, 1, () => 0);
}

describe("TypeWord model", () => {
  it("keeps repeated letters and advances through each repeated slot", () => {
    const round = roundForWord("пицца");

    expect(round.letters).toEqual(["п", "и", "ц", "ц", "а"]);
    expect(round.letterChoices[2]).toContain("ц");
    expect(round.letterChoices[3]).toContain("ц");

    const firstRepeatedLetter = evaluateTypeWordChoice(round, 2, "ц");
    expect(firstRepeatedLetter).toEqual({ isCorrect: true, nextIndex: 3, complete: false });
    expect(evaluateTypeWordChoice(round, firstRepeatedLetter.nextIndex, "ц")).toEqual({ isCorrect: true, nextIndex: 4, complete: false });
  });

  it.each([
    ["gentle", 2],
    ["standard", 3],
    ["challenge", 4]
  ] as const)("offers exactly %s preset choice count", (preset, expectedCount) => {
    const settings = settingsFromPreset(preset);
    const item = createTypeWordDeck(settings, () => 0)[0];
    if (!item) throw new Error("TypeWord deck is empty.");
    const round = generateTypeWordRound(settings, item, 3, () => 0);

    expect(round.roundId).toBe("type-word:round:3");
    expect(round.letterChoices).toHaveLength(round.letters.length);
    for (const choices of round.letterChoices) expect(choices).toHaveLength(expectedCount);
  });

  it("uses unique distractors that never reveal another letter from the word", () => {
    const round = roundForWord("банан", "challenge");
    const wordLetters = new Set(round.letters);

    round.letterChoices.forEach((choices, index) => {
      const target = round.letters[index];
      expect(new Set(choices).size).toBe(choices.length);
      expect(choices.filter((choice) => choice === target)).toHaveLength(1);
      expect(choices.filter((choice) => choice !== target).every((choice) => !wordLetters.has(choice))).toBe(true);
    });
  });

  it("keeps progress unchanged after a wrong choice", () => {
    const round = roundForWord("кот");
    const distractor = round.letterChoices[0]?.find((choice) => choice !== round.letters[0]);
    if (!distractor) throw new Error("TypeWord round has no distractor.");

    expect(evaluateTypeWordChoice(round, 0, distractor)).toEqual({ isCorrect: false, nextIndex: 0, complete: false });
  });

  it.each(["gentle", "standard", "challenge"] as const)("creates a unique short-word %s deck", (preset) => {
    const deck = createTypeWordDeck(settingsFromPreset(preset), () => 0);
    const ids = deck.map((item) => item.id);
    const maxLength = preset === "gentle" ? 4 : 5;

    expect(new Set(ids).size).toBe(ids.length);
    expect(deck.length).toBeGreaterThan(5);
    expect(deck.every((item) => {
      const length = Array.from(item.word).length;
      return length >= 3 && length <= maxLength;
    })).toBe(true);
    expect(deck.every((item) => imageIds.has(item.id))).toBe(true);
    expect(deck.every((item) => wordAudioIds.has(typeWordAudioAssetId(item.id)))).toBe(true);
  });
});

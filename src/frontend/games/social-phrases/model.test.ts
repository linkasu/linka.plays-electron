import { describe, expect, it } from "vitest";
import ttsAssets from "../../data/ttsAssets.json";
import {
  socialPhraseAssetId,
  socialPhrases,
  socialPhrasesPrompt,
  socialPhrasesPromptAssetId,
} from "./model";

describe("social phrases board", () => {
  it("has the phrases the testers asked for, each with its own picture", () => {
    const labels = socialPhrases.map((phrase) => phrase.label);
    for (const label of [
      "Да",
      "Нет",
      "Хочу отдохнуть",
      "Хочу есть",
      "Хочу пить",
      "Хочу в туалет",
    ]) {
      expect(labels).toContain(label);
    }
    expect(new Set(socialPhrases.map((phrase) => phrase.id)).size).toBe(socialPhrases.length);
    expect(new Set(socialPhrases.map((phrase) => phrase.artId)).size).toBe(socialPhrases.length);
  });

  it("has a recording for the task and every phrase, with matching text", () => {
    const byId = new Map(ttsAssets.map((asset) => [asset.id, asset.text]));
    expect(byId.get(socialPhrasesPromptAssetId)).toBe(socialPhrasesPrompt);
    for (const phrase of socialPhrases) {
      expect(byId.get(socialPhraseAssetId(phrase))).toBe(phrase.phrase);
    }
  });
});

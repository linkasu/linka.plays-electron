import { describe, expect, it } from "vitest";
import { getWordsByCategory, getWordsByLength, validateWordBank, wordBank } from "./wordBank";

describe("wordBank", () => {
  it("contains a validated expanded vocabulary", () => {
    expect(wordBank).toHaveLength(160);
    expect(validateWordBank()).toEqual([]);
  });

  it("uses unique ids", () => {
    const ids = new Set(wordBank.map((item) => item.id));

    expect(ids.size).toBe(wordBank.length);
  });

  it("uses unique prompt words", () => {
    const words = new Set(wordBank.map((item) => item.word));

    expect(words.size).toBe(wordBank.length);
  });

  it("does not use placeholder symbols as emoji", () => {
    const placeholderSymbols = new Set(["▭", "〽️", "♠️", "🟫", "🟦", "🟨"]);

    expect(wordBank.filter((item) => placeholderSymbols.has(item.emoji))).toEqual([]);
  });

  it("keeps enough words for category games", () => {
    expect(getWordsByCategory("food")).toHaveLength(40);
    expect(getWordsByCategory("thing")).toHaveLength(40);
  });

  it("keeps enough short words for typing rounds", () => {
    expect(getWordsByLength(2, 4).length).toBeGreaterThanOrEqual(25);
  });
});

import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateWhatMissingRound, shuffleWhatMissingItems, whatMissingItems } from "./model";

describe("what-missing model", () => {
  it("shows exactly three unique items", () => {
    const round = generateWhatMissingRound(settingsFromPreset("gentle"), 1, () => 0.4);
    const ids = round.displayItems.map((item) => item.id);

    expect(round.displayItems).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it("uses the displayed items as answer choices", () => {
    const round = generateWhatMissingRound(settingsFromPreset("standard"), 2, () => 0.7);
    const displayedIds = new Set(round.displayItems.map((item) => item.id));
    const choiceIds = new Set(round.choices.map((item) => item.id));

    expect(round.choices).toHaveLength(3);
    expect(choiceIds).toEqual(displayedIds);
  });

  it("points correctIndex to the missing item", () => {
    const round = generateWhatMissingRound(settingsFromPreset("challenge"), 5, () => 0.2);

    expect(round.roundId).toBe("what-missing:round:5");
    expect(round.displayItems[round.missingIndex]).toBe(round.missingItem);
    expect(round.choices[round.correctIndex]).toBe(round.missingItem);
    expect(round.prompt).toContain("Что пропало");
  });

  it("keeps all items while shuffling", () => {
    const shuffled = shuffleWhatMissingItems(whatMissingItems.slice(0, 4), () => 0.3);

    expect(shuffled).toHaveLength(4);
    expect(new Set(shuffled.map((item) => item.id))).toEqual(new Set(whatMissingItems.slice(0, 4).map((item) => item.id)));
  });
});

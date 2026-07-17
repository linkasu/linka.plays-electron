import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { DEFAULT_WHAT_MISSING_OBSERVE_MS, generateWhatMissingRound, shuffleWhatMissingItems, transitionWhatMissingPhase, whatMissingItems } from "./model";

describe("what-missing model", () => {
  it("shows exactly three unique items", () => {
    const round = generateWhatMissingRound(settingsFromPreset("gentle"), 1, () => 0.4);
    const ids = round.displayItems.map((item) => item.id);

    expect(round.displayItems).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it("uses displayed items plus one decoy as answer choices", () => {
    const round = generateWhatMissingRound(settingsFromPreset("standard"), 2, () => 0.7);
    const displayedIds = new Set(round.displayItems.map((item) => item.id));
    const choiceIds = new Set(round.choices.map((item) => item.id));

    expect(round.choices).toHaveLength(4);
    for (const id of displayedIds) expect(choiceIds.has(id)).toBe(true);
    expect([...choiceIds].filter((id) => !displayedIds.has(id))).toHaveLength(1);
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

  it("keeps the default observation interval at five seconds or longer", () => {
    expect(DEFAULT_WHAT_MISSING_OBSERVE_MS).toBeGreaterThanOrEqual(5000);
  });

  it("advances through every round phase in order", () => {
    let phase = transitionWhatMissingPhase("instruction", "instruction-complete");
    expect(phase).toBe("observe");
    phase = transitionWhatMissingPhase(phase, "observe-complete");
    expect(phase).toBe("transition");
    phase = transitionWhatMissingPhase(phase, "transition-complete");
    expect(phase).toBe("choose");
    phase = transitionWhatMissingPhase(phase, "answer");
    expect(phase).toBe("feedback");
    expect(transitionWhatMissingPhase(phase, "retry")).toBe("choose");
    expect(transitionWhatMissingPhase(phase, "next-round")).toBe("instruction");
  });

  it("does not allow phase events to skip observation", () => {
    expect(transitionWhatMissingPhase("instruction", "transition-complete")).toBe("instruction");
    expect(transitionWhatMissingPhase("observe", "answer")).toBe("observe");
  });
});

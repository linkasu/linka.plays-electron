import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateMatchSameRound, MATCH_SAME_PROMPT } from "./model";

describe("match-same model", () => {
  it("uses three choices in gentle mode", () => {
    const round = generateMatchSameRound(settingsFromPreset("gentle"));

    expect(round.choices).toHaveLength(3);
  });

  it("uses four choices in standard mode", () => {
    const round = generateMatchSameRound(settingsFromPreset("standard"));
    const ids = new Set(round.choices.map((choice) => choice.id));

    expect(round.choices).toHaveLength(4);
    expect(ids.size).toBe(4);
  });

  it("points correctIndex to the target", () => {
    const round = generateMatchSameRound(settingsFromPreset("challenge"), 5);

    expect(round.roundId).toBe("match-same:round:5");
    expect(round.choices[round.correctIndex]).toBe(round.target);
  });

  it("keeps all choices visually different", () => {
    const round = generateMatchSameRound(settingsFromPreset("standard"));
    const emoji = new Set(round.choices.map((choice) => choice.emoji));

    expect(emoji.size).toBe(round.choices.length);
  });

  it("uses child-facing copy", () => {
    expect(MATCH_SAME_PROMPT).toBe("Покажи такое же");
    expect(generateMatchSameRound(settingsFromPreset("standard")).prompt).toBe(MATCH_SAME_PROMPT);
  });
});

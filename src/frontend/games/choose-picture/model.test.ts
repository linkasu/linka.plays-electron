import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateChoosePictureRound } from "./model";

describe("choose-picture model", () => {
  it("uses four choices in gentle mode", () => {
    const round = generateChoosePictureRound(settingsFromPreset("gentle"));

    expect(round.choices).toHaveLength(4);
  });

  it("uses four unique choices in standard mode", () => {
    const round = generateChoosePictureRound(settingsFromPreset("standard"));
    const ids = new Set(round.choices.map((choice) => choice.id));

    expect(round.choices).toHaveLength(4);
    expect(ids.size).toBe(4);
  });

  it("points correctIndex to the target and includes the target word in prompt", () => {
    const round = generateChoosePictureRound(settingsFromPreset("challenge"), 3);

    expect(round.roundId).toBe("choose-picture:round:3");
    expect(round.choices[round.correctIndex]).toBe(round.target);
    expect(round.prompt).toContain(round.target.word);
  });
});

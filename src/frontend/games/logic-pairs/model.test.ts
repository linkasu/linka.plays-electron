import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateLogicPairsRound, logicPairDefinitions, type LogicPairRelation } from "./model";

describe("logic-pairs model", () => {
  it("uses three choices in gentle mode", () => {
    const round = generateLogicPairsRound(settingsFromPreset("gentle"));

    expect(round.choices).toHaveLength(3);
  });

  it("uses four choices in standard mode", () => {
    const round = generateLogicPairsRound(settingsFromPreset("standard"));
    const ids = new Set(round.choices.map((choice) => choice.id));

    expect(round.choices).toHaveLength(4);
    expect(ids.size).toBe(4);
  });

  it("points correctIndex to the matching pair", () => {
    const round = generateLogicPairsRound(settingsFromPreset("challenge"), 7);

    expect(round.roundId).toBe("logic-pairs:round:7");
    expect(round.choices[round.correctIndex]).toBe(round.pair);
  });

  it("cycles through meaning, shape and number relations", () => {
    const relations = new Set<LogicPairRelation>();

    for (let index = 1; index <= logicPairDefinitions.length; index += 1) {
      relations.add(generateLogicPairsRound(settingsFromPreset("standard"), index).relation);
    }

    expect(relations).toEqual(new Set<LogicPairRelation>(["meaning", "shape", "number"]));
  });

  it("keeps all choices unique and includes the target pair", () => {
    const round = generateLogicPairsRound(settingsFromPreset("standard"), 2);
    const ids = new Set(round.choices.map((choice) => choice.id));

    expect(ids.size).toBe(round.choices.length);
    expect(ids.has(round.pair.id)).toBe(true);
  });
});

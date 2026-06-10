import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateWhereObjectRound, phraseFor, whereObjectPrepositions } from "./model";

function expectValidRound(round: ReturnType<typeof generateWhereObjectRound>) {
  const placeIds = round.places.map((place) => place.id);

  expect(round.roundId).toMatch(/^where-object:round:\d+$/);
  expect(round.targetObject.category).toBe("thing");
  expect(placeIds).toContain(round.targetPlace.id);
  expect(new Set(placeIds).size).toBe(round.places.length);
  expect(round.prepositions).toEqual(whereObjectPrepositions);
  expect(phraseFor(round.targetPlace, round.targetPreposition)).toContain(round.targetPreposition.label);
  expect(round.prompt).toContain(round.targetObject.word);
}

describe("generateWhereObjectRound", () => {
  it("alternates place search and preposition answer modes", () => {
    const settings = settingsFromPreset("standard");

    expect(generateWhereObjectRound(settings, 1).mode).toBe("place");
    expect(generateWhereObjectRound(settings, 2).mode).toBe("preposition");
  });

  it("creates gentle rounds with two place choices", () => {
    for (let index = 1; index <= 12; index += 1) {
      const round = generateWhereObjectRound(settingsFromPreset("gentle"), index);

      expectValidRound(round);
      expect(round.places).toHaveLength(2);
    }
  });

  it("keeps standard rounds between three and four places", () => {
    for (let index = 1; index <= 12; index += 1) {
      const round = generateWhereObjectRound(settingsFromPreset("standard"), index);

      expectValidRound(round);
      expect(round.places.length).toBeGreaterThanOrEqual(3);
      expect(round.places.length).toBeLessThanOrEqual(4);
    }
  });

  it("creates challenge rounds with four places and all preposition answers", () => {
    const round = generateWhereObjectRound(settingsFromPreset("challenge"), 6);

    expectValidRound(round);
    expect(round.places).toHaveLength(4);
    expect(round.prepositions.map((preposition) => preposition.id)).toEqual(["on", "under", "in"]);
  });

  it("sets correctId to the place or preposition expected by the current mode", () => {
    const settings = settingsFromPreset("standard");
    const placeRound = generateWhereObjectRound(settings, 3);
    const prepositionRound = generateWhereObjectRound(settings, 4);

    expect(placeRound.correctId).toBe(placeRound.targetPlace.id);
    expect(prepositionRound.correctId).toBe(prepositionRound.targetPreposition.id);
    expect(prepositionRound.roundId).toBe("where-object:round:4");
  });
});

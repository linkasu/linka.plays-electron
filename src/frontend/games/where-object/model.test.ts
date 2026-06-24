import { describe, expect, it } from "vitest";
import { generateWhereObjectRound, phraseFor, whereObjectItems, whereObjectPlaces, whereObjectPrepositions } from "./model";

describe("generateWhereObjectRound", () => {
  it("always asks for a preposition answer", () => {
    const round = generateWhereObjectRound(1);

    expect(round.roundId).toBe("where-object:round:1");
    expect(round.prompt).toContain(round.targetObject.word);
    expect(round.prepositions.map((item) => item.id)).toEqual(["on", "under", "in"]);
    expect(round.correctId).toBe(round.targetPreposition.id);
  });

  it("cycles through semi-open places", () => {
    expect(generateWhereObjectRound(1).targetPlace.id).toBe("house");
    expect(generateWhereObjectRound(2).targetPlace.id).toBe("table");
    expect(generateWhereObjectRound(3).targetPlace.id).toBe("bag");
    expect(generateWhereObjectRound(4).targetPlace.id).toBe("box");
    expect(generateWhereObjectRound(whereObjectPlaces.length + 1).targetPlace.id).toBe("house");
  });

  it("cycles through prepositions and objects", () => {
    expect(generateWhereObjectRound(1).targetPreposition.id).toBe("on");
    expect(generateWhereObjectRound(2).targetPreposition.id).toBe("under");
    expect(generateWhereObjectRound(3).targetPreposition.id).toBe("in");
    expect(generateWhereObjectRound(whereObjectItems.length + 1).targetObject.id).toBe(whereObjectItems[0].id);
  });

  it("builds grammatical scene phrases", () => {
    const round = generateWhereObjectRound(3);

    expect(phraseFor(round.targetPlace, round.targetPreposition)).toBe(round.targetPlace.phrases[round.targetPreposition.id]);
    expect(round.scenePhrase).toBe(`${round.targetObject.word} ${phraseFor(round.targetPlace, round.targetPreposition)}`);
    expect(whereObjectPrepositions).toHaveLength(3);
  });
});

import { describe, expect, it } from "vitest";
import { generateWantDontWantRound, wantDontWantItems } from "./model";

describe("want-dont-want model", () => {
  it("creates a round with both AAC choices", () => {
    const round = generateWantDontWantRound(1);

    expect(round.roundId).toBe("want-dont-want:round:1");
    expect(round.prompt).toBeTruthy();
    expect(round.item).toBe(wantDontWantItems[0]);
    expect(round.choices.map((choice) => choice.id)).toEqual(["want", "dont-want"]);
  });

  it("cycles through soft items and activities", () => {
    const afterLast = generateWantDontWantRound(wantDontWantItems.length + 1);

    expect(afterLast.item).toBe(wantDontWantItems[0]);
    expect(new Set(wantDontWantItems.map((item) => item.kind))).toEqual(new Set(["предмет", "занятие"]));
  });
});

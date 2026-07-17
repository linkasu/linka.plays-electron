import { describe, expect, it } from "vitest";
import { effectiveStarDwellMs } from "./model";

describe("starry-sky model", () => {
  it("applies the shortened dwell used by the game", () => {
    expect(effectiveStarDwellMs(1000)).toBe(680);
  });
});

import { describe, expect, it } from "vitest";
import { isFollowCueHintVisible } from "./model";

describe("follow-cue model", () => {
  it("does not reveal the correct choice before the first mistake", () => {
    expect(isFollowCueHintVisible(true, 0)).toBe(false);
    expect(isFollowCueHintVisible(false, 0)).toBe(false);
  });

  it("reveals only the correct choice after a mistake", () => {
    expect(isFollowCueHintVisible(true, 1)).toBe(true);
    expect(isFollowCueHintVisible(false, 1)).toBe(false);
  });
});

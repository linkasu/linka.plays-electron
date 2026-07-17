import { describe, expect, it } from "vitest";
import { advanceSoundSourceHint } from "./model";

describe("sound source hint state", () => {
  it("keeps the target marker hidden at the start of every round", () => {
    expect(advanceSoundSourceHint("revealed", "new-round")).toBe("hidden");
  });

  it("reveals the target only after a mistake or an explicit hint", () => {
    expect(advanceSoundSourceHint("hidden", "mistake")).toBe("revealed");
    expect(advanceSoundSourceHint("hidden", "hint-requested")).toBe("revealed");
  });
});

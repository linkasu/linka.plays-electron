import { describe, expect, it } from "vitest";
import { pointerHitPadding } from "./domGazeTargetCoordinator";

describe("pointerHitPadding", () => {
  it("keeps the margin around a target for the eye tracker", () => {
    expect(pointerHitPadding(36, "tobii")).toBe(36);
  });

  it("gives the mouse no margin, so a button fires only inside its edges", () => {
    expect(pointerHitPadding(36, "mouse")).toBe(0);
  });

  it("never returns a negative margin", () => {
    expect(pointerHitPadding(-4, "tobii")).toBe(0);
  });
});

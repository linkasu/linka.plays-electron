import { describe, expect, it } from "vitest";
import { applyGliderDamage, classifyGatePass, gliderDifficulty } from "./model";

describe("glider model", () => {
  it("narrows gates and speeds up later route steps", () => {
    const early = gliderDifficulty(0, 8);
    const late = gliderDifficulty(7, 8);

    expect(late.gapScale).toBeLessThan(early.gapScale);
    expect(late.speedScale).toBeGreaterThan(early.speedScale);
    expect(late.passRatio).toBeLessThan(early.passRatio);
  });

  it("classifies a centered gate as passed", () => {
    expect(classifyGatePass(100, 80, 200, 160, 100, 200, 0.36)).toBe("pass");
  });

  it("classifies a late unpassed gate as missed", () => {
    expect(classifyGatePass(10, 80, 200, 160, 140, 200, 0.36)).toBe("miss");
  });

  it("reduces hull without going below zero", () => {
    expect(applyGliderDamage(3)).toBe(2);
    expect(applyGliderDamage(0)).toBe(0);
  });
});

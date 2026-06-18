import { afterEach, describe, expect, it, vi } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateMathRound } from "./model";

function parseExpression(expression: string) {
  const match = expression.match(/^(\d+) ([+-]) (\d+)$/);
  if (!match) throw new Error(`Unexpected expression: ${expression}`);
  return { a: Number(match[1]), operator: match[2], b: Number(match[3]) };
}

describe("generateMathRound", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps round ids stable for telemetry", () => {
    expect(generateMathRound(settingsFromPreset("gentle"), 1).roundId).toBe("math-actions:round:1");
    expect(generateMathRound(settingsFromPreset("standard"), 8).roundId).toBe("math-actions:round:8");
  });

  it("gentle rounds use addition only with operands up to five", () => {
    const settings = settingsFromPreset("gentle");

    for (let index = 0; index < 100; index += 1) {
      const round = generateMathRound(settings, index + 1);
      const { a, operator, b } = parseExpression(round.expression);

      expect(round.roundId).toBe(`math-actions:round:${index + 1}`);
      expect(operator).toBe("+");
      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(5);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(5);
      expect(round.answer).toBe(a + b);
      expect(round.answerText).toBe(String(round.answer));
    }
  });

  it("standard addition rounds compute the answer from the expression", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.49)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.95);

    const round = generateMathRound(settingsFromPreset("standard"), 2);
    const { a, operator, b } = parseExpression(round.expression);

    expect(operator).toBe("+");
    expect(a).toBe(1);
    expect(b).toBe(20);
    expect(round.answer).toBe(21);
    expect(round.answerText).toBe("21");
  });

  it("standard subtraction rounds start at the random threshold", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);

    const round = generateMathRound(settingsFromPreset("standard"), 3);
    const { a, operator, b } = parseExpression(round.expression);

    expect(operator).toBe("-");
    expect(a).toBe(2);
    expect(b).toBe(1);
    expect(round.answer).toBe(a - b);
    expect(round.answer).toBeGreaterThanOrEqual(1);
    expect(round.answerText).toBe(String(round.answer));
  });

  it("non-gentle subtraction never produces zero or negative answers", () => {
    for (const preset of ["standard", "challenge", "custom"] as const) {
      const settings = settingsFromPreset(preset);

      for (let index = 0; index < 100; index += 1) {
        const round = generateMathRound(settings, index + 1);
        const { a, operator, b } = parseExpression(round.expression);

        if (operator === "-") {
          expect(a).toBeGreaterThan(b);
          expect(round.answer).toBeGreaterThanOrEqual(1);
          expect(round.answer).toBe(a - b);
        } else {
          expect(round.answer).toBe(a + b);
        }
        expect(round.answerText).toBe(String(round.answer));
      }
    }
  });
});

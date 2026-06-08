import { describe, expect, it } from "vitest";
import { createNonRepeatingRandomIndexGenerator } from "./random";

describe("random helpers", () => {
  it("returns every index once before repeating", () => {
    const generator = createNonRepeatingRandomIndexGenerator(4, () => 0);
    const values = Array.from({ length: 4 }, () => generator.next());

    expect(new Set(values).size).toBe(4);
    expect([...values].sort()).toEqual([0, 1, 2, 3]);
  });

  it("avoids immediate repeats across refill boundaries", () => {
    const values = [0, 0.99, 0.99, 0.99, 0.5];
    const generator = createNonRepeatingRandomIndexGenerator(3, () => values.shift() ?? 0.99);
    const sequence = Array.from({ length: 4 }, () => generator.next());

    expect(sequence.slice(0, 3)).toEqual([2, 1, 0]);
    expect(sequence[3]).not.toBe(sequence[2]);
  });

  it("can reset the current cycle", () => {
    const generator = createNonRepeatingRandomIndexGenerator(2, () => 0);

    expect(generator.next()).toBe(1);
    generator.reset();
    expect(generator.next()).toBe(1);
  });
});

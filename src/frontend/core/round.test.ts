import { describe, expect, it } from "vitest";
import { buildChoiceRound, choiceCountByPreset, idEquality, pickByRoundIndex, referenceEquality } from "./round";
import { createDefaultSettings, presetSettings } from "./settings";

const items = [
  { id: "a", label: "альфа" },
  { id: "b", label: "бета" },
  { id: "c", label: "гамма" },
  { id: "d", label: "дельта" }
];

describe("choiceCountByPreset", () => {
  it("returns gentle/standard/challenge variants by preset", () => {
    expect(choiceCountByPreset({ ...presetSettings.gentle }, 1, { gentle: 2, standard: 3, challenge: 4 })).toBe(2);
    expect(choiceCountByPreset({ ...presetSettings.standard }, 1, { gentle: 2, standard: 3, challenge: 4 })).toBe(3);
    expect(choiceCountByPreset({ ...presetSettings.challenge }, 1, { gentle: 2, standard: 3, challenge: 4 })).toBe(4);
  });

  it("supports function presets dependent on round index", () => {
    const fn = (idx: number) => 2 + (idx % 3);
    expect(choiceCountByPreset({ ...presetSettings.standard }, 1, { gentle: 2, standard: fn, challenge: 4 })).toBe(3);
    expect(choiceCountByPreset({ ...presetSettings.standard }, 4, { gentle: 2, standard: fn, challenge: 4 })).toBe(3);
  });

  it("respects cap", () => {
    expect(choiceCountByPreset({ ...presetSettings.challenge }, 1, { gentle: 2, standard: 3, challenge: 6, cap: 5 })).toBe(5);
  });

  it("never drops below 2", () => {
    expect(choiceCountByPreset({ ...presetSettings.gentle }, 1, { gentle: 1, standard: 3, challenge: 4 })).toBe(2);
  });
});

describe("buildChoiceRound", () => {
  const settings = createDefaultSettings();

  it("produces a round whose correctIndex points at the target", () => {
    const round = buildChoiceRound({
      idPrefix: "test",
      roundIndex: 1,
      items,
      choiceCount: 3,
      pickTarget: (pool, idx) => pickByRoundIndex(pool, idx),
      isSame: idEquality,
      prompt: (target) => `Найди ${target.label}`
    });
    expect(round.roundId).toBe("test:round:1");
    expect(round.choices.length).toBe(3);
    expect(round.choices).toContain(round.target);
    expect(round.choices[round.correctIndex]).toBe(round.target);
    expect(round.prompt).toBe(`Найди ${round.target.label}`);
  });

  it("caps choices to pool size", () => {
    const round = buildChoiceRound({
      idPrefix: "small",
      roundIndex: 2,
      items,
      choiceCount: 100,
      pickTarget: (pool) => pool[0],
      isSame: idEquality,
      prompt: () => "x"
    });
    expect(round.choices.length).toBe(items.length);
  });

  it("supports reference equality for primitives", () => {
    const pool = [1, 2, 3, 4, 5];
    const round = buildChoiceRound({
      idPrefix: "n",
      roundIndex: 3,
      items: pool,
      choiceCount: 4,
      pickTarget: (p, idx) => p[(idx - 1) % p.length],
      isSame: referenceEquality,
      prompt: (target) => `${target}`
    });
    expect(round.choices.length).toBe(4);
    expect(round.choices[round.correctIndex]).toBe(round.target);
  });

  it("throws when the pool has fewer than two items", () => {
    expect(() => buildChoiceRound({
      idPrefix: "x",
      roundIndex: 1,
      items: items.slice(0, 1),
      choiceCount: 2,
      pickTarget: (pool) => pool[0],
      isSame: idEquality,
      prompt: () => "x"
    })).toThrow();
  });

  it("uses settings only via pickTarget when needed", () => {
    expect(settings.preset).toBe("standard");
  });
});

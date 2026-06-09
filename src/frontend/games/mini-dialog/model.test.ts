import { describe, expect, it } from "vitest";
import { generateMiniDialogRound, getMiniDialogChoice, getMiniDialogScenarioCoverage } from "./model";

describe("generateMiniDialogRound", () => {
  it("creates a soft AAC dialog round with large reply choices", () => {
    const round = generateMiniDialogRound(1);

    expect(round.roundId).toBe("mini-dialog:round:1");
    expect(round.partnerLine).toBeTruthy();
    expect(round.prompt).toBeTruthy();
    expect(round.choices.length).toBeGreaterThanOrEqual(2);
    expect(round.choices.length).toBeLessThanOrEqual(3);
    expect(round.choices.every((choice) => choice.text && choice.emoji && choice.confirmation)).toBe(true);
  });

  it("covers greeting, continue/stop, and thanks/more scenarios in one short session", () => {
    const scenarios = new Set(getMiniDialogScenarioCoverage(7));

    expect(scenarios).toEqual(new Set(["greeting", "continue-stop", "thanks-more"]));
  });

  it("keeps every choice valid and confirmation-based", () => {
    const rounds = Array.from({ length: 7 }, (_, index) => generateMiniDialogRound(index + 1));

    for (const round of rounds) {
      for (const choice of round.choices) {
        expect(getMiniDialogChoice(round, choice.id)).toEqual(choice);
        expect(choice.confirmation.toLowerCase()).not.toContain("ошибка");
      }
    }
  });

  it("cycles scenarios after the prepared gentle session", () => {
    const firstRound = generateMiniDialogRound(1);
    const cycledRound = generateMiniDialogRound(8);

    expect(cycledRound.scenario).toBe(firstRound.scenario);
    expect(cycledRound.partnerLine).toBe(firstRound.partnerLine);
  });

  it("rejects unknown choice ids", () => {
    const round = generateMiniDialogRound(1);

    expect(() => getMiniDialogChoice(round, "unknown")).toThrow("Нет реплики unknown");
  });
});

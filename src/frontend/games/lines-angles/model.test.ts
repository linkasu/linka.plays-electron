import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateLinesAnglesRound, isCorrectLinesAnglesChoice, linesAnglesTasks } from "./model";

describe("lines-angles model", () => {
  it("scales choice count by preset", () => {
    expect(generateLinesAnglesRound(settingsFromPreset("gentle")).choices).toHaveLength(3);
    expect(generateLinesAnglesRound(settingsFromPreset("standard")).choices).toHaveLength(4);
    expect(generateLinesAnglesRound(settingsFromPreset("challenge")).choices).toHaveLength(5);
  });

  it("cycles through all geometry classification tasks", () => {
    const settings = settingsFromPreset("standard");
    const taskIds = linesAnglesTasks.map((task) => task.id);
    const rounds = taskIds.map((_, index) => generateLinesAnglesRound(settings, index + 1));

    expect(rounds.map((round) => round.task.id)).toEqual(taskIds);
  });

  it("includes exactly one correct choice in each round", () => {
    const settings = settingsFromPreset("challenge");

    for (let index = 1; index <= linesAnglesTasks.length * 2; index += 1) {
      const round = generateLinesAnglesRound(settings, index);
      const correctChoices = round.choices.filter((choice) => isCorrectLinesAnglesChoice(choice, round.task));

      expect(round.roundId).toBe(`lines-angles:round:${index}`);
      expect(round.prompt).toBe(round.task.prompt);
      expect(correctChoices).toEqual([round.target]);
      expect(round.choices[round.correctIndex]).toBe(round.target);
    }
  });
});

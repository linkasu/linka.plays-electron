import { describe, expect, it } from "vitest";
import { buildRobotPartOrder, generateBuildRobotRound } from "./model";

function expectValidRound(round: ReturnType<typeof generateBuildRobotRound>) {
  const choiceIds = round.choices.map((choice) => choice.id);

  expect(round.choices).toHaveLength(buildRobotPartOrder.length);
  expect(new Set(choiceIds).size).toBe(buildRobotPartOrder.length);
  expect(round.choices[round.correctIndex]).toBe(round.target);
  expect(choiceIds).toContain(round.target.id);
  expect(round.prompt).toContain(round.target.instructionLabel);
}

describe("generateBuildRobotRound", () => {
  it("asks for robot details in the fixed assembly order", () => {
    const targets = Array.from({ length: 8 }, (_, index) => generateBuildRobotRound(index + 1).target.id);

    expect(targets).toEqual([...buildRobotPartOrder, ...buildRobotPartOrder]);
  });

  it("includes all details as unique choices and points correctIndex to the target", () => {
    for (let index = 1; index <= 12; index += 1) {
      expectValidRound(generateBuildRobotRound(index));
    }
  });

  it("tracks completed details inside the current robot", () => {
    expect(generateBuildRobotRound(1).completedPartIds).toEqual([]);
    expect(generateBuildRobotRound(2).completedPartIds).toEqual(["head"]);
    expect(generateBuildRobotRound(3).completedPartIds).toEqual(["head", "body"]);
    expect(generateBuildRobotRound(4).completedPartIds).toEqual(["head", "body", "arms"]);
    expect(generateBuildRobotRound(5).completedPartIds).toEqual([]);
  });

  it("keeps round ids stable for telemetry", () => {
    expect(generateBuildRobotRound(8).roundId).toBe("build-robot:round:8");
    expect(generateBuildRobotRound(8).robotIndex).toBe(2);
  });
});

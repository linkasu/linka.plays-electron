export type RobotPartId = "head" | "body" | "arms" | "legs";

export type RobotPart = {
  id: RobotPartId;
  label: string;
  instructionLabel: string;
  icon: string;
  color: string;
};

export type BuildRobotRound = {
  roundId: string;
  robotIndex: number;
  stepIndex: number;
  prompt: string;
  target: RobotPart;
  choices: RobotPart[];
  correctIndex: number;
  completedPartIds: RobotPartId[];
};

export const buildRobotPartOrder: RobotPartId[] = ["head", "body", "arms", "legs"];

const baseParts: Record<RobotPartId, Omit<RobotPart, "color">> = {
  head: { id: "head", label: "голова", instructionLabel: "голову", icon: "mdi-robot-happy-outline" },
  body: { id: "body", label: "корпус", instructionLabel: "корпус", icon: "mdi-cube-outline" },
  arms: { id: "arms", label: "руки", instructionLabel: "руки", icon: "mdi-arm-flex-outline" },
  legs: { id: "legs", label: "ноги", instructionLabel: "ноги", icon: "mdi-shoe-print" }
};

const robotPalettes: Record<RobotPartId, string>[] = [
  { head: "#90caf9", body: "#a5d6a7", arms: "#ffe082", legs: "#ce93d8" },
  { head: "#ffccbc", body: "#b39ddb", arms: "#80deea", legs: "#c5e1a5" },
  { head: "#f8bbd0", body: "#b2dfdb", arms: "#fff59d", legs: "#b0bec5" }
];

function partsForRobot(robotIndex: number) {
  const palette = robotPalettes[(robotIndex - 1) % robotPalettes.length];
  return buildRobotPartOrder.map((id) => ({ ...baseParts[id], color: palette[id] }));
}

function rotateChoices(parts: RobotPart[], roundIndex: number) {
  const offset = roundIndex % parts.length;
  return [...parts.slice(offset), ...parts.slice(0, offset)];
}

export function generateBuildRobotRound(roundIndex = 1): BuildRobotRound {
  const safeRoundIndex = Math.max(1, Math.floor(roundIndex));
  const stepIndex = (safeRoundIndex - 1) % buildRobotPartOrder.length;
  const robotIndex = Math.floor((safeRoundIndex - 1) / buildRobotPartOrder.length) + 1;
  const parts = partsForRobot(robotIndex);
  const targetId = buildRobotPartOrder[stepIndex];
  const target = parts.find((part) => part.id === targetId);

  if (!target) throw new Error(`BuildRobotGame cannot find robot part: ${targetId}`);

  const choices = rotateChoices(parts, safeRoundIndex);

  return {
    roundId: `build-robot:round:${safeRoundIndex}`,
    robotIndex,
    stepIndex,
    prompt: `Выбери ${target.instructionLabel}.`,
    target,
    choices,
    correctIndex: choices.indexOf(target),
    completedPartIds: buildRobotPartOrder.slice(0, stepIndex)
  };
}

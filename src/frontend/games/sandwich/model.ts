export type SandwichStepKind = "bread" | "filling" | "top-bread";

export type SandwichChoice = {
  id: string;
  label: string;
  shortLabel: string;
  kind: SandwichStepKind;
  icon: string;
  color: string;
};

export type SandwichStep = {
  id: string;
  roundId: string;
  sandwichIndex: number;
  stepIndex: number;
  kind: SandwichStepKind;
  choice: SandwichChoice;
  instruction: string;
};

const minSteps = 6;
const maxSteps = 8;

const bottomBread: SandwichChoice = {
  id: "bottom-bread",
  label: "Нижний хлеб",
  shortLabel: "хлеб",
  kind: "bread",
  icon: "mdi-bread-slice",
  color: "#d9a441"
};

const topBread: SandwichChoice = {
  id: "top-bread",
  label: "Верхний хлеб",
  shortLabel: "верхний хлеб",
  kind: "top-bread",
  icon: "mdi-bread-slice-outline",
  color: "#c7892f"
};

export const sandwichChoices: SandwichChoice[] = [
  bottomBread,
  { id: "cheese", label: "Сыр", shortLabel: "сыр", kind: "filling", icon: "mdi-cheese", color: "#f6c84c" },
  { id: "lettuce", label: "Лист салата", shortLabel: "салат", kind: "filling", icon: "mdi-leaf", color: "#73b66b" },
  { id: "tomato", label: "Помидор", shortLabel: "помидор", kind: "filling", icon: "mdi-circle", color: "#e57373" },
  topBread
];

const fillings = sandwichChoices.filter((choice) => choice.kind === "filling");
const stepOrder: SandwichStepKind[] = ["bread", "filling", "top-bread"];

function normalizeStepCount(stepCount: number) {
  return Math.min(maxSteps, Math.max(minSteps, Math.trunc(stepCount)));
}

function choiceFor(kind: SandwichStepKind, sandwichIndex: number) {
  if (kind === "bread") return bottomBread;
  if (kind === "top-bread") return topBread;
  return fillings[sandwichIndex % fillings.length];
}

function instructionFor(kind: SandwichStepKind, choice: SandwichChoice, sandwichIndex: number) {
  const sandwichNumber = sandwichIndex + 1;
  if (kind === "bread") return `Бутерброд ${sandwichNumber}: сначала положи хлеб.`;
  if (kind === "top-bread") return `Бутерброд ${sandwichNumber}: накрой верхним хлебом.`;
  return `Бутерброд ${sandwichNumber}: добавь начинку — ${choice.shortLabel}.`;
}

export function buildSandwichSteps(stepCount = minSteps): SandwichStep[] {
  const totalSteps = normalizeStepCount(stepCount);

  return Array.from({ length: totalSteps }, (_, index) => {
    const kind = stepOrder[index % stepOrder.length];
    const sandwichIndex = Math.floor(index / stepOrder.length);
    const choice = choiceFor(kind, sandwichIndex);

    return {
      id: `sandwich-step-${index + 1}`,
      roundId: `sandwich:round:${index + 1}`,
      sandwichIndex,
      stepIndex: index,
      kind,
      choice,
      instruction: instructionFor(kind, choice, sandwichIndex)
    };
  });
}

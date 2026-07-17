import { shuffleItems } from "../../core/random";

export type SandwichChoiceKind = "bread" | "spread" | "filling" | "vegetable" | "top-bread";

export type SandwichChoice = {
  id: string;
  label: string;
  shortLabel: string;
  kind: SandwichChoiceKind;
  imageId?: string;
  emoji: string;
  roleIcon?: string;
  ttsAssetId?: string;
  color: string;
};

export type SandwichRecipeStep = {
  id: string;
  roundId: string;
  recipeId: string;
  recipeIndex: number;
  stepIndex: number;
  choice: SandwichChoice;
  instruction: string;
  helper: string;
};

export type SandwichRecipe = {
  id: string;
  title: string;
  helper: string;
  steps: SandwichChoice[];
};

const bottomBread: SandwichChoice = {
  id: "bottom-bread",
  label: "Нижний хлеб",
  shortLabel: "нижний хлеб",
  kind: "bread",
  imageId: "bread",
  emoji: "🍞",
  roleIcon: "mdi-arrow-down-bold",
  ttsAssetId: "word-categories.item.bread",
  color: "#d9a441"
};

const topBread: SandwichChoice = {
  id: "top-bread",
  label: "Верхний хлеб",
  shortLabel: "верхний хлеб",
  kind: "top-bread",
  imageId: "bread",
  emoji: "🍞",
  roleIcon: "mdi-arrow-up-bold",
  ttsAssetId: "word-categories.item.bread",
  color: "#c7892f"
};

const butter: SandwichChoice = {
  id: "butter",
  label: "Масло",
  shortLabel: "масло",
  kind: "spread",
  emoji: "🧈",
  color: "#f8d568"
};

const cheese: SandwichChoice = {
  id: "cheese",
  label: "Сыр",
  shortLabel: "сыр",
  kind: "filling",
  imageId: "cheese",
  emoji: "🧀",
  ttsAssetId: "word-categories.item.cheese",
  color: "#f6c84c"
};

const lettuce: SandwichChoice = {
  id: "lettuce",
  label: "Лист салата",
  shortLabel: "салат",
  kind: "vegetable",
  imageId: "leaf",
  emoji: "🥬",
  color: "#73b66b"
};

const tomato: SandwichChoice = {
  id: "tomato",
  label: "Помидор",
  shortLabel: "помидор",
  kind: "vegetable",
  imageId: "tomato",
  emoji: "🍅",
  ttsAssetId: "word-categories.item.tomato",
  color: "#e57373"
};

export const sandwichChoices: SandwichChoice[] = [bottomBread, butter, cheese, lettuce, tomato, topBread];

export const sandwichRecipes: SandwichRecipe[] = [
  {
    id: "cheese-salad",
    title: "Сырный бутерброд",
    helper: "Нижний хлеб, масло, сыр, салат и верхний хлеб.",
    steps: [bottomBread, butter, cheese, lettuce, topBread]
  },
  {
    id: "tomato-cheese",
    title: "Овощной бутерброд",
    helper: "Нижний хлеб, масло, помидор, сыр и верхний хлеб.",
    steps: [bottomBread, butter, tomato, cheese, topBread]
  }
];

function instructionFor(choice: SandwichChoice, recipe: SandwichRecipe, stepIndex: number) {
  if (stepIndex === 0) return `${recipe.title}: сначала положи нижний хлеб.`;
  if (choice.kind === "spread") return `${recipe.title}: намажь масло на хлеб.`;
  if (choice.kind === "top-bread") return `${recipe.title}: накрой верхним хлебом.`;
  return `${recipe.title}: добавь ${choice.shortLabel}.`;
}

function helperFor(choice: SandwichChoice, stepIndex: number) {
  if (stepIndex === 0) return "Тарелка готова. Начинаем с основы.";
  if (choice.kind === "spread") return "Масло помогает начинке держаться на хлебе.";
  if (choice.kind === "top-bread") return "Верхний хлеб завершает бутерброд.";
  return "Начинка ложится ровно поверх предыдущего слоя.";
}

export function sandwichMaxSteps(recipes = sandwichRecipes) {
  return recipes.reduce((sum, recipe) => sum + recipe.steps.length, 0);
}

export function buildSandwichSteps(recipes = sandwichRecipes): SandwichRecipeStep[] {
  return recipes.flatMap((recipe, recipeIndex) => recipe.steps.map((choice, stepIndex) => {
    const absoluteStepIndex = recipes.slice(0, recipeIndex).reduce((sum, item) => sum + item.steps.length, 0) + stepIndex;
    return {
      id: `sandwich-step-${absoluteStepIndex + 1}`,
      roundId: `sandwich:round:${absoluteStepIndex + 1}`,
      recipeId: recipe.id,
      recipeIndex,
      stepIndex,
      choice,
      instruction: instructionFor(choice, recipe, stepIndex),
      helper: helperFor(choice, stepIndex)
    };
  }));
}

export function isSandwichRecipeCompleteStep(step: SandwichRecipeStep, recipes = sandwichRecipes) {
  return step.stepIndex === recipes[step.recipeIndex].steps.length - 1;
}

export function getSandwichRecipe(recipeIndex: number, recipes = sandwichRecipes) {
  return recipes[recipeIndex % recipes.length];
}

export function shuffleSandwichChoices(choices = sandwichChoices, random = Math.random): SandwichChoice[] {
  return shuffleItems(choices, random);
}

export type SoupIngredient = {
  id: string;
  label: string;
  icon: string;
  color: string;
  orderIndex: number;
};

export type SoupRecipeRound = {
  roundId: string;
  ingredients: SoupIngredient[];
};

export const soupRecipeIngredients: readonly SoupIngredient[] = [
  { id: "water", label: "вода", icon: "mdi-water-outline", color: "#90caf9", orderIndex: 1 },
  { id: "potatoes", label: "картофель", icon: "mdi-food-apple-outline", color: "#ffe082", orderIndex: 2 },
  { id: "carrot", label: "морковь", icon: "mdi-carrot", color: "#ffb74d", orderIndex: 3 },
  { id: "onion", label: "лук", icon: "mdi-circle-outline", color: "#d7ccc8", orderIndex: 4 },
  { id: "peas", label: "горошек", icon: "mdi-dots-circle", color: "#a5d6a7", orderIndex: 5 },
  { id: "noodles", label: "лапша", icon: "mdi-barley", color: "#fff59d", orderIndex: 6 },
  { id: "salt", label: "соль", icon: "mdi-shaker-outline", color: "#e0e0e0", orderIndex: 7 },
  { id: "greens", label: "зелень", icon: "mdi-leaf", color: "#81c784", orderIndex: 8 }
];

export function createSoupRecipeRound(maxSteps = soupRecipeIngredients.length): SoupRecipeRound {
  const safeMaxSteps = Math.min(soupRecipeIngredients.length, Math.max(1, Math.floor(maxSteps)));

  return {
    roundId: "soup-recipe:recipe:1",
    ingredients: soupRecipeIngredients.slice(0, safeMaxSteps).map((ingredient) => ({ ...ingredient }))
  };
}

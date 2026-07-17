export type SoupIngredient = {
  id: string;
  label: string;
  imageId?: string;
  emoji: string;
  icon?: string;
  color: string;
};

export type SoupRect = { x: number; y: number; width: number; height: number };
export type SoupIngredientSlot = { ingredient: SoupIngredient; rect: SoupRect; center: { x: number; y: number } };

export type SoupRecipeRound = {
  roundId: string;
  ingredients: SoupIngredient[];
};

export const soupRecipeIngredients: readonly SoupIngredient[] = [
  { id: "water", label: "вода", emoji: "💧", icon: "mdi-water-outline", color: "#90caf9" },
  { id: "potatoes", label: "картофель", imageId: "potato", emoji: "🥔", color: "#ffe082" },
  { id: "carrot", label: "морковь", imageId: "carrot", emoji: "🥕", color: "#ffb74d" },
  { id: "onion", label: "лук", imageId: "onion", emoji: "🧅", color: "#d7ccc8" },
  { id: "peas", label: "горошек", emoji: "🫛", color: "#a5d6a7" },
  { id: "noodles", label: "лапша", imageId: "pasta", emoji: "🍝", color: "#fff59d" },
  { id: "salt", label: "соль", emoji: "🧂", icon: "mdi-shaker-outline", color: "#e0e0e0" },
  { id: "greens", label: "зелень", imageId: "leaf", emoji: "🌿", color: "#81c784" }
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function createSoupRecipeLayout(canvasWidth: number, canvasHeight: number) {
  const margin = clamp(canvasWidth * 0.045, 18, 84);
  const top = clamp(canvasHeight * 0.11, 82, 116);
  const bottom = clamp(canvasHeight * 0.04, 18, 44);
  const panel = {
    x: margin,
    y: top,
    width: canvasWidth - margin * 2,
    height: canvasHeight - top - bottom
  };
  const headerHeight = clamp(panel.height * 0.26, 116, 148);
  const recipeRect = {
    x: panel.x + 14,
    y: panel.y + 72,
    width: panel.width - 28,
    height: Math.max(44, headerHeight - 78)
  };
  const contentY = panel.y + headerHeight;
  const contentHeight = Math.max(240, panel.height - headerHeight - 18);
  const gap = clamp(canvasWidth * 0.012, 12, 26);

  if (canvasWidth < 720) {
    const potHeight = Math.min(contentHeight * 0.44, 210);
    return {
      panel,
      headerHeight,
      recipeRect,
      potRect: { x: panel.x + 14, y: contentY, width: panel.width - 28, height: potHeight },
      gridRect: { x: panel.x + 14, y: contentY + potHeight + gap, width: panel.width - 28, height: contentHeight - potHeight - gap },
      columns: 4,
      rows: 2
    };
  }

  const potWidthRatio = canvasWidth < 1100 ? 0.34 : 0.4;
  const potWidth = clamp(panel.width * potWidthRatio, 240, 720);
  return {
    panel,
    headerHeight,
    recipeRect,
    potRect: { x: panel.x + 14, y: contentY, width: potWidth, height: contentHeight },
    gridRect: { x: panel.x + 14 + potWidth + gap, y: contentY, width: panel.width - potWidth - gap - 28, height: contentHeight },
    columns: 4,
    rows: 2
  };
}

export function createSoupIngredientSlots(ingredients: readonly SoupIngredient[], canvasWidth: number, canvasHeight: number): SoupIngredientSlot[] {
  const layout = createSoupRecipeLayout(canvasWidth, canvasHeight);
  const gap = clamp(Math.min(canvasWidth, canvasHeight) * 0.016, 8, 18);
  const cellWidth = (layout.gridRect.width - gap * (layout.columns - 1)) / layout.columns;
  const cellHeight = (layout.gridRect.height - gap * (layout.rows - 1)) / layout.rows;

  return ingredients.map((ingredient, index) => {
    const col = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    const rect = {
      x: layout.gridRect.x + col * (cellWidth + gap),
      y: layout.gridRect.y + row * (cellHeight + gap),
      width: cellWidth,
      height: cellHeight
    };
    return {
      ingredient,
      rect,
      center: { x: rect.x + rect.width * 0.5, y: rect.y + rect.height * 0.5 }
    };
  });
}

export function createSoupRecipeRound(maxSteps = soupRecipeIngredients.length): SoupRecipeRound {
  const safeMaxSteps = Math.min(soupRecipeIngredients.length, Math.max(1, Math.floor(maxSteps)));

  return {
    roundId: "soup-recipe:recipe:1",
    ingredients: soupRecipeIngredients.slice(0, safeMaxSteps).map((ingredient) => ({ ...ingredient }))
  };
}

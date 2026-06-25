export type ClothingSlot = "hat" | "jacket" | "shoes";

export type DressCharacterWeatherId = "cold" | "rain" | "sun";

export type ClothingItem = {
  id: string;
  slot: ClothingSlot;
  label: string;
  color: string;
  darkColor: string;
};

export type DressCharacterTask = {
  slot: ClothingSlot;
  prompt: string;
  target: ClothingItem;
  choices: ClothingItem[];
};

export type DressCharacterWeatherKit = {
  id: DressCharacterWeatherId;
  title: string;
  helper: string;
  sceneStart: string;
  sceneEnd: string;
  sceneAccent: string;
  items: DressCharacterTask[];
};

export const clothingSlots: ClothingSlot[] = ["hat", "jacket", "shoes"];

export const dressCharacterWeatherKits: DressCharacterWeatherKit[] = [
  {
    id: "cold",
    title: "Холодно и снежно",
    helper: "Собираемся на морозную прогулку: шапка, куртка и тёплая обувь.",
    sceneStart: "#dff7f3",
    sceneEnd: "#eef3ff",
    sceneAccent: "#cfe8ff",
    items: [
      {
        slot: "hat",
        prompt: "Холодно. Что надеть на голову?",
        target: { id: "cold-hat-beanie", slot: "hat", label: "Шапка", color: "#b39ddb", darkColor: "#4a3d76" },
        choices: [
          { id: "cold-hat-beanie", slot: "hat", label: "Шапка", color: "#b39ddb", darkColor: "#4a3d76" },
          { id: "cold-hat-cap", slot: "hat", label: "Кепка", color: "#90caf9", darkColor: "#1e3a8a" },
          { id: "cold-hat-brim", slot: "hat", label: "Шляпа", color: "#c8a27a", darkColor: "#6d4c41" }
        ]
      },
      {
        slot: "jacket",
        prompt: "Холодно. Что надеть на тело?",
        target: { id: "cold-jacket-coat", slot: "jacket", label: "Куртка", color: "#64b5f6", darkColor: "#16446f" },
        choices: [
          { id: "cold-jacket-coat", slot: "jacket", label: "Куртка", color: "#64b5f6", darkColor: "#16446f" },
          { id: "cold-jacket-vest", slot: "jacket", label: "Жилет", color: "#a5d6a7", darkColor: "#1b5e20" },
          { id: "cold-jacket-shirt", slot: "jacket", label: "Футболка", color: "#ffcc80", darkColor: "#9a3412" }
        ]
      },
      {
        slot: "shoes",
        prompt: "Холодно. Что надеть на ноги?",
        target: { id: "cold-shoes-boots", slot: "shoes", label: "Ботинки", color: "#4db6ac", darkColor: "#15514d" },
        choices: [
          { id: "cold-shoes-boots", slot: "shoes", label: "Ботинки", color: "#4db6ac", darkColor: "#15514d" },
          { id: "cold-shoes-sandals", slot: "shoes", label: "Сандалии", color: "#f472b6", darkColor: "#9d174d" },
          { id: "cold-shoes-slippers", slot: "shoes", label: "Тапочки", color: "#ce93d8", darkColor: "#6a1b9a" }
        ]
      }
    ]
  },
  {
    id: "rain",
    title: "Идёт дождь",
    helper: "Для дождя берём капюшон, плащ и резиновые сапоги.",
    sceneStart: "#dbeafe",
    sceneEnd: "#e0f2fe",
    sceneAccent: "#93c5fd",
    items: [
      {
        slot: "hat",
        prompt: "Идёт дождь. Что надеть на голову?",
        target: { id: "rain-hat-hood", slot: "hat", label: "Капюшон", color: "#60a5fa", darkColor: "#1d4ed8" },
        choices: [
          { id: "rain-hat-hood", slot: "hat", label: "Капюшон", color: "#60a5fa", darkColor: "#1d4ed8" },
          { id: "rain-hat-panama", slot: "hat", label: "Панама", color: "#facc15", darkColor: "#a16207" },
          { id: "rain-hat-brim", slot: "hat", label: "Шляпа", color: "#c8a27a", darkColor: "#6d4c41" }
        ]
      },
      {
        slot: "jacket",
        prompt: "Идёт дождь. Что надеть на тело?",
        target: { id: "rain-jacket-raincoat", slot: "jacket", label: "Плащ", color: "#38bdf8", darkColor: "#075985" },
        choices: [
          { id: "rain-jacket-raincoat", slot: "jacket", label: "Плащ", color: "#38bdf8", darkColor: "#075985" },
          { id: "rain-jacket-coat", slot: "jacket", label: "Куртка", color: "#64b5f6", darkColor: "#16446f" },
          { id: "rain-jacket-shirt", slot: "jacket", label: "Футболка", color: "#fb923c", darkColor: "#9a3412" }
        ]
      },
      {
        slot: "shoes",
        prompt: "Идёт дождь. Что надеть на ноги?",
        target: { id: "rain-shoes-rainboots", slot: "shoes", label: "Сапоги", color: "#22c55e", darkColor: "#166534" },
        choices: [
          { id: "rain-shoes-rainboots", slot: "shoes", label: "Сапоги", color: "#22c55e", darkColor: "#166534" },
          { id: "rain-shoes-boots", slot: "shoes", label: "Ботинки", color: "#4db6ac", darkColor: "#15514d" },
          { id: "rain-shoes-sandals", slot: "shoes", label: "Сандалии", color: "#f472b6", darkColor: "#9d174d" }
        ]
      }
    ]
  },
  {
    id: "sun",
    title: "Солнечно и тепло",
    helper: "Для тёплого солнца подойдут панама, футболка и лёгкие сандалии.",
    sceneStart: "#fff7d6",
    sceneEnd: "#d9f99d",
    sceneAccent: "#fde68a",
    items: [
      {
        slot: "hat",
        prompt: "Солнечно. Что надеть на голову?",
        target: { id: "sun-hat-panama", slot: "hat", label: "Панама", color: "#facc15", darkColor: "#a16207" },
        choices: [
          { id: "sun-hat-panama", slot: "hat", label: "Панама", color: "#facc15", darkColor: "#a16207" },
          { id: "sun-hat-beanie", slot: "hat", label: "Шапка", color: "#b39ddb", darkColor: "#4a3d76" },
          { id: "sun-hat-hood", slot: "hat", label: "Капюшон", color: "#60a5fa", darkColor: "#1d4ed8" }
        ]
      },
      {
        slot: "jacket",
        prompt: "Солнечно. Что надеть на тело?",
        target: { id: "sun-jacket-shirt", slot: "jacket", label: "Футболка", color: "#fb923c", darkColor: "#9a3412" },
        choices: [
          { id: "sun-jacket-shirt", slot: "jacket", label: "Футболка", color: "#fb923c", darkColor: "#9a3412" },
          { id: "sun-jacket-coat", slot: "jacket", label: "Куртка", color: "#64b5f6", darkColor: "#16446f" },
          { id: "sun-jacket-raincoat", slot: "jacket", label: "Плащ", color: "#38bdf8", darkColor: "#075985" }
        ]
      },
      {
        slot: "shoes",
        prompt: "Солнечно. Что надеть на ноги?",
        target: { id: "sun-shoes-sandals", slot: "shoes", label: "Сандалии", color: "#f472b6", darkColor: "#9d174d" },
        choices: [
          { id: "sun-shoes-sandals", slot: "shoes", label: "Сандалии", color: "#f472b6", darkColor: "#9d174d" },
          { id: "sun-shoes-boots", slot: "shoes", label: "Ботинки", color: "#4db6ac", darkColor: "#15514d" },
          { id: "sun-shoes-rainboots", slot: "shoes", label: "Сапоги", color: "#22c55e", darkColor: "#166534" }
        ]
      }
    ]
  }
];

export function dressCharacterMaxSteps(kits = dressCharacterWeatherKits) {
  return kits.length * clothingSlots.length;
}

export function dressCharacterKitIndex(step: number, kits = dressCharacterWeatherKits) {
  return Math.floor(step / clothingSlots.length) % kits.length;
}

export function dressCharacterSlotIndex(step: number) {
  return step % clothingSlots.length;
}

export function getDressCharacterKit(step: number, kits = dressCharacterWeatherKits) {
  return kits[dressCharacterKitIndex(step, kits)];
}

export function getDressCharacterTask(step: number, kits = dressCharacterWeatherKits) {
  return getDressCharacterKit(step, kits).items[dressCharacterSlotIndex(step)];
}

export function getDressCharacterExpectedItem(step: number, kits = dressCharacterWeatherKits) {
  return getDressCharacterTask(step, kits).target;
}

export function isDressCharacterKitCompleteStep(step: number) {
  return dressCharacterSlotIndex(step) === clothingSlots.length - 1;
}

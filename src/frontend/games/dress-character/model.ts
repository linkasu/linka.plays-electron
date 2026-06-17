export type ClothingSlot = "hat" | "jacket" | "shoes";

export type DressCharacterWeatherId = "cold" | "rain" | "sun";

export type ClothingItem = {
  slot: ClothingSlot;
  label: string;
  prompt: string;
  hint: string;
  color: string;
  darkColor: string;
};

export type DressCharacterWeatherKit = {
  id: DressCharacterWeatherId;
  title: string;
  helper: string;
  sceneStart: string;
  sceneEnd: string;
  sceneAccent: string;
  items: ClothingItem[];
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
        label: "Шапка",
        prompt: "Холодно. Сначала найдём тёплую шапку.",
        hint: "Для холода нужна шапка сверху.",
        color: "#b39ddb",
        darkColor: "#4a3d76"
      },
      {
        slot: "jacket",
        label: "Куртка",
        prompt: "Теперь выбери куртку для холода.",
        hint: "Куртка закрывает плечи и живот.",
        color: "#64b5f6",
        darkColor: "#16446f"
      },
      {
        slot: "shoes",
        label: "Ботинки",
        prompt: "Остались тёплые ботинки.",
        hint: "Ботинки ждут внизу, у ног.",
        color: "#4db6ac",
        darkColor: "#15514d"
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
        label: "Капюшон",
        prompt: "Идёт дождь. Сначала нужен капюшон.",
        hint: "Капюшон защищает голову от дождя.",
        color: "#60a5fa",
        darkColor: "#1d4ed8"
      },
      {
        slot: "jacket",
        label: "Плащ",
        prompt: "Теперь выбери непромокаемый плащ.",
        hint: "Плащ надевают на тело в дождь.",
        color: "#38bdf8",
        darkColor: "#075985"
      },
      {
        slot: "shoes",
        label: "Сапоги",
        prompt: "Для луж нужны резиновые сапоги.",
        hint: "Сапоги надевают на ноги для луж.",
        color: "#22c55e",
        darkColor: "#166534"
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
        label: "Панама",
        prompt: "Солнечно. Сначала выбери панаму.",
        hint: "Панама защищает голову от солнца.",
        color: "#facc15",
        darkColor: "#a16207"
      },
      {
        slot: "jacket",
        label: "Футболка",
        prompt: "Теперь нужна лёгкая футболка.",
        hint: "В тёплую погоду выбираем лёгкую одежду для тела.",
        color: "#fb923c",
        darkColor: "#9a3412"
      },
      {
        slot: "shoes",
        label: "Сандалии",
        prompt: "Остались сандалии для тёплой прогулки.",
        hint: "Сандалии надевают на ноги в тёплый день.",
        color: "#f472b6",
        darkColor: "#9d174d"
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

export function getDressCharacterExpectedItem(step: number, kits = dressCharacterWeatherKits) {
  return getDressCharacterKit(step, kits).items[dressCharacterSlotIndex(step)];
}

export function isDressCharacterKitCompleteStep(step: number) {
  return dressCharacterSlotIndex(step) === clothingSlots.length - 1;
}

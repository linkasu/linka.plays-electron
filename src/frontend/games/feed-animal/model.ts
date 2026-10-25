export type FeedAnimalFood = {
  id: string;
  wordId?: string;
  /** Drawn picture (core/gameArt.ts); wins over the word picture and the emoji. */
  artId?: string;
  name: string;
  emoji: string;
  color: string;
};

export type FeedAnimal = {
  id: string;
  wordId?: string;
  artId?: string;
  name: string;
  emoji: string;
  promptName: string;
  phrase: string;
  eats: string[];
  /**
   * Foods the animal might well eat although they are not the answer here, so
   * they are never offered as a wrong choice (a correct answer hidden among
   * the «wrong» ones confuses the child, see BUG-PATTERNS P4).
   */
  avoid: string[];
};

export type FeedAnimalRound = {
  roundId: string;
  animal: FeedAnimal;
  foods: FeedAnimalFood[];
  correctFood: FeedAnimalFood;
  correctIndex: number;
};

export const feedAnimalFoods: FeedAnimalFood[] = [
  { id: "carrot", wordId: "carrot", name: "Морковка", emoji: "🥕", color: "orange-lighten-4" },
  { id: "apple", wordId: "apple", name: "Яблоко", emoji: "🍎", color: "red-lighten-4" },
  { id: "grass", wordId: "grass", name: "Трава", emoji: "🌿", color: "green-lighten-4" },
  { id: "bone", name: "Косточка", emoji: "🦴", color: "brown-lighten-4" },
  { id: "fish", wordId: "fish", name: "Рыбка", emoji: "🐟", color: "blue-lighten-4" },
  { id: "berries", name: "Ягоды", emoji: "🫐", color: "indigo-lighten-4" },
  { id: "honey", wordId: "honey", name: "Мёд", emoji: "🍯", color: "amber-lighten-4" },
  {
    id: "seeds",
    artId: "feed-animal/seeds",
    name: "Зёрна",
    emoji: "🌾",
    color: "yellow-lighten-4",
  },
  {
    id: "milk",
    artId: "feed-animal/milk",
    name: "Молоко",
    emoji: "🥛",
    color: "blue-grey-lighten-5",
  },
  { id: "cheese", artId: "feed-animal/cheese", name: "Сыр", emoji: "🧀", color: "amber-lighten-5" },
  {
    id: "leaf",
    artId: "feed-animal/leaf",
    name: "Листик",
    emoji: "🍃",
    color: "light-green-lighten-4",
  },
  { id: "nut", artId: "feed-animal/nut", name: "Орех", emoji: "🌰", color: "brown-lighten-5" },
  { id: "ball", wordId: "ball", name: "Мяч", emoji: "⚽", color: "blue-grey-lighten-4" },
  { id: "boot", name: "Сапог", emoji: "🥾", color: "grey-lighten-3" },
];

// Testers: «мало животных». Five more animals with their food, drawn in the
// style of the existing word pictures.
export const feedAnimals: FeedAnimal[] = [
  {
    id: "rabbit",
    wordId: "rabbit",
    name: "Зайка",
    emoji: "🐰",
    promptName: "зайку",
    phrase: "Зайка ест морковку, яблоко или траву",
    eats: ["carrot", "apple", "grass"],
    avoid: ["leaf", "berries", "seeds"],
  },
  {
    // Testers: «щенок это все не ест, у щенка должна быть кость». With fish
    // also counted as his food, a fish round offered no bone at all.
    id: "puppy",
    wordId: "dog",
    name: "Щенок",
    emoji: "🐶",
    promptName: "щенка",
    phrase: "Щенок ест косточку",
    eats: ["bone"],
    avoid: ["fish", "cheese", "milk", "carrot", "apple"],
  },
  {
    id: "bear",
    wordId: "bear",
    name: "Мишка",
    emoji: "🐻",
    promptName: "мишку",
    phrase: "Мишка ест мёд, ягоды или рыбку",
    eats: ["honey", "berries", "fish"],
    avoid: ["apple", "nut", "grass", "carrot", "seeds"],
  },
  {
    id: "hamster",
    name: "Хомяк",
    emoji: "🐹",
    promptName: "хомяка",
    phrase: "Хомяк ест зёрна, яблоко или морковку",
    eats: ["seeds", "apple", "carrot"],
    avoid: ["nut", "berries", "grass", "leaf", "cheese"],
  },
  {
    id: "kitten",
    artId: "feed-animal/kitten",
    name: "Котёнок",
    emoji: "🐱",
    promptName: "котёнка",
    phrase: "Котёнок ест молоко или рыбку",
    eats: ["milk", "fish"],
    avoid: ["cheese"],
  },
  {
    id: "bird",
    artId: "feed-animal/bird",
    name: "Птичка",
    emoji: "🐦",
    promptName: "птичку",
    phrase: "Птичка ест зёрна или ягоды",
    eats: ["seeds", "berries"],
    avoid: ["apple", "nut", "grass", "leaf"],
  },
  {
    id: "mouse",
    artId: "feed-animal/mouse",
    name: "Мышка",
    emoji: "🐭",
    promptName: "мышку",
    phrase: "Мышка ест сыр или зёрна",
    eats: ["cheese", "seeds"],
    avoid: ["nut", "apple", "berries", "carrot"],
  },
  {
    id: "turtle",
    artId: "feed-animal/turtle",
    name: "Черепаха",
    emoji: "🐢",
    promptName: "черепаху",
    phrase: "Черепаха ест листик или траву",
    eats: ["leaf", "grass"],
    avoid: ["apple", "carrot", "berries"],
  },
  {
    id: "squirrel",
    artId: "feed-animal/squirrel",
    name: "Белка",
    emoji: "🐿️",
    promptName: "белку",
    phrase: "Белка ест орехи или зёрна",
    eats: ["nut", "seeds"],
    avoid: ["berries", "apple"],
  },
];

export const feedAnimalArtIds = [...feedAnimalFoods, ...feedAnimals]
  .map((item) => item.artId)
  .filter((artId): artId is string => Boolean(artId));

function itemAt<T>(items: T[], index: number) {
  return items[index % items.length];
}

function rotate<T>(items: T[], offset: number) {
  return items.map((_, index) => itemAt(items, index + offset));
}

export function animalEatsFood(animal: FeedAnimal, food: FeedAnimalFood) {
  return animal.eats.includes(food.id);
}

export function generateFeedAnimalRound(roundIndex = 1): FeedAnimalRound {
  const animal = itemAt(feedAnimals, roundIndex - 1);
  const edibleFoods = feedAnimalFoods.filter((food) => animalEatsFood(animal, food));
  const wrongFoods = feedAnimalFoods.filter(
    (food) => !animalEatsFood(animal, food) && !animal.avoid.includes(food.id),
  );
  const correctFood = itemAt(edibleFoods, roundIndex - 1);
  const firstWrong = itemAt(wrongFoods, roundIndex);
  let secondWrong = itemAt(wrongFoods, roundIndex + 3);
  if (secondWrong.id === firstWrong.id) secondWrong = itemAt(wrongFoods, roundIndex + 4);
  const foods = rotate([correctFood, firstWrong, secondWrong], roundIndex % 3);

  return {
    roundId: `feed-animal-${roundIndex}`,
    animal,
    foods,
    correctFood,
    correctIndex: foods.findIndex((food) => food.id === correctFood.id),
  };
}

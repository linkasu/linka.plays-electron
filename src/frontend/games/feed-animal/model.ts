export type FeedAnimalFood = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

export type FeedAnimal = {
  id: string;
  name: string;
  emoji: string;
  promptName: string;
  phrase: string;
  eats: string[];
};

export type FeedAnimalRound = {
  roundId: string;
  animal: FeedAnimal;
  foods: FeedAnimalFood[];
  correctFood: FeedAnimalFood;
  correctIndex: number;
};

export const feedAnimalFoods: FeedAnimalFood[] = [
  { id: "carrot", name: "Морковка", emoji: "🥕", color: "orange-lighten-4" },
  { id: "apple", name: "Яблоко", emoji: "🍎", color: "red-lighten-4" },
  { id: "grass", name: "Трава", emoji: "🌿", color: "green-lighten-4" },
  { id: "bone", name: "Косточка", emoji: "🦴", color: "brown-lighten-4" },
  { id: "fish", name: "Рыбка", emoji: "🐟", color: "blue-lighten-4" },
  { id: "berries", name: "Ягоды", emoji: "🫐", color: "indigo-lighten-4" },
  { id: "honey", name: "Мёд", emoji: "🍯", color: "amber-lighten-4" },
  { id: "seeds", name: "Зёрна", emoji: "🌾", color: "yellow-lighten-4" },
  { id: "ball", name: "Мяч", emoji: "⚽", color: "blue-grey-lighten-4" },
  { id: "boot", name: "Сапог", emoji: "🥾", color: "grey-lighten-3" }
];

export const feedAnimals: FeedAnimal[] = [
  { id: "rabbit", name: "Зайка", emoji: "🐰", promptName: "зайку", phrase: "Зайка ест морковку, яблоко или траву", eats: ["carrot", "apple", "grass"] },
  { id: "puppy", name: "Щенок", emoji: "🐶", promptName: "щенка", phrase: "Щенок ест косточку или рыбку", eats: ["bone", "fish"] },
  { id: "bear", name: "Мишка", emoji: "🐻", promptName: "мишку", phrase: "Мишка ест мёд, ягоды или рыбку", eats: ["honey", "berries", "fish"] },
  { id: "hamster", name: "Хомяк", emoji: "🐹", promptName: "хомяка", phrase: "Хомяк ест зёрна, яблоко или морковку", eats: ["seeds", "apple", "carrot"] }
];

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
  const wrongFoods = feedAnimalFoods.filter((food) => !animalEatsFood(animal, food));
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
    correctIndex: foods.findIndex((food) => food.id === correctFood.id)
  };
}

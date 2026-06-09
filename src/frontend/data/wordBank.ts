export type WordItem = {
  id: string;
  word: string;
  emoji: string;
  category: string;
  audioSrc?: string;
};

export const wordBank: WordItem[] = [
  { id: "apple", word: "яблоко", emoji: "🍎", category: "food" },
  { id: "banana", word: "банан", emoji: "🍌", category: "food" },
  { id: "bread", word: "хлеб", emoji: "🍞", category: "food" },
  { id: "cheese", word: "сыр", emoji: "🧀", category: "food" },
  { id: "carrot", word: "морковь", emoji: "🥕", category: "food" },
  { id: "pear", word: "груша", emoji: "🍐", category: "food" },
  { id: "orange", word: "апельсин", emoji: "🍊", category: "food" },
  { id: "lemon", word: "лимон", emoji: "🍋", category: "food" },
  { id: "grapes", word: "виноград", emoji: "🍇", category: "food" },
  { id: "cherry", word: "вишня", emoji: "🍒", category: "food" },
  { id: "strawberry", word: "клубника", emoji: "🍓", category: "food" },
  { id: "watermelon", word: "арбуз", emoji: "🍉", category: "food" },
  { id: "melon", word: "дыня", emoji: "🍈", category: "food" },
  { id: "peach", word: "персик", emoji: "🍑", category: "food" },
  { id: "plum", word: "слива", emoji: "🫐", category: "food" },
  { id: "kiwi", word: "киви", emoji: "🥝", category: "food" },
  { id: "tomato", word: "помидор", emoji: "🍅", category: "food" },
  { id: "cucumber", word: "огурец", emoji: "🥒", category: "food" },
  { id: "potato", word: "картошка", emoji: "🥔", category: "food" },
  { id: "onion", word: "лук", emoji: "🧅", category: "food" },
  { id: "corn", word: "кукуруза", emoji: "🌽", category: "food" },
  { id: "pepper", word: "перец", emoji: "🫑", category: "food" },
  { id: "mushroom", word: "гриб", emoji: "🍄", category: "food" },
  { id: "egg", word: "яйцо", emoji: "🥚", category: "food" },
  { id: "milk", word: "молоко", emoji: "🥛", category: "food" },
  { id: "juice", word: "сок", emoji: "🧃", category: "food" },
  { id: "tea", word: "чай", emoji: "🍵", category: "food" },
  { id: "soup", word: "суп", emoji: "🍲", category: "food" },
  { id: "rice", word: "рис", emoji: "🍚", category: "food" },
  { id: "pasta", word: "лапша", emoji: "🍝", category: "food" },
  { id: "meat", word: "мясо", emoji: "🥩", category: "food" },
  { id: "chicken", word: "курятина", emoji: "🍗", category: "food" },
  { id: "cake", word: "торт", emoji: "🎂", category: "food" },
  { id: "cookie", word: "печенье", emoji: "🍪", category: "food" },
  { id: "honey", word: "мёд", emoji: "🍯", category: "food" },
  { id: "ice_cream", word: "мороженое", emoji: "🍦", category: "food" },
  { id: "porridge", word: "каша", emoji: "🥣", category: "food" },
  { id: "yogurt", word: "йогурт", emoji: "🥤", category: "food" },
  { id: "sausage", word: "сосиска", emoji: "🌭", category: "food" },
  { id: "pizza", word: "пицца", emoji: "🍕", category: "food" },
  { id: "ball", word: "мяч", emoji: "⚽", category: "thing" },
  { id: "book", word: "книга", emoji: "📘", category: "thing" },
  { id: "chair", word: "стул", emoji: "🪑", category: "thing" },
  { id: "key", word: "ключ", emoji: "🔑", category: "thing" },
  { id: "lamp", word: "лампа", emoji: "💡", category: "thing" },
  { id: "cup", word: "чашка", emoji: "☕", category: "thing" },
  { id: "plate", word: "тарелка", emoji: "🍽️", category: "thing" },
  { id: "spoon", word: "ложка", emoji: "🥄", category: "thing" },
  { id: "fork", word: "вилка", emoji: "🍴", category: "thing" },
  { id: "sofa", word: "диван", emoji: "🛋️", category: "thing" },
  { id: "bed", word: "кровать", emoji: "🛏️", category: "thing" },
  { id: "pillow", word: "подушка", emoji: "🛌", category: "thing" },
  { id: "backpack", word: "рюкзак", emoji: "🎒", category: "thing" },
  { id: "door", word: "дверь", emoji: "🚪", category: "thing" },
  { id: "window", word: "окно", emoji: "🪟", category: "thing" },
  { id: "clock", word: "часы", emoji: "🕘", category: "thing" },
  { id: "phone", word: "телефон", emoji: "📱", category: "thing" },
  { id: "bag", word: "сумка", emoji: "👜", category: "thing" },
  { id: "box", word: "коробка", emoji: "📦", category: "thing" },
  { id: "pencil", word: "карандаш", emoji: "✏️", category: "thing" },
  { id: "pen", word: "ручка", emoji: "🖊️", category: "thing" },
  { id: "brush", word: "щётка", emoji: "🪥", category: "thing" },
  { id: "soap", word: "мыло", emoji: "🧼", category: "thing" },
  { id: "towel", word: "полотенце", emoji: "🧺", category: "thing" },
  { id: "comb", word: "расчёска", emoji: "🪮", category: "thing" },
  { id: "scissors", word: "ножницы", emoji: "✂️", category: "thing" },
  { id: "umbrella", word: "зонт", emoji: "☂️", category: "thing" },
  { id: "toy", word: "игрушка", emoji: "🧸", category: "thing" },
  { id: "doll", word: "кукла", emoji: "🎎", category: "thing" },
  { id: "drum", word: "барабан", emoji: "🥁", category: "thing" },
  { id: "bell", word: "колокол", emoji: "🔔", category: "thing" },
  { id: "candle", word: "свеча", emoji: "🕯️", category: "thing" },
  { id: "camera", word: "камера", emoji: "📷", category: "thing" },
  { id: "glasses", word: "очки", emoji: "👓", category: "thing" },
  { id: "map", word: "карта", emoji: "🗺️", category: "thing" },
  { id: "coin", word: "монета", emoji: "🪙", category: "thing" },
  { id: "flag", word: "флаг", emoji: "🚩", category: "thing" },
  { id: "bucket", word: "ведро", emoji: "🪣", category: "thing" },
  { id: "broom", word: "метла", emoji: "🧹", category: "thing" },
  { id: "basket", word: "корзина", emoji: "🧺", category: "thing" },
  { id: "cat", word: "кот", emoji: "🐱", category: "animal" },
  { id: "dog", word: "пёс", emoji: "🐶", category: "animal" },
  { id: "fish", word: "рыба", emoji: "🐟", category: "animal" },
  { id: "duck", word: "утка", emoji: "🦆", category: "animal" },
  { id: "cow", word: "корова", emoji: "🐮", category: "animal" },
  { id: "horse", word: "лошадь", emoji: "🐴", category: "animal" },
  { id: "pig", word: "свинья", emoji: "🐷", category: "animal" },
  { id: "sheep", word: "овца", emoji: "🐑", category: "animal" },
  { id: "goat", word: "коза", emoji: "🐐", category: "animal" },
  { id: "rabbit", word: "заяц", emoji: "🐰", category: "animal" },
  { id: "fox", word: "лиса", emoji: "🦊", category: "animal" },
  { id: "bear", word: "медведь", emoji: "🐻", category: "animal" },
  { id: "wolf", word: "волк", emoji: "🐺", category: "animal" },
  { id: "lion", word: "лев", emoji: "🦁", category: "animal" },
  { id: "tiger", word: "тигр", emoji: "🐯", category: "animal" },
  { id: "elephant", word: "слон", emoji: "🐘", category: "animal" },
  { id: "giraffe", word: "жираф", emoji: "🦒", category: "animal" },
  { id: "zebra", word: "зебра", emoji: "🦓", category: "animal" },
  { id: "monkey", word: "обезьяна", emoji: "🐵", category: "animal" },
  { id: "mouse", word: "мышь", emoji: "🐭", category: "animal" },
  { id: "frog", word: "жаба", emoji: "🐸", category: "animal" },
  { id: "bird", word: "птица", emoji: "🐦", category: "animal" },
  { id: "owl", word: "сова", emoji: "🦉", category: "animal" },
  { id: "hen", word: "курица", emoji: "🐔", category: "animal" },
  { id: "turtle", word: "черепаха", emoji: "🐢", category: "animal" },
  { id: "dolphin", word: "дельфин", emoji: "🐬", category: "animal" },
  { id: "whale", word: "кит", emoji: "🐳", category: "animal" },
  { id: "snail", word: "улитка", emoji: "🐌", category: "animal" },
  { id: "bee", word: "пчела", emoji: "🐝", category: "animal" },
  { id: "butterfly", word: "бабочка", emoji: "🦋", category: "animal" },
  { id: "flower", word: "цветок", emoji: "🌸", category: "nature" },
  { id: "tree", word: "дерево", emoji: "🌳", category: "nature" },
  { id: "sun", word: "солнце", emoji: "☀️", category: "nature" },
  { id: "moon", word: "луна", emoji: "🌙", category: "nature" },
  { id: "star", word: "звезда", emoji: "⭐", category: "nature" },
  { id: "cloud", word: "облако", emoji: "☁️", category: "nature" },
  { id: "rain", word: "дождь", emoji: "🌧️", category: "nature" },
  { id: "snow", word: "снег", emoji: "❄️", category: "nature" },
  { id: "wind", word: "ветер", emoji: "💨", category: "nature" },
  { id: "rainbow", word: "радуга", emoji: "🌈", category: "nature" },
  { id: "river", word: "река", emoji: "🏞️", category: "nature" },
  { id: "lake", word: "озеро", emoji: "💧", category: "nature" },
  { id: "sea", word: "море", emoji: "🌊", category: "nature" },
  { id: "mountain", word: "гора", emoji: "⛰️", category: "nature" },
  { id: "forest", word: "лес", emoji: "🌲", category: "nature" },
  { id: "grass", word: "трава", emoji: "🌿", category: "nature" },
  { id: "leaf", word: "лист", emoji: "🍃", category: "nature" },
  { id: "stone", word: "камень", emoji: "🪨", category: "nature" },
  { id: "fire", word: "огонь", emoji: "🔥", category: "nature" },
  { id: "wave", word: "волна", emoji: "🌊", category: "nature" },
  { id: "island", word: "остров", emoji: "🏝️", category: "nature" },
  { id: "sand", word: "песок", emoji: "🏖️", category: "nature" },
  { id: "shell", word: "ракушка", emoji: "🐚", category: "nature" },
  { id: "pine", word: "сосна", emoji: "🌲", category: "nature" },
  { id: "cactus", word: "кактус", emoji: "🌵", category: "nature" },
  { id: "car", word: "машина", emoji: "🚗", category: "transport" },
  { id: "bus", word: "автобус", emoji: "🚌", category: "transport" },
  { id: "train", word: "поезд", emoji: "🚆", category: "transport" },
  { id: "tram", word: "трамвай", emoji: "🚋", category: "transport" },
  { id: "bicycle", word: "велосипед", emoji: "🚲", category: "transport" },
  { id: "scooter", word: "самокат", emoji: "🛴", category: "transport" },
  { id: "boat", word: "лодка", emoji: "🚣", category: "transport" },
  { id: "ship", word: "корабль", emoji: "🚢", category: "transport" },
  { id: "plane", word: "самолёт", emoji: "✈️", category: "transport" },
  { id: "rocket", word: "ракета", emoji: "🚀", category: "transport" },
  { id: "eye", word: "глаз", emoji: "👁️", category: "body" },
  { id: "ear", word: "ухо", emoji: "👂", category: "body" },
  { id: "nose", word: "нос", emoji: "👃", category: "body" },
  { id: "mouth", word: "рот", emoji: "👄", category: "body" },
  { id: "hand", word: "рука", emoji: "✋", category: "body" },
  { id: "foot", word: "нога", emoji: "🦶", category: "body" },
  { id: "tooth", word: "зуб", emoji: "🦷", category: "body" },
  { id: "heart", word: "сердце", emoji: "❤️", category: "body" },
  { id: "shirt", word: "рубашка", emoji: "👕", category: "clothes" },
  { id: "pants", word: "штаны", emoji: "👖", category: "clothes" },
  { id: "dress", word: "платье", emoji: "👗", category: "clothes" },
  { id: "shoes", word: "обувь", emoji: "👟", category: "clothes" },
  { id: "socks", word: "носки", emoji: "🧦", category: "clothes" },
  { id: "coat", word: "пальто", emoji: "🧥", category: "clothes" },
  { id: "cap", word: "кепка", emoji: "🧢", category: "clothes" }
];

export function getAllWords() {
  return [...wordBank];
}

export function getWordsByCategory(category: string) {
  return wordBank.filter((item) => item.category === category);
}

export function getWordsByLength(min: number, max: number) {
  return wordBank.filter((item) => Array.from(item.word).length >= min && Array.from(item.word).length <= max);
}

export function sampleItems<T>(items: T[], count: number, exclude: T[] = []) {
  const excluded = new Set(exclude);
  const pool = items.filter((item) => !excluded.has(item));
  const result: T[] = [];
  while (pool.length && result.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    const [item] = pool.splice(index, 1);
    result.push(item);
  }
  return result;
}

export function shuffleItems<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function validateWordBank(items = wordBank) {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.id) errors.push("Word id is empty.");
    if (ids.has(item.id)) errors.push(`Duplicate word id: ${item.id}`);
    ids.add(item.id);
    if (!item.word) errors.push(`Word is empty for ${item.id}`);
    if (!item.emoji) errors.push(`Emoji is empty for ${item.id}`);
    if (!item.category) errors.push(`Category is empty for ${item.id}`);
  }
  if (getWordsByCategory("food").length < 2) errors.push("Need at least two food words.");
  if (getWordsByCategory("thing").length < 2) errors.push("Need at least two thing words.");
  return errors;
}

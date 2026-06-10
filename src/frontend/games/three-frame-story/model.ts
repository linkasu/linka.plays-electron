import { shuffleItems } from "../../data/wordBank";

export type ThreeFrameStoryFrame = {
  id: string;
  label: string;
  caption: string;
  emoji: string;
  color: string;
};

export type ThreeFrameStory = {
  id: string;
  title: string;
  prompt: string;
  frames: [ThreeFrameStoryFrame, ThreeFrameStoryFrame, ThreeFrameStoryFrame];
};

export type ThreeFrameStoryRound = {
  roundId: string;
  story: ThreeFrameStory;
  stepInStory: number;
  placedFrames: ThreeFrameStoryFrame[];
  expectedFrame: ThreeFrameStoryFrame;
  choices: ThreeFrameStoryFrame[];
  correctIndex: number;
};

export const threeFrameStories: ThreeFrameStory[] = [
  {
    id: "plant-flower",
    title: "Цветок растёт",
    prompt: "Собери историю: как появляется цветок?",
    frames: [
      { id: "seed", label: "семечко", caption: "Сначала кладём семечко в землю.", emoji: "🌱", color: "green-lighten-5" },
      { id: "watering", label: "полив", caption: "Потом мягко поливаем росток.", emoji: "💧", color: "light-blue-lighten-5" },
      { id: "flower", label: "цветок", caption: "В конце раскрывается цветок.", emoji: "🌸", color: "pink-lighten-5" }
    ]
  },
  {
    id: "make-tea",
    title: "Чай готов",
    prompt: "Собери историю: как сделать чай?",
    frames: [
      { id: "kettle", label: "чайник", caption: "Сначала греем чайник.", emoji: "🫖", color: "blue-grey-lighten-5" },
      { id: "cup", label: "чашка", caption: "Потом наливаем чай в чашку.", emoji: "☕", color: "brown-lighten-5" },
      { id: "cookie", label: "печенье", caption: "В конце пьём чай спокойно.", emoji: "🍪", color: "orange-lighten-5" }
    ]
  },
  {
    id: "rainbow-after-rain",
    title: "После дождя",
    prompt: "Собери историю: что происходит после тучи?",
    frames: [
      { id: "cloud", label: "туча", caption: "Сначала приходит туча.", emoji: "☁️", color: "blue-grey-lighten-5" },
      { id: "rain", label: "дождь", caption: "Потом идёт тихий дождь.", emoji: "🌧️", color: "light-blue-lighten-5" },
      { id: "rainbow", label: "радуга", caption: "В конце появляется радуга.", emoji: "🌈", color: "purple-lighten-5" }
    ]
  },
  {
    id: "build-snowman",
    title: "Снеговик",
    prompt: "Собери историю: как сделать снеговика?",
    frames: [
      { id: "snow", label: "снег", caption: "Сначала выпал мягкий снег.", emoji: "❄️", color: "cyan-lighten-5" },
      { id: "snowballs", label: "комы", caption: "Потом катаем снежные комы.", emoji: "⚪", color: "blue-lighten-5" },
      { id: "snowman", label: "снеговик", caption: "В конце стоит снеговик.", emoji: "⛄", color: "indigo-lighten-5" }
    ]
  }
];

export function generateThreeFrameStoryRound(completedSteps: number): ThreeFrameStoryRound {
  const safeCompletedSteps = Math.max(0, completedSteps);
  const storyIndex = Math.floor(safeCompletedSteps / 3) % threeFrameStories.length;
  const stepInStory = safeCompletedSteps % 3;
  const story = threeFrameStories[storyIndex];
  const expectedFrame = story.frames[stepInStory];
  const placedFrames = story.frames.slice(0, stepInStory);
  const choices = shuffleItems(story.frames);

  return {
    roundId: `three-frame-story:${story.id}:${stepInStory + 1}`,
    story,
    stepInStory,
    placedFrames,
    expectedFrame,
    choices,
    correctIndex: choices.indexOf(expectedFrame)
  };
}

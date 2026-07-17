import { shuffleItems } from "../../core/random";

export type ThreeFrameStoryFrame = {
  id: string;
  label: string;
  caption: string;
  color: string;
  scene: ThreeFrameStoryScene;
};

export type ThreeFrameStorySceneSetting = "earth" | "sky" | "snow" | "table";
export type ThreeFrameStoryScenePosition = "top-left" | "top-center" | "top-right" | "left" | "center" | "right" | "bottom-left" | "bottom-center" | "bottom-right";
export type ThreeFrameStorySceneSize = "small" | "medium" | "large";

export type ThreeFrameStorySceneLayer =
  | { kind: "word"; wordId: string; word: string; emoji: string; position: ThreeFrameStoryScenePosition; size?: ThreeFrameStorySceneSize }
  | { kind: "icon"; icon: string; color: string; position: ThreeFrameStoryScenePosition; size?: ThreeFrameStorySceneSize };

export type ThreeFrameStoryScene = {
  setting: ThreeFrameStorySceneSetting;
  layers: [ThreeFrameStorySceneLayer, ThreeFrameStorySceneLayer, ...ThreeFrameStorySceneLayer[]];
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

export type ThreeFrameStoryRoundOptions = {
  random?: () => number;
  choiceOrder?: string[];
  storyOrder?: number[];
};

function word(wordId: string, label: string, emoji: string, position: ThreeFrameStoryScenePosition, size: ThreeFrameStorySceneSize = "large"): ThreeFrameStorySceneLayer {
  return { kind: "word", wordId, word: label, emoji, position, size };
}

function icon(iconName: string, color: string, position: ThreeFrameStoryScenePosition, size: ThreeFrameStorySceneSize = "medium"): ThreeFrameStorySceneLayer {
  return { kind: "icon", icon: iconName, color, position, size };
}

function scene(setting: ThreeFrameStorySceneSetting, first: ThreeFrameStorySceneLayer, second: ThreeFrameStorySceneLayer, ...rest: ThreeFrameStorySceneLayer[]): ThreeFrameStoryScene {
  return { setting, layers: [first, second, ...rest] };
}

export const threeFrameStories: ThreeFrameStory[] = [
  {
    id: "plant-flower",
    title: "Цветок растёт",
    prompt: "Собери историю о росте цветка.",
    frames: [
      {
        id: "seed",
        label: "семечко",
        caption: "Сначала семечко лежит в земле.",
        color: "brown-lighten-5",
        scene: scene("earth", icon("mdi-seed-outline", "brown-darken-2", "bottom-center", "large"), icon("mdi-shovel", "blue-grey-darken-1", "left"), icon("mdi-arrow-down-bold", "green-darken-2", "top-center", "small"))
      },
      {
        id: "sprout",
        label: "росток",
        caption: "Потом из земли появляется росток.",
        color: "light-green-lighten-5",
        scene: scene("earth", icon("mdi-sprout", "green-darken-2", "bottom-center", "large"), icon("mdi-watering-can-outline", "light-blue-darken-2", "right"), icon("mdi-water", "light-blue-darken-1", "top-right", "small"))
      },
      {
        id: "flower",
        label: "цветок",
        caption: "В конце раскрывается цветок.",
        color: "pink-lighten-5",
        scene: scene("earth", word("flower", "цветок", "🌸", "center"), icon("mdi-white-balance-sunny", "amber-darken-1", "top-right"), icon("mdi-sprout", "green-darken-2", "bottom-left", "small"))
      }
    ]
  },
  {
    id: "make-tea",
    title: "Чай готов",
    prompt: "Собери историю о чаепитии.",
    frames: [
      {
        id: "kettle",
        label: "греем воду",
        caption: "Сначала греем воду в чайнике.",
        color: "blue-grey-lighten-5",
        scene: scene("table", icon("mdi-kettle-steam-outline", "blue-grey-darken-2", "center", "large"), icon("mdi-stove", "deep-orange-darken-1", "bottom-center"), icon("mdi-heat-wave", "orange-darken-1", "top-center", "small"))
      },
      {
        id: "cup",
        label: "наливаем чай",
        caption: "Потом наливаем чай в чашку.",
        color: "brown-lighten-5",
        scene: scene("table", icon("mdi-kettle-outline", "blue-grey-darken-2", "left", "large"), word("cup", "чашка", "☕", "right"), icon("mdi-arrow-right-bold", "brown-darken-1", "center", "small"))
      },
      {
        id: "tea",
        label: "пьём чай",
        caption: "В конце чай готов.",
        color: "orange-lighten-5",
        scene: scene("table", word("tea", "чай", "🍵", "left"), word("cookie", "печенье", "🍪", "right", "medium"), icon("mdi-heat-wave", "orange-darken-1", "top-left", "small"))
      }
    ]
  },
  {
    id: "rainbow-after-rain",
    title: "После дождя",
    prompt: "Собери историю о погоде.",
    frames: [
      {
        id: "cloud",
        label: "туча закрыла солнце",
        caption: "Сначала туча закрывает солнце.",
        color: "blue-grey-lighten-5",
        scene: scene("sky", word("cloud", "туча", "☁️", "center"), icon("mdi-white-balance-sunny", "amber-darken-1", "top-right"), icon("mdi-weather-windy", "blue-grey-darken-1", "left", "small"))
      },
      {
        id: "rain",
        label: "идёт дождь",
        caption: "Потом из тучи идёт дождь.",
        color: "light-blue-lighten-5",
        scene: scene("sky", word("rain", "дождь", "🌧️", "center"), icon("mdi-water", "light-blue-darken-2", "bottom-left", "small"), icon("mdi-water", "light-blue-darken-2", "bottom-right", "small"))
      },
      {
        id: "rainbow",
        label: "появилась радуга",
        caption: "В конце появляется радуга.",
        color: "purple-lighten-5",
        scene: scene("sky", word("rainbow", "радуга", "🌈", "center"), icon("mdi-white-balance-sunny", "amber-darken-1", "top-right"), word("cloud", "облако", "☁️", "bottom-left", "small"))
      }
    ]
  },
  {
    id: "build-snowman",
    title: "Снеговик",
    prompt: "Собери историю о снеговике.",
    frames: [
      {
        id: "snow",
        label: "выпал снег",
        caption: "Сначала землю укрывает снег.",
        color: "cyan-lighten-5",
        scene: scene("snow", word("snow", "снег", "❄️", "center"), icon("mdi-weather-cloudy", "blue-grey-darken-1", "top-center"), icon("mdi-snowflake", "light-blue-darken-1", "bottom-right", "small"))
      },
      {
        id: "snowballs",
        label: "скатали комы",
        caption: "Потом катаем снежные комы.",
        color: "blue-lighten-5",
        scene: scene("snow", icon("mdi-circle", "blue-grey-lighten-4", "bottom-left", "large"), icon("mdi-circle", "blue-grey-lighten-4", "bottom-right", "medium"), icon("mdi-hand-back-right-outline", "blue-darken-1", "top-right", "small"))
      },
      {
        id: "snowman",
        label: "собрали снеговика",
        caption: "В конце стоит снеговик.",
        color: "indigo-lighten-5",
        scene: scene("snow", icon("mdi-snowman", "blue-grey-darken-2", "center", "large"), word("snow", "снег", "❄️", "bottom-left", "small"), icon("mdi-white-balance-sunny", "amber-darken-1", "top-right", "small"))
      }
    ]
  }
];

export function createThreeFrameStorySlots(round: ThreeFrameStoryRound, acceptedFrameId?: string): [ThreeFrameStoryFrame | undefined, ThreeFrameStoryFrame | undefined, ThreeFrameStoryFrame | undefined] {
  const frames = acceptedFrameId === round.expectedFrame.id ? [...round.placedFrames, round.expectedFrame] : round.placedFrames;
  return [frames[0], frames[1], frames[2]];
}

export function generateThreeFrameStoryRound(completedSteps: number, options: ThreeFrameStoryRoundOptions = {}): ThreeFrameStoryRound {
  const safeCompletedSteps = Math.max(0, completedSteps);
  const storyCycleIndex = Math.floor(safeCompletedSteps / 3) % threeFrameStories.length;
  const storyIndex = options.storyOrder?.[storyCycleIndex] ?? storyCycleIndex;
  const stepInStory = safeCompletedSteps % 3;
  const story = threeFrameStories[storyIndex];
  const expectedFrame = story.frames[stepInStory];
  const placedFrames = story.frames.slice(0, stepInStory);
  const choices = options.choiceOrder
    ? [...story.frames].sort((left, right) => options.choiceOrder!.indexOf(left.id) - options.choiceOrder!.indexOf(right.id))
    : shuffleItems(story.frames, options.random);

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

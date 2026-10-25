import { shuffleItems } from "../../core/random";

export type ThreeFrameStoryFrame = {
  id: string;
  label: string;
  caption: string;
  color: string;
  /** Drawn frame, public/images/three-frame-story/<name>.png. */
  artId: string;
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

// Testers: «нарисовать картинки, непонятные картинки» — every frame is one drawn picture.
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
        artId: "three-frame-story/seed-1",
      },
      {
        id: "sprout",
        label: "росток",
        caption: "Потом из земли появляется росток.",
        color: "light-green-lighten-5",
        artId: "three-frame-story/seed-2",
      },
      {
        id: "flower",
        label: "цветок",
        caption: "В конце раскрывается цветок.",
        color: "pink-lighten-5",
        artId: "three-frame-story/seed-3",
      },
    ],
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
        artId: "three-frame-story/tea-1",
      },
      {
        id: "cup",
        label: "наливаем чай",
        caption: "Потом наливаем чай в чашку.",
        color: "brown-lighten-5",
        artId: "three-frame-story/tea-2",
      },
      {
        id: "tea",
        label: "пьём чай",
        caption: "В конце чай готов.",
        color: "orange-lighten-5",
        artId: "three-frame-story/tea-3",
      },
    ],
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
        artId: "three-frame-story/rain-1",
      },
      {
        id: "rain",
        label: "идёт дождь",
        caption: "Потом из тучи идёт дождь.",
        color: "light-blue-lighten-5",
        artId: "three-frame-story/rain-2",
      },
      {
        id: "rainbow",
        label: "появилась радуга",
        caption: "В конце появляется радуга.",
        color: "purple-lighten-5",
        artId: "three-frame-story/rain-3",
      },
    ],
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
        artId: "three-frame-story/snowman-1",
      },
      {
        id: "snowballs",
        label: "скатали комы",
        caption: "Потом катаем снежные комы.",
        color: "blue-lighten-5",
        artId: "three-frame-story/snowman-2",
      },
      {
        id: "snowman",
        label: "собрали снеговика",
        caption: "В конце стоит снеговик.",
        color: "indigo-lighten-5",
        artId: "three-frame-story/snowman-3",
      },
    ],
  },
  {
    id: "bake-pie",
    title: "Пирог",
    prompt: "Собери историю о пироге.",
    frames: [
      {
        id: "dough",
        label: "тесто",
        caption: "Сначала замешиваем тесто.",
        color: "amber-lighten-5",
        artId: "three-frame-story/pie-1",
      },
      {
        id: "oven",
        label: "печём",
        caption: "Потом пирог печётся в духовке.",
        color: "orange-lighten-5",
        artId: "three-frame-story/pie-2",
      },
      {
        id: "pie",
        label: "пирог готов",
        caption: "В конце пирог готов.",
        color: "deep-orange-lighten-5",
        artId: "three-frame-story/pie-3",
      },
    ],
  },
  {
    id: "butterfly",
    title: "Бабочка",
    prompt: "Собери историю о бабочке.",
    frames: [
      {
        id: "caterpillar",
        label: "гусеница",
        caption: "Сначала гусеница ест листья.",
        color: "light-green-lighten-5",
        artId: "three-frame-story/butterfly-1",
      },
      {
        id: "cocoon",
        label: "кокон",
        caption: "Потом гусеница прячется в кокон.",
        color: "green-lighten-5",
        artId: "three-frame-story/butterfly-2",
      },
      {
        id: "butterfly",
        label: "бабочка",
        caption: "В конце из кокона вылетает бабочка.",
        color: "orange-lighten-5",
        artId: "three-frame-story/butterfly-3",
      },
    ],
  },
];

export function createThreeFrameStorySlots(
  round: ThreeFrameStoryRound,
  acceptedFrameId?: string,
): [
  ThreeFrameStoryFrame | undefined,
  ThreeFrameStoryFrame | undefined,
  ThreeFrameStoryFrame | undefined,
] {
  const frames =
    acceptedFrameId === round.expectedFrame.id
      ? [...round.placedFrames, round.expectedFrame]
      : round.placedFrames;
  return [frames[0], frames[1], frames[2]];
}

export function generateThreeFrameStoryRound(
  completedSteps: number,
  options: ThreeFrameStoryRoundOptions = {},
): ThreeFrameStoryRound {
  const safeCompletedSteps = Math.max(0, completedSteps);
  const storyCycleIndex = Math.floor(safeCompletedSteps / 3) % threeFrameStories.length;
  const storyIndex = options.storyOrder?.[storyCycleIndex] ?? storyCycleIndex;
  const stepInStory = safeCompletedSteps % 3;
  const story = threeFrameStories[storyIndex];
  const expectedFrame = story.frames[stepInStory];
  const placedFrames = story.frames.slice(0, stepInStory);
  const choices = options.choiceOrder
    ? [...story.frames].sort(
        (left, right) =>
          options.choiceOrder!.indexOf(left.id) - options.choiceOrder!.indexOf(right.id),
      )
    : shuffleItems(story.frames, options.random);

  return {
    roundId: `three-frame-story:${story.id}:${stepInStory + 1}`,
    story,
    stepInStory,
    placedFrames,
    expectedFrame,
    choices,
    correctIndex: choices.indexOf(expectedFrame),
  };
}

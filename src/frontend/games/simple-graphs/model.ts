import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../core/random";

export type SimpleGraphsQuestionKind = "more" | "less" | "count";

export type SimpleGraphsBar = {
  id: string;
  wordId: string;
  label: string;
  emoji: string;
  value: number;
  color: string;
};

export type SimpleGraphsChoice = {
  choiceId: string;
  label: string;
  value?: number;
  barId?: string;
};

export type SimpleGraphsRound = {
  roundId: string;
  prompt: string;
  helperText: string;
  questionKind: SimpleGraphsQuestionKind;
  bars: SimpleGraphsBar[];
  choices: SimpleGraphsChoice[];
  correctChoiceId: string;
  correctIndex: number;
  targetBar?: SimpleGraphsBar;
};

const graphItems = [
  { id: "apples", wordId: "apple", label: "яблоки", emoji: "🍎", color: "#f28b82" },
  { id: "stars", wordId: "star", label: "звёзды", emoji: "⭐", color: "#fdd663" },
  { id: "fish", wordId: "fish", label: "рыбки", emoji: "🐟", color: "#7baaf7" },
  { id: "flowers", wordId: "flower", label: "цветы", emoji: "🌸", color: "#f7a1c4" },
  { id: "ducks", wordId: "duck", label: "утки", emoji: "🦆", color: "#81c995" },
  { id: "cars", wordId: "car", label: "машинки", emoji: "🚗", color: "#a78bfa" }
] as const;

function maxValueFor(settings: SessionSettings) {
  if (settings.preset === "gentle") return 5;
  if (settings.preset === "challenge") return 9;
  return 7;
}

function questionKindFor(roundIndex: number): SimpleGraphsQuestionKind {
  const kinds: SimpleGraphsQuestionKind[] = ["more", "less", "count"];
  return kinds[(roundIndex - 1) % kinds.length];
}

function pickValues(settings: SessionSettings, random: () => number) {
  return shuffleItems(Array.from({ length: maxValueFor(settings) }, (_, index) => index + 1), random).slice(0, 3);
}

function buildCountChoices(answer: number, settings: SessionSettings, random: () => number): SimpleGraphsChoice[] {
  const choiceCount = settings.preset === "gentle" ? 3 : 4;
  const max = maxValueFor(settings);
  const nearby = [answer - 1, answer + 1, answer - 2, answer + 2]
   .filter((value) => value >= 1 && value <= max && value !== answer);
  const values = new Set([answer]);

  for (const value of shuffleItems(nearby, random)) {
    if (values.size < choiceCount) values.add(value);
  }
  for (const value of shuffleItems(Array.from({ length: max }, (_, index) => index + 1), random)) {
    if (values.size < choiceCount && value !== answer) values.add(value);
  }

  return shuffleItems([...values], random).map((value) => ({
    choiceId: `count:${value}`,
    label: String(value),
    value
  }));
}

function buildBarChoices(bars: SimpleGraphsBar[]): SimpleGraphsChoice[] {
  return bars.map((bar) => ({
    choiceId: `bar:${bar.id}`,
    label: bar.label,
    barId: bar.id,
    value: bar.value
  }));
}

export function generateSimpleGraphsRound(settings: SessionSettings, roundIndex = 1, random = Math.random): SimpleGraphsRound {
  const questionKind = questionKindFor(roundIndex);
  const items = shuffleItems([...graphItems], random).slice(0, 3);
  const values = pickValues(settings, random);
  const bars = items.map((item, index) => ({ ...item, value: values[index] }));

  if (questionKind === "count") {
    const targetBar = bars[(roundIndex - 1) % bars.length];
    const choices = buildCountChoices(targetBar.value, settings, random);
    const correctChoiceId = `count:${targetBar.value}`;

    return {
      roundId: `simple-graphs:round:${roundIndex}`,
      prompt: `Сколько у столбика "${targetBar.label}"?`,
      helperText: "Найди столбик и выбери его число.",
      questionKind,
      bars,
      choices,
      correctChoiceId,
      correctIndex: choices.findIndex((choice) => choice.choiceId === correctChoiceId),
      targetBar
    };
  }

  const correctBar = bars.reduce((best, bar) => questionKind === "more"
    ? bar.value > best.value ? bar : best
    : bar.value < best.value ? bar : best);
  const choices = buildBarChoices(bars);
  const correctChoiceId = `bar:${correctBar.id}`;

  return {
    roundId: `simple-graphs:round:${roundIndex}`,
    prompt: questionKind === "more" ? "Где больше?" : "Где меньше?",
    helperText: questionKind === "more" ? "Выбери самый высокий столбик." : "Выбери самый низкий столбик.",
    questionKind,
    bars,
    choices,
    correctChoiceId,
    correctIndex: choices.findIndex((choice) => choice.choiceId === correctChoiceId)
  };
}

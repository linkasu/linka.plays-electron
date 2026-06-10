import type { SessionSettings } from "../../core/settings";
import { sampleItems, shuffleItems } from "../../data/wordBank";

export type DominoSide = "left" | "right";

export type DominoTile = {
  id: string;
  left: number;
  right: number;
};

export type DominoChoice = {
  id: string;
  tile: DominoTile;
  matchSide: DominoSide;
};

export type DominoMatchingRound = {
  roundId: string;
  prompt: string;
  instruction: string;
  target: DominoTile;
  openSide: DominoSide;
  targetDots: number;
  choices: DominoChoice[];
  correctIndex: number;
  explanation: string;
};

export const dominoTiles: DominoTile[] = Array.from({ length: 7 }, (_, left) =>
  Array.from({ length: 7 - left }, (_, offset) => {
    const right = left + offset;
    return { id: `${left}-${right}`, left, right };
  })
).flat();

function oppositeSide(side: DominoSide): DominoSide {
  return side === "left" ? "right" : "left";
}

function sideLabel(side: DominoSide) {
  return side === "left" ? "левой" : "правой";
}

function dotLabel(count: number) {
  if (count === 0) return "пустой стороной";
  if (count === 1) return "1 точкой";
  if (count >= 2 && count <= 4) return `${count} точками`;
  return `${count} точками`;
}

function choiceCountForSettings(settings: SessionSettings) {
  return settings.preset === "gentle" ? 3 : 4;
}

function buildChoice(tile: DominoTile, matchSide: DominoSide): DominoChoice {
  return {
    id: `${tile.id}:${matchSide}`,
    tile,
    matchSide
  };
}

export function generateDominoMatchingRound(settings: SessionSettings, roundIndex = 1): DominoMatchingRound {
  const choiceCount = choiceCountForSettings(settings);
  const target = dominoTiles[(roundIndex - 1) % dominoTiles.length];
  const openSide: DominoSide = roundIndex % 2 === 0 ? "left" : "right";
  const matchSide = oppositeSide(openSide);
  const targetDots = target[openSide];
  const correctCandidates = dominoTiles.filter((tile) => tile.id !== target.id && tile[matchSide] === targetDots);
  const correct = sampleItems(correctCandidates, 1)[0];
  const distractors = sampleItems(
    dominoTiles.filter((tile) => tile[matchSide] !== targetDots && tile.left !== targetDots && tile.right !== targetDots),
    choiceCount - 1
  );
  const choices = shuffleItems([buildChoice(correct, matchSide), ...distractors.map((tile) => buildChoice(tile, matchSide))]);

  return {
    roundId: `domino-matching:round:${roundIndex}`,
    prompt: `Подбери домино к ${sideLabel(openSide)} стороне`,
    instruction: `Найди домино, где на ${sideLabel(matchSide)} стороне столько же точек: ${dotLabel(targetDots)}.`,
    target,
    openSide,
    targetDots,
    choices,
    correctIndex: choices.findIndex((choice) => choice.tile[choice.matchSide] === targetDots),
    explanation: `Нужна ${sideLabel(matchSide)} сторона с ${dotLabel(targetDots)}.`
  };
}

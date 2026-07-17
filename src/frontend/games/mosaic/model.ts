import type { SessionSettings } from "../../core/settings";
import { mosaicImages, type MosaicImage } from "./images";

export const mosaicGridSize = 3;
export const mosaicTileCount = mosaicGridSize * mosaicGridSize;

export type MosaicTile = {
  id: string;
  imageId: string;
  row: number;
  col: number;
  slotIndex: number;
};

export type MosaicStep = {
  roundId: string;
  image: MosaicImage;
  slotIndex: number;
  target: MosaicTile;
  choices: MosaicTile[];
  correctIndex: number;
  prompt: string;
  hint: string;
};

export function getMosaicImage(imageIndex = 0, images = mosaicImages) {
  if (!images.length) throw new Error("No mosaic images configured.");
  return images[((Math.floor(imageIndex) % images.length) + images.length) % images.length];
}

export function selectMosaicImageIndex(random = Math.random, images = mosaicImages) {
  if (!images.length) throw new Error("No mosaic images configured.");
  return Math.floor(random() * images.length);
}

export function createMosaicTiles(image: MosaicImage): MosaicTile[] {
  return Array.from({ length: mosaicTileCount }, (_, slotIndex) => {
    const row = Math.floor(slotIndex / mosaicGridSize);
    const col = slotIndex % mosaicGridSize;
    return {
      id: `${image.id}-${row}-${col}`,
      imageId: image.id,
      row,
      col,
      slotIndex
    };
  });
}

export function createMosaicStep(settings: SessionSettings, stepIndex: number, imageIndex = 0): MosaicStep {
  const image = getMosaicImage(imageIndex);
  const tiles = createMosaicTiles(image);
  const slotIndex = Math.max(0, Math.min(Math.floor(stepIndex), tiles.length - 1));
  const target = tiles[slotIndex];
  const choiceCount = settings.preset === "gentle" ? 3 : 4;
  const choices = buildMosaicChoices(target, tiles, choiceCount, slotIndex + imageIndex);

  return {
    roundId: `mosaic:${image.id}:slot:${slotIndex + 1}`,
    image,
    slotIndex,
    target,
    choices,
    correctIndex: choices.findIndex((choice) => choice.id === target.id),
    prompt: "Найди кусочек для подсвеченной клетки.",
    hint: "Сравни клетку с образцом и кусочками."
  };
}

export function isMosaicChoiceCorrect(choice: MosaicTile, target: MosaicTile) {
  return choice.id === target.id;
}

function buildMosaicChoices(target: MosaicTile, tiles: MosaicTile[], choiceCount: number, offset: number) {
  const distractors = rotate(tiles.filter((tile) => tile.id !== target.id), offset).slice(0, Math.max(0, choiceCount - 1));
  return rotate([target, ...distractors], offset % Math.max(1, choiceCount));
}

function rotate<T>(items: T[], offset: number) {
  if (!items.length) return items;
  const shift = ((Math.floor(offset) % items.length) + items.length) % items.length;
  return [...items.slice(shift), ...items.slice(0, shift)];
}

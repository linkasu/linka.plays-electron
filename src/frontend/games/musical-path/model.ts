export type MusicalPathStone = {
  id: string;
  order: number;
  note: string;
  icon: string;
  x: number;
  y: number;
  mobileX: number;
  mobileY: number;
  hue: number;
  selected: boolean;
  softError: boolean;
};

export const musicalPathHitPadding = 3;

export const musicalPathStoneTemplate: readonly Omit<MusicalPathStone, "selected" | "softError">[] = [
  { id: "do-low", order: 1, note: "до", icon: "mdi-music-note", x: 13, y: 76, mobileX: 24, mobileY: 82, hue: 198 },
  { id: "re", order: 2, note: "ре", icon: "mdi-music-note-eighth", x: 25, y: 70, mobileX: 67, mobileY: 75, hue: 222 },
  { id: "mi", order: 3, note: "ми", icon: "mdi-music-note", x: 37, y: 64, mobileX: 31, mobileY: 68, hue: 263 },
  { id: "fa", order: 4, note: "фа", icon: "mdi-music-clef-treble", x: 49, y: 58, mobileX: 72, mobileY: 61, hue: 286 },
  { id: "sol", order: 5, note: "соль", icon: "mdi-music-note-eighth", x: 69, y: 66, mobileX: 28, mobileY: 60, hue: 154 },
  { id: "la", order: 6, note: "ля", icon: "mdi-music-note", x: 90, y: 66, mobileX: 72, mobileY: 60, hue: 124 },
  { id: "si", order: 7, note: "си", icon: "mdi-music-clef-treble", x: 69, y: 35, mobileX: 28, mobileY: 34, hue: 36 },
  { id: "do-high", order: 8, note: "до", icon: "mdi-music-note", x: 90, y: 35, mobileX: 72, mobileY: 34, hue: 14 }
];

export function createMusicalPathStones(maxSteps = musicalPathStoneTemplate.length): MusicalPathStone[] {
  const safeMaxSteps = Math.min(musicalPathStoneTemplate.length, Math.max(1, Math.floor(maxSteps)));
  return musicalPathStoneTemplate.slice(0, safeMaxSteps).map((stone) => ({ ...stone, selected: false, softError: false }));
}

export function findNextMusicalPathStone(stones: MusicalPathStone[], completedSteps: number) {
  return stones.find((stone) => !stone.selected && stone.order === completedSteps + 1);
}

export function isExpectedMusicalPathStone(stone: MusicalPathStone, expectedStone: MusicalPathStone | undefined) {
  return stone.id === expectedStone?.id;
}

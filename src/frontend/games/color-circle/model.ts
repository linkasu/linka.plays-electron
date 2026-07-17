export type ColorCircleColor = {
  id: string;
  label: string;
  hex: string;
  textColor: string;
};

export type ColorCircleRound = {
  roundId: string;
  prompt: string;
  target: ColorCircleColor;
  sectors: ColorCircleColor[];
  correctIndex: number;
};

export type ColorCircleBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const colorCircleColors: ColorCircleColor[] = [
  { id: "red", label: "красный", hex: "#B71C1C", textColor: "#FFFFFF" },
  { id: "yellow", label: "жёлтый", hex: "#F8C73E", textColor: "#25210C" },
  { id: "blue", label: "синий", hex: "#0D47A1", textColor: "#FFFFFF" },
  { id: "green", label: "зелёный", hex: "#1B5E20", textColor: "#FFFFFF" },
  { id: "purple", label: "фиолетовый", hex: "#4A148C", textColor: "#FFFFFF" },
  { id: "orange", label: "оранжевый", hex: "#F28A2E", textColor: "#2B1708" },
  { id: "teal", label: "бирюзовый", hex: "#21A7A1", textColor: "#172321" },
  { id: "pink", label: "розовый", hex: "#E45C95", textColor: "#172321" }
];

const sectorCount = 4;

function colorAt(index: number) {
  return colorCircleColors[index % colorCircleColors.length];
}

function rotateSectors(colors: ColorCircleColor[], offset: number) {
  return colors.map((_, index) => colors[(index + offset) % colors.length]);
}

export function resolveColorCircleSectorIndex(point: { x: number; y: number }, bounds: ColorCircleBounds) {
  if (bounds.width <= 0 || bounds.height <= 0) return undefined;

  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  const offsetX = point.x - centerX;
  const offsetY = point.y - centerY;
  const radius = Math.min(bounds.width, bounds.height) / 2;

  if (Math.hypot(offsetX, offsetY) > radius) return undefined;
  return (offsetY >= 0 ? 2 : 0) + (offsetX >= 0 ? 1 : 0);
}

export function generateColorCircleRound(roundIndex = 1): ColorCircleRound {
  if (colorCircleColors.length < sectorCount) throw new Error("Недостаточно цветов для игры.");

  const targetIndex = (roundIndex - 1) % colorCircleColors.length;
  const target = colorCircleColors[targetIndex];
  const sectors = [target];
  let cursor = roundIndex;

  while (sectors.length < sectorCount) {
    const candidate = colorAt(targetIndex + cursor);
    if (!sectors.some((color) => color.id === candidate.id)) sectors.push(candidate);
    cursor += 2;
  }

  const rotatedSectors = rotateSectors(sectors, roundIndex % sectorCount);

  return {
    roundId: `color-circle:round:${roundIndex}`,
    prompt: `Выбери ${target.label} цвет`,
    target,
    sectors: rotatedSectors,
    correctIndex: rotatedSectors.findIndex((color) => color.id === target.id)
  };
}

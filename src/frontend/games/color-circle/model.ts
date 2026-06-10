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

export const colorCircleColors: ColorCircleColor[] = [
  { id: "red", label: "красный", hex: "#D83A3A", textColor: "#FFFFFF" },
  { id: "yellow", label: "жёлтый", hex: "#F8C73E", textColor: "#25210C" },
  { id: "blue", label: "синий", hex: "#2F6FDB", textColor: "#FFFFFF" },
  { id: "green", label: "зелёный", hex: "#2F9E62", textColor: "#FFFFFF" },
  { id: "purple", label: "фиолетовый", hex: "#8E55C7", textColor: "#FFFFFF" },
  { id: "orange", label: "оранжевый", hex: "#F28A2E", textColor: "#2B1708" },
  { id: "teal", label: "бирюзовый", hex: "#21A7A1", textColor: "#FFFFFF" },
  { id: "pink", label: "розовый", hex: "#E45C95", textColor: "#FFFFFF" }
];

const sectorCount = 4;

function colorAt(index: number) {
  return colorCircleColors[index % colorCircleColors.length];
}

function rotateSectors(colors: ColorCircleColor[], offset: number) {
  return colors.map((_, index) => colors[(index + offset) % colors.length]);
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

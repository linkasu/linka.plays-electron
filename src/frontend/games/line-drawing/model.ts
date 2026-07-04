export type DrawingTemplatePoint = {
  x: number;
  y: number;
};

export type DrawingLevel = {
  id: string;
  title: string;
  prompt: string;
  points: DrawingTemplatePoint[];
  closed?: boolean;
};

export const drawingLevels: DrawingLevel[] = [
  {
    id: "straight-line",
    title: "Прямая линия",
    prompt: "Соедини две точки ровной линией.",
    points: [{ x: 0.22, y: 0.52 }, { x: 0.78, y: 0.52 }]
  },
  {
    id: "corner",
    title: "Уголок",
    prompt: "Нарисуй угол: вниз, потом вправо.",
    points: [{ x: 0.28, y: 0.25 }, { x: 0.28, y: 0.72 }, { x: 0.72, y: 0.72 }]
  },
  {
    id: "triangle",
    title: "Треугольник",
    prompt: "Соедини вершины треугольника.",
    closed: true,
    points: [{ x: 0.5, y: 0.18 }, { x: 0.23, y: 0.74 }, { x: 0.77, y: 0.74 }]
  },
  {
    id: "square",
    title: "Квадрат",
    prompt: "Обведи квадрат по углам.",
    closed: true,
    points: [{ x: 0.28, y: 0.24 }, { x: 0.72, y: 0.24 }, { x: 0.72, y: 0.72 }, { x: 0.28, y: 0.72 }]
  },
  {
    id: "house",
    title: "Домик",
    prompt: "Нарисуй домик: крыша, стены и основание.",
    closed: true,
    points: [{ x: 0.2, y: 0.54 }, { x: 0.5, y: 0.2 }, { x: 0.8, y: 0.54 }, { x: 0.8, y: 0.78 }, { x: 0.2, y: 0.78 }]
  },
  {
    id: "fish",
    title: "Рыбка",
    prompt: "Собери рыбку: нос, спинка, хвост и живот.",
    closed: true,
    points: [{ x: 0.78, y: 0.48 }, { x: 0.55, y: 0.28 }, { x: 0.28, y: 0.4 }, { x: 0.12, y: 0.3 }, { x: 0.22, y: 0.48 }, { x: 0.12, y: 0.66 }, { x: 0.28, y: 0.58 }, { x: 0.55, y: 0.68 }]
  },
  {
    id: "cat",
    title: "Кошка",
    prompt: "Нарисуй кошку: ушки, мордочку и хвост.",
    closed: true,
    points: [{ x: 0.3, y: 0.36 }, { x: 0.22, y: 0.18 }, { x: 0.42, y: 0.3 }, { x: 0.58, y: 0.3 }, { x: 0.78, y: 0.18 }, { x: 0.7, y: 0.36 }, { x: 0.76, y: 0.58 }, { x: 0.62, y: 0.76 }, { x: 0.38, y: 0.76 }, { x: 0.24, y: 0.58 }, { x: 0.14, y: 0.46 }]
  },
  {
    id: "dog",
    title: "Собака",
    prompt: "Нарисуй собаку: мордочку, ушко, спину, лапы и хвост.",
    closed: true,
    points: [{ x: 0.18, y: 0.5 }, { x: 0.28, y: 0.34 }, { x: 0.4, y: 0.46 }, { x: 0.58, y: 0.42 }, { x: 0.74, y: 0.52 }, { x: 0.86, y: 0.42 }, { x: 0.76, y: 0.62 }, { x: 0.66, y: 0.78 }, { x: 0.56, y: 0.62 }, { x: 0.4, y: 0.66 }, { x: 0.32, y: 0.8 }, { x: 0.26, y: 0.62 }]
  }
];

export function wrapDrawingLevelIndex(index: number) {
  return ((index % drawingLevels.length) + drawingLevels.length) % drawingLevels.length;
}

export function drawingLevelAt(index: number) {
  return drawingLevels[wrapDrawingLevelIndex(index)];
}

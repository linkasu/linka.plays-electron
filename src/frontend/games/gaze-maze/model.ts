export type MazeNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  kind?: "start" | "exit" | "branch" | "candy" | "deadend";
};

export type MazeEdge = [string, string];

export type MazeLevel = {
  id: string;
  title: string;
  startId: string;
  exitId: string;
  nodes: MazeNode[];
  edges: MazeEdge[];
};

export type MazePoint = { x: number; y: number };

export type MazeTargetGeometry = {
  center: MazePoint;
  hitRadius: number;
};

export const gazeMazeLevels: MazeLevel[] = [
  {
    id: "sweet-garden",
    title: "Сладкий сад",
    startId: "start",
    exitId: "exit",
    nodes: [
      { id: "start", label: "Домик", x: 12, y: 53, kind: "start" },
      { id: "berry", label: "Ягодная конфета", x: 30, y: 33, kind: "candy" },
      { id: "mint", label: "Мятная тропа", x: 30, y: 72, kind: "candy" },
      { id: "caramel", label: "Карамельная развилка", x: 52, y: 52, kind: "branch" },
      { id: "cotton", label: "Ватный тупик", x: 49, y: 17, kind: "deadend" },
      { id: "crumb", label: "Крошечный тупик", x: 48, y: 88, kind: "deadend" },
      { id: "star", label: "Звёздная конфета", x: 70, y: 31, kind: "candy" },
      { id: "exit", label: "Конфетный выход", x: 86, y: 56, kind: "exit" }
    ],
    edges: [["start", "berry"], ["start", "mint"], ["berry", "caramel"], ["berry", "cotton"], ["mint", "caramel"], ["mint", "crumb"], ["caramel", "star"], ["caramel", "exit"], ["star", "exit"]]
  },
  {
    id: "lollipop-bridge",
    title: "Леденцовый мостик",
    startId: "start",
    exitId: "exit",
    nodes: [
      { id: "start", label: "Домик", x: 11, y: 69, kind: "start" },
      { id: "sugar", label: "Сахарный камень", x: 28, y: 50, kind: "candy" },
      { id: "upper", label: "Верхний мостик", x: 47, y: 30, kind: "branch" },
      { id: "lower", label: "Нижний мостик", x: 47, y: 73, kind: "branch" },
      { id: "marshmallow", label: "Зефирный тупик", x: 66, y: 19, kind: "deadend" },
      { id: "wafer", label: "Вафельный тупик", x: 67, y: 84, kind: "deadend" },
      { id: "cream", label: "Сливочная поляна", x: 67, y: 54, kind: "candy" },
      { id: "exit", label: "Конфетный выход", x: 87, y: 33, kind: "exit" }
    ],
    edges: [["start", "sugar"], ["sugar", "upper"], ["sugar", "lower"], ["upper", "cream"], ["upper", "marshmallow"], ["lower", "cream"], ["lower", "wafer"], ["cream", "exit"], ["upper", "exit"]]
  },
  {
    id: "candy-loop",
    title: "Карамельная петля",
    startId: "start",
    exitId: "exit",
    nodes: [
      { id: "start", label: "Домик", x: 13, y: 35, kind: "start" },
      { id: "gate", label: "Вафельная калитка", x: 32, y: 35, kind: "candy" },
      { id: "pink", label: "Розовая конфета", x: 51, y: 22, kind: "branch" },
      { id: "blue", label: "Голубая конфета", x: 51, y: 60, kind: "branch" },
      { id: "mint-cave", label: "Мятный тупик", x: 69, y: 17, kind: "deadend" },
      { id: "jelly-corner", label: "Желейный тупик", x: 33, y: 78, kind: "deadend" },
      { id: "loop", label: "Карамельная петля", x: 70, y: 58, kind: "candy" },
      { id: "exit", label: "Конфетный выход", x: 88, y: 73, kind: "exit" }
    ],
    edges: [["start", "gate"], ["gate", "pink"], ["gate", "blue"], ["gate", "jelly-corner"], ["pink", "loop"], ["pink", "mint-cave"], ["blue", "loop"], ["loop", "gate"], ["loop", "exit"]]
  }
];

export function mazeNeighborIds(level: MazeLevel, nodeId: string) {
  return level.edges.flatMap(([fromId, toId]) => {
    if (fromId === nodeId) return [toId];
    if (toId === nodeId) return [fromId];
    return [];
  });
}

export function isMazeDeadEnd(level: MazeLevel, node: MazeNode) {
  return node.kind === "deadend" || (node.kind !== "start" && node.kind !== "exit" && mazeNeighborIds(level, node.id).length === 1);
}

export function resolveAdjacentMazeTarget(level: MazeLevel, currentNodeId: string, point: MazePoint, geometryFor: (node: MazeNode) => MazeTargetGeometry) {
  let closest: { node: MazeNode; distance: number } | undefined;
  for (const nodeId of mazeNeighborIds(level, currentNodeId)) {
    const node = level.nodes.find((item) => item.id === nodeId);
    if (!node) continue;
    const geometry = geometryFor(node);
    const distance = Math.hypot(point.x - geometry.center.x, point.y - geometry.center.y);
    if (distance <= geometry.hitRadius && (!closest || distance < closest.distance)) closest = { node, distance };
  }
  return closest?.node;
}

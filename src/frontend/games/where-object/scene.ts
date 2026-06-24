import type { WhereObjectPlace, WhereObjectPreposition, WhereObjectRound } from "./model";

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type WhereObjectCanvasTarget = Rect & {
  id: string;
  preposition: WhereObjectPreposition;
  dwellProgress: number;
  enteredAt?: number;
};

export type WhereObjectSceneOptions = {
  round: WhereObjectRound;
  targets: WhereObjectCanvasTarget[];
  pointer: Point & { valid: boolean };
  running: boolean;
  hintedId?: string;
  mistakeId?: string;
  now: number;
};

type PlaceGeometry = {
  rect: Rect;
  on: Point;
  under: Point;
  in: Point;
};

function roundRect(context: CanvasRenderingContext2D, rect: Rect, radius: number) {
  const { x, y, width, height } = rect;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function drawText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, font: string, color = "#243035") {
  context.save();
  context.font = font;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, x, y, maxWidth);
  context.restore();
}

function drawBackground(context: CanvasRenderingContext2D) {
  const gradient = context.createLinearGradient(0, 0, window.innerWidth, window.innerHeight);
  gradient.addColorStop(0, "#e3d8ff");
  gradient.addColorStop(0.48, "#d9f3ed");
  gradient.addColorStop(1, "#ffdca0");
  context.fillStyle = gradient;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);
}

export function buildWhereObjectTargets(round: WhereObjectRound): WhereObjectCanvasTarget[] {
  const count = round.prepositions.length;
  const side = Math.max(28, window.innerWidth * 0.065);
  const gap = Math.max(18, window.innerWidth * 0.018);
  const top = window.innerHeight < 680 ? window.innerHeight * 0.7 : window.innerHeight * 0.68;
  const height = Math.min(190, Math.max(128, window.innerHeight - top - 34));
  const width = (window.innerWidth - side * 2 - gap * (count - 1)) / count;

  return round.prepositions.map((preposition, index) => ({
    id: preposition.id,
    preposition,
    x: side + index * (width + gap),
    y: top,
    width,
    height,
    dwellProgress: 0
  }));
}

export function containsTarget(target: WhereObjectCanvasTarget, point: Point, padding = 18) {
  return point.x >= target.x - padding
    && point.x <= target.x + target.width + padding
    && point.y >= target.y - padding
    && point.y <= target.y + target.height + padding;
}

function sceneRect(): Rect {
  const width = Math.min(window.innerWidth * 0.62, 760);
  const height = Math.min(window.innerHeight * 0.38, 330);
  return {
    x: (window.innerWidth - width) / 2,
    y: window.innerHeight < 680 ? window.innerHeight * 0.25 : window.innerHeight * 0.27,
    width,
    height
  };
}

function placeGeometry(rect: Rect): PlaceGeometry {
  const size = Math.min(rect.width * 0.42, rect.height * 0.76);
  const objectCenter = { x: rect.x + rect.width * 0.5, y: rect.y + rect.height * 0.55 };
  return {
    rect: {
      x: objectCenter.x - size / 2,
      y: objectCenter.y - size / 2,
      width: size,
      height: size
    },
    on: { x: objectCenter.x, y: objectCenter.y - size * 0.48 },
    under: { x: objectCenter.x, y: objectCenter.y + size * 0.58 },
    in: { x: objectCenter.x, y: objectCenter.y + size * 0.04 }
  };
}

function fillStroke(context: CanvasRenderingContext2D, fill: string, stroke = "#8b8f8b", lineWidth = 5) {
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = stroke;
  context.lineWidth = lineWidth;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.stroke();
}

function drawOpenHouse(context: CanvasRenderingContext2D, geometry: PlaceGeometry) {
  const r = geometry.rect;
  const cx = r.x + r.width / 2;
  const baseY = r.y + r.height * 0.82;
  const wall: Rect = { x: r.x + r.width * 0.22, y: r.y + r.height * 0.34, width: r.width * 0.56, height: r.height * 0.48 };

  context.save();
  context.beginPath();
  context.moveTo(r.x + r.width * 0.12, wall.y + r.height * 0.02);
  context.lineTo(cx, r.y + r.height * 0.06);
  context.lineTo(r.x + r.width * 0.88, wall.y + r.height * 0.02);
  context.closePath();
  fillStroke(context, "#86a9ee", "#6b7893", 5);

  roundRect(context, wall, r.width * 0.05);
  fillStroke(context, "#bcd5ff", "#6b7893", 5);

  const door: Rect = { x: cx - r.width * 0.09, y: wall.y + wall.height * 0.38, width: r.width * 0.18, height: wall.height * 0.62 };
  roundRect(context, door, r.width * 0.025);
  fillStroke(context, "#fff3d8", "#78909c", 3);
  context.restore();
}

function drawOpenTable(context: CanvasRenderingContext2D, geometry: PlaceGeometry) {
  const r = geometry.rect;
  const top: Rect = { x: r.x + r.width * 0.12, y: r.y + r.height * 0.34, width: r.width * 0.76, height: r.height * 0.14 };
  const drawer: Rect = { x: r.x + r.width * 0.34, y: r.y + r.height * 0.48, width: r.width * 0.32, height: r.height * 0.2 };

  context.save();
  roundRect(context, top, r.width * 0.035);
  fillStroke(context, "#bde6c9", "#789b80", 5);
  roundRect(context, drawer, r.width * 0.03);
  fillStroke(context, "#ffe2a8", "#9b8060", 4);

  context.fillStyle = "#c6e8cf";
  context.fillRect(r.x + r.width * 0.2, top.y + top.height, r.width * 0.08, r.height * 0.35);
  context.fillRect(r.x + r.width * 0.72, top.y + top.height, r.width * 0.08, r.height * 0.35);
  context.restore();
}

function drawOpenBag(context: CanvasRenderingContext2D, geometry: PlaceGeometry) {
  const r = geometry.rect;
  const body: Rect = { x: r.x + r.width * 0.2, y: r.y + r.height * 0.32, width: r.width * 0.6, height: r.height * 0.5 };

  context.save();
  context.strokeStyle = "#8e9890";
  context.lineWidth = 6;
  context.beginPath();
  context.arc(r.x + r.width / 2, body.y + r.height * 0.03, r.width * 0.18, Math.PI, 0);
  context.stroke();
  roundRect(context, body, r.width * 0.09);
  fillStroke(context, "#efb6cf", "#8e9890", 5);

  context.fillStyle = "#fff3d8";
  context.beginPath();
  context.ellipse(r.x + r.width / 2, body.y + body.height * 0.18, body.width * 0.32, body.height * 0.11, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawOpenBox(context: CanvasRenderingContext2D, geometry: PlaceGeometry) {
  const r = geometry.rect;
  const body: Rect = { x: r.x + r.width * 0.18, y: r.y + r.height * 0.46, width: r.width * 0.64, height: r.height * 0.34 };

  context.save();
  context.beginPath();
  context.moveTo(body.x, body.y);
  context.lineTo(body.x + body.width * 0.5, body.y - r.height * 0.18);
  context.lineTo(body.x + body.width, body.y);
  fillStroke(context, "#e4c092", "#8c887f", 4);
  roundRect(context, body, r.width * 0.045);
  fillStroke(context, "#d7ad7c", "#8c887f", 5);
  context.restore();
}

function drawPlace(context: CanvasRenderingContext2D, place: WhereObjectPlace, geometry: PlaceGeometry) {
  if (place.id === "house") drawOpenHouse(context, geometry);
  if (place.id === "table") drawOpenTable(context, geometry);
  if (place.id === "bag") drawOpenBag(context, geometry);
  if (place.id === "box") drawOpenBox(context, geometry);
}

function objectAnchor(geometry: PlaceGeometry, prepositionId: string) {
  if (prepositionId === "on") return geometry.on;
  if (prepositionId === "under") return geometry.under;
  return geometry.in;
}

function drawObjectToken(context: CanvasRenderingContext2D, emoji: string, point: Point, size: number) {
  context.save();
  context.fillStyle = "rgb(255 255 255 / 94%)";
  context.beginPath();
  context.arc(point.x, point.y, size * 0.52, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgb(103 80 164 / 24%)";
  context.lineWidth = Math.max(2, size * 0.035);
  context.stroke();
  context.restore();
  drawText(context, emoji, point.x, point.y + size * 0.02, size * 1.35, `${Math.round(size * 0.84)}px "Apple Color Emoji", "Segoe UI Emoji"`);
}

function drawScene(context: CanvasRenderingContext2D, round: WhereObjectRound) {
  const rect = sceneRect();
  const geometry = placeGeometry(rect);
  const object = objectAnchor(geometry, round.targetPreposition.id);
  const tokenSize = Math.min(92, geometry.rect.width * 0.28);

  drawPlace(context, round.targetPlace, geometry);
  drawObjectToken(context, round.targetObject.emoji, object, tokenSize);
}

function drawDwellProgress(context: CanvasRenderingContext2D, target: WhereObjectCanvasTarget) {
  if (target.dwellProgress <= 0) return;
  const radius = Math.min(target.width, target.height) * 0.32;
  context.save();
  context.strokeStyle = "rgb(103 80 164 / 86%)";
  context.lineWidth = 7;
  context.lineCap = "round";
  context.beginPath();
  context.arc(target.x + target.width / 2, target.y + target.height / 2, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * target.dwellProgress);
  context.stroke();
  context.restore();
}

function drawTarget(context: CanvasRenderingContext2D, target: WhereObjectCanvasTarget, options: WhereObjectSceneOptions) {
  const hinted = options.hintedId === target.id;
  const mistaken = options.mistakeId === target.id;
  const radius = Math.min(28, target.height * 0.16);

  context.save();
  context.fillStyle = hinted ? "#e4d8ff" : "#fff3d8";
  roundRect(context, target, radius);
  context.fill();
  context.strokeStyle = hinted ? "#6750a4" : "rgb(82 64 42 / 22%)";
  context.lineWidth = hinted ? 4 : 1.5;
  context.stroke();
  context.restore();

  drawText(context, target.preposition.label, target.x + target.width / 2, target.y + target.height * 0.5, target.width - 28, "800 76px system-ui", mistaken ? "#607d8b" : "#243035");
  drawDwellProgress(context, target);
}

function drawPointerSight(context: CanvasRenderingContext2D, pointer: Point & { valid: boolean }, running: boolean) {
  if (!pointer.valid || !running) return;
  context.save();
  context.strokeStyle = "rgb(103 80 164 / 68%)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(pointer.x, pointer.y, 16, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(pointer.x - 7, pointer.y);
  context.lineTo(pointer.x + 7, pointer.y);
  context.moveTo(pointer.x, pointer.y - 7);
  context.lineTo(pointer.x, pointer.y + 7);
  context.stroke();
  context.restore();
}

export function drawWhereObjectScene(context: CanvasRenderingContext2D, options: WhereObjectSceneOptions) {
  drawBackground(context);
  drawScene(context, options.round);
  for (const target of options.targets) drawTarget(context, target, options);
  drawPointerSight(context, options.pointer, options.running);
}

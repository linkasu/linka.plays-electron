export type Point = { x: number; y: number };
export type DuckState = "swimming" | "hit";
export type Duck = {
  id: string;
  x: number;
  y: number;
  laneY: number;
  size: number;
  direction: -1 | 1;
  speed: number;
  bob: number;
  state: DuckState;
  dwellProgress: number;
  hitAge: number;
};
export type Splash = Point & {
  age: number;
  life: number;
  radius: number;
};

export type ScenePointer = Point & {
  valid: boolean;
};

export type DuckSceneOptions = {
  ducks: Duck[];
  splashes: Splash[];
  pointer: ScenePointer;
  running: boolean;
  now: number;
  durationMs: number;
  sessionSeconds: number;
};

type Building = {
  x: number;
  w: number;
  h: number;
  row: 0 | 1;
  color: string;
  roof: string;
  windows: 1 | 2 | 3;
};

export function waterTop() {
  return window.innerHeight * 0.54;
}

export function duckHitRadius(duck: Duck) {
  return duck.size;
}

function drawCloud(context: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number) {
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = "#fff9f1";
  context.beginPath();
  context.ellipse(x - size * 0.36, y + size * 0.08, size * 0.45, size * 0.18, 0, 0, Math.PI * 2);
  context.ellipse(x - size * 0.08, y - size * 0.04, size * 0.48, size * 0.24, 0, 0, Math.PI * 2);
  context.ellipse(x + size * 0.3, y + size * 0.08, size * 0.42, size * 0.2, 0, 0, Math.PI * 2);
  context.ellipse(x, y + size * 0.16, size * 0.68, size * 0.14, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawMountains(context: CanvasRenderingContext2D) {
  const horizon = waterTop() - window.innerHeight * 0.06;

  context.save();
  context.fillStyle = "#b7d8f8";
  context.beginPath();
  context.moveTo(0, horizon);
  context.lineTo(window.innerWidth * 0.16, horizon - window.innerHeight * 0.14);
  context.lineTo(window.innerWidth * 0.28, horizon);
  context.lineTo(window.innerWidth * 0.44, horizon - window.innerHeight * 0.24);
  context.lineTo(window.innerWidth * 0.62, horizon);
  context.lineTo(window.innerWidth * 0.78, horizon - window.innerHeight * 0.15);
  context.lineTo(window.innerWidth, horizon);
  context.closePath();
  context.fill();

  context.fillStyle = "rgb(255 255 255 / 45%)";
  context.beginPath();
  context.moveTo(window.innerWidth * 0.39, horizon - window.innerHeight * 0.17);
  context.lineTo(window.innerWidth * 0.44, horizon - window.innerHeight * 0.24);
  context.lineTo(window.innerWidth * 0.5, horizon - window.innerHeight * 0.14);
  context.closePath();
  context.fill();

  context.fillStyle = "#8fc1ef";
  context.beginPath();
  context.moveTo(window.innerWidth * 0.08, horizon);
  context.lineTo(window.innerWidth * 0.26, horizon - window.innerHeight * 0.12);
  context.lineTo(window.innerWidth * 0.42, horizon);
  context.lineTo(window.innerWidth * 0.58, horizon - window.innerHeight * 0.1);
  context.lineTo(window.innerWidth * 0.74, horizon);
  context.closePath();
  context.fill();
  context.restore();
}

function drawTree(context: CanvasRenderingContext2D, x: number, groundY: number, unit: number) {
  context.fillStyle = "#7d6b45";
  context.fillRect(x - unit * 0.035, groundY - unit * 0.38, unit * 0.07, unit * 0.38);
  context.fillStyle = "#4f9a57";
  context.beginPath();
  context.arc(x, groundY - unit * 0.42, unit * 0.17, 0, Math.PI * 2);
  context.arc(x - unit * 0.12, groundY - unit * 0.32, unit * 0.13, 0, Math.PI * 2);
  context.arc(x + unit * 0.12, groundY - unit * 0.31, unit * 0.13, 0, Math.PI * 2);
  context.fill();
}

function drawBuilding(context: CanvasRenderingContext2D, building: Building, groundY: number, unit: number) {
  const y = groundY - building.h - unit * (building.row ? 0.07 : 0.18);
  const shadowY = y + building.h + unit * 0.02;

  context.fillStyle = "rgb(48 92 54 / 20%)";
  context.beginPath();
  context.ellipse(building.x + building.w * 0.5, shadowY, building.w * 0.58, unit * 0.08, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = building.color;
  context.fillRect(building.x, y, building.w, building.h);

  context.fillStyle = building.roof;
  context.beginPath();
  context.moveTo(building.x - building.w * 0.08, y + building.h * 0.05);
  context.lineTo(building.x + building.w * 0.5, y - building.h * 0.48);
  context.lineTo(building.x + building.w * 1.08, y + building.h * 0.05);
  context.closePath();
  context.fill();

  context.fillStyle = "#7bb6d9";
  for (let index = 0; index < building.windows; index++) {
    const gap = building.w / (building.windows + 1);
    context.fillRect(building.x + gap * (index + 1) - building.w * 0.07, y + building.h * 0.32, building.w * 0.14, building.h * 0.2);
  }

  context.fillStyle = "#83604f";
  context.fillRect(building.x + building.w * 0.43, y + building.h * 0.54, building.w * 0.16, building.h * 0.46);
}

function drawCityPath(context: CanvasRenderingContext2D, centerX: number, groundY: number, unit: number) {
  context.fillStyle = "rgb(210 182 112 / 38%)";
  context.beginPath();
  context.moveTo(centerX - unit * 0.5, groundY - unit * 0.08);
  context.quadraticCurveTo(centerX - unit * 0.18, groundY + unit * 0.18, centerX + unit * 0.25, waterTop());
  context.lineTo(centerX - unit * 0.35, waterTop());
  context.quadraticCurveTo(centerX - unit * 0.48, groundY + unit * 0.2, centerX - unit * 0.95, groundY - unit * 0.04);
  context.closePath();
  context.fill();
}

function drawClockTower(context: CanvasRenderingContext2D, progress: number) {
  const height = Math.min(198, Math.max(146, window.innerHeight * 0.19));
  const width = height * 0.5;
  const x = window.innerWidth * 0.52;
  const baseY = waterTop() - window.innerHeight * 0.032;
  const topY = baseY - height;
  const roofY = topY - height * 0.22;
  const clockX = x + width * 0.5;
  const clockY = topY + height * 0.24;
  const clockRadius = width * 0.29;

  context.save();
  context.fillStyle = "rgb(48 92 54 / 24%)";
  context.beginPath();
  context.ellipse(clockX, baseY + 7, width * 1.12, 9, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#8c8f71";
  context.fillRect(x + width * 0.06, baseY - height * 0.04, width * 0.88, height * 0.08);

  context.fillStyle = "#f3ead8";
  context.beginPath();
  context.moveTo(x + width * 0.14, baseY);
  context.lineTo(x + width * 0.27, topY);
  context.lineTo(x + width * 0.73, topY);
  context.lineTo(x + width * 0.86, baseY);
  context.closePath();
  context.fill();
  context.strokeStyle = "rgb(86 99 98 / 32%)";
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = "#e27458";
  for (let index = 0; index < 4; index++) {
    const stripeY = topY + height * (0.14 + index * 0.2);
    context.fillRect(x + width * 0.23, stripeY, width * 0.54, height * 0.055);
  }

  context.fillStyle = "#9d5b4d";
  context.beginPath();
  context.moveTo(clockX, roofY);
  context.lineTo(x + width * 0.08, topY + height * 0.02);
  context.lineTo(x + width * 0.92, topY + height * 0.02);
  context.closePath();
  context.fill();
  context.fillStyle = "#6f423b";
  context.fillRect(x + width * 0.22, topY - height * 0.01, width * 0.56, height * 0.06);

  context.fillStyle = "rgb(255 244 190 / 42%)";
  context.beginPath();
  context.arc(clockX, clockY, clockRadius * 1.35, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fff9e6";
  context.beginPath();
  context.arc(clockX, clockY, clockRadius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#324c61";
  context.lineWidth = 3;
  context.stroke();

  context.strokeStyle = "#324c61";
  context.lineWidth = 2;
  for (let index = 0; index < 12; index++) {
    const angle = index / 12 * Math.PI * 2 - Math.PI / 2;
    const inner = clockRadius * (index % 3 === 0 ? 0.72 : 0.82);
    context.beginPath();
    context.moveTo(clockX + Math.cos(angle) * inner, clockY + Math.sin(angle) * inner);
    context.lineTo(clockX + Math.cos(angle) * clockRadius * 0.9, clockY + Math.sin(angle) * clockRadius * 0.9);
    context.stroke();
  }

  const handAngle = -Math.PI / 2 + Math.PI * 2 * progress;
  context.strokeStyle = "#26384a";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(clockX, clockY);
  context.lineTo(clockX + Math.cos(handAngle) * clockRadius * 0.58, clockY + Math.sin(handAngle) * clockRadius * 0.58);
  context.stroke();
  context.beginPath();
  context.arc(clockX, clockY, 4, 0, Math.PI * 2);
  context.fillStyle = "#26384a";
  context.fill();

  context.fillStyle = "#7bb6d9";
  for (const windowY of [0.52, 0.66]) {
    context.beginPath();
    context.arc(clockX, topY + height * windowY, width * 0.1, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "#7b5d4c";
  context.beginPath();
  context.moveTo(x + width * 0.38, baseY);
  context.lineTo(x + width * 0.38, baseY - height * 0.16);
  context.quadraticCurveTo(clockX, baseY - height * 0.23, x + width * 0.62, baseY - height * 0.16);
  context.lineTo(x + width * 0.62, baseY);
  context.closePath();
  context.fill();
  context.restore();
}

function drawVillage(context: CanvasRenderingContext2D, progress: number) {
  const groundY = waterTop() - window.innerHeight * 0.035;
  const unit = Math.min(54, Math.max(30, window.innerWidth * 0.024));
  const startX = window.innerWidth * 0.035;
  const endX = window.innerWidth * 0.94;
  const colors = ["#f4dfb5", "#eecaa4", "#f6e8c8", "#e8d6b8", "#f1d3aa", "#f5e1c0", "#ead7b9"];
  const roofs = ["#c86a54", "#9f5a48", "#b85f50", "#8f6150", "#b35f48", "#9d6a4f", "#c77855"];
  const buildings: Building[] = [];
  let cursor = startX;
  let index = 0;

  while (cursor < endX) {
    const w = unit * (0.62 + index % 4 * 0.11);
    buildings.push({
      x: cursor,
      w,
      h: unit * (0.5 + index % 5 * 0.055),
      row: index % 2 as 0 | 1,
      color: colors[index % colors.length],
      roof: roofs[index % roofs.length],
      windows: (index % 3 + 1) as 1 | 2 | 3
    });
    cursor += w + unit * 0.12;
    index += 1;
  }

  context.save();
  drawCityPath(context, window.innerWidth * 0.38, groundY, unit);
  for (let treeX = startX - unit * 0.1; treeX < endX; treeX += unit * 2.15) drawTree(context, treeX, groundY, unit);
  for (const building of buildings) {
    const towerLeft = window.innerWidth * 0.5;
    const towerRight = window.innerWidth * 0.62;
    if (building.x + building.w > towerLeft && building.x < towerRight) continue;
    drawBuilding(context, building, groundY, unit);
  }
  drawClockTower(context, progress);
  context.restore();
}

function drawBackground(context: CanvasRenderingContext2D, progress: number) {
  const mountainBase = waterTop() - window.innerHeight * 0.06;
  const sky = context.createLinearGradient(0, 0, 0, waterTop());
  sky.addColorStop(0, "#5aa8ff");
  sky.addColorStop(0.58, "#a8e4ef");
  sky.addColorStop(1, "#e8fff1");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  drawCloud(context, window.innerWidth * 0.18, window.innerHeight * 0.12, window.innerWidth * 0.16, 0.64);
  drawCloud(context, window.innerWidth * 0.74, window.innerHeight * 0.16, window.innerWidth * 0.13, 0.5);
  drawMountains(context);

  context.fillStyle = "#8abc3d";
  context.beginPath();
  context.moveTo(0, mountainBase - window.innerHeight * 0.004);
  context.quadraticCurveTo(window.innerWidth * 0.26, mountainBase - window.innerHeight * 0.022, window.innerWidth * 0.5, mountainBase - window.innerHeight * 0.006);
  context.quadraticCurveTo(window.innerWidth * 0.74, mountainBase + window.innerHeight * 0.014, window.innerWidth, mountainBase - window.innerHeight * 0.012);
  context.lineTo(window.innerWidth, waterTop());
  context.lineTo(0, waterTop());
  context.closePath();
  context.fill();
  drawVillage(context, progress);

  const water = context.createLinearGradient(0, waterTop(), 0, window.innerHeight);
  water.addColorStop(0, "#5caef4");
  water.addColorStop(0.5, "#438ee7");
  water.addColorStop(1, "#2f78c9");
  context.fillStyle = water;
  context.fillRect(0, waterTop(), window.innerWidth, window.innerHeight - waterTop());
}

function drawWaves(context: CanvasRenderingContext2D, now: number) {
  context.save();
  context.lineCap = "round";
  for (let row = 0; row < 10; row++) {
    const y = waterTop() + 34 + row * ((window.innerHeight - waterTop()) / 9);
    const phase = now / 1800 + row * 0.7;
    context.strokeStyle = row % 2 === 0 ? "rgb(255 255 255 / 28%)" : "rgb(37 132 160 / 18%)";
    context.lineWidth = row % 2 === 0 ? 3 : 2;
    context.beginPath();
    for (let x = -40; x <= window.innerWidth + 40; x += 18) {
      const waveY = y + Math.sin(x / 58 + phase) * 5;
      if (x === -40) context.moveTo(x, waveY);
      else context.lineTo(x, waveY);
    }
    context.stroke();
  }
  context.restore();
}

function drawDuckWing(context: CanvasRenderingContext2D, size: number) {
  context.save();
  context.fillStyle = "rgb(227 166 0 / 34%)";
  context.beginPath();
  context.moveTo(-size * 0.25, size * 0.05);
  context.quadraticCurveTo(-size * 0.08, size * 0.25, size * 0.28, size * 0.12);
  context.quadraticCurveTo(size * 0.16, size * 0.34, -size * 0.18, size * 0.28);
  context.quadraticCurveTo(-size * 0.38, size * 0.2, -size * 0.25, size * 0.05);
  context.fill();
  context.restore();
}

function drawDuck(context: CanvasRenderingContext2D, duck: Duck) {
  const alpha = duck.state === "hit" ? Math.max(0, 1 - duck.hitAge / 0.75) : 1;
  const size = duck.size;

  context.save();
  context.translate(duck.x, duck.y);
  context.scale(duck.direction, 1);
  context.globalAlpha = alpha;
  context.rotate(Math.sin(duck.bob * 0.8) * 0.035);

  context.fillStyle = "rgb(255 255 255 / 32%)";
  context.beginPath();
  context.ellipse(-size * 0.03, size * 0.28, size * 0.56, size * 0.12, 0, 0, Math.PI * 2);
  context.fill();

  const body = context.createRadialGradient(-size * 0.1, -size * 0.1, size * 0.08, 0, size * 0.05, size * 0.72);
  body.addColorStop(0, "#ffe66f");
  body.addColorStop(0.58, "#ffd018");
  body.addColorStop(1, "#eeb000");
  context.fillStyle = body;
  context.beginPath();
  context.moveTo(-size * 0.56, size * 0.12);
  context.quadraticCurveTo(-size * 0.64, -size * 0.28, -size * 0.2, -size * 0.18);
  context.quadraticCurveTo(size * 0.05, -size * 0.44, size * 0.42, -size * 0.18);
  context.quadraticCurveTo(size * 0.54, size * 0.12, size * 0.2, size * 0.34);
  context.quadraticCurveTo(-size * 0.26, size * 0.52, -size * 0.56, size * 0.12);
  context.fill();

  context.fillStyle = "#ffcf18";
  context.beginPath();
  context.arc(size * 0.31, -size * 0.35, size * 0.24, 0, Math.PI * 2);
  context.fill();

  drawDuckWing(context, size);

  context.fillStyle = "#ff6f1f";
  context.beginPath();
  context.moveTo(size * 0.48, -size * 0.38);
  context.quadraticCurveTo(size * 0.74, -size * 0.36, size * 0.88, -size * 0.28);
  context.quadraticCurveTo(size * 0.72, -size * 0.18, size * 0.48, -size * 0.22);
  context.closePath();
  context.fill();

  context.fillStyle = "#2e3640";
  context.beginPath();
  context.arc(size * 0.36, -size * 0.4, Math.max(3, size * 0.04), 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgb(255 248 170 / 38%)";
  context.beginPath();
  context.ellipse(-size * 0.06, -size * 0.12, size * 0.22, size * 0.07, -0.32, 0, Math.PI * 2);
  context.fill();
  context.restore();

  if (duck.state === "swimming" && duck.dwellProgress > 0) drawAimProgress(context, duck);
}

function drawAimProgress(context: CanvasRenderingContext2D, duck: Duck) {
  const radius = duckHitRadius(duck) * 0.95;
  context.save();
  context.strokeStyle = "rgb(255 250 220 / 82%)";
  context.lineWidth = 5;
  context.lineCap = "round";
  context.beginPath();
  context.arc(duck.x, duck.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * duck.dwellProgress);
  context.stroke();
  context.restore();
}

function drawSplash(context: CanvasRenderingContext2D, splash: Splash) {
  const progress = splash.age / splash.life;
  context.save();
  context.globalAlpha = Math.max(0, 1 - progress) * 0.72;
  context.strokeStyle = "#f8fdff";
  context.lineWidth = 4;
  context.beginPath();
  context.ellipse(splash.x, splash.y, splash.radius * (1 + progress * 1.8), splash.radius * (0.34 + progress * 0.42), 0, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "#f8fdff";
  for (let index = 0; index < 5; index++) {
    const angle = -Math.PI + index * (Math.PI / 4);
    const x = splash.x + Math.cos(angle) * splash.radius * progress * 1.5;
    const y = splash.y - Math.abs(Math.sin(angle)) * splash.radius * progress * 1.1;
    context.beginPath();
    context.arc(x, y, Math.max(2, splash.radius * 0.045), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawPointerSight(context: CanvasRenderingContext2D, pointer: ScenePointer, running: boolean) {
  if (!pointer.valid || !running) return;
  context.save();
  context.strokeStyle = "rgb(255 255 255 / 62%)";
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

export function drawDuckScene(context: CanvasRenderingContext2D, options: DuckSceneOptions) {
  const totalMs = options.sessionSeconds * 1000;
  const progress = totalMs > 0 ? Math.min(1, Math.max(0, options.durationMs / totalMs)) : 0;

  drawBackground(context, progress);
  drawWaves(context, options.now);
  [...options.ducks].sort((a, b) => a.y - b.y).forEach((duck) => drawDuck(context, duck));
  for (const splash of options.splashes) drawSplash(context, splash);
  drawPointerSight(context, options.pointer, options.running);
}

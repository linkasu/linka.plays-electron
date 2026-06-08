export type Point = { x: number; y: number };
export type FishState = "swimming" | "caught";
export type Fish = Point & {
  id: string;
  laneY: number;
  size: number;
  direction: -1 | 1;
  speed: number;
  phase: number;
  hue: number;
  state: FishState;
  dwellProgress: number;
  enteredAt?: number;
  caughtAge: number;
};
export type Bubble = Point & {
  radius: number;
  speed: number;
  wobble: number;
  alpha: number;
};
export type CatchRipple = Point & {
  age: number;
  life: number;
  radius: number;
  hue: number;
};
export type ScenePointer = Point & {
  valid: boolean;
};
export type FishSceneOptions = {
  fishes: Fish[];
  bubbles: Bubble[];
  ripples: CatchRipple[];
  pointer: ScenePointer;
  running: boolean;
  now: number;
  durationMs: number;
  sessionSeconds: number;
};

export function surfaceY() {
  return window.innerHeight * 0.15;
}

export function seabedTop() {
  return window.innerHeight * 0.78;
}

export function swimTop() {
  return window.innerHeight * 0.27;
}

export function swimBottom() {
  return window.innerHeight * 0.66;
}

export function fishHitRadius(fish: Fish) {
  return fish.size * 0.88;
}

function drawWater(context: CanvasRenderingContext2D) {
  const gradient = context.createLinearGradient(0, 0, 0, window.innerHeight);
  gradient.addColorStop(0, "#6ec9dc");
  gradient.addColorStop(0.22, "#278dad");
  gradient.addColorStop(0.62, "#135f82");
  gradient.addColorStop(1, "#0b3558");
  context.fillStyle = gradient;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  context.save();
  context.strokeStyle = "rgb(210 250 255 / 28%)";
  context.lineWidth = 4;
  context.lineCap = "round";
  for (let row = 0; row < 3; row++) {
    const y = surfaceY() + row * 24;
    context.beginPath();
    for (let x = -40; x <= window.innerWidth + 40; x += 18) {
      const waveY = y + Math.sin(x / 42 + row * 0.8) * 4;
      if (x === -40) context.moveTo(x, waveY);
      else context.lineTo(x, waveY);
    }
    context.stroke();
  }
  context.restore();
}

function drawLightRays(context: CanvasRenderingContext2D) {
  context.save();
  context.globalAlpha = 0.15;
  const ray = context.createLinearGradient(0, surfaceY(), 0, seabedTop());
  ray.addColorStop(0, "rgb(220 255 248 / 54%)");
  ray.addColorStop(1, "rgb(255 255 240 / 0%)");
  context.fillStyle = ray;
  for (const x of [window.innerWidth * 0.16, window.innerWidth * 0.45, window.innerWidth * 0.75]) {
    context.beginPath();
    context.moveTo(x, surfaceY() - 20);
    context.lineTo(x + window.innerWidth * 0.11, seabedTop());
    context.lineTo(x - window.innerWidth * 0.07, seabedTop());
    context.closePath();
    context.fill();
  }
  context.restore();
}

function drawSeaweed(context: CanvasRenderingContext2D, x: number, baseY: number, height: number, color: string, sway: number) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = Math.max(5, height * 0.08);
  context.lineCap = "round";
  for (let index = 0; index < 3; index++) {
    const offset = (index - 1) * height * 0.12;
    context.beginPath();
    context.moveTo(x + offset, baseY);
    context.quadraticCurveTo(x + offset + Math.sin(sway + index) * height * 0.14, baseY - height * 0.5, x + offset + Math.cos(sway + index) * height * 0.08, baseY - height);
    context.stroke();
  }
  context.restore();
}

function drawShell(context: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  context.save();
  context.fillStyle = color;
  context.beginPath();
  context.ellipse(x, y, size, size * 0.48, 0, Math.PI, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgb(126 83 66 / 28%)";
  context.lineWidth = 2;
  for (let index = -2; index <= 2; index++) {
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + index * size * 0.18, y - size * 0.34, x + index * size * 0.36, y - size * 0.05);
    context.stroke();
  }
  context.restore();
}

function drawSeabed(context: CanvasRenderingContext2D, now: number) {
  const top = seabedTop();
  const sand = context.createLinearGradient(0, top, 0, window.innerHeight);
  sand.addColorStop(0, "#c99f72");
  sand.addColorStop(0.62, "#9b7058");
  sand.addColorStop(1, "#5d3d3f");
  context.fillStyle = sand;
  context.beginPath();
  context.moveTo(0, top + 24);
  context.quadraticCurveTo(window.innerWidth * 0.18, top - 8, window.innerWidth * 0.36, top + 18);
  context.quadraticCurveTo(window.innerWidth * 0.58, top + 48, window.innerWidth, top + 16);
  context.lineTo(window.innerWidth, window.innerHeight);
  context.lineTo(0, window.innerHeight);
  context.closePath();
  context.fill();

  for (const item of [
    [0.08, 0.9, 70, "#2e7386"],
    [0.25, 0.86, 46, "#557d4d"],
    [0.66, 0.88, 58, "#2e7386"],
    [0.92, 0.9, 72, "#5e7040"]
  ] as const) drawSeaweed(context, window.innerWidth * item[0], window.innerHeight * item[1], item[2], item[3], now / 1600);

  drawShell(context, window.innerWidth * 0.18, window.innerHeight * 0.9, 42, "#c79d91");
  drawShell(context, window.innerWidth * 0.52, window.innerHeight * 0.84, 58, "#d6a77f");
  drawShell(context, window.innerWidth * 0.82, window.innerHeight * 0.86, 36, "#a9975d");

  context.fillStyle = "rgb(87 143 154 / 45%)";
  for (const rock of [[0.42, 0.93, 32], [0.62, 0.92, 24], [0.73, 0.88, 18], [0.34, 0.86, 15]] as const) {
    context.beginPath();
    context.ellipse(window.innerWidth * rock[0], window.innerHeight * rock[1], rock[2], rock[2] * 0.42, 0, 0, Math.PI * 2);
    context.fill();
  }
}

function drawTreasureClock(context: CanvasRenderingContext2D, progress: number) {
  const x = window.innerWidth * 0.68;
  const y = seabedTop() + window.innerHeight * 0.12;
  const size = Math.min(124, Math.max(82, window.innerHeight * 0.115));
  const width = size * 1.36;
  const height = size * 0.72;
  const left = x - width * 0.5;
  const top = y - height;
  const clockRadius = size * 0.2;
  const clockX = x;
  const clockY = top + height * 0.58;

  context.save();
  context.fillStyle = "rgb(68 113 118 / 24%)";
  context.beginPath();
  context.ellipse(x, y + size * 0.06, width * 0.56, size * 0.14, 0, 0, Math.PI * 2);
  context.fill();

  const wood = context.createLinearGradient(left, top, left, y);
  wood.addColorStop(0, "#c9823f");
  wood.addColorStop(0.5, "#9c562d");
  wood.addColorStop(1, "#6f3b24");
  context.fillStyle = wood;
  context.beginPath();
  context.moveTo(left, top + height * 0.42);
  context.quadraticCurveTo(left + width * 0.08, top, x, top);
  context.quadraticCurveTo(left + width * 0.92, top, left + width, top + height * 0.42);
  context.lineTo(left + width, y);
  context.lineTo(left, y);
  context.closePath();
  context.fill();

  context.strokeStyle = "#5a2f1f";
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = "rgb(255 205 104 / 78%)";
  for (const stripeX of [left + width * 0.16, left + width * 0.78]) {
    context.fillRect(stripeX, top + height * 0.18, width * 0.08, height * 0.78);
  }
  context.fillRect(left + width * 0.04, top + height * 0.48, width * 0.92, height * 0.08);

  context.strokeStyle = "rgb(92 48 29 / 45%)";
  context.lineWidth = 2;
  for (let index = 1; index < 4; index++) {
    const lineY = top + height * (0.54 + index * 0.1);
    context.beginPath();
    context.moveTo(left + width * 0.07, lineY);
    context.lineTo(left + width * 0.93, lineY);
    context.stroke();
  }

  context.fillStyle = "#fff8d8";
  context.beginPath();
  context.arc(clockX, clockY, clockRadius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#31546a";
  context.lineWidth = 3;
  context.stroke();

  context.strokeStyle = "rgb(49 84 106 / 70%)";
  context.lineWidth = 1.5;
  for (let index = 0; index < 12; index++) {
    const angle = index / 12 * Math.PI * 2 - Math.PI / 2;
    context.beginPath();
    context.moveTo(clockX + Math.cos(angle) * clockRadius * 0.7, clockY + Math.sin(angle) * clockRadius * 0.7);
    context.lineTo(clockX + Math.cos(angle) * clockRadius * 0.88, clockY + Math.sin(angle) * clockRadius * 0.88);
    context.stroke();
  }

  const handAngle = -Math.PI / 2 + Math.PI * 2 * progress;
  context.strokeStyle = "#31546a";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(clockX, clockY);
  context.lineTo(clockX + Math.cos(handAngle) * clockRadius * 0.58, clockY + Math.sin(handAngle) * clockRadius * 0.58);
  context.stroke();
  context.fillStyle = "#31546a";
  context.beginPath();
  context.arc(clockX, clockY, 4, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#e3b45b";
  context.beginPath();
  context.roundRect?.(x - size * 0.1, top + height * 0.76, size * 0.2, size * 0.16, 5);
  if (!context.roundRect) context.rect(x - size * 0.1, top + height * 0.76, size * 0.2, size * 0.16);
  context.fill();

  context.fillStyle = "rgb(255 230 150 / 48%)";
  context.beginPath();
  context.ellipse(left + width * 0.3, top + height * 0.24, width * 0.16, height * 0.08, -0.25, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBubble(context: CanvasRenderingContext2D, bubble: Bubble) {
  context.save();
  context.globalAlpha = bubble.alpha;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawFish(context: CanvasRenderingContext2D, fish: Fish) {
  const alpha = fish.state === "caught" ? Math.max(0, 1 - fish.caughtAge / 0.78) : 1;
  const size = fish.size;

  context.save();
  context.translate(fish.x, fish.y);
  context.scale(fish.direction, 1);
  context.globalAlpha = alpha;
  context.rotate(Math.sin(fish.phase * 0.7) * 0.045);

  context.fillStyle = "rgb(28 93 116 / 18%)";
  context.beginPath();
  context.ellipse(-size * 0.03, size * 0.32, size * 0.62, size * 0.12, 0, 0, Math.PI * 2);
  context.fill();

  const body = context.createRadialGradient(-size * 0.16, -size * 0.12, size * 0.08, 0, 0, size * 0.62);
  body.addColorStop(0, `hsl(${fish.hue}, 95%, 76%)`);
  body.addColorStop(0.62, `hsl(${fish.hue + 8}, 88%, 58%)`);
  body.addColorStop(1, `hsl(${fish.hue + 12}, 78%, 44%)`);
  context.fillStyle = body;
  context.beginPath();
  context.ellipse(0, 0, size * 0.56, size * 0.34, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = `hsl(${fish.hue + 12}, 82%, 48%)`;
  context.beginPath();
  context.moveTo(-size * 0.52, 0);
  context.lineTo(-size * 0.86, -size * 0.28);
  context.lineTo(-size * 0.82, 0);
  context.lineTo(-size * 0.86, size * 0.28);
  context.closePath();
  context.fill();

  context.fillStyle = `hsl(${fish.hue + 20}, 85%, 66%)`;
  context.beginPath();
  context.ellipse(size * 0.03, size * 0.12, size * 0.2, size * 0.1, -0.34, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.ellipse(-size * 0.02, -size * 0.3, size * 0.18, size * 0.08, 0.2, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#fff9d2";
  context.beginPath();
  context.arc(size * 0.38, -size * 0.08, size * 0.1, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#24313b";
  context.beginPath();
  context.arc(size * 0.41, -size * 0.08, size * 0.038, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgb(255 255 210 / 28%)";
  context.beginPath();
  context.ellipse(size * 0.1, -size * 0.12, size * 0.28, size * 0.07, -0.25, 0, Math.PI * 2);
  context.fill();
  context.restore();

  if (fish.state === "swimming" && fish.dwellProgress > 0) drawCatchProgress(context, fish);
}

function drawCatchProgress(context: CanvasRenderingContext2D, fish: Fish) {
  const radius = fishHitRadius(fish) * 0.94;
  context.save();
  context.strokeStyle = "rgb(255 250 220 / 82%)";
  context.lineWidth = 5;
  context.lineCap = "round";
  context.beginPath();
  context.arc(fish.x, fish.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fish.dwellProgress);
  context.stroke();

  context.strokeStyle = "rgb(255 255 255 / 52%)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(fish.x, surfaceY() + 8);
  context.quadraticCurveTo(fish.x + fish.size * 0.1, (surfaceY() + fish.y) * 0.5, fish.x, fish.y - radius);
  context.stroke();
  context.restore();
}

function drawCatchRipple(context: CanvasRenderingContext2D, ripple: CatchRipple) {
  const progress = ripple.age / ripple.life;
  context.save();
  context.globalAlpha = Math.max(0, 1 - progress) * 0.72;
  context.strokeStyle = `hsl(${ripple.hue}, 90%, 86%)`;
  context.lineWidth = 4;
  context.beginPath();
  context.ellipse(ripple.x, ripple.y, ripple.radius * (1 + progress * 1.8), ripple.radius * (0.44 + progress * 0.42), 0, 0, Math.PI * 2);
  context.stroke();
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

export function drawFishScene(context: CanvasRenderingContext2D, options: FishSceneOptions) {
  const totalMs = options.sessionSeconds * 1000;
  const progress = totalMs > 0 ? Math.min(1, Math.max(0, options.durationMs / totalMs)) : 0;

  drawWater(context);
  drawLightRays(context);
  for (const bubble of options.bubbles) drawBubble(context, bubble);
  drawSeabed(context, options.now);
  drawTreasureClock(context, progress);
  [...options.fishes].sort((a, b) => a.y - b.y).forEach((fish) => drawFish(context, fish));
  for (const ripple of options.ripples) drawCatchRipple(context, ripple);
  drawPointerSight(context, options.pointer, options.running);
}

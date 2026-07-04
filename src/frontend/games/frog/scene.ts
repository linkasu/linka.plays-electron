export type Point = { x: number; y: number };
export type BugState = "flying" | "caught";
export type Bug = Point & {
  id: string;
  laneY: number;
  laneIndex: number;
  size: number;
  direction: -1 | 1;
  speed: number;
  phase: number;
  state: BugState;
  dwellProgress: number;
  enteredAt?: number;
  caughtAge: number;
};
export type CatchBurst = Point & {
  age: number;
  life: number;
  radius: number;
};
export type Tongue = Point & {
  age: number;
  life: number;
};
export type ScenePointer = Point & {
  valid: boolean;
};
export type FrogSceneOptions = {
  bugs: Bug[];
  bursts: CatchBurst[];
  tongues: Tongue[];
  pointer: ScenePointer;
  running: boolean;
  now: number;
  durationMs: number;
  sessionSeconds: number;
  attempts: number;
  maxAttempts: number;
};

export function laneTop() {
  return window.innerHeight * 0.2;
}

export function laneBottom() {
  return window.innerHeight * 0.58;
}

export function frogBaseY() {
  return window.innerHeight * 0.88;
}

export function frogSize() {
  return Math.min(178, Math.max(108, Math.min(window.innerWidth, window.innerHeight) * 0.2));
}

export function frogMouthPoint(): Point {
  const size = frogSize();
  return {
    x: window.innerWidth * 0.5,
    y: frogBaseY() - size * 0.38
  };
}

export function bugHitRadius(bug: Bug) {
  return bug.size * 0.86;
}

function drawSky(context: CanvasRenderingContext2D, progress: number) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#17204c");
  sky.addColorStop(0.52, "#344a78");
  sky.addColorStop(1, "#172b36");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const moonX = window.innerWidth * 0.82;
  const moonY = window.innerHeight * 0.14;
  const moonSize = Math.min(82, Math.max(48, window.innerWidth * 0.06));
  context.save();
  context.fillStyle = "rgb(255 241 185 / 28%)";
  context.beginPath();
  context.arc(moonX, moonY, moonSize * 1.32, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fff0b7";
  context.beginPath();
  context.arc(moonX, moonY, moonSize, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#17204c";
  context.beginPath();
  context.arc(moonX - moonSize * 0.28, moonY - moonSize * 0.12, moonSize * 0.94, 0, Math.PI * 2);
  context.fill();
  context.restore();

  drawFireflyMist(context, progress);
}

function drawFireflyMist(context: CanvasRenderingContext2D, progress: number) {
  context.save();
  for (let index = 0; index < 18; index++) {
    const baseX = (index * 0.137 + 0.08) % 1;
    const baseY = 0.16 + index % 7 * 0.072;
    const drift = Math.sin(progress * Math.PI * 2 + index) * 0.018;
    const x = window.innerWidth * Math.min(0.96, Math.max(0.04, baseX + drift));
    const y = window.innerHeight * baseY + Math.cos(progress * Math.PI * 2 + index * 0.9) * 8;
    const radius = 2.4 + index % 3 * 1.2;
    context.globalAlpha = 0.24 + (index % 4) * 0.06;
    context.fillStyle = "#fff7a4";
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawMeadow(context: CanvasRenderingContext2D, now: number) {
  const pondTop = window.innerHeight * 0.64;
  const hill = context.createLinearGradient(0, laneBottom(), 0, window.innerHeight);
  hill.addColorStop(0, "#4c944f");
  hill.addColorStop(1, "#17492f");

  context.fillStyle = "#325d45";
  context.beginPath();
  context.moveTo(0, window.innerHeight * 0.55);
  context.quadraticCurveTo(window.innerWidth * 0.28, window.innerHeight * 0.5, window.innerWidth * 0.52, window.innerHeight * 0.57);
  context.quadraticCurveTo(window.innerWidth * 0.74, window.innerHeight * 0.63, window.innerWidth, window.innerHeight * 0.54);
  context.lineTo(window.innerWidth, window.innerHeight);
  context.lineTo(0, window.innerHeight);
  context.closePath();
  context.fill();

  context.fillStyle = hill;
  context.beginPath();
  context.moveTo(0, pondTop - 18);
  context.quadraticCurveTo(window.innerWidth * 0.24, pondTop - 42, window.innerWidth * 0.5, pondTop - 16);
  context.quadraticCurveTo(window.innerWidth * 0.72, pondTop + 18, window.innerWidth, pondTop - 24);
  context.lineTo(window.innerWidth, window.innerHeight);
  context.lineTo(0, window.innerHeight);
  context.closePath();
  context.fill();

  const water = context.createLinearGradient(0, pondTop, 0, window.innerHeight);
  water.addColorStop(0, "#2f7d8e");
  water.addColorStop(0.62, "#1e5f73");
  water.addColorStop(1, "#16435c");
  context.fillStyle = water;
  context.beginPath();
  context.ellipse(window.innerWidth * 0.5, window.innerHeight * 0.86, window.innerWidth * 0.64, window.innerHeight * 0.22, 0, 0, Math.PI * 2);
  context.fill();

  drawReeds(context, now);
  drawWaterLines(context, pondTop, now);
}

function drawWaterLines(context: CanvasRenderingContext2D, pondTop: number, now: number) {
  const pondX = window.innerWidth * 0.5;
  const pondY = window.innerHeight * 0.86;
  const pondRadiusX = window.innerWidth * 0.64;
  const pondRadiusY = window.innerHeight * 0.22;

  context.save();
  context.beginPath();
  context.ellipse(pondX, pondY, pondRadiusX, pondRadiusY, 0, 0, Math.PI * 2);
  context.clip();
  context.lineCap = "round";
  for (let row = 0; row < 6; row++) {
    const y = pondTop + 12 + row * 26 + Math.sin(now / 1800 + row) * 4;
    context.strokeStyle = row % 2 === 0 ? "rgb(190 244 232 / 24%)" : "rgb(30 80 96 / 18%)";
    context.lineWidth = row % 2 === 0 ? 3 : 2;
    context.beginPath();
    for (let x = window.innerWidth * 0.16; x <= window.innerWidth * 0.84; x += 20) {
      const waveY = y + Math.sin(x / 58 + now / 1500 + row) * 3;
      if (x === window.innerWidth * 0.16) context.moveTo(x, waveY);
      else context.lineTo(x, waveY);
    }
    context.stroke();
  }
  context.restore();
}

function drawReeds(context: CanvasRenderingContext2D, now: number) {
  context.save();
  for (const side of [-1, 1] as const) {
    const origin = side === -1 ? window.innerWidth * 0.1 : window.innerWidth * 0.9;
    for (let index = 0; index < 9; index++) {
      const x = origin + side * index * 16;
      const baseY = window.innerHeight * (0.73 + (index % 3) * 0.026);
      const height = 62 + index % 4 * 14;
      const sway = Math.sin(now / 1700 + index) * 12;
      context.strokeStyle = index % 2 ? "#6f8a35" : "#8aa747";
      context.lineWidth = 5;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(x, baseY);
      context.quadraticCurveTo(x + sway * 0.35, baseY - height * 0.52, x + sway, baseY - height);
      context.stroke();
      if (index % 3 === 0) {
        context.fillStyle = "#765542";
        context.beginPath();
        context.ellipse(x + sway, baseY - height - 8, 7, 18, Math.sin(now / 1600 + index) * 0.18, 0, Math.PI * 2);
        context.fill();
      }
    }
  }
  context.restore();
}

function drawFrog(context: CanvasRenderingContext2D, now: number) {
  const size = frogSize();
  const x = window.innerWidth * 0.5;
  const y = frogBaseY();
  const breathe = Math.sin(now / 900) * size * 0.012;

  context.save();
  context.translate(x, y + breathe);
  context.fillStyle = "rgb(0 0 0 / 24%)";
  context.beginPath();
  context.ellipse(0, size * 0.08, size * 0.58, size * 0.16, 0, 0, Math.PI * 2);
  context.fill();

  const body = context.createRadialGradient(-size * 0.14, -size * 0.36, size * 0.08, 0, -size * 0.12, size * 0.82);
  body.addColorStop(0, "#a9df66");
  body.addColorStop(0.58, "#57a947");
  body.addColorStop(1, "#2d6f3c");
  context.fillStyle = body;
  context.beginPath();
  context.ellipse(0, -size * 0.08, size * 0.48, size * 0.42, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#6fbd4f";
  context.beginPath();
  context.ellipse(-size * 0.34, size * 0.02, size * 0.18, size * 0.12, -0.18, 0, Math.PI * 2);
  context.ellipse(size * 0.34, size * 0.02, size * 0.18, size * 0.12, 0.18, 0, Math.PI * 2);
  context.fill();

  for (const eyeX of [-size * 0.2, size * 0.2]) {
    context.fillStyle = "#77bd52";
    context.beginPath();
    context.arc(eyeX, -size * 0.48, size * 0.16, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#f7ffe8";
    context.beginPath();
    context.arc(eyeX, -size * 0.5, size * 0.1, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#263545";
    context.beginPath();
    context.arc(eyeX, -size * 0.5, size * 0.046, 0, Math.PI * 2);
    context.fill();
  }

  context.strokeStyle = "#255235";
  context.lineWidth = Math.max(3, size * 0.025);
  context.lineCap = "round";
  context.beginPath();
  context.quadraticCurveTo(-size * 0.16, -size * 0.27, 0, -size * 0.22);
  context.quadraticCurveTo(size * 0.16, -size * 0.27, size * 0.28, -size * 0.34);
  context.stroke();
  context.restore();
}

function eased(progress: number) {
  const value = Math.min(1, Math.max(0, progress));
  return 1 - Math.pow(1 - value, 3);
}

function quadraticPoint(start: Point, control: Point, end: Point, progress: number): Point {
  const oneMinus = 1 - progress;
  return {
    x: oneMinus * oneMinus * start.x + 2 * oneMinus * progress * control.x + progress * progress * end.x,
    y: oneMinus * oneMinus * start.y + 2 * oneMinus * progress * control.y + progress * progress * end.y
  };
}

function drawTongueLine(context: CanvasRenderingContext2D, target: Point, alpha: number, width: number, reach = 1) {
  const start = frogMouthPoint();
  const control = {
    x: (start.x + target.x) * 0.5,
    y: (start.y + target.y) * 0.5 - Math.min(56, Math.abs(start.x - target.x) * 0.08)
  };
  const end = quadraticPoint(start, control, target, Math.min(1, Math.max(0.08, reach)));
  const partialControl = quadraticPoint(start, control, target, Math.min(1, Math.max(0.04, reach * 0.52)));

  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = "#ff8fa3";
  context.lineWidth = width;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.quadraticCurveTo(partialControl.x, partialControl.y, end.x, end.y);
  context.stroke();
  context.restore();
}

function drawBug(context: CanvasRenderingContext2D, bug: Bug, now: number) {
  const alpha = bug.state === "caught" ? Math.max(0, 1 - bug.caughtAge / 0.78) : 1;
  const wing = Math.sin(now / 80 + bug.phase) * 0.22;
  const size = bug.size;

  context.save();
  context.translate(bug.x, bug.y);
  context.scale(bug.direction, 1);
  context.rotate(Math.sin(bug.phase * 0.8) * 0.08);
  context.globalAlpha = alpha;

  context.fillStyle = "rgb(255 246 128 / 22%)";
  context.beginPath();
  context.arc(0, 0, size * 0.62, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgb(210 252 255 / 58%)";
  context.beginPath();
  context.ellipse(-size * 0.18, -size * 0.16, size * 0.24, size * 0.12, -0.45 + wing, 0, Math.PI * 2);
  context.ellipse(size * 0.18, -size * 0.16, size * 0.24, size * 0.12, 0.45 - wing, 0, Math.PI * 2);
  context.fill();

  const body = context.createLinearGradient(0, -size * 0.26, 0, size * 0.28);
  body.addColorStop(0, "#fff49a");
  body.addColorStop(0.5, "#f7bd3a");
  body.addColorStop(1, "#df6a36");
  context.fillStyle = body;
  context.beginPath();
  context.ellipse(0, 0, size * 0.13, size * 0.34, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#6e5735";
  context.lineWidth = Math.max(2, size * 0.025);
  context.beginPath();
  context.moveTo(0, -size * 0.32);
  context.quadraticCurveTo(size * 0.16, -size * 0.48, size * 0.32, -size * 0.42);
  context.moveTo(0, -size * 0.32);
  context.quadraticCurveTo(-size * 0.16, -size * 0.48, -size * 0.32, -size * 0.42);
  context.stroke();
  context.restore();

  if (bug.state === "flying" && bug.dwellProgress > 0) drawAimProgress(context, bug);
}

function drawAimProgress(context: CanvasRenderingContext2D, bug: Bug) {
  const radius = bugHitRadius(bug) * 0.96;
  context.save();
  context.strokeStyle = "rgb(255 247 190 / 84%)";
  context.lineWidth = 5;
  context.lineCap = "round";
  context.beginPath();
  context.arc(bug.x, bug.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * bug.dwellProgress);
  context.stroke();
  context.restore();
}

function drawBurst(context: CanvasRenderingContext2D, burst: CatchBurst) {
  const progress = burst.age / burst.life;
  context.save();
  context.globalAlpha = Math.max(0, 1 - progress) * 0.82;
  context.strokeStyle = "#fff5a7";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(burst.x, burst.y, burst.radius * (0.65 + progress * 1.35), 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = "#fff7b8";
  for (let index = 0; index < 7; index++) {
    const angle = index / 7 * Math.PI * 2 + progress * 0.8;
    const distance = burst.radius * progress * 1.6;
    context.beginPath();
    context.arc(burst.x + Math.cos(angle) * distance, burst.y + Math.sin(angle) * distance, Math.max(2, burst.radius * 0.06), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawPointerSight(context: CanvasRenderingContext2D, pointer: ScenePointer, running: boolean) {
  if (!pointer.valid || !running) return;
  context.save();
  context.strokeStyle = "rgb(255 255 255 / 58%)";
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

function drawAttemptDots(context: CanvasRenderingContext2D, attempts: number, maxAttempts: number) {
  const count = Math.max(1, maxAttempts);
  const radius = Math.min(7, Math.max(4, window.innerWidth * 0.0048));
  const gap = radius * 2.4;
  const total = count * radius * 2 + (count - 1) * gap;
  const startX = window.innerWidth * 0.5 - total * 0.5 + radius;
  const y = window.innerHeight - 24;

  context.save();
  for (let index = 0; index < count; index++) {
    context.fillStyle = index < attempts ? "rgb(255 238 152 / 78%)" : "rgb(255 255 255 / 24%)";
    context.beginPath();
    context.arc(startX + index * (radius * 2 + gap), y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

export function drawFrogScene(context: CanvasRenderingContext2D, options: FrogSceneOptions) {
  const totalMs = options.sessionSeconds * 1000;
  const progress = totalMs > 0 ? Math.min(1, Math.max(0, options.durationMs / totalMs)) : 0;
  const activeBug = options.bugs
   .filter((bug) => bug.state === "flying" && bug.dwellProgress > 0)
   .sort((a, b) => b.dwellProgress - a.dwellProgress)[0];

  drawSky(context, progress);
  drawMeadow(context, options.now);
  if (activeBug) drawTongueLine(context, activeBug, 0.26 + activeBug.dwellProgress * 0.34, Math.max(5, activeBug.size * 0.09), eased(activeBug.dwellProgress));
  for (const tongue of options.tongues) {
    const tongueProgress = tongue.age / tongue.life;
    const reach = tongueProgress < 0.58 ? eased(tongueProgress / 0.58) : eased(1 - (tongueProgress - 0.58) / 0.42);
    drawTongueLine(context, tongue, Math.max(0, 1 - tongueProgress) * 0.86, 9, reach);
  }
  [...options.bugs].sort((a, b) => a.y - b.y).forEach((bug) => drawBug(context, bug, options.now));
  for (const burst of options.bursts) drawBurst(context, burst);
  drawFrog(context, options.now);
  drawPointerSight(context, options.pointer, options.running);
  drawAttemptDots(context, options.attempts, options.maxAttempts);
}

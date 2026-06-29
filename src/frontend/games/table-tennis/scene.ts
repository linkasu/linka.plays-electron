export type Point = { x: number; y: number };

export type TennisPaddle = Point & {
  width: number;
  height: number;
  glow: number;
};

export type TennisBall = Point & {
  radius: number;
  phase: number;
  contactProgress: number;
};

export type TennisTrail = Point & {
  age: number;
  life: number;
  radius: number;
};

export type TennisBurst = Point & {
  age: number;
  life: number;
  radius: number;
  kind: "hit" | "miss" | "return";
};

export type TennisScenePointer = Point & {
  valid: boolean;
};

export type TennisSceneOptions = {
  paddle: TennisPaddle;
  partnerY: number;
  ball: TennisBall;
  trails: TennisTrail[];
  bursts: TennisBurst[];
  pointer: TennisScenePointer;
  running: boolean;
  now: number;
  durationMs: number;
  sessionSeconds: number;
  score: number;
  streak: number;
  reduceMotion: boolean;
};

export function tennisCourtTop() {
  return Math.max(118, window.innerHeight * 0.18);
}

export function tennisCourtBottom() {
  return window.innerHeight - Math.max(72, window.innerHeight * 0.1);
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(x, y, width, height, radius);
    return;
  }

  const nextRadius = Math.min(radius, width / 2, height / 2);
  context.moveTo(x + nextRadius, y);
  context.lineTo(x + width - nextRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + nextRadius);
  context.lineTo(x + width, y + height - nextRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - nextRadius, y + height);
  context.lineTo(x + nextRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - nextRadius);
  context.lineTo(x, y + nextRadius);
  context.quadraticCurveTo(x, y, x + nextRadius, y);
}

function drawCloud(context: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number) {
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.ellipse(x - size * 0.34, y + size * 0.08, size * 0.42, size * 0.18, 0, 0, Math.PI * 2);
  context.ellipse(x - size * 0.08, y - size * 0.04, size * 0.5, size * 0.25, 0, 0, Math.PI * 2);
  context.ellipse(x + size * 0.32, y + size * 0.08, size * 0.4, size * 0.18, 0, 0, Math.PI * 2);
  context.ellipse(x + size * 0.02, y + size * 0.16, size * 0.66, size * 0.14, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBackground(context: CanvasRenderingContext2D, now: number, reduceMotion: boolean) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#b9ebff");
  sky.addColorStop(0.56, "#eaf8ff");
  sky.addColorStop(1, "#d9f0d0");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const sway = reduceMotion ? 0 : Math.sin(now / 2600) * 12;
  drawCloud(context, window.innerWidth * 0.18 + sway, window.innerHeight * 0.14, Math.min(132, window.innerWidth * 0.11), 0.62);
  drawCloud(context, window.innerWidth * 0.74 - sway * 0.8, window.innerHeight * 0.12, Math.min(156, window.innerWidth * 0.13), 0.5);

  const grassTop = tennisCourtBottom() + 18;
  context.fillStyle = "#b9df93";
  context.fillRect(0, grassTop, window.innerWidth, Math.max(0, window.innerHeight - grassTop));
}

function drawCourt(context: CanvasRenderingContext2D) {
  const left = Math.max(42, window.innerWidth * 0.045);
  const right = window.innerWidth - left;
  const top = tennisCourtTop();
  const bottom = tennisCourtBottom();
  const width = right - left;
  const height = bottom - top;

  context.save();
  context.fillStyle = "rgb(68 147 139 / 24%)";
  context.beginPath();
  context.ellipse(window.innerWidth * 0.5, bottom + 18, width * 0.48, 22, 0, 0, Math.PI * 2);
  context.fill();

  const court = context.createLinearGradient(0, top, 0, bottom);
  court.addColorStop(0, "#77d5ca");
  court.addColorStop(1, "#49b7a9");
  context.fillStyle = court;
  roundedRect(context, left, top, width, height, 36);
  context.fill();

  context.strokeStyle = "rgb(255 255 255 / 74%)";
  context.lineWidth = 5;
  roundedRect(context, left + 14, top + 14, width - 28, height - 28, 24);
  context.stroke();

  context.strokeStyle = "rgb(255 255 255 / 44%)";
  context.lineWidth = 3;
  context.setLineDash([12, 12]);
  context.beginPath();
  context.moveTo(window.innerWidth * 0.5, top + 22);
  context.lineTo(window.innerWidth * 0.5, bottom - 22);
  context.stroke();
  context.setLineDash([]);

  const netX = window.innerWidth * 0.5;
  context.strokeStyle = "rgb(45 96 113 / 34%)";
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(netX, top + 20);
  context.quadraticCurveTo(netX + 10, top + height * 0.5, netX, bottom - 20);
  context.stroke();
  context.restore();
}

function drawProgress(context: CanvasRenderingContext2D, options: TennisSceneOptions) {
  const progress = Math.min(1, options.durationMs / Math.max(1, options.sessionSeconds * 1000));
  const x = window.innerWidth - Math.max(112, window.innerWidth * 0.08);
  const y = Math.max(38, window.innerHeight * 0.06);
  const radius = 28;

  context.save();
  context.fillStyle = "rgb(255 255 255 / 58%)";
  roundedRect(context, x - 76, y - 27, 152, 54, 22);
  context.fill();

  context.strokeStyle = "rgb(48 88 111 / 22%)";
  context.lineWidth = 6;
  context.beginPath();
  context.arc(x - 44, y, radius * 0.52, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = "#5aa59c";
  context.lineCap = "round";
  context.beginPath();
  context.arc(x - 44, y, radius * 0.52, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  context.stroke();

  context.fillStyle = "#31546a";
  context.font = "700 18px system-ui, sans-serif";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(`${options.score}`, x - 14, y - 8);
  context.font = "600 12px system-ui, sans-serif";
  context.fillStyle = "rgb(49 84 106 / 72%)";
  context.fillText(`серия ${options.streak}`, x - 14, y + 12);
  context.restore();
}

function drawPaddle(context: CanvasRenderingContext2D, paddle: TennisPaddle, side: "player" | "partner") {
  const left = paddle.x;
  const top = paddle.y - paddle.height / 2;
  const radius = paddle.width * 0.7;
  const glow = side === "player" ? paddle.glow : 0.28;

  context.save();
  context.fillStyle = side === "player" ? "rgb(255 214 107 / 20%)" : "rgb(255 255 255 / 18%)";
  context.beginPath();
  context.ellipse(left + paddle.width * 0.5, paddle.y, paddle.width * (2.6 + glow), paddle.height * (0.56 + glow * 0.08), 0, 0, Math.PI * 2);
  context.fill();

  const gradient = context.createLinearGradient(left, top, left + paddle.width, top + paddle.height);
  gradient.addColorStop(0, side === "player" ? "#fff4b8" : "#d9f7ff");
  gradient.addColorStop(1, side === "player" ? "#f7aa61" : "#83c9e8");
  context.fillStyle = gradient;
  roundedRect(context, left, top, paddle.width, paddle.height, radius);
  context.fill();

  context.strokeStyle = side === "player" ? "rgb(143 92 53 / 34%)" : "rgb(49 84 106 / 26%)";
  context.lineWidth = 3;
  roundedRect(context, left, top, paddle.width, paddle.height, radius);
  context.stroke();
  context.restore();
}

function drawBall(context: CanvasRenderingContext2D, ball: TennisBall) {
  context.save();
  const shadow = Math.max(8, ball.radius * 0.35);
  context.fillStyle = "rgb(48 92 54 / 18%)";
  context.beginPath();
  context.ellipse(ball.x + ball.radius * 0.36, ball.y + ball.radius * 1.05, ball.radius * 0.82, shadow, 0, 0, Math.PI * 2);
  context.fill();

  context.translate(ball.x, ball.y);
  context.rotate(ball.phase * 0.3);

  const glow = context.createRadialGradient(-ball.radius * 0.34, -ball.radius * 0.42, 1, 0, 0, ball.radius * 1.2);
  glow.addColorStop(0, "#fff9bf");
  glow.addColorStop(0.58, "#ffd66f");
  glow.addColorStop(1, "#f4a65f");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(0, 0, ball.radius, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgb(255 255 255 / 58%)";
  context.lineWidth = Math.max(2, ball.radius * 0.08);
  context.beginPath();
  context.arc(0, 0, ball.radius * 0.68, -Math.PI * 0.8, Math.PI * 0.28);
  context.stroke();
  context.restore();
}

function drawTrail(context: CanvasRenderingContext2D, trail: TennisTrail) {
  const progress = Math.min(1, trail.age / trail.life);
  context.save();
  context.globalAlpha = (1 - progress) * 0.24;
  context.fillStyle = "#fff7b7";
  context.beginPath();
  context.arc(trail.x, trail.y, trail.radius * (1 - progress * 0.42), 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBurst(context: CanvasRenderingContext2D, burst: TennisBurst) {
  const progress = Math.min(1, burst.age / burst.life);
  const color = burst.kind === "miss" ? "117 160 185" : burst.kind === "return" ? "120 205 220" : "255 210 103";

  context.save();
  context.globalAlpha = 1 - progress;
  context.strokeStyle = `rgb(${color} / 62%)`;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(burst.x, burst.y, burst.radius * (0.4 + (progress * (context.canvas.dataset.reduceMotion === "true" ? 0.18 : 0.9))), 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = `rgb(${color} / 34%)`;
  for (let index = 0; index < 6; index++) {
    const angle = index / 6 * Math.PI * 2 + progress * (context.canvas.dataset.reduceMotion === "true" ? 0 : 0.7);
    context.beginPath();
    context.arc(burst.x + Math.cos(angle) * burst.radius * progress, burst.y + Math.sin(angle) * burst.radius * progress, Math.max(3, burst.radius * 0.1 * (1 - progress)), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawPointerHint(context: CanvasRenderingContext2D, options: TennisSceneOptions) {
  if (!options.pointer.valid || !options.running) return;

  context.save();
  context.globalAlpha = 0.18;
  context.strokeStyle = "#31546a";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(options.pointer.x, options.pointer.y, 20, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

export function drawTennisScene(context: CanvasRenderingContext2D, options: TennisSceneOptions) {
  context.canvas.dataset.reduceMotion = String(options.reduceMotion);
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  drawBackground(context, options.now, options.reduceMotion);
  drawCourt(context);

  for (const trail of options.trails) drawTrail(context, trail);
  for (const burst of options.bursts) drawBurst(context, burst);

  const partnerPaddle: TennisPaddle = {
    x: window.innerWidth - Math.max(92, window.innerWidth * 0.1),
    y: options.partnerY,
    width: Math.max(22, options.paddle.width * 0.82),
    height: options.paddle.height * 0.72,
    glow: 0.2
  };
  drawPaddle(context, partnerPaddle, "partner");
  drawPaddle(context, options.paddle, "player");

  if (options.ball.contactProgress > 0) {
    context.save();
    context.globalAlpha = options.ball.contactProgress * 0.34;
    context.strokeStyle = "#fff4a8";
    context.lineWidth = 5;
    context.beginPath();
    context.arc(options.paddle.x + options.paddle.width * 0.5, options.paddle.y, options.paddle.height * 0.52, -Math.PI / 2, Math.PI / 2);
    context.stroke();
    context.restore();
  }

  drawBall(context, options.ball);
  drawProgress(context, options);
  drawPointerHint(context, options);
}

import { canvasArt } from "../../core/canvasArt";
import { clamp01 } from "../../core/motion";

// Testers asked for drawn pictures. The fire is assembled from separate drawn
// tongues of flame: each one sways and flickers at its own pace around its base,
// so the fire moves smoothly instead of switching between frames. Drawn sparks fly
// up from it, and a big fire lets off a little smoke.

export const fireArtIds = [
  "warm-fire/flame-tall",
  "warm-fire/flame-left",
  "warm-fire/flame-right",
  "warm-fire/flame-small",
  "warm-fire/flame-core",
  "warm-fire/spark",
  "warm-fire/smoke",
];

// x in widths of the logs, height in fire heights; back to front.
const tongues = [
  { artId: "warm-fire/flame-left", x: -0.18, height: 0.64, speed: 1.7, seed: 0.3, mirror: false },
  { artId: "warm-fire/flame-right", x: 0.18, height: 0.6, speed: 1.9, seed: 2.1, mirror: false },
  { artId: "warm-fire/flame-tall", x: 0, height: 1, speed: 1.4, seed: 4.2, mirror: false },
  { artId: "warm-fire/flame-small", x: 0.3, height: 0.36, speed: 2.4, seed: 1.2, mirror: false },
  { artId: "warm-fire/flame-small", x: -0.3, height: 0.32, speed: 2.2, seed: 5.3, mirror: true },
  { artId: "warm-fire/flame-core", x: 0, height: 0.5, speed: 2.8, seed: 3.4, mirror: false },
];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
};
const sparks: Particle[] = [];
const smoke: Particle[] = [];
let lastNow: number | undefined;
let sparkDebt = 0;
let smokeDebt = 0;

export function resetDrawnFire() {
  sparks.length = 0;
  smoke.length = 0;
  lastNow = undefined;
  sparkDebt = 0;
  smokeDebt = 0;
}

/**
 * Draws the fire standing on (x, baseY) above logs `logsWidth` wide.
 * `energy` 0..1 sets its height. Returns false while the pictures are loading.
 */
export function drawDrawnFire(
  context: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  logsWidth: number,
  energy: number,
  now: number,
) {
  if (fireArtIds.some((artId) => !canvasArt(artId))) return false;
  const delta = lastNow === undefined ? 0 : Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
  lastNow = now;
  const level = clamp01(energy);
  const t = now / 1000;
  const fireHeight = logsWidth * (0.3 + level * 1.15);

  updateParticles(delta, x, baseY - fireHeight * 0.55, logsWidth, level);
  for (const puff of smoke) drawParticle(context, "warm-fire/smoke", puff, 0.45);

  if (level > 0.01) {
    for (const tongue of tongues) {
      const art = canvasArt(tongue.artId)!;
      const flicker =
        Math.sin(t * tongue.speed * 3 + tongue.seed) * 0.07 +
        Math.sin(t * tongue.speed * 7.3 + tongue.seed * 2) * 0.035;
      const height = fireHeight * tongue.height * (1 + flicker);
      const width =
        ((fireHeight * tongue.height * art.naturalWidth) / art.naturalHeight) * (1 - flicker * 0.5);
      const sway = Math.sin(t * tongue.speed * 1.3 + tongue.seed) * 0.12;
      context.save();
      context.globalAlpha *= Math.min(1, 0.55 + level);
      context.translate(x + tongue.x * logsWidth, baseY);
      // Lean the flame at its tip while its base stays on the logs.
      context.transform(1, 0, sway, 1, 0, 0);
      if (tongue.mirror) context.scale(-1, 1);
      context.drawImage(art, -width / 2, -height, width, height);
      context.restore();
    }
  }
  for (const spark of sparks) drawParticle(context, "warm-fire/spark", spark, 1);
  return true;
}

function updateParticles(delta: number, x: number, topY: number, logsWidth: number, level: number) {
  sparkDebt += delta * level * 5;
  while (sparkDebt >= 1) {
    sparkDebt -= 1;
    sparks.push({
      x: x + (Math.random() - 0.5) * logsWidth * 0.5,
      y: topY,
      vx: (Math.random() - 0.5) * 40,
      vy: -70 - Math.random() * 60,
      age: 0,
      life: 1 + Math.random() * 0.6,
      size: 12 + Math.random() * 10,
    });
  }
  smokeDebt += delta * Math.max(0, level - 0.35) * 1.2;
  while (smokeDebt >= 1) {
    smokeDebt -= 1;
    smoke.push({
      x,
      y: topY - logsWidth * 0.25,
      vx: 8,
      vy: -35,
      age: 0,
      life: 3,
      size: logsWidth * 0.3,
    });
  }
  for (const list of [sparks, smoke]) {
    for (const particle of list) {
      particle.age += delta;
      particle.x += particle.vx * delta + Math.sin(particle.age * 4 + particle.size) * 12 * delta;
      particle.y += particle.vy * delta;
    }
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (list[index].age >= list[index].life) list.splice(index, 1);
    }
  }
}

function drawParticle(
  context: CanvasRenderingContext2D,
  artId: string,
  particle: Particle,
  opacity: number,
) {
  const art = canvasArt(artId)!;
  const progress = particle.age / particle.life;
  const size = particle.size * (artId.endsWith("smoke") ? 1 + progress : 1 - progress * 0.5);
  const height = (size * art.naturalHeight) / art.naturalWidth;
  context.save();
  context.globalAlpha *= opacity * Math.sin(Math.PI * Math.min(1, progress));
  context.drawImage(art, particle.x - size / 2, particle.y - height / 2, size, height);
  context.restore();
}

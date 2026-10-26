import { canvasArt } from "../../core/canvasArt";
import { clamp01, easeOutBack, easeOutCubic, progressBetween } from "../../core/motion";

// Testers asked for drawn pictures. The flower is assembled from drawn parts so it
// can grow like a plant: the stem rises with a bud on top, then the bud gives way
// and the petals pop open one after another. Sizes are in units of `radius`; the
// head sits at `point` and the stem stands on point.y + radius * 1.18.

export type PlantColor = "pink" | "yellow" | "lilac";

export const plantArtIds = [
  "flowers/stem",
  ...(["pink", "yellow", "lilac"] as const).flatMap((color) => [
    `flowers/${color}-petal`,
    `flowers/${color}-center`,
    `flowers/${color}-bud`,
  ]),
];

export function plantColor(hue: number): PlantColor {
  const h = ((hue % 360) + 360) % 360;
  if (h >= 30 && h < 120) return "yellow";
  if (h >= 200 && h < 300) return "lilac";
  return "pink";
}

export type PlantPose = {
  /** 0 — a short sprout, 1 — the full stem. */
  growth: number;
  /** 0 — closed bud, 1 — every petal open. */
  bloom: number;
  /** How wide the open petals spread, for a flower that breathes; 1 by default. */
  openness?: number;
  /** Gentle sway angle of the whole plant around its foot. */
  sway: number;
  alpha: number;
};

const petalCount = 6;

/** Returns false while the pictures are loading. */
export function drawPlantParts(
  context: CanvasRenderingContext2D,
  point: { x: number; y: number },
  radius: number,
  color: PlantColor,
  pose: PlantPose,
) {
  const stem = canvasArt("flowers/stem");
  const petal = canvasArt(`flowers/${color}-petal`);
  const center = canvasArt(`flowers/${color}-center`);
  const bud = canvasArt(`flowers/${color}-bud`);
  if (!stem || !petal || !center || !bud) return false;

  const foot = radius * 1.18;
  const growth = easeOutCubic(pose.growth);
  const stemHeight = foot * (0.45 + 0.55 * growth);
  const stemWidth = (foot * stem.naturalWidth) / stem.naturalHeight;
  const openness = pose.openness ?? 1;

  context.save();
  context.globalAlpha *= pose.alpha;
  context.translate(point.x, point.y + foot);
  context.rotate(pose.sway);
  context.drawImage(stem, -stemWidth / 2, -stemHeight, stemWidth, stemHeight);
  context.translate(0, -stemHeight);

  // The bud rides on top of the stem and fades as the petals come out.
  const budFade = 1 - progressBetween(pose.bloom, 0.05, 0.35);
  if (budFade > 0) {
    const budWidth = radius * (0.32 + 0.22 * growth) * (1 + (1 - budFade) * 0.2);
    const budHeight = (budWidth * bud.naturalHeight) / bud.naturalWidth;
    const alpha = context.globalAlpha;
    context.globalAlpha = alpha * budFade;
    context.drawImage(bud, -budWidth / 2, -budHeight * 0.92, budWidth, budHeight);
    context.globalAlpha = alpha;
  }

  if (pose.bloom > 0) {
    const petalLength = radius * 0.78 * (0.6 + 0.4 * openness);
    const petalWidth = (petalLength * petal.naturalWidth) / petal.naturalHeight;
    const lift = radius * 0.04;
    for (let index = 0; index < petalCount; index += 1) {
      const start = 0.1 + index * 0.07;
      const t = progressBetween(pose.bloom, start, start + 0.35);
      if (t <= 0) continue;
      const angle = (index / petalCount) * Math.PI * 2 + Math.PI / petalCount;
      // Each petal unfolds from pointing up to its place around the centre.
      const turn = angle * (0.35 + 0.65 * easeOutCubic(t));
      const scale = easeOutBack(t) * (0.92 + 0.08 * openness);
      const alpha = context.globalAlpha;
      context.save();
      context.globalAlpha = alpha * clamp01(t * 3);
      context.translate(0, -lift);
      context.rotate(turn);
      context.drawImage(
        petal,
        (-petalWidth * scale) / 2,
        -radius * (0.1 + 0.06 * openness) - petalLength * scale,
        petalWidth * scale,
        petalLength * scale,
      );
      context.restore();
    }
    const centerScale =
      easeOutBack(progressBetween(pose.bloom, 0.05, 0.35)) * (0.9 + 0.1 * openness);
    if (centerScale > 0) {
      const centerWidth = radius * 0.62 * centerScale;
      const centerHeight = (centerWidth * center.naturalHeight) / center.naturalWidth;
      context.drawImage(
        center,
        -centerWidth / 2,
        -lift - centerHeight / 2,
        centerWidth,
        centerHeight,
      );
    }
  }
  context.restore();
  return true;
}

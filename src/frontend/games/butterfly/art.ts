import { canvasArt } from "../../core/canvasArt";

// Testers: «бабочек бы поинтереснее». Drawn butterflies assembled from a body and
// the left half of the wings (the right half is its mirror), so the wings can beat
// around the body while the body stays still. The code-drawn shape stays as a
// fallback until the pictures load.
export const butterflyColors = ["blue", "orange", "pink", "purple", "teal", "yellow"];

export const butterflyArtIds = [
  "butterfly/body",
  ...butterflyColors.map((color) => `butterfly/${color}-wing-left`),
];

/**
 * Draws a butterfly seen from above, centred on the origin, `wingHeight` tall.
 * `open` is 0..1: 1 — wings spread, near 0 — folded up over the back.
 * Returns false while the pictures are loading.
 */
export function drawDrawnButterfly(
  context: CanvasRenderingContext2D,
  color: number,
  wingHeight: number,
  open: number,
) {
  const body = canvasArt("butterfly/body");
  const wing = canvasArt(`butterfly/${butterflyColors[color % butterflyColors.length]}-wing-left`);
  if (!body || !wing) return false;
  const wingWidth = (wingHeight * wing.naturalWidth) / wing.naturalHeight;
  // Measured on the drawn whole butterfly: the body is 71 % of the wing height and
  // starts 15 % below the top of the wings; the wing roots meet on the body's axis.
  const bodyHeight = wingHeight * 0.71;
  const bodyWidth = (bodyHeight * body.naturalWidth) / body.naturalHeight;
  const spread = 0.18 + 0.82 * open;
  for (const side of [-1, 1]) {
    context.save();
    context.scale(side * spread, 1);
    context.drawImage(wing, -wingWidth, -wingHeight / 2, wingWidth, wingHeight);
    context.restore();
  }
  context.drawImage(
    body,
    -bodyWidth / 2,
    -wingHeight / 2 + wingHeight * 0.15,
    bodyWidth,
    bodyHeight,
  );
  return true;
}

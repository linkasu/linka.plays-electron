import { canvasArt } from "../../core/canvasArt";
import { clamp01 } from "../../core/motion";

// Testers asked for drawn pictures. A drawn firefly seen from above, assembled
// from a body and two wings: the wings beat by folding towards the body around
// their roots, the body stays still and its tail glows brighter or dimmer.
// Positions are measured on the drawn whole firefly, in body widths and heights.

export const fireflyArtIds = [
  "firefly-meadow/body-lit",
  "firefly-meadow/body-dark",
  "firefly-meadow/wing-left",
  "firefly-meadow/wing-right",
];

/** Whole firefly with spread wings is this many body widths wide. */
const spanInBodies = 2.21;
const wings = [
  { artId: "firefly-meadow/wing-left", x: -0.561, y: 0.159, width: 0.812, rootX: 1, side: -1 },
  { artId: "firefly-meadow/wing-right", x: 0.757, y: 0.157, width: 0.79, rootX: 0, side: 1 },
];

/**
 * Draws the firefly centred on (x, y), `width` wide with wings spread.
 * `beat` is the wing phase in radians, `glow` 0..1 lights the tail.
 * Returns false while the pictures are loading.
 */
export function drawDrawnFirefly(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  beat: number,
  glow: number,
) {
  const lit = canvasArt("firefly-meadow/body-lit");
  const dark = canvasArt("firefly-meadow/body-dark");
  if (!lit || !dark) return false;
  const bodyWidth = width / spanInBodies;
  const bodyHeight = (bodyWidth * lit.naturalHeight) / lit.naturalWidth;
  const left = x - bodyWidth / 2;
  const top = y - bodyHeight / 2;
  const fold = 0.5 + 0.5 * Math.sin(beat);

  for (const wing of wings) {
    const art = canvasArt(wing.artId);
    if (!art) return false;
    const wingWidth = wing.width * bodyWidth;
    const wingHeight = (wingWidth * art.naturalHeight) / art.naturalWidth;
    const rootX = left + (wing.x * bodyWidth + wing.rootX * wingWidth);
    const rootY = top + wing.y * bodyHeight + wingHeight * 0.45;
    context.save();
    context.translate(rootX, rootY);
    // Folding up towards the viewer: narrower and swept back a little.
    context.rotate(wing.side * fold * 0.28);
    context.scale(1 - fold * 0.5, 1);
    context.drawImage(art, -wing.rootX * wingWidth, -wingHeight * 0.45, wingWidth, wingHeight);
    context.restore();
  }

  const alpha = context.globalAlpha;
  context.drawImage(dark, left, top, bodyWidth, bodyHeight);
  context.globalAlpha = alpha * clamp01(glow);
  context.drawImage(lit, left, top, bodyWidth, bodyHeight);
  context.globalAlpha = alpha;
  return true;
}

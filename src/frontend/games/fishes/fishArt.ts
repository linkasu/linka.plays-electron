import { canvasArt } from "../../core/canvasArt";

// Testers asked for drawn fish. Four drawn fish, each with a separate tail that
// wags; a fish takes the drawn colour closest to its hue.
const fishColors = [
  { name: "orange", hue: 24 },
  { name: "yellow", hue: 48 },
  { name: "blue", hue: 205 },
  { name: "purple", hue: 280 },
];

export const fishArtIds = fishColors.flatMap(({ name }) => [
  `fishes/${name}-body`,
  `fishes/${name}-tail`,
]);

function hueDistance(left: number, right: number) {
  const diff = Math.abs((((left - right) % 360) + 360) % 360);
  return Math.min(diff, 360 - diff);
}

export function fishColorForHue(hue: number) {
  return fishColors.reduce((best, color) =>
    hueDistance(color.hue, hue) < hueDistance(best.hue, hue) ? color : best,
  ).name;
}

/**
 * Draws a drawn fish facing +x, centred on the origin and `length` long.
 * Returns false while the pictures are loading.
 */
export function drawDrawnFish(
  context: CanvasRenderingContext2D,
  hue: number,
  length: number,
  wag: number,
) {
  const color = fishColorForHue(hue);
  const body = canvasArt(`fishes/${color}-body`);
  const tail = canvasArt(`fishes/${color}-tail`);
  if (!body || !tail) return false;

  // The tail is 62 % of the body height and tucks 15 % of its width under the body.
  // In the picture its stub is on the left and the fins open to the right, so it is
  // mirrored to trail behind a fish that faces +x.
  const bodyAspect = body.naturalHeight / body.naturalWidth;
  const tailAspect = tail.naturalWidth / tail.naturalHeight;
  const bodyWidth = length / (1 + 0.85 * 0.62 * bodyAspect * tailAspect);
  const bodyHeight = bodyWidth * bodyAspect;
  const tailHeight = bodyHeight * 0.62;
  const tailWidth = tailHeight * tailAspect;
  const jointX = -length / 2 + tailWidth * 0.85;
  const jointY = bodyHeight * 0.05;

  context.save();
  context.translate(jointX, jointY);
  context.rotate(Math.sin(wag) * 0.28);
  context.scale(-1, 1);
  context.drawImage(tail, -tailWidth * 0.15, -tailHeight / 2, tailWidth, tailHeight);
  context.restore();
  context.drawImage(body, jointX - bodyWidth * 0.02, -bodyHeight / 2, bodyWidth, bodyHeight);
  return true;
}

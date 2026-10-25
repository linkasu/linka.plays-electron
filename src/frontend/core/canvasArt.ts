import { gameArtSrc } from "./gameArt";

const images = new Map<string, HTMLImageElement>();

/**
 * Drawn picture (core/gameArt.ts) for a canvas game. Returns undefined until the
 * file has loaded, so the caller keeps drawing its own shape in the meantime.
 */
export function canvasArt(artId: string): HTMLImageElement | undefined {
  let image = images.get(artId);
  if (!image) {
    if (typeof Image === "undefined") return undefined;
    image = new Image();
    image.src = gameArtSrc(artId);
    images.set(artId, image);
  }
  return image.complete && image.naturalWidth > 0 ? image : undefined;
}

/** Starts loading pictures before the first frame needs them. */
export function preloadCanvasArt(artIds: readonly string[]) {
  for (const artId of artIds) canvasArt(artId);
}

/** Draws the picture centred on (x, y), `width` wide, keeping its proportions. */
export function drawCanvasArt(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
) {
  const height = (width * image.naturalHeight) / image.naturalWidth;
  context.drawImage(image, x - width / 2, y - height / 2, width, height);
  return height;
}

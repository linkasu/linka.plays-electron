import { resolvePublicAssetUrl } from "./publicAsset";

const loadedWordImages = new Map<string, HTMLImageElement>();

export function wordImageSrc(wordId: string, base?: string, locationHref?: string) {
  return resolvePublicAssetUrl(`images/words/${encodeURIComponent(wordId)}.png`, base, locationHref);
}

export function loadWordImage(wordId: string) {
  const existing = loadedWordImages.get(wordId);
  if (existing) return existing;

  const image = new Image();
  image.src = wordImageSrc(wordId);
  loadedWordImages.set(wordId, image);
  return image;
}

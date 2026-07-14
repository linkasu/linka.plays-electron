const loadedWordImages = new Map<string, HTMLImageElement>();

export function wordImageSrc(wordId: string) {
  return `/images/words/${encodeURIComponent(wordId)}.png`;
}

export function loadWordImage(wordId: string) {
  const existing = loadedWordImages.get(wordId);
  if (existing) return existing;

  const image = new Image();
  image.src = wordImageSrc(wordId);
  loadedWordImages.set(wordId, image);
  return image;
}

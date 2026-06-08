export type PlacementPoint = { x: number; y: number };

export type PlacementArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TargetPlacementOptions = {
  viewportWidth?: number;
  viewportHeight?: number;
  targetWidth: number;
  targetHeight: number;
  hudHeight?: number;
  sidePadding?: number;
  bottomPadding?: number;
  previous?: PlacementPoint;
  minDistance?: number;
  attempts?: number;
  random?: () => number;
};

const defaultHudHeight = 112;
const defaultSidePadding = 32;
const defaultBottomPadding = 64;

function viewportWidth(width?: number) {
  return width ?? window.innerWidth;
}

function viewportHeight(height?: number) {
  return height ?? window.innerHeight;
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

export function createSafePlacementArea(options: Pick<TargetPlacementOptions, "viewportWidth" | "viewportHeight" | "hudHeight" | "sidePadding" | "bottomPadding"> = {}): PlacementArea {
  const width = viewportWidth(options.viewportWidth);
  const height = viewportHeight(options.viewportHeight);
  const sidePadding = options.sidePadding ?? defaultSidePadding;
  const top = options.hudHeight ?? defaultHudHeight;
  const bottomPadding = options.bottomPadding ?? defaultBottomPadding;

  return {
    x: sidePadding,
    y: top,
    width: Math.max(1, width - sidePadding * 2),
    height: Math.max(1, height - top - bottomPadding)
  };
}

export function percentToPixels(point: PlacementPoint, viewport: { width?: number; height?: number } = {}): PlacementPoint {
  return {
    x: viewportWidth(viewport.width) * point.x / 100,
    y: viewportHeight(viewport.height) * point.y / 100
  };
}

export function pixelsToPercent(point: PlacementPoint, viewport: { width?: number; height?: number } = {}): PlacementPoint {
  return {
    x: viewportWidth(viewport.width) ? point.x / viewportWidth(viewport.width) * 100 : 50,
    y: viewportHeight(viewport.height) ? point.y / viewportHeight(viewport.height) * 100 : 50
  };
}

export function clampTargetCenter(point: PlacementPoint, options: TargetPlacementOptions): PlacementPoint {
  const area = createSafePlacementArea(options);
  const halfWidth = options.targetWidth / 2;
  const halfHeight = options.targetHeight / 2;

  return {
    x: clamp(point.x, area.x + halfWidth, area.x + area.width - halfWidth),
    y: clamp(point.y, area.y + halfHeight, area.y + area.height - halfHeight)
  };
}

export function clampTargetCenterPercent(point: PlacementPoint, options: TargetPlacementOptions): PlacementPoint {
  const viewport = { width: viewportWidth(options.viewportWidth), height: viewportHeight(options.viewportHeight) };
  return pixelsToPercent(clampTargetCenter(percentToPixels(point, viewport), options), viewport);
}

export function randomTargetCenterPercent(options: TargetPlacementOptions): PlacementPoint {
  const viewport = { width: viewportWidth(options.viewportWidth), height: viewportHeight(options.viewportHeight) };
  const area = createSafePlacementArea(options);
  const halfWidth = options.targetWidth / 2;
  const halfHeight = options.targetHeight / 2;
  const minX = area.x + halfWidth;
  const maxX = area.x + area.width - halfWidth;
  const minY = area.y + halfHeight;
  const maxY = area.y + area.height - halfHeight;
  const random = options.random ?? Math.random;
  const attempts = options.attempts ?? 12;
  const previous = options.previous ? percentToPixels(options.previous, viewport) : undefined;
  const minDistance = options.minDistance ?? 0;
  let best = clampTargetCenter({ x: minX, y: minY }, options);
  let bestDistance = -1;

  for (let index = 0; index < attempts; index++) {
    const candidate = clampTargetCenter({
      x: minX + random() * Math.max(0, maxX - minX),
      y: minY + random() * Math.max(0, maxY - minY)
    }, options);

    const distance = previous ? Math.hypot(candidate.x - previous.x, candidate.y - previous.y) : Number.POSITIVE_INFINITY;
    if (distance >= minDistance) return pixelsToPercent(candidate, viewport);
    if (distance > bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return pixelsToPercent(best, viewport);
}

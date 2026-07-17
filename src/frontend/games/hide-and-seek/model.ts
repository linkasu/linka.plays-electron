export type HideAndSeekRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HideAndSeekTargetPlacement = {
  x: number;
  y: number;
};

export type HideAndSeekLayout = {
  targetWidth: number;
  targetHeight: number;
  hitPadding: number;
  placements: HideAndSeekTargetPlacement[];
};

export type HideAndSeekLayoutOptions = {
  viewportWidth: number;
  viewportHeight: number;
  targetScale: number;
  targetCount?: number;
  obstacles?: HideAndSeekRect[];
};

const baseTargetWidth = 180;
const baseTargetHeight = 170;
const edgePadding = 12;
const targetGap = 12;
const hitPadding = 16;
const compactHeight = 700;
const minimumScale = 0.35;

const placementAnchors = [
  { x: 0.16, y: 0.2 },
  { x: 0.5, y: 0.2 },
  { x: 0.84, y: 0.2 },
  { x: 0.28, y: 0.8 },
  { x: 0.72, y: 0.8 }
];

export function hideAndSeekFallbackObstacles(viewportWidth: number, viewportHeight: number): HideAndSeekRect[] {
  const compact = viewportHeight <= compactHeight;
  const promptWidth = compact ? Math.min(480, viewportWidth - 32) : Math.min(444, viewportWidth - 64);
  const promptImageSize = Math.min(128, Math.max(80, viewportWidth * 0.12));

  return [
    { x: 0, y: 0, width: viewportWidth, height: compact ? 112 : 118 },
    {
      x: compact ? (viewportWidth - promptWidth) / 2 : 32,
      y: compact ? 124 : 118,
      width: promptWidth,
      height: compact ? 58 : promptImageSize + 194
    }
  ];
}

export function hideAndSeekRectsOverlap(first: HideAndSeekRect, second: HideAndSeekRect) {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
}

export function hideAndSeekEffectiveTargetBounds(
  placement: HideAndSeekTargetPlacement,
  targetWidth: number,
  targetHeight: number,
  targetHitPadding = hitPadding
): HideAndSeekRect {
  const width = targetWidth + targetHitPadding * 2;
  const height = targetHeight + targetHitPadding * 2;
  return {
    x: placement.x - width / 2,
    y: placement.y - height / 2,
    width,
    height
  };
}

function placementArea(options: HideAndSeekLayoutOptions, obstacles: HideAndSeekRect[]) {
  const fullWidthBottom = obstacles
    .filter((obstacle) => obstacle.x <= edgePadding && obstacle.x + obstacle.width >= options.viewportWidth - edgePadding)
    .reduce((bottom, obstacle) => Math.max(bottom, obstacle.y + obstacle.height), edgePadding);
  const compactBottom = options.viewportHeight <= compactHeight
    ? obstacles.reduce((bottom, obstacle) => Math.max(bottom, obstacle.y + obstacle.height), fullWidthBottom)
    : fullWidthBottom;
  const top = Math.min(options.viewportHeight - edgePadding, compactBottom + targetGap);

  return {
    x: edgePadding,
    y: top,
    width: Math.max(1, options.viewportWidth - edgePadding * 2),
    height: Math.max(1, options.viewportHeight - top - edgePadding)
  };
}

function createCandidates(
  area: HideAndSeekRect,
  targetWidth: number,
  targetHeight: number,
  obstacles: HideAndSeekRect[]
) {
  const effectiveWidth = targetWidth + hitPadding * 2;
  const effectiveHeight = targetHeight + hitPadding * 2;
  const columns = Math.floor((area.width + targetGap) / (effectiveWidth + targetGap));
  const rows = Math.floor((area.height + targetGap) / (effectiveHeight + targetGap));
  if (columns < 1 || rows < 1) return [];

  const usedWidth = columns * effectiveWidth + (columns - 1) * targetGap;
  const usedHeight = rows * effectiveHeight + (rows - 1) * targetGap;
  const startX = area.x + (area.width - usedWidth) / 2 + effectiveWidth / 2;
  const startY = area.y + (area.height - usedHeight) / 2 + effectiveHeight / 2;
  const candidates: HideAndSeekTargetPlacement[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const placement = {
        x: startX + column * (effectiveWidth + targetGap),
        y: startY + row * (effectiveHeight + targetGap)
      };
      const bounds = hideAndSeekEffectiveTargetBounds(placement, targetWidth, targetHeight);
      if (obstacles.every((obstacle) => !hideAndSeekRectsOverlap(bounds, obstacle))) candidates.push(placement);
    }
  }

  return candidates;
}

function selectSpreadPlacements(candidates: HideAndSeekTargetPlacement[], count: number, area: HideAndSeekRect) {
  const remaining = [...candidates];
  const selected: HideAndSeekTargetPlacement[] = [];

  for (let index = 0; index < count; index += 1) {
    const anchor = placementAnchors[index] ?? {
      x: ((index * 0.61803398875) % 1),
      y: ((index * 0.38196601125) % 1)
    };
    const anchorPoint = {
      x: area.x + area.width * anchor.x,
      y: area.y + area.height * anchor.y
    };
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let candidateIndex = 0; candidateIndex < remaining.length; candidateIndex += 1) {
      const candidate = remaining[candidateIndex];
      const distance = Math.hypot(candidate.x - anchorPoint.x, candidate.y - anchorPoint.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = candidateIndex;
      }
    }

    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return selected;
}

export function createHideAndSeekLayout(options: HideAndSeekLayoutOptions): HideAndSeekLayout {
  const targetCount = options.targetCount ?? 5;
  const obstacles = options.obstacles ?? hideAndSeekFallbackObstacles(options.viewportWidth, options.viewportHeight);
  const area = placementArea(options, obstacles);
  const desiredScale = Math.max(minimumScale, options.targetScale);
  const stepCount = Math.ceil((desiredScale - minimumScale) * 100);

  for (let step = 0; step <= stepCount; step += 1) {
    const scale = Math.max(minimumScale, Math.round((desiredScale - step * 0.01) * 100) / 100);
    const targetWidth = baseTargetWidth * scale;
    const targetHeight = baseTargetHeight * scale;
    const candidates = createCandidates(area, targetWidth, targetHeight, obstacles);
    if (candidates.length < targetCount) continue;

    return {
      targetWidth,
      targetHeight,
      hitPadding,
      placements: selectSpreadPlacements(candidates, targetCount, area)
    };
  }

  throw new RangeError("HideAndSeek cannot place all gaze targets in the available viewport");
}

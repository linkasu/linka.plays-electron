export type CloudLobe = {
  offsetX: number;
  offsetY: number;
  radius: number;
  seed: number;
  speed: number;
};

export type CloudVisualBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type CloudPlacement = {
  x: number;
  y: number;
  baseRx: number;
  baseRy: number;
  visualBounds: CloudVisualBounds;
};

export type CloudPlacementArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CloudPlacementLayout = {
  placements: CloudPlacement[];
  area: CloudPlacementArea;
  count: number;
  nominalRadius: number;
  radiusScale: number;
  template: string;
};

export type CreateCloudPlacementOptions = {
  viewportWidth: number;
  viewportHeight: number;
  targetScale: number;
  desiredCount?: number;
  random?: () => number;
  templateOffset?: number;
};

export const cloudRenderGeometry = {
  lobeWobbleX: 0.035,
  lobeWobbleY: 0.06,
  lobePulseX: 0.035,
  lobePulseY: 0.045,
  lobeOpenRadiusX: 0.07,
  lobeOpenRadiusY: 0.02,
  pushProximity: 1.08,
  pushBase: 0.22,
  pushRadius: 0.12,
  pushY: 0.48,
  clearingLift: 0.24,
  shadowOffsetY: 0.42,
  shadowRadiusX: 1.18,
  shadowRadiusY: 0.68,
  progressRadius: 0.78,
  progressOpenRadius: 0.08,
  progressLineWidth: 0.028
} as const;

const cloudLobeTemplates = [
  { offsetX: -0.72, offsetY: 0.08, radius: 0.58, seedOffset: 0.2, speed: 0.18 },
  { offsetX: -0.38, offsetY: -0.14, radius: 0.72, seedOffset: 1.1, speed: 0.16 },
  { offsetX: 0, offsetY: -0.24, radius: 0.84, seedOffset: 2.4, speed: 0.14 },
  { offsetX: 0.4, offsetY: -0.1, radius: 0.74, seedOffset: 3.6, speed: 0.17 },
  { offsetX: 0.72, offsetY: 0.1, radius: 0.6, seedOffset: 4.5, speed: 0.2 },
  { offsetX: -0.04, offsetY: 0.18, radius: 0.9, seedOffset: 5.7, speed: 0.13 }
] as const;

const templatesByCount: Record<number, Array<{ id: string; rows: number[] }>> = {
  1: [{ id: "single", rows: [1] }],
  2: [{ id: "two-wide", rows: [2] }, { id: "two-tall", rows: [1, 1] }],
  3: [{ id: "three-wide", rows: [3] }, { id: "two-one", rows: [2, 1] }, { id: "one-two", rows: [1, 2] }],
  4: [{ id: "two-by-two", rows: [2, 2] }, { id: "four-wide", rows: [4] }, { id: "one-two-one", rows: [1, 2, 1] }],
  5: [{ id: "three-two", rows: [3, 2] }, { id: "two-three", rows: [2, 3] }, { id: "two-two-one", rows: [2, 2, 1] }],
  6: [{ id: "three-by-two", rows: [3, 3] }, { id: "two-by-three", rows: [2, 2, 2] }, { id: "three-two-one", rows: [3, 2, 1] }]
};

const maximumCloudCount = 6;
const minimumNominalRadius = 101.1;
const minimumGap = 8;

type CloudProfile = {
  sizeFactor: number;
  aspectRatio: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function createCloudLobes(seed: number): CloudLobe[] {
  return cloudLobeTemplates.map((lobe) => ({
    offsetX: lobe.offsetX,
    offsetY: lobe.offsetY,
    radius: lobe.radius,
    seed: seed + lobe.seedOffset,
    speed: lobe.speed
  }));
}

export function cloudPlacementArea(viewportWidth: number, viewportHeight: number): CloudPlacementArea {
  const sidePadding = Math.max(42, viewportWidth * 0.06);
  const top = Math.max(104, viewportHeight * 0.16);
  const bottomPadding = Math.max(64, viewportHeight * 0.08);

  return {
    x: sidePadding,
    y: top,
    width: Math.max(1, viewportWidth - sidePadding * 2),
    height: Math.max(1, viewportHeight - top - bottomPadding)
  };
}

export function cloudVisualBounds(baseRx: number, baseRy: number): CloudVisualBounds {
  const geometry = cloudRenderGeometry;
  const progressExtent = baseRx * (geometry.progressRadius + geometry.progressOpenRadius)
    + Math.max(2, baseRx * geometry.progressLineWidth / 2);
  const bounds: CloudVisualBounds = {
    left: Math.max(baseRx * geometry.shadowRadiusX, progressExtent),
    right: Math.max(baseRx * geometry.shadowRadiusX, progressExtent),
    top: Math.max(baseRy * (geometry.shadowRadiusY - geometry.shadowOffsetY), progressExtent),
    bottom: Math.max(baseRy * (geometry.shadowRadiusY + geometry.shadowOffsetY), progressExtent)
  };

  for (const lobe of cloudLobeTemplates) {
    const push = baseRx * geometry.pushProximity * (geometry.pushBase + lobe.radius * geometry.pushRadius);
    const radiusX = baseRx * lobe.radius * (1 + geometry.lobePulseX + geometry.lobeOpenRadiusX);
    const radiusY = baseRy * lobe.radius * (1 + geometry.lobePulseY);
    const wobbleX = baseRx * geometry.lobeWobbleX;
    const wobbleY = baseRy * geometry.lobeWobbleY;
    const centerX = lobe.offsetX * baseRx;
    const centerY = lobe.offsetY * baseRy;

    bounds.left = Math.max(bounds.left, -centerX + wobbleX + push + radiusX);
    bounds.right = Math.max(bounds.right, centerX + wobbleX + push + radiusX);
    bounds.top = Math.max(bounds.top, -centerY + wobbleY + push * geometry.pushY + baseRy * geometry.clearingLift + radiusY);
    bounds.bottom = Math.max(bounds.bottom, centerY + wobbleY + push * geometry.pushY + radiusY);
  }

  return bounds;
}

export function cloudPlacementsOverlap(first: CloudPlacement, second: CloudPlacement) {
  return first.x + first.visualBounds.right > second.x - second.visualBounds.left
    && first.x - first.visualBounds.left < second.x + second.visualBounds.right
    && first.y + first.visualBounds.bottom > second.y - second.visualBounds.top
    && first.y - first.visualBounds.top < second.y + second.visualBounds.bottom;
}

function desiredNominalRadius(viewportWidth: number, viewportHeight: number, targetScale: number) {
  const limit = Math.min(viewportWidth * 0.22, viewportHeight * 0.18);
  return Math.min(210, Math.max(118, limit * targetScale));
}

function rotatedTemplates(count: number, offset: number) {
  const templates = templatesByCount[count] ?? templatesByCount[1];
  const start = ((Math.floor(offset) % templates.length) + templates.length) % templates.length;
  return [...templates.slice(start), ...templates.slice(0, start)];
}

function placeWithTemplate(
  profiles: CloudProfile[],
  nominalRadius: number,
  area: CloudPlacementArea,
  gap: number,
  template: { id: string; rows: number[] }
): CloudPlacementLayout | undefined {
  const placements = profiles.map((profile) => {
    const baseRx = nominalRadius * profile.sizeFactor;
    const baseRy = baseRx * profile.aspectRatio;
    return { x: 0, y: 0, baseRx, baseRy, visualBounds: cloudVisualBounds(baseRx, baseRy) };
  });
  const rows: CloudPlacement[][] = [];
  let placementIndex = 0;

  for (const rowLength of template.rows) {
    rows.push(placements.slice(placementIndex, placementIndex + rowLength));
    placementIndex += rowLength;
  }
  if (placementIndex !== placements.length || rows.some((row) => row.length === 0)) return undefined;

  const rowWidths = rows.map((row) => row.reduce((width, placement) => width + placement.visualBounds.left + placement.visualBounds.right, 0) + gap * (row.length - 1));
  const rowHeights = rows.map((row) => Math.max(...row.map((placement) => placement.visualBounds.top + placement.visualBounds.bottom)));
  const totalHeight = rowHeights.reduce((height, rowHeight) => height + rowHeight, 0) + gap * (rows.length - 1);
  if (Math.max(...rowWidths) > area.width || totalHeight > area.height) return undefined;

  let rowTop = area.y + (area.height - totalHeight) / 2;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    let left = area.x + (area.width - rowWidths[rowIndex]) / 2;
    for (const placement of row) {
      const height = placement.visualBounds.top + placement.visualBounds.bottom;
      placement.x = left + placement.visualBounds.left;
      placement.y = rowTop + (rowHeights[rowIndex] - height) / 2 + placement.visualBounds.top;
      left += placement.visualBounds.left + placement.visualBounds.right + gap;
    }
    rowTop += rowHeights[rowIndex] + gap;
  }

  return {
    placements,
    area,
    count: placements.length,
    nominalRadius,
    radiusScale: 1,
    template: template.id
  };
}

export function createCloudPlacementLayout(options: CreateCloudPlacementOptions): CloudPlacementLayout {
  const viewportWidth = Math.max(1, options.viewportWidth);
  const viewportHeight = Math.max(1, options.viewportHeight);
  const desiredCount = clamp(Math.floor(options.desiredCount ?? maximumCloudCount), 1, maximumCloudCount);
  const random = options.random ?? Math.random;
  const area = cloudPlacementArea(viewportWidth, viewportHeight);
  const desiredRadius = desiredNominalRadius(viewportWidth, viewportHeight, options.targetScale);
  const minimumRadius = Math.min(desiredRadius, minimumNominalRadius);
  const gap = Math.max(minimumGap, Math.min(viewportWidth, viewportHeight) * 0.012);
  const templateOffset = options.templateOffset ?? Math.floor(random() * maximumCloudCount);
  const profiles = Array.from({ length: desiredCount }, () => ({
    sizeFactor: 0.94 + random() * 0.12,
    aspectRatio: 0.42 + random() * 0.12
  }));

  for (let count = desiredCount; count >= 1; count -= 1) {
    const countProfiles = profiles.slice(0, count);
    const templates = rotatedTemplates(count, templateOffset);
    const findLayout = (radius: number) => {
      for (const template of templates) {
        const layout = placeWithTemplate(countProfiles, radius, area, gap, template);
        if (layout) return layout;
      }
      return undefined;
    };
    let best = findLayout(minimumRadius);
    if (!best) continue;

    let low = minimumRadius;
    let high = desiredRadius;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const radius = (low + high) / 2;
      const candidate = findLayout(radius);
      if (candidate) {
        best = candidate;
        low = radius;
      } else {
        high = radius;
      }
    }

    best.radiusScale = best.nominalRadius / desiredRadius;
    return best;
  }

  const profile = profiles[0];
  const template = templatesByCount[1][0];
  let low = 1;
  let high = minimumRadius;
  let best = placeWithTemplate([profile], low, area, gap, template);
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const radius = (low + high) / 2;
    const candidate = placeWithTemplate([profile], radius, area, gap, template);
    if (candidate) {
      best = candidate;
      low = radius;
    } else {
      high = radius;
    }
  }
  if (!best) throw new Error("Cloud placement area is too small.");
  best.radiusScale = best.nominalRadius / desiredRadius;
  return best;
}

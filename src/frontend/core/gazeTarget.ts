export type Point = { x: number; y: number };

export type AdaptiveGazeHitRadiusOptions = {
  viewportWidth?: number;
  viewportHeight?: number;
  edgeBoost?: number;
  edgeBandRatio?: number;
};

function viewportWidth(width?: number) {
  return width ?? window.innerWidth;
}

function viewportHeight(height?: number) {
  return height ?? window.innerHeight;
}

function edgeFactor(position: number, size: number, bandRatio: number) {
  const band = Math.max(1, size * bandRatio);
  return Math.max(0, 1 - Math.min(position, size - position) / band);
}

export function adaptiveGazeHitRadius(point: Point, baseRadius: number, options: AdaptiveGazeHitRadiusOptions = {}) {
  const width = viewportWidth(options.viewportWidth);
  const height = viewportHeight(options.viewportHeight);
  const edgeBoost = options.edgeBoost ?? 0.18;
  const bandRatio = options.edgeBandRatio ?? 0.16;
  const boost = Math.max(edgeFactor(point.x, width, bandRatio), edgeFactor(point.y, height, bandRatio));

  return baseRadius * (1 + boost * edgeBoost);
}

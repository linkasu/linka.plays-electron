export type Point = {
  x: number;
  y: number;
};

export type ArcProjection = Point & {
  distance: number;
  ratio: number;
};

export const orchestraConductorMaxBeats = 8;

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function sampleQuadraticArc(start: Point, control: Point, end: Point, segments = 32): Point[] {
  const safeSegments = Math.max(2, Math.floor(segments));
  const points: Point[] = [];

  for (let index = 0; index <= safeSegments; index += 1) {
    const t = index / safeSegments;
    const inverse = 1 - t;
    points.push({
      x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
      y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y
    });
  }

  return points;
}

export function createOrchestraArcPoints(width: number, height: number): Point[] {
  const side = Math.max(54, width * 0.11);
  const top = Math.max(132, height * 0.22);
  const bottom = height - Math.max(112, height * 0.18);

  return sampleQuadraticArc(
    { x: side, y: bottom },
    { x: width * 0.5, y: top },
    { x: width - side, y: bottom },
    44
  );
}

export function arcLength(points: Point[]) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) length += distance(points[index - 1], points[index]);
  return Math.max(1, length);
}

export function pointAtArcProgress(points: Point[], ratio: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const target = arcLength(points) * clamp(ratio, 0, 1);
  let walked = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = distance(start, end);

    if (walked + segmentLength >= target) {
      const local = segmentLength <= 0 ? 0 : (target - walked) / segmentLength;
      return {
        x: start.x + (end.x - start.x) * local,
        y: start.y + (end.y - start.y) * local
      };
    }

    walked += segmentLength;
  }

  return points[points.length - 1];
}

export function projectPointToArc(point: Point, points: Point[]): ArcProjection {
  if (points.length === 0) return { x: 0, y: 0, distance: Number.POSITIVE_INFINITY, ratio: 0 };
  if (points.length === 1) return { ...points[0], distance: distance(point, points[0]), ratio: 0 };

  const totalLength = arcLength(points);
  let walked = 0;
  let best: ArcProjection = { ...points[0], distance: Number.POSITIVE_INFINITY, ratio: 0 };

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const segmentLength = Math.hypot(dx, dy);
    const squaredLength = dx * dx + dy * dy;
    const local = squaredLength <= 0 ? 0 : clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / squaredLength, 0, 1);
    const candidate = { x: start.x + dx * local, y: start.y + dy * local };
    const candidateDistance = distance(point, candidate);

    if (candidateDistance < best.distance) {
      best = {
        ...candidate,
        distance: candidateDistance,
        ratio: clamp((walked + segmentLength * local) / totalLength, 0, 1)
      };
    }

    walked += segmentLength;
  }

  return best;
}

export function beatProgress(beat: number, maxBeats = orchestraConductorMaxBeats) {
  return clamp(beat / Math.max(1, maxBeats), 0, 1);
}

export function nextReachedBeat(progress: number, nextBeat: number, maxBeats = orchestraConductorMaxBeats, tolerance = 0.018) {
  if (nextBeat < 1 || nextBeat > maxBeats) return undefined;
  return progress >= beatProgress(nextBeat, maxBeats) - tolerance ? nextBeat : undefined;
}

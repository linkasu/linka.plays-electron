export type GazeTargetRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type GazeTargetCandidate = {
  id: string;
  rect: GazeTargetRect;
  enabled: boolean;
  visible: boolean;
  hitPadding: number;
  priority?: number;
};

export type GazeTargetPoint = { x: number; y: number };

function containsPoint(rect: GazeTargetRect, point: GazeTargetPoint, padding = 0) {
  return point.x >= rect.left - padding
    && point.x <= rect.right + padding
    && point.y >= rect.top - padding
    && point.y <= rect.bottom + padding;
}

function distanceToRect(rect: GazeTargetRect, point: GazeTargetPoint) {
  const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
  const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
  return Math.hypot(dx, dy);
}

function distanceToCenter(rect: GazeTargetRect, point: GazeTargetPoint) {
  return Math.hypot(point.x - (rect.left + rect.right) / 2, point.y - (rect.top + rect.bottom) / 2);
}

export function resolveGazeTarget(candidates: GazeTargetCandidate[], point: GazeTargetPoint) {
  return candidates
    .filter((candidate) => candidate.enabled && candidate.visible && containsPoint(candidate.rect, point, candidate.hitPadding))
    .map((candidate) => ({
      candidate,
      directHit: containsPoint(candidate.rect, point),
      rectDistance: distanceToRect(candidate.rect, point),
      centerDistance: distanceToCenter(candidate.rect, point)
    }))
    .sort((a, b) => {
      const priorityDifference = (b.candidate.priority ?? 0) - (a.candidate.priority ?? 0);
      if (priorityDifference) return priorityDifference;
      if (a.directHit !== b.directHit) return a.directHit ? -1 : 1;
      if (a.rectDistance !== b.rectDistance) return a.rectDistance - b.rectDistance;
      if (a.centerDistance !== b.centerDistance) return a.centerDistance - b.centerDistance;
      return a.candidate.id.localeCompare(b.candidate.id);
    })[0]?.candidate;
}

export function fishTravelSpeed(baseSpeed: number, motionSpeed: number, progressionSpeed: number, depthScale: number) {
  return baseSpeed * motionSpeed * progressionSpeed * (0.92 + depthScale * 0.2);
}

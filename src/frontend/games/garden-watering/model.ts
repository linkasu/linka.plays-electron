export type GardenFlowerGrowth = {
  growth: number;
  wateredSeconds: number;
  completed: boolean;
  bloomPulse: number;
};

export type GardenWateringInput = {
  deltaSeconds: number;
  distancePx: number;
  waterRadiusPx: number;
  growthPerSecond?: number;
  bloomPulseDecayPerSecond?: number;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function wateringStrength(distancePx: number, waterRadiusPx: number) {
  if (!Number.isFinite(distancePx) || !Number.isFinite(waterRadiusPx) || waterRadiusPx <= 0) return 0;
  if (distancePx >= waterRadiusPx) return 0;

  const fullStrengthRadius = waterRadiusPx * 0.35;
  if (distancePx <= fullStrengthRadius) return 1;

  const falloff = 1 - (distancePx - fullStrengthRadius) / Math.max(1, waterRadiusPx - fullStrengthRadius);
  return clamp01(falloff * falloff);
}

export function advanceFlowerGrowth(current: GardenFlowerGrowth, input: GardenWateringInput): GardenFlowerGrowth {
  const deltaSeconds = Math.max(0, input.deltaSeconds);
  const growthPerSecond = input.growthPerSecond ?? 0.24;
  const bloomPulseDecayPerSecond = input.bloomPulseDecayPerSecond ?? 1.15;
  const strength = current.completed ? 0 : wateringStrength(input.distancePx, input.waterRadiusPx);
  const nextGrowth = clamp01(current.growth + strength * growthPerSecond * deltaSeconds);

  return {
    growth: nextGrowth,
    wateredSeconds: current.wateredSeconds + (strength > 0 ? deltaSeconds * strength : 0),
    completed: current.completed || nextGrowth >= 1,
    bloomPulse: Math.max(0, strength, current.bloomPulse - bloomPulseDecayPerSecond * deltaSeconds)
  };
}

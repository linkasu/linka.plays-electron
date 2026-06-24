import type { SessionSettings } from "../../core/settings";
import { randomInt, shuffleItems } from "../../core/random";

export type ClockRound = {
  roundId: string;
  targetHour: number;
  prompt: string;
  choices: number[];
  correctIndex: number;
};

export function normalizeClockHour(hour: number) {
  return ((hour - 1) % 12 + 12) % 12 + 1;
}

export function formatClockHour(hour: number) {
  return `${normalizeClockHour(hour)}:00`;
}

export function formatClockHourSpeech(hour: number) {
  const normalized = normalizeClockHour(hour);
  if (normalized === 1) return "один час";
  if (normalized >= 2 && normalized <= 4) return `${normalized} часа`;
  return `${normalized} часов`;
}

function randomHour(random: () => number) {
  return randomInt(1, 12, random);
}

function choiceCount(settings: SessionSettings) {
  return settings.preset === "gentle" ? 2 : 4;
}

export function generateClockRound(settings: SessionSettings, roundIndex = 1, random = Math.random): ClockRound {
  const targetHour = randomHour(random);
  const choices = new Set([targetHour]);
  const nearbyHours = [-1, 1, -2, 2, -3, 3, -4, 4, -5, 5, 6].map((offset) => normalizeClockHour(targetHour + offset));

  for (const hour of shuffleItems(nearbyHours, random)) {
    if (choices.size < choiceCount(settings)) choices.add(hour);
  }

  const shuffled = shuffleItems([...choices], random);

  return {
    roundId: `clock:round:${roundIndex}`,
    targetHour,
    prompt: `Выбери ${formatClockHour(targetHour)}`,
    choices: shuffled,
    correctIndex: shuffled.indexOf(targetHour)
  };
}

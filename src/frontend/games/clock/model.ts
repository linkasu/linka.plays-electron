import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

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

function randomHour() {
  return 1 + Math.floor(Math.random() * 12);
}

function choiceCount(settings: SessionSettings) {
  return settings.preset === "gentle" ? 2 : 4;
}

export function generateClockRound(settings: SessionSettings, roundIndex = 1): ClockRound {
  const targetHour = randomHour();
  const choices = new Set([targetHour]);
  const nearbyHours = [-1, 1, -2, 2, -3, 3, -4, 4, -5, 5, 6].map((offset) => normalizeClockHour(targetHour + offset));

  for (const hour of shuffleItems(nearbyHours)) {
    if (choices.size < choiceCount(settings)) choices.add(hour);
  }

  const shuffled = shuffleItems([...choices]);

  return {
    roundId: `clock:round:${roundIndex}`,
    targetHour,
    prompt: `Выбери ${formatClockHour(targetHour)}`,
    choices: shuffled,
    correctIndex: shuffled.indexOf(targetHour)
  };
}

import { notesToLoadForMajorMelodies, softMajorMelodies, type MajorMelody } from "./majorMelodies";
import { notesToLoadForMinorMelodies, softMinorMelodies, type MinorMelody } from "./minorMelodies";

export type TherapeuticMelody = MajorMelody | MinorMelody;

export const softTherapeuticMelodies: TherapeuticMelody[] = [
  ...softMajorMelodies,
  ...softMinorMelodies
];

export function notesToLoadForSoftTherapeuticMelodies(melodies = softTherapeuticMelodies) {
  if (melodies === softTherapeuticMelodies) {
    return [...new Set([...notesToLoadForMajorMelodies(), ...notesToLoadForMinorMelodies()])].sort((a, b) => a - b);
  }

  return [...new Set(melodies.flatMap((melody) => melody.notesToLoad ?? []))].sort((a, b) => a - b);
}

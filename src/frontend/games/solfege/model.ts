export type SolfegeNote = {
  id: string;
  label: string;
  syllable: string;
  octaveLabel: string;
  frequency: number;
  color: string;
};

export const solfegeNotes: SolfegeNote[] = [
  { id: "do", label: "До", syllable: "до", octaveLabel: "C4", frequency: 261.63, color: "#ef9a9a" },
  { id: "re", label: "Ре", syllable: "ре", octaveLabel: "D4", frequency: 293.66, color: "#ffcc80" },
  { id: "mi", label: "Ми", syllable: "ми", octaveLabel: "E4", frequency: 329.63, color: "#fff176" },
  { id: "fa", label: "Фа", syllable: "фа", octaveLabel: "F4", frequency: 349.23, color: "#a5d6a7" },
  { id: "sol", label: "Соль", syllable: "соль", octaveLabel: "G4", frequency: 392, color: "#80deea" },
  { id: "la", label: "Ля", syllable: "ля", octaveLabel: "A4", frequency: 440, color: "#90caf9" },
  { id: "si", label: "Си", syllable: "си", octaveLabel: "B4", frequency: 493.88, color: "#ce93d8" },
  { id: "do-high", label: "До", syllable: "до", octaveLabel: "C5", frequency: 523.25, color: "#f48fb1" }
];

export const solfegeMaxSteps = solfegeNotes.length;

export function generateSolfegeSequence(random = Math.random) {
  const notes = [...solfegeNotes];
  for (let index = notes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [notes[index], notes[swapIndex]] = [notes[swapIndex], notes[index]];
  }
  return notes;
}

export function playedSolfegeNotes(step: number) {
  return solfegeNotes.slice(0, Math.max(0, Math.min(step, solfegeMaxSteps)));
}

export function nextSolfegeNote(step: number) {
  return solfegeNotes[step];
}

export function nextSolfegeSequenceNote(sequence: readonly SolfegeNote[], step: number) {
  return sequence[step];
}

export function solfegeChoiceNotes(step: number) {
  return solfegeNotes;
}

export function isExpectedSolfegeNote(noteId: string, step: number) {
  return nextSolfegeNote(step)?.id === noteId;
}

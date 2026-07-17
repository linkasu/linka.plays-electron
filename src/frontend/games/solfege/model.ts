export type SolfegeNote = {
  id: string;
  label: string;
  syllable: string;
  octaveLabel: string;
  frequency: number;
  color: string;
};

export type SolfegeMode = "guided" | "free";
export type SolfegeSelectionOutcome = "correct" | "mistake" | "free";

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

function notesById(...ids: string[]) {
  return ids.map((id) => {
    const note = solfegeNotes.find((candidate) => candidate.id === id);
    if (!note) throw new Error(`Unknown solfege note: ${id}`);
    return note;
  });
}

export const solfegeGuidedStages = [
  { id: "two-notes", sequence: notesById("do", "re") },
  { id: "three-notes", sequence: notesById("do", "re", "mi") },
  { id: "four-notes", sequence: notesById("do", "re", "mi", "fa") }
] as const;

export const solfegeMaxSteps = solfegeGuidedStages.reduce((total, stage) => total + stage.sequence.length, 0);

export function solfegeGuidedStageStart(stageIndex: number) {
  return solfegeGuidedStages.slice(0, stageIndex).reduce((total, stage) => total + stage.sequence.length, 0);
}

export function solfegeGuidedProgress(completedSteps: number) {
  const safeSteps = Math.max(0, Math.floor(completedSteps));

  for (let stageIndex = 0; stageIndex < solfegeGuidedStages.length; stageIndex += 1) {
    const stage = solfegeGuidedStages[stageIndex];
    const stageStart = solfegeGuidedStageStart(stageIndex);
    const noteIndex = safeSteps - stageStart;
    if (noteIndex < stage.sequence.length) return { stageIndex, stage, noteIndex, expectedNote: stage.sequence[noteIndex] };
  }

  return undefined;
}

export function solfegeChoiceNotes() {
  return solfegeNotes;
}

export function isExpectedSolfegeNote(noteId: string, completedSteps: number) {
  return solfegeGuidedProgress(completedSteps)?.expectedNote.id === noteId;
}

export function solfegeSelectionOutcome(mode: SolfegeMode, noteId: string, expectedNoteId?: string): SolfegeSelectionOutcome {
  if (mode === "free") return "free";
  return noteId === expectedNoteId ? "correct" : "mistake";
}

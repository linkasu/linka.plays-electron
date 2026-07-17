export type SoundSourceHintState = "hidden" | "revealed";

export type SoundSourceHintEvent = "new-round" | "mistake" | "hint-requested";

export function advanceSoundSourceHint(state: SoundSourceHintState, event: SoundSourceHintEvent): SoundSourceHintState {
  if (event === "new-round") return "hidden";
  if (event === "mistake" || event === "hint-requested") return "revealed";
  return state;
}

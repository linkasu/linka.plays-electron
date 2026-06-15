import { computed, onUnmounted, ref, type ComputedRef, type Ref, type ShallowRef } from "vue";
import type { ChoiceRound } from "../core/round";
import type { GameSessionState } from "../core/session";

export type ChoiceRoundFlowDelays = {
  promptOnMount?: number;
  promptOnNextRound?: number;
  promptReplayOnMistake?: number;
  responseOnSuccess?: number;
  responseOnMistake?: number;
  nextRoundDelay?: number;
  mistakeReleaseDelay?: number;
};

export type ChoiceRoundFlowOptions<T> = {
  session: GameSessionState;
  round: ShallowRef<ChoiceRound<T>> | Ref<ChoiceRound<T>>;
  nextRound: () => void;
  restartRoundGame: () => void;
  isSameChoice: (left: T, right: T) => boolean;
  buildAnswerPayload?: (choice: T, round: ChoiceRound<T>, isCorrect: boolean) => Record<string, unknown>;
  recordSuccess: (payload: Record<string, unknown>) => void;
  recordMistake: (payload: Record<string, unknown>) => void;
  recordHint?: (payload: Record<string, unknown>) => void;
  feedback?: {
    playSuccess?: () => void;
    playMistake?: () => void;
  };
  prompt?: {
    play: (assetId: string, delayMs?: number) => void;
    cancel: () => void;
    promptAssetId: (round: ChoiceRound<T>) => string | undefined;
    successAssetId?: string;
    mistakeAssetId?: string;
  };
  delays?: ChoiceRoundFlowDelays;
  finishOnMaxSteps?: boolean;
};

const defaultDelays: Required<ChoiceRoundFlowDelays> = {
  promptOnMount: 450,
  promptOnNextRound: 350,
  promptReplayOnMistake: 2400,
  responseOnSuccess: 980,
  responseOnMistake: 940,
  nextRoundDelay: 2600,
  mistakeReleaseDelay: 2200
};

export type ChoiceRoundFlow<T> = {
  hintedRoundId: Ref<string | undefined>;
  lastMistakeId: Ref<string | undefined>;
  pendingSelection: Ref<boolean>;
  hintedChoice: ComputedRef<T | undefined>;
  answer: (choice: T) => void;
  restart: () => void;
  start: () => void;
  dispose: () => void;
};

export function useChoiceRoundFlow<T extends { id: string }>(options: ChoiceRoundFlowOptions<T>): ChoiceRoundFlow<T> {
  const delays = { ...defaultDelays, ...(options.delays ?? {}) };
  const hintedRoundId = ref<string>();
  const lastMistakeId = ref<string>();
  const pendingSelection = ref(false);
  const finishOnMaxSteps = options.finishOnMaxSteps !== false;

  const timers = new Set<number>();

  function scheduleTimer(callback: () => void, delayMs: number) {
    const id = window.setTimeout(() => {
      timers.delete(id);
      callback();
    }, delayMs);
    timers.add(id);
    return id;
  }

  function clearTimers() {
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
  }

  function currentPromptAssetId() {
    const assetId = options.prompt?.promptAssetId(options.round.value);
    return assetId;
  }

  function playPrompt(delayMs: number) {
    const assetId = currentPromptAssetId();
    if (!assetId || !options.prompt) return;
    options.prompt.cancel();
    options.prompt.play(assetId, delayMs);
  }

  function playResponse(assetId: string | undefined, delayMs: number) {
    if (!assetId || !options.prompt) return;
    options.prompt.play(assetId, delayMs);
  }

  const hintedChoice = computed(() => {
    if (hintedRoundId.value !== options.round.value.roundId) return undefined;
    return options.round.value.target;
  });

  function buildPayload(choice: T, isCorrect: boolean) {
    const round = options.round.value;
    const base = {
      roundId: round.roundId,
      answerId: choice.id,
      targetId: round.target.id,
      isCorrect
    };
    const extra = options.buildAnswerPayload ? options.buildAnswerPayload(choice, round, isCorrect) : {};
    return { ...base, ...extra };
  }

  function answer(choice: T) {
    if (options.session.status !== "running" || pendingSelection.value) return;
    const round = options.round.value;
    const isCorrect = options.isSameChoice(choice, round.target);

    if (isCorrect) {
      pendingSelection.value = true;
      options.feedback?.playSuccess?.();
      options.recordSuccess(buildPayload(choice, true));
      hintedRoundId.value = undefined;
      lastMistakeId.value = undefined;
      playResponse(options.prompt?.successAssetId, delays.responseOnSuccess);

      if (options.session.status === "running" && (!finishOnMaxSteps || options.session.step < options.session.maxSteps)) {
        scheduleTimer(() => {
          if (options.session.status !== "running") {
            pendingSelection.value = false;
            return;
          }
          options.nextRound();
          pendingSelection.value = false;
          playPrompt(delays.promptOnNextRound);
        }, delays.nextRoundDelay);
      } else {
        scheduleTimer(() => {
          pendingSelection.value = false;
        }, delays.nextRoundDelay);
      }
      return;
    }

    pendingSelection.value = true;
    options.feedback?.playMistake?.();
    options.recordMistake(buildPayload(choice, false));
    options.recordHint?.({ roundId: round.roundId, targetId: round.target.id, reason: "wrong-choice" });
    hintedRoundId.value = round.roundId;
    lastMistakeId.value = choice.id;
    playResponse(options.prompt?.mistakeAssetId, delays.responseOnMistake);
    playPrompt(delays.promptReplayOnMistake);

    scheduleTimer(() => {
      pendingSelection.value = false;
      lastMistakeId.value = undefined;
    }, delays.mistakeReleaseDelay);
  }

  function start() {
    playPrompt(delays.promptOnMount);
  }

  function restart() {
    clearTimers();
    options.prompt?.cancel();
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    pendingSelection.value = false;
    options.restartRoundGame();
    playPrompt(delays.promptOnMount);
  }

  function dispose() {
    clearTimers();
  }

  onUnmounted(() => {
    dispose();
  });

  return { hintedRoundId, lastMistakeId, pendingSelection, hintedChoice, answer, restart, start, dispose };
}

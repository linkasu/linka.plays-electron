import { computed, shallowRef } from "vue";
import type { SessionStatus } from "../core/session";

type RoundGameSession = {
  status: SessionStatus;
};

export function useRoundGame<TRound>(options: {
  session: RoundGameSession;
  startSession: () => void;
  generateRound: (roundIndex: number) => TRound;
}) {
  let roundIndex = 1;
  const round = shallowRef(options.generateRound(roundIndex));
  const resultVisible = computed(() => options.session.status === "finished");

  function nextRound() {
    roundIndex += 1;
    round.value = options.generateRound(roundIndex);
  }

  function restart() {
    options.startSession();
    roundIndex = 1;
    round.value = options.generateRound(roundIndex);
  }

  return { round, resultVisible, nextRound, restart };
}

<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type PhraseKind = "greeting" | "request" | "thanks";

type SocialPhraseChoice = {
  id: string;
  kind: PhraseKind;
  emoji: string;
  text: string;
};

type SocialPhraseRound = {
  roundId: string;
  scene: string;
  prompt: string;
  partner: string;
  expectedKind: PhraseKind;
  choices: SocialPhraseChoice[];
};

const kindLabels: Record<PhraseKind, string> = {
  greeting: "приветствие",
  request: "просьба",
  thanks: "благодарность"
};

const kindHints: Record<PhraseKind, string> = {
  greeting: "Здесь можно поздороваться.",
  request: "Здесь можно попросить помощь или предмет.",
  thanks: "Здесь можно сказать спасибо."
};

const rounds: Omit<SocialPhraseRound, "roundId">[] = [
  {
    scene: "Утром ты видишь знакомого взрослого.",
    prompt: "Выбери фразу приветствия.",
    partner: "Взрослый улыбается и ждёт твою фразу.",
    expectedKind: "greeting",
    choices: [
      { id: "good-morning", kind: "greeting", emoji: "🌤️", text: "Доброе утро!" },
      { id: "water-please", kind: "request", emoji: "💧", text: "Можно воды?" },
      { id: "thank-you", kind: "thanks", emoji: "💛", text: "Спасибо!" }
    ]
  },
  {
    scene: "Тебе хочется пить.",
    prompt: "Выбери фразу просьбы.",
    partner: "Рядом стоит стакан с водой.",
    expectedKind: "request",
    choices: [
      { id: "hello", kind: "greeting", emoji: "👋", text: "Привет!" },
      { id: "may-i-have-water", kind: "request", emoji: "🥤", text: "Дай воды, пожалуйста" },
      { id: "thanks-help", kind: "thanks", emoji: "🙏", text: "Спасибо за помощь" }
    ]
  },
  {
    scene: "Тебе помогли открыть коробку.",
    prompt: "Выбери фразу благодарности.",
    partner: "Коробка открыта, и человек рядом ждёт ответа.",
    expectedKind: "thanks",
    choices: [
      { id: "hi", kind: "greeting", emoji: "😊", text: "Здравствуйте!" },
      { id: "help-please", kind: "request", emoji: "🤝", text: "Помоги, пожалуйста" },
      { id: "thank-open", kind: "thanks", emoji: "🎁", text: "Спасибо, что открыл" }
    ]
  },
  {
    scene: "В комнату пришёл друг.",
    prompt: "Выбери фразу приветствия.",
    partner: "Друг смотрит на тебя и машет рукой.",
    expectedKind: "greeting",
    choices: [
      { id: "friend-hi", kind: "greeting", emoji: "👋", text: "Привет!" },
      { id: "toy-please", kind: "request", emoji: "🧸", text: "Дай игрушку, пожалуйста" },
      { id: "thanks-friend", kind: "thanks", emoji: "⭐", text: "Спасибо тебе" }
    ]
  },
  {
    scene: "Нужная карточка лежит далеко.",
    prompt: "Выбери фразу просьбы.",
    partner: "Человек рядом может подать карточку.",
    expectedKind: "request",
    choices: [
      { id: "good-day", kind: "greeting", emoji: "☀️", text: "Добрый день!" },
      { id: "card-please", kind: "request", emoji: "🃏", text: "Подай карточку, пожалуйста" },
      { id: "thanks-card", kind: "thanks", emoji: "💚", text: "Спасибо за карточку" }
    ]
  },
  {
    scene: "Тебе дали любимую книгу.",
    prompt: "Выбери фразу благодарности.",
    partner: "Книга уже у тебя в руках.",
    expectedKind: "thanks",
    choices: [
      { id: "book-hello", kind: "greeting", emoji: "🙋", text: "Приветствую!" },
      { id: "read-please", kind: "request", emoji: "📖", text: "Почитай, пожалуйста" },
      { id: "thanks-book", kind: "thanks", emoji: "📚", text: "Спасибо за книгу" }
    ]
  },
  {
    scene: "Ты хочешь пройти к столу.",
    prompt: "Выбери фразу просьбы.",
    partner: "Проход узкий, нужно попросить место.",
    expectedKind: "request",
    choices: [
      { id: "table-hi", kind: "greeting", emoji: "🙂", text: "Здравствуйте" },
      { id: "pass-please", kind: "request", emoji: "➡️", text: "Можно пройти?" },
      { id: "thanks-place", kind: "thanks", emoji: "🌟", text: "Спасибо за место" }
    ]
  },
  {
    scene: "Занятие начинается, и педагог смотрит на тебя.",
    prompt: "Выбери фразу приветствия.",
    partner: "Педагог ждёт начало общения.",
    expectedKind: "greeting",
    choices: [
      { id: "teacher-hello", kind: "greeting", emoji: "👋", text: "Здравствуйте!" },
      { id: "break-please", kind: "request", emoji: "🕊️", text: "Можно паузу?" },
      { id: "thanks-lesson", kind: "thanks", emoji: "💛", text: "Спасибо за занятие" }
    ]
  }
];

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("social-phrases", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 125
}, { finishOnMistakes: false });

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<SocialPhraseRound>({
  session,
  startSession,
  generateRound: generateSocialPhraseRound
});

const feedback = ref("Выбери подходящую социальную фразу взглядом.");
const hintedKind = ref<PhraseKind>();
const selectedChoiceId = ref<string>();
const isChangingRound = ref(false);
let transitionTimer = 0;

const expectedKindLabel = computed(() => kindLabels[round.value.expectedKind]);

function generateSocialPhraseRound(roundIndex: number): SocialPhraseRound {
  const source = rounds[(roundIndex - 1) % rounds.length];
  return {
    ...source,
    roundId: `social-phrases:${roundIndex}:${source.expectedKind}`
  };
}

function choiceTargetId(choiceId: string) {
  return `social-phrases:choice:${round.value.roundId}:${choiceId}`;
}

function clearTransitionTimer() {
  window.clearTimeout(transitionTimer);
  transitionTimer = 0;
}

function choose(choice: SocialPhraseChoice) {
  if (session.status !== "running" || isChangingRound.value) return;

  const targetId = choiceTargetId(choice.id);
  const isExpected = choice.kind === round.value.expectedKind;
  selectedChoiceId.value = choice.id;

  if (isExpected) {
    isChangingRound.value = true;
    hintedKind.value = undefined;
    feedback.value = `Хороший выбор: «${choice.text}». Это ${expectedKindLabel.value}.`;
    recordSuccess({
      roundId: round.value.roundId,
      targetId,
      answerId: choice.id,
      expected: round.value.expectedKind,
      actual: choice.kind,
      phrase: choice.text,
      isCorrect: true
    });

    clearTransitionTimer();
    transitionTimer = window.setTimeout(() => {
      transitionTimer = 0;
      if (session.status === "running") {
        nextRound();
        feedback.value = "Следующая ситуация. Выбери подходящую фразу.";
        selectedChoiceId.value = undefined;
      } else {
        feedback.value = "Спасибо. Социальные фразы потренированы спокойно.";
      }
      isChangingRound.value = false;
    }, 1000);
    return;
  }

  hintedKind.value = round.value.expectedKind;
  feedback.value = `Я услышал: «${choice.text}». ${kindHints[round.value.expectedKind]} Попробуй ещё раз спокойно.`;
  recordMistake({
    roundId: round.value.roundId,
    targetId,
    expectedTargetId: choiceTargetId(round.value.choices.find((item) => item.kind === round.value.expectedKind)?.id ?? "expected"),
    answerId: choice.id,
    expected: round.value.expectedKind,
    actual: choice.kind,
    phrase: choice.text,
    isCorrect: false,
    noFail: true
  });
  recordHint({
    roundId: round.value.roundId,
    targetId,
    text: kindHints[round.value.expectedKind]
  });
}

function restart() {
  clearTransitionTimer();
  feedback.value = "Выбери подходящую социальную фразу взглядом.";
  hintedKind.value = undefined;
  selectedChoiceId.value = undefined;
  isChangingRound.value = false;
  restartRoundGame();
}

onUnmounted(() => {
  clearTransitionTimer();
});
</script>

<template>
  <div class="social-phrases-shell">
    <GameHud title="Социальные фразы" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-3">AAC: приветствие, просьба, благодарность</div>
            <v-card class="scene-card pa-5 pa-md-7 mb-5" color="teal-lighten-5" rounded="xl" variant="flat">
              <v-chip class="mb-4" color="primary" size="large" variant="tonal">Нужна фраза: {{ expectedKindLabel }}</v-chip>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-3">{{ round.scene }}</h1>
              <div class="text-h6 text-md-h5 text-medium-emphasis mb-2">{{ round.partner }}</div>
              <div class="text-h6 text-md-h5 font-weight-medium">{{ round.prompt }}</div>
            </v-card>

            <div class="text-h6 text-md-h5 text-center text-medium-emphasis mb-5">{{ feedback }}</div>

            <v-row justify="center">
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" md="4">
                <GameDwellButton :class="{ 'hinted-choice': hintedKind === choice.kind, 'selected-choice': selectedChoiceId === choice.id }" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" :min-height="220" :color="hintedKind === choice.kind ? 'primary' : 'surface'" @select="choose(choice)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph mb-3" aria-hidden="true">{{ choice.emoji }}</div>
                    <div class="text-overline text-primary mb-2">{{ kindLabels[choice.kind] }}</div>
                    <div class="text-h4 text-md-h3 font-weight-bold">{{ choice.text }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Социальные фразы" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.social-phrases-shell {
  background: linear-gradient(135deg, #effaf7 0%, #f7f2ff 52%, #fff8e8 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.scene-card {
  text-align: center;
}

.choice-emoji {
  font-size: clamp(3.8rem, 8vw, 6.5rem);
  line-height: 1;
}

.hinted-choice {
  filter: drop-shadow(0 0 1.2rem rgb(var(--v-theme-primary) / 34%));
  transform: scale(1.02);
}

.selected-choice {
  outline: 0.25rem solid rgb(var(--v-theme-secondary) / 32%);
  outline-offset: 0.2rem;
}
</style>

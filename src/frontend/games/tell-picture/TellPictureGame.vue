<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type TellPicturePart = "phrase" | "object" | "action";

type TellPictureChoice = {
  id: string;
  text: string;
  emoji: string;
  color: string;
};

type TellPictureScene = {
  id: string;
  title: string;
  emoji: string;
  place: string;
  prompt: string;
  choices: Record<TellPicturePart, TellPictureChoice[]>;
};

type TellPictureRound = {
  roundId: string;
  scene: TellPictureScene;
  part: TellPicturePart;
  partIndex: number;
  prompt: string;
  choices: TellPictureChoice[];
};

const partKinds: TellPicturePart[] = ["phrase", "object", "action"];
const partLabels: Record<TellPicturePart, string> = {
  phrase: "Фраза",
  object: "Кто или что",
  action: "Что делает"
};
const partPrompts: Record<TellPicturePart, string> = {
  phrase: "Выбери начало рассказа.",
  object: "Выбери героя или предмет на картинке.",
  action: "Выбери действие для короткого высказывания."
};

const scenes: TellPictureScene[] = [
  {
    id: "park-play",
    title: "Парк",
    emoji: "🌳🐕🟡",
    place: "тёплая прогулка",
    prompt: "Посмотри на картинку и составь короткий рассказ.",
    choices: {
      phrase: [
        { id: "here", text: "Здесь", emoji: "📍", color: "blue-lighten-5" },
        { id: "picture", text: "На картинке", emoji: "🖼️", color: "cyan-lighten-5" },
        { id: "i-see", text: "Я вижу", emoji: "👀", color: "indigo-lighten-5" }
      ],
      object: [
        { id: "dog", text: "собака", emoji: "🐕", color: "amber-lighten-5" },
        { id: "ball", text: "мяч", emoji: "🟡", color: "yellow-lighten-5" },
        { id: "child", text: "ребёнок", emoji: "🧒", color: "green-lighten-5" }
      ],
      action: [
        { id: "plays", text: "играет", emoji: "🎾", color: "lime-lighten-5" },
        { id: "runs", text: "бежит", emoji: "💨", color: "teal-lighten-5" },
        { id: "smiles", text: "улыбается", emoji: "😊", color: "pink-lighten-5" }
      ]
    }
  },
  {
    id: "kitchen-snack",
    title: "Кухня",
    emoji: "🍎🥣🥛",
    place: "спокойный перекус",
    prompt: "Расскажи, что происходит на кухне.",
    choices: {
      phrase: [
        { id: "now", text: "Сейчас", emoji: "🕒", color: "purple-lighten-5" },
        { id: "i-notice", text: "Я заметил", emoji: "🔎", color: "deep-purple-lighten-5" },
        { id: "there-is", text: "Тут", emoji: "🏠", color: "blue-grey-lighten-5" }
      ],
      object: [
        { id: "apple", text: "яблоко", emoji: "🍎", color: "red-lighten-5" },
        { id: "cup", text: "чашка", emoji: "☕", color: "brown-lighten-5" },
        { id: "porridge", text: "каша", emoji: "🥣", color: "orange-lighten-5" }
      ],
      action: [
        { id: "waits", text: "ждёт", emoji: "⏳", color: "amber-lighten-5" },
        { id: "stands", text: "стоит", emoji: "🧺", color: "grey-lighten-4" },
        { id: "tasty", text: "вкусное", emoji: "😋", color: "red-lighten-5" }
      ]
    }
  },
  {
    id: "home-reading",
    title: "Комната",
    emoji: "📖🧸🛋️",
    place: "тихий дом",
    prompt: "Выбери слова, чтобы рассказать про комнату.",
    choices: {
      phrase: [
        { id: "in-room", text: "В комнате", emoji: "🛋️", color: "deep-orange-lighten-5" },
        { id: "i-like", text: "Мне нравится", emoji: "💛", color: "yellow-lighten-5" },
        { id: "story", text: "Расскажу", emoji: "💬", color: "light-blue-lighten-5" }
      ],
      object: [
        { id: "book", text: "книга", emoji: "📖", color: "blue-lighten-5" },
        { id: "bear", text: "мишка", emoji: "🧸", color: "brown-lighten-5" },
        { id: "lamp", text: "лампа", emoji: "💡", color: "yellow-lighten-5" }
      ],
      action: [
        { id: "rests", text: "отдыхает", emoji: "🌙", color: "blue-grey-lighten-5" },
        { id: "shines", text: "светит", emoji: "✨", color: "amber-lighten-5" },
        { id: "helps", text: "помогает", emoji: "🤝", color: "green-lighten-5" }
      ]
    }
  }
];

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("tell-picture", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 135
}, { finishOnMistakes: false });

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<TellPictureRound>({
  session,
  startSession,
  generateRound: generateTellPictureRound
});

const sentenceParts = reactive<Partial<Record<TellPicturePart, TellPictureChoice>>>({});
const storyLines = ref<string[]>([]);
const feedback = ref("Выбери первую часть рассказа. Любой выбор подходит.");
const isChangingRound = ref(false);
let feedbackTimer = 0;

const currentStatement = computed(() => buildStatement() || "Выборы появятся здесь.");

function generateTellPictureRound(roundIndex = 1): TellPictureRound {
  const partIndex = (roundIndex - 1) % partKinds.length;
  const part = partKinds[partIndex];
  const scene = scenes[Math.floor((roundIndex - 1) / partKinds.length) % scenes.length];

  return {
    roundId: `tell-picture:round:${roundIndex}`,
    scene,
    part,
    partIndex,
    prompt: partPrompts[part],
    choices: scene.choices[part].map((choice) => ({ ...choice }))
  };
}

function choiceTargetId(choice: TellPictureChoice) {
  return `tell-picture:${round.value.scene.id}:${round.value.part}:${choice.id}`;
}

function buildStatement() {
  return partKinds.map((part) => sentenceParts[part]?.text).filter(Boolean).join(" ");
}

function clearSentenceParts() {
  for (const part of partKinds) delete sentenceParts[part];
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function completeStoryLine() {
  const statement = buildStatement();
  if (!statement) return;
  storyLines.value = [...storyLines.value.slice(-2), `${statement}.`];
}

function choose(choice: TellPictureChoice) {
  if (session.status !== "running" || isChangingRound.value) return;

  clearFeedbackTimer();
  isChangingRound.value = true;
  sentenceParts[round.value.part] = choice;
  const statement = buildStatement();
  if (round.value.part === "action") completeStoryLine();
  feedback.value = `Ты сказал: «${statement}».`;

  recordSuccess({
    roundId: round.value.roundId,
    targetId: choiceTargetId(choice),
    answerId: choice.id,
    sceneId: round.value.scene.id,
    part: round.value.part,
    expected: "any-picture-story-choice",
    actual: choice.text,
    statement,
    isCorrect: true,
    noFail: true
  });

  feedbackTimer = window.setTimeout(() => {
    if (session.status !== "running") {
      isChangingRound.value = false;
      return;
    }

    const nextPart = partKinds[session.step % partKinds.length];
    if (nextPart === "phrase") clearSentenceParts();
    nextRound();
    feedback.value = nextPart === "phrase" ? "Новая картинка. Начни новый рассказ." : partPrompts[nextPart];
    isChangingRound.value = false;
  }, 900);
}

function restart() {
  clearFeedbackTimer();
  clearSentenceParts();
  storyLines.value = [];
  feedback.value = "Выбери первую часть рассказа. Любой выбор подходит.";
  isChangingRound.value = false;
  restartRoundGame();
}

onUnmounted(() => {
  clearFeedbackTimer();
});
</script>

<template>
  <div class="tell-picture-shell">
    <GameHud title="Расскажи картинку" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="tell-picture-card pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-3">AAC-рассказ без неправильных ответов</div>

            <v-row align="stretch" class="scene-row mb-5">
              <v-col cols="12" md="5">
                <v-card class="scene-card pa-5 h-100" color="blue-lighten-5" rounded="xl" variant="flat">
                  <v-chip class="mb-4" color="primary" size="large" variant="tonal">{{ round.scene.place }}</v-chip>
                  <div class="scene-emoji emoji-glyph mb-4">{{ round.scene.emoji }}</div>
                  <h1 class="text-h3 text-md-h2 font-weight-bold mb-3">{{ round.scene.title }}</h1>
                  <p class="text-h6 text-medium-emphasis mb-0">{{ round.scene.prompt }}</p>
                </v-card>
              </v-col>

              <v-col cols="12" md="7">
                <v-card class="pa-5 h-100" color="surface-variant" rounded="xl" variant="tonal">
                  <div class="d-flex align-center ga-3 mb-4">
                    <v-icon icon="mdi-check" color="success" size="34" />
                    <div>
                      <div class="text-overline text-secondary">Собираем высказывание</div>
                      <div class="text-h4 text-md-h3 font-weight-bold">{{ currentStatement }}</div>
                    </div>
                  </div>

                  <div class="sentence-parts mb-4" aria-label="Части высказывания">
                    <v-card v-for="part in partKinds" :key="part" class="pa-4 text-center" :color="sentenceParts[part]?.color ?? 'surface'" rounded="lg" variant="elevated">
                      <div class="text-caption text-medium-emphasis mb-1">{{ partLabels[part] }}</div>
                      <div class="part-emoji emoji-glyph">{{ sentenceParts[part]?.emoji ?? '…' }}</div>
                      <div class="text-h6 font-weight-bold">{{ sentenceParts[part]?.text ?? 'ждёт выбор' }}</div>
                    </v-card>
                  </div>

                  <div class="text-h6 text-medium-emphasis mb-3">{{ feedback }}</div>
                  <v-chip v-for="line in storyLines" :key="line" class="ma-1" color="success" size="large" variant="tonal">
                    {{ line }}
                  </v-chip>
                </v-card>
              </v-col>
            </v-row>

            <v-card class="prompt-card pa-4 pa-md-5 mb-5" color="green-lighten-5" rounded="xl" variant="flat">
              <div class="d-flex flex-wrap align-center justify-center ga-3 text-center">
                <v-icon icon="mdi-message-text-outline" color="primary" size="34" />
                <div class="text-h5 text-md-h4 font-weight-bold">{{ round.prompt }}</div>
              </div>
            </v-card>

            <v-row class="choice-row" justify="center">
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="4" md="4">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" :min-height="220" :color="choice.color" @select="choose(choice)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph mb-3">{{ choice.emoji }}</div>
                    <div class="text-h4 text-md-h3 font-weight-bold">{{ choice.text }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Расскажи картинку" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.tell-picture-shell {
  background: linear-gradient(135deg, #eef8ff 0%, #f4fff1 52%, #fff7e8 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.scene-card {
  text-align: center;
}

.scene-emoji {
  filter: drop-shadow(0 12px 16px rgb(0 0 0 / 14%));
  font-size: clamp(5.5rem, 12vw, 9rem);
  line-height: 1;
}

.sentence-parts {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.part-emoji {
  font-size: clamp(2.6rem, 5vw, 4.5rem);
  line-height: 1;
}

.choice-emoji {
  font-size: clamp(4rem, 8vw, 6.5rem);
  line-height: 1;
}

@media (max-width: 700px) {
  .sentence-parts {
    grid-template-columns: 1fr;
  }
}

@media (max-height: 680px) {
  .game-container {
    padding-block-start: 104px;
  }

  .tell-picture-card {
    display: flex;
    flex-direction: column;
    padding: 1rem !important;
  }

  .tell-picture-card > .text-overline {
    display: none;
  }

  .choice-row {
    order: 1;
  }

  .prompt-card {
    margin-block-end: 0.75rem !important;
    order: 2;
    padding: 0.75rem !important;
  }

  .scene-row {
    margin-block-end: 0.75rem !important;
    order: 3;
  }

  .scene-card,
  .scene-row :deep(.v-card) {
    padding: 0.75rem !important;
  }

  .scene-emoji,
  .sentence-parts,
  .scene-card p,
  .scene-row .text-h6,
  .scene-row .v-chip {
    display: none;
  }

  .choice-emoji {
    font-size: clamp(2.5rem, 5vw, 3.5rem);
  }
}
</style>

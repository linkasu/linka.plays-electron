<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameChoiceCardGrid from "../../components/game/GameChoiceCardGrid.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWordImage from "../../components/game/GameWordImage.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeTtsAssets, playTtsAssetAndWait, stopTtsPlayback, warmTtsAssets, type TtsAsset } from "../../core/ttsAudio";
import ttsAssetsData from "../../data/ttsAssets.json";
import { findYesNoNameAsset, generateYesNoRound, type YesNoAnswer, type YesNoRound } from "./model";

const allTtsAssets = ttsAssetsData as TtsAsset[];

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, finishSession, startSession } = useGameSessionFor("yes-no", { maxSteps: 8, finishOnMaxSteps: false, finishOnMistakes: false });
const soundEnabled = toRef(session.settings, "sound");
const feedbackAudio = useStandardGameFeedback(soundEnabled);
const promptAudio = useGamePromptAudio({ gameId: "yes-no", soundEnabled, warmAssetIds: ["yes-no.correct", "yes-no.mistake", "yes-no.complete"] });
const recentAnswers = ref<YesNoAnswer[]>([]);

function generateRound(roundIndex: number) {
  const nextRound = generateYesNoRound(roundIndex, { recentAnswers: recentAnswers.value });
  recentAnswers.value = [...recentAnswers.value, nextRound.answer].slice(-2);
  return nextRound;
}

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<YesNoRound>({
  session,
  startSession,
  generateRound
});

const feedback = ref("Выбери ответ взглядом.");
const isChangingRound = ref(false);
const usedNameAssets = new Map<string, TtsAsset>();
let questionToken = 0;
let speechGuardTimer = 0;
let settleSystemSpeech: (() => void) | undefined;

function answerTargetId(value: YesNoAnswer) {
  return `yes-no:answer:${value}`;
}

function cancelRoundQuestion() {
  questionToken += 1;
  window.clearTimeout(speechGuardTimer);
  speechGuardTimer = 0;
  window.speechSynthesis?.cancel();
  settleSystemSpeech?.();
  settleSystemSpeech = undefined;
  promptAudio.cancelPending();
  stopTtsPlayback();
  isChangingRound.value = false;
}

function speakSystemText(text: string) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (spoken: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(speechGuardTimer);
      speechGuardTimer = 0;
      settleSystemSpeech = undefined;
      resolve(spoken);
    };

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ru-RU";
      utterance.rate = 0.82;
      utterance.pitch = 1;
      utterance.volume = 0.32;
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      settleSystemSpeech = () => finish(false);
      window.speechSynthesis.speak(utterance);
      speechGuardTimer = window.setTimeout(() => {
        window.speechSynthesis.cancel();
        finish(false);
      }, 8000);
    } catch {
      finish(false);
    }
  });
}

async function playRoundQuestion(delayMs = 0) {
  cancelRoundQuestion();
  const token = questionToken;
  isChangingRound.value = true;
  if (delayMs > 0) await new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
  if (token !== questionToken) return;

  if (!session.settings.sound) {
    isChangingRound.value = false;
    return;
  }

  const nameAsset = findYesNoNameAsset(round.value.askedItem, allTtsAssets) as TtsAsset | undefined;
  if (nameAsset) {
    await speakSystemText("Это");
    if (token !== questionToken) return;
    usedNameAssets.set(nameAsset.id, nameAsset);
    warmTtsAssets(true, [nameAsset]);
    await playTtsAssetAndWait(true, nameAsset, 0.36);
  } else {
    await speakSystemText(round.value.prompt);
  }

  if (token === questionToken) isChangingRound.value = false;
}

async function answer(value: YesNoAnswer) {
  if (session.status !== "running" || isChangingRound.value) return;

  const targetId = answerTargetId(value);
  const expectedTargetId = answerTargetId(round.value.answer);
  isChangingRound.value = true;

  const wasCorrect = value === round.value.answer;
  if (wasCorrect) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: value, expected: round.value.answer, actual: value, isCorrect: true });
    feedback.value = "Да, так и есть.";
    void feedbackAudio.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["yes-no.correct", "yes-no.complete"] : ["yes-no.correct"], 80, 170);
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      isChangingRound.value = false;
      return;
    }
    nextRound();
    feedback.value = "Следующий вопрос.";
    await playRoundQuestion(180);
  } else {
    recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: value, expected: round.value.answer, actual: value, isCorrect: false });
    feedback.value = "Посмотри на картинку и вопрос ещё раз. Попробуй выбрать другой ответ.";
    void feedbackAudio.playMistake();
    await promptAudio.playSequenceAndWait(["yes-no.mistake"], 80);
    await playRoundQuestion(180);
  }
}

function restart() {
  cancelRoundQuestion();
  feedback.value = "Выбери ответ взглядом.";
  recentAnswers.value = [];
  restartRoundGame();
  void playRoundQuestion(220);
}

onMounted(() => {
  promptAudio.warm();
  void playRoundQuestion(420);
});

onUnmounted(() => {
  cancelRoundQuestion();
  disposeTtsAssets([...usedNameAssets.values()]);
});
</script>

<template>
  <GamePageShell gradient="linear-gradient(135deg, #eef7ff 0%, #fff4e9 100%)" padding-top="8.25rem">
    <template #hud>
      <GameHud title="Да / нет" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10">
          <v-card class="yes-no-card pa-6 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Отвечаем</div>
            <div class="item-display mb-6">
              <GameWordImage class="item-emoji" :word-id="round.item.id" :word="round.item.word" :emoji="round.item.emoji" />
              <h1 class="text-h3 font-weight-bold mb-2">{{ round.prompt }}</h1>
              <div class="text-h6 text-medium-emphasis">{{ feedback }}</div>
            </div>
            <GameChoiceCardGrid :choices="round.choices" :target-id="(choice) => answerTargetId(choice.id)" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" min-height="13.75rem" :cols="12" :md="6" :color="(choice) => choice.color" @select="(choice) => answer(choice.id)">
              <template #default="{ choice }">
                <v-icon class="choice-icon align-self-center" :icon="choice.icon" />
                <div class="text-h3 font-weight-bold">{{ choice.title }}</div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Да / нет" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.item-display {
  text-align: center;
}

.item-emoji,
.choice-icon {
  font-size: clamp(4.5rem, 11vw, 8rem);
  line-height: 1;
}

@media (max-height: 42rem) {
 .yes-no-card {
    padding: 1rem !important;
  }

 .yes-no-card >.text-overline {
    display: none;
  }

 .item-display {
    margin-block-end: 0.85rem !important;
  }

 .item-display h1 {
    font-size: clamp(1.9rem, 5.8vh, 2.35rem) !important;
    line-height: 1.05;
  }

 .item-display .text-h6 {
    font-size: 1rem !important;
    line-height: 1.18;
  }

  .item-emoji,
  .choice-icon {
    font-size: clamp(3rem, 9vh, 4.25rem);
  }

 .game-container :deep(.dwell-button) {
    min-block-size: 10rem !important;
  }
}
</style>

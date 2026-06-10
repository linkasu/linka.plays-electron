<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateHiddenPictureRound, type HiddenPictureZone } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("hidden-picture", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120
}, {
  finishOnMistakes: false
});

const hintedRoundId = ref<string>();
const lastMistakeId = ref<string>();
const hintLevel = ref(0);

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateHiddenPictureRound(session.settings, roundIndex)
});

const revealPercent = computed(() => Math.min(96, 26 + session.step * 7 + hintLevel.value * 5));
const hintText = computed(() => {
  if (hintLevel.value <= 0 || hintedRoundId.value !== round.value.roundId) return `Найди зону-подсказку: ${round.value.targetZone.shortHint}. Удержи взгляд спокойно.`;
  if (hintLevel.value === 1) return `Подсказка: ${round.value.targetZone.shortHint}. Картинка стала чуть виднее.`;
  return `Следующий намёк: ${round.value.targetZone.strongHint}. Ошибки не страшны.`;
});

const sceneStyle = computed(() => ({
  "--scene-bg": round.value.theme.background,
  "--picture-color": round.value.theme.color,
  "--accent-color": round.value.theme.accentColor,
  "--reveal-opacity": `${revealPercent.value / 100}`,
  "--cover-opacity": `${Math.max(0.08, 1 - revealPercent.value / 100)}`
}));

function zoneTargetId(zone: HiddenPictureZone) {
  return `hidden-picture:zone:${round.value.roundId}:${zone.id}`;
}

function zoneStyle(zone: HiddenPictureZone) {
  return {
    left: `${zone.x}%`,
    top: `${zone.y}%`,
    inlineSize: `${zone.size * session.settings.targetScale}px`
  };
}

function chooseZone(zone: HiddenPictureZone) {
  if (session.status !== "running") return;

  const targetId = zoneTargetId(zone);
  const expectedTargetId = zoneTargetId(round.value.targetZone);
  if (zone.id === round.value.targetZone.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: zone.id, expected: round.value.targetZone.label, actual: zone.label, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    hintLevel.value = 0;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  const nextHintLevel = Math.min(2, hintLevel.value + 1);
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: zone.id, expected: round.value.targetZone.label, actual: zone.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "wrong-hidden-picture-zone", hintLevel: nextHintLevel });
  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = zone.id;
  hintLevel.value = nextHintLevel;
}

function restart() {
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  hintLevel.value = 0;
  restartRoundGame();
}
</script>

<template>
  <div class="hidden-picture-shell">
    <GameHud title="Скрытая картинка" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="10">
          <v-card class="pa-4 pa-md-7" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Визуальный поиск</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ hintText }}</p>

            <v-card class="picture-scene" rounded="xl" variant="flat" :style="sceneStyle">
              <div class="scene-wash" aria-hidden="true" />
              <div class="picture-aura" aria-hidden="true" />
              <v-icon class="secret-picture" :icon="round.theme.icon" aria-hidden="true" />
              <div class="soft-cover" aria-hidden="true" />
              <v-chip class="reveal-chip" color="white" prepend-icon="mdi-image-filter-center-focus" rounded="pill" size="large" variant="elevated">
                Проявлено {{ revealPercent }}%
              </v-chip>
              <div v-if="hintedRoundId === round.roundId" class="reveal-focus" :style="zoneStyle(round.targetZone)" aria-hidden="true" />

              <GameDwellButton
                v-for="zone in round.zones"
                :key="zone.id"
                :class="['picture-zone', { 'picture-zone--hint': hintedRoundId === round.roundId && zone.id === round.targetZone.id, 'picture-zone--mistake': zone.id === lastMistakeId }]"
                :target-id="zoneTargetId(zone)"
                :disabled="session.status !== 'running'"
                :dwell-ms="session.settings.dwellMs"
                :min-height="zone.size * session.settings.targetScale"
                :style="zoneStyle(zone)"
                color="transparent"
                @select="chooseZone(zone)"
              >
                <template #default="{ active, progress }">
                  <div class="zone-marker" :style="{ '--zone-progress': progress }">
                    <v-icon class="zone-icon" :icon="zone.icon" />
                    <div v-if="active || (hintedRoundId === round.roundId && zone.id === round.targetZone.id)" class="zone-label text-body-2 font-weight-bold">
                      {{ zone.label }}
                    </div>
                  </div>
                </template>
              </GameDwellButton>
            </v-card>

            <v-expand-transition>
              <v-alert v-if="hintedRoundId === round.roundId" class="mt-5 text-h6" color="primary" icon="mdi-lightbulb-on-outline" rounded="xl" variant="tonal">
                Неверный выбор только добавил подсказку. Переведи взгляд к подсвеченной зоне и удержи его.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Скрытая картинка" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.hidden-picture-shell {
  background: linear-gradient(135deg, #eef8ff 0%, #fff7e8 50%, #f3edff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.picture-scene {
  background: var(--scene-bg);
  block-size: clamp(32rem, 64vh, 43rem);
  overflow: hidden;
  position: relative;
}

.scene-wash {
  background:
    radial-gradient(circle at 22% 22%, rgb(255 255 255 / 74%) 0 9rem, transparent 18rem),
    radial-gradient(circle at 78% 72%, color-mix(in srgb, var(--accent-color) 32%, transparent) 0 10rem, transparent 20rem);
  inset: 0;
  position: absolute;
}

.picture-aura {
  background: radial-gradient(circle, color-mix(in srgb, var(--picture-color) 24%, transparent) 0 24%, transparent 62%);
  block-size: 78%;
  inline-size: 78%;
  inset-block-start: 10%;
  inset-inline-start: 11%;
  opacity: calc(var(--reveal-opacity) + 0.08);
  position: absolute;
}

.secret-picture {
  color: var(--picture-color);
  filter: drop-shadow(0 1.3rem 2rem rgb(0 0 0 / 16%));
  font-size: clamp(14rem, min(42vw, 48vh), 27rem);
  inset-block-start: 50%;
  inset-inline-start: 50%;
  line-height: 1;
  opacity: var(--reveal-opacity);
  position: absolute;
  transform: translate(-50%, -50%);
  transition: opacity 220ms ease, transform 220ms ease;
  z-index: 1;
}

.soft-cover {
  background:
    repeating-linear-gradient(135deg, rgb(255 255 255 / 58%) 0 1.1rem, rgb(255 255 255 / 18%) 1.1rem 2.2rem),
    radial-gradient(circle at 50% 48%, rgb(255 255 255 / 68%) 0 26%, rgb(255 255 255 / 28%) 56%, transparent 78%);
  inset: 0;
  opacity: var(--cover-opacity);
  position: absolute;
  transition: opacity 220ms ease;
  z-index: 2;
}

.reveal-chip {
  inset-block-start: 1rem;
  inset-inline-start: 1rem;
  position: absolute;
  z-index: 5;
}

.reveal-focus {
  background: radial-gradient(circle, rgb(var(--v-theme-primary) / 22%) 0 46%, transparent 70%);
  border-radius: 999px;
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 3;
}

.picture-zone {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 6;
}

.picture-zone :deep(.dwell-button) {
  background: transparent !important;
  box-shadow: none;
  overflow: visible;
}

.picture-zone--hint {
  filter: drop-shadow(0 0 1.35rem rgb(var(--v-theme-primary) / 48%));
}

.picture-zone--mistake {
  opacity: 0.66;
}

.zone-marker {
  align-items: center;
  background:
    conic-gradient(rgb(var(--v-theme-primary) / 42%) calc(var(--zone-progress) * 1turn), transparent 0),
    rgb(255 255 255 / 24%);
  block-size: 100%;
  border: 0.2rem dashed rgb(255 255 255 / 72%);
  border-radius: 999px;
  color: color-mix(in srgb, var(--picture-color) 76%, #263238 24%);
  display: flex;
  flex-direction: column;
  inline-size: 100%;
  justify-content: center;
  min-block-size: 9.5rem;
  outline: 0.35rem solid rgb(255 255 255 / 34%);
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
}

.picture-zone--hint .zone-marker {
  background:
    conic-gradient(rgb(var(--v-theme-primary) / 55%) calc(var(--zone-progress) * 1turn), transparent 0),
    rgb(var(--v-theme-primary) / 18%);
  border-color: rgb(var(--v-theme-primary) / 78%);
  transform: scale(1.04);
}

.zone-icon {
  font-size: clamp(2.8rem, 7vw, 4.8rem);
  opacity: 0.8;
}

.zone-label {
  background: rgb(255 255 255 / 88%);
  border-radius: 999px;
  margin-block-start: 0.4rem;
  max-inline-size: 86%;
  padding: 0.25rem 0.65rem;
  text-align: center;
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .picture-scene {
    block-size: 34rem;
  }

  .reveal-chip {
    display: none;
  }
}
</style>

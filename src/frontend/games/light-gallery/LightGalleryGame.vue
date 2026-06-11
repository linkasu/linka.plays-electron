<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { disposeLightGalleryPiano, playLightGalleryCue, setLightGalleryPianoActive, tickLightGalleryPiano, warmLightGalleryPiano } from "./audio";

type LightPanel = {
  id: string;
  title: string;
  caption: string;
  icon: string;
  gradient: string;
  mood: {
    base: string;
    top: string;
    middle: string;
    bottom: string;
    warmAura: string;
    coolAura: string;
    lowAura: string;
  };
  revealed: boolean;
};

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("light-gallery", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1400,
  sessionSeconds: 90,
  targetScale: 1.55,
  motionSpeed: 0.35,
  distractors: "none",
  hints: "high",
  sound: true
}, {
  finishOnMistakes: false
});

const panels = reactive<LightPanel[]>([
  {
    id: "light-gallery:panel:morning",
    title: "Утро",
    caption: "мягкий рассвет",
    icon: "mdi-weather-sunset-up",
    gradient: "linear-gradient(135deg, #fff1c8 0%, #ffd2b8 45%, #adc7ff 100%)",
    mood: {
      base: "#271a34",
      top: "#1a2747",
      middle: "#59304e",
      bottom: "#8a5944",
      warmAura: "255 190 104",
      coolAura: "156 194 255",
      lowAura: "255 136 116"
    },
    revealed: false
  },
  {
    id: "light-gallery:panel:pond",
    title: "Пруд",
    caption: "тихая вода",
    icon: "mdi-waves",
    gradient: "linear-gradient(135deg, #d7fff4 0%, #9ed8dd 48%, #668fc4 100%)",
    mood: {
      base: "#092537",
      top: "#073145",
      middle: "#13526a",
      bottom: "#21456f",
      warmAura: "148 255 228",
      coolAura: "118 181 255",
      lowAura: "82 238 205"
    },
    revealed: false
  },
  {
    id: "light-gallery:panel:meadow",
    title: "Луг",
    caption: "светлая трава",
    icon: "mdi-grass",
    gradient: "linear-gradient(135deg, #efffcf 0%, #b7e8b4 50%, #74bda4 100%)",
    mood: {
      base: "#11291f",
      top: "#122d35",
      middle: "#1f563d",
      bottom: "#35492d",
      warmAura: "225 255 151",
      coolAura: "105 229 184",
      lowAura: "176 255 176"
    },
    revealed: false
  },
  {
    id: "light-gallery:panel:moon",
    title: "Луна",
    caption: "спокойная ночь",
    icon: "mdi-moon-waning-crescent",
    gradient: "linear-gradient(135deg, #e9eeff 0%, #b9c4ee 48%, #6b79b8 100%)",
    mood: {
      base: "#0b102d",
      top: "#070b21",
      middle: "#18224d",
      bottom: "#272150",
      warmAura: "219 226 255",
      coolAura: "125 151 255",
      lowAura: "161 125 255"
    },
    revealed: false
  },
  {
    id: "light-gallery:panel:garden",
    title: "Сад",
    caption: "тёплые листья",
    icon: "mdi-flower-tulip-outline",
    gradient: "linear-gradient(135deg, #ffe8be 0%, #f7b889 44%, #c9786f 100%)",
    mood: {
      base: "#301d25",
      top: "#25192d",
      middle: "#633135",
      bottom: "#7b4b2e",
      warmAura: "255 177 94",
      coolAura: "255 143 160",
      lowAura: "255 211 135"
    },
    revealed: false
  },
  {
    id: "light-gallery:panel:cloud",
    title: "Облако",
    caption: "воздушный свет",
    icon: "mdi-cloud-outline",
    gradient: "linear-gradient(135deg, #ffffff 0%, #dcecff 52%, #a9c1de 100%)",
    mood: {
      base: "#142439",
      top: "#101b31",
      middle: "#253c58",
      bottom: "#343a55",
      warmAura: "255 255 255",
      coolAura: "180 220 255",
      lowAura: "214 232 255"
    },
    revealed: false
  },
  {
    id: "light-gallery:panel:lantern",
    title: "Фонарь",
    caption: "тихое тепло",
    icon: "mdi-lamps-outline",
    gradient: "linear-gradient(135deg, #fff5c2 0%, #ffc875 48%, #c88b64 100%)",
    mood: {
      base: "#2f2018",
      top: "#241a27",
      middle: "#6a4226",
      bottom: "#744226",
      warmAura: "255 199 89",
      coolAura: "255 149 103",
      lowAura: "255 230 148"
    },
    revealed: false
  },
  {
    id: "light-gallery:panel:stars",
    title: "Звёзды",
    caption: "мягкое мерцание",
    icon: "mdi-star-four-points-outline",
    gradient: "linear-gradient(135deg, #f5edff 0%, #bca8f4 46%, #6c63a8 100%)",
    mood: {
      base: "#151033",
      top: "#0d102c",
      middle: "#30215b",
      bottom: "#21183d",
      warmAura: "231 210 255",
      coolAura: "145 129 255",
      lowAura: "196 149 255"
    },
    revealed: false
  }
]);

const resultVisible = computed(() => session.status === "finished");
const revealedCount = computed(() => panels.filter((panel) => panel.revealed).length);
const activePanelId = ref("");
const activeMood = computed(() => panels.find((panel) => panel.id === activePanelId.value)?.mood);
const backdropStyle = computed(() => {
  const mood = activeMood.value;
  const top = mood?.top ?? "#081b2a";
  const middle = mood?.middle ?? "#16203b";
  const bottom = mood?.bottom ?? "#321f45";
  const warmAura = mood?.warmAura ?? "255 196 120";
  const coolAura = mood?.coolAura ?? "112 222 255";
  const lowAura = mood?.lowAura ?? "244 142 255";

  return {
    background: `radial-gradient(circle at 16% 18%, rgb(${warmAura} / 18%), transparent 31%), radial-gradient(circle at 82% 22%, rgb(${coolAura} / 17%), transparent 35%), radial-gradient(circle at 48% 88%, rgb(${lowAura} / 15%), transparent 43%), linear-gradient(180deg, ${top} 0%, ${middle} 44%, ${bottom} 100%)`
  };
});
let audioTimer = 0;

function revealPanel(panel: LightPanel) {
  if (session.status !== "running" || panel.revealed) return;
  panel.revealed = true;
  activePanelId.value = panel.id;
  recordSuccess({ targetId: panel.id, title: panel.title });
  playLightGalleryCue(session.settings.sound);
}

function restart() {
  for (const panel of panels) panel.revealed = false;
  activePanelId.value = "";
  startSession();
}

watch(() => [session.status, session.settings.sound] as const, () => {
  setLightGalleryPianoActive(session.settings.sound, session.status === "running");
}, { immediate: true });

onMounted(() => {
  warmLightGalleryPiano(session.settings.sound);
  audioTimer = window.setInterval(() => tickLightGalleryPiano(session.settings.sound), 500);
});

onUnmounted(() => {
  window.clearInterval(audioTimer);
  disposeLightGalleryPiano();
});
</script>

<template>
  <div class="light-gallery-shell">
    <Transition name="light-gallery-backdrop-fade">
      <div :key="activePanelId || 'gallery-base'" class="light-gallery-backdrop" :style="backdropStyle" aria-hidden="true" />
    </Transition>
    <div class="light-gallery-aura" aria-hidden="true" />

    <GameHud
      title="Галерея света"
      :step="session.step"
      :max-steps="session.maxSteps"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      @pause="pauseSession"
      @resume="resumeSession"
    />

    <v-container class="light-gallery-container d-flex align-center justify-center" fluid>
      <v-card class="light-gallery-frame pa-4 pa-sm-6 pa-md-8" color="transparent" elevation="0">
        <div class="text-center mb-4 mb-md-6 light-gallery-copy">
          <div class="text-overline text-indigo-lighten-4">ambient gaze basics</div>
          <h1 class="text-h4 text-sm-h3 font-weight-bold">Проявляй картины светом</h1>
          <p class="text-body-1 text-sm-h6 text-blue-grey-lighten-4 mb-0">
            Смотри на любую панель. Картина постепенно проявляется светом.
          </p>
        </div>

        <div class="light-gallery-grid" role="group" aria-label="Панели света для игры Галерея света">
          <GameDwellButton
            v-for="panel in panels"
            :key="panel.id"
            :target-id="panel.id"
            :dwell-ms="session.settings.dwellMs"
            :disabled="session.status !== 'running' || panel.revealed"
            :min-height="150"
            color="indigo-darken-4"
            class="light-gallery-target"
            @select="revealPanel(panel)"
          >
            <template #default="{ active, progress }">
              <div
                :class="['light-gallery-panel', { 'light-gallery-panel--active': active, 'light-gallery-panel--revealed': panel.revealed }]"
                :style="{ '--panel-gradient': panel.gradient, '--panel-progress': panel.revealed ? 1 : active ? progress : 0 }"
              >
                <div class="light-gallery-panel-art" aria-hidden="true">
                  <v-icon :icon="panel.icon" class="light-gallery-panel-icon" />
                </div>
                <div class="text-subtitle-1 text-sm-h6 font-weight-bold">{{ panel.title }}</div>
                <div class="text-caption text-medium-emphasis">{{ panel.revealed ? panel.caption : active && progress > 0.72 ? 'Проявляется' : 'Смотри спокойно' }}</div>
              </div>
            </template>
          </GameDwellButton>
        </div>

        <v-card class="light-gallery-progress mt-5 mx-auto px-4 py-3" color="surface" rounded="xl" variant="tonal">
          <div class="text-body-2 font-weight-medium">Проявлено картин: {{ revealedCount }} из {{ session.maxSteps }}</div>
          <div class="text-caption text-medium-emphasis">Выбирай панели в любом порядке, галерея просто становится светлее.</div>
        </v-card>
      </v-card>
    </v-container>

    <GameResultDialog
      :model-value="resultVisible"
      title="Галерея света"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :metrics="metrics"
      :recommendation="recommendation"
      @menu="router.push(resolveMenuRoute())"
      @restart="restart"
    />
  </div>
</template>

<style scoped>
.light-gallery-shell {
  background: #081b2a;
  min-block-size: 100vh;
  overflow: hidden;
  position: relative;
}

.light-gallery-backdrop {
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.light-gallery-backdrop-fade-enter-active,
.light-gallery-backdrop-fade-leave-active {
  transition: opacity 1400ms ease, transform 1600ms ease, filter 1600ms ease;
}

.light-gallery-backdrop-fade-enter-from {
  opacity: 0;
  transform: scale(1.035);
}

.light-gallery-backdrop-fade-leave-to {
  filter: blur(8px);
  opacity: 0;
  transform: scale(0.985);
}

.light-gallery-aura {
  background: radial-gradient(circle at 28% 30%, rgb(255 255 255 / 10%), transparent 34%),
    radial-gradient(circle at 74% 62%, rgb(159 203 255 / 9%), transparent 38%),
    linear-gradient(110deg, rgb(255 255 255 / 5%), rgb(255 210 164 / 5%));
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.light-gallery-container {
  min-block-size: 100vh;
  padding-block-start: 112px;
}

.light-gallery-frame {
  inline-size: min(1040px, 100%);
  position: relative;
  z-index: 1;
}

.light-gallery-copy {
  color: #fff8ee;
  text-shadow: 0 2px 22px rgb(12 14 30 / 42%);
}

.light-gallery-grid {
  display: grid;
  gap: clamp(14px, 2.2vw, 24px);
  grid-template-columns: repeat(4, minmax(136px, 1fr));
}

.light-gallery-target {
  min-block-size: clamp(144px, 18vw, 188px);
}

.light-gallery-panel {
  align-items: center;
  block-size: 100%;
  color: rgb(242 245 255 / 92%);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  justify-content: center;
  min-block-size: 100%;
  opacity: calc(0.62 + (var(--panel-progress) * 0.38));
  position: relative;
  text-shadow: 0 1px 14px rgb(12 14 30 / 42%);
  transform: scale(calc(0.97 + (var(--panel-progress) * 0.03)));
  transition: color 220ms ease, filter 220ms ease, opacity 220ms ease, transform 220ms ease;
}

.light-gallery-panel::before {
  background: var(--panel-gradient);
  border-radius: 22px;
  content: "";
  filter: saturate(calc(0.42 + (var(--panel-progress) * 0.58))) contrast(calc(0.72 + (var(--panel-progress) * 0.34)));
  inset: -0.6rem;
  opacity: calc(0.18 + (var(--panel-progress) * 0.76));
  position: absolute;
  transition: filter 260ms ease, opacity 260ms ease;
  z-index: -1;
}

.light-gallery-panel--active,
.light-gallery-panel--revealed {
  color: #19213b;
}

.light-gallery-panel--revealed {
  filter: drop-shadow(0 18px 32px rgb(255 238 196 / 18%));
}

.light-gallery-panel-art {
  align-items: center;
  background: rgb(255 255 255 / calc(0.1 + (var(--panel-progress) * 0.42)));
  block-size: clamp(54px, 7vw, 78px);
  border-radius: 999px;
  display: flex;
  inline-size: clamp(54px, 7vw, 78px);
  justify-content: center;
  transition: background 220ms ease;
}

.light-gallery-panel-icon {
  font-size: clamp(2rem, 4.5vw, 3.1rem);
}

.light-gallery-progress {
  max-inline-size: 560px;
  opacity: 0.82;
}

@media (max-width: 860px) {
  .light-gallery-grid {
    grid-template-columns: repeat(2, minmax(136px, 1fr));
  }
}

@media (max-width: 520px) {
  .light-gallery-container {
    padding-block-start: 104px;
  }

  .light-gallery-grid {
    grid-template-columns: 1fr;
  }
}
</style>

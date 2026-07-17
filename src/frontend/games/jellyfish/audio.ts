import { watch, type WatchStopHandle } from "vue";
import { createNonRepeatingRandomIndexGenerator } from "../../core/random";
import { disposeSoftPiano, playSoftPianoMelody, warmSoftPiano, type SoftPianoMelody } from "../../core/softPiano";

const ambientMelodies: SoftPianoMelody[] = [
  {
    notesToLoad: [55, 62, 67, 74],
    sampled: [
      { note: 55, at: 0, duration: 1.4, velocity: 22 },
      { note: 62, at: 0.32, duration: 1.1, velocity: 18 },
      { note: 67, at: 0.74, duration: 1.2, velocity: 16 }
    ],
    fallback: [
      { frequency: 196, at: 0, duration: 1.4, peak: 0.018 },
      { frequency: 293.66, at: 0.32, duration: 1.1, peak: 0.014 },
      { frequency: 392, at: 0.74, duration: 1.2, peak: 0.012 }
    ],
    lengthSeconds: 2.2
  },
  {
    notesToLoad: [50, 57, 64, 69],
    sampled: [
      { note: 50, at: 0, duration: 1.5, velocity: 20 },
      { note: 57, at: 0.4, duration: 1.1, velocity: 17 },
      { note: 69, at: 0.92, duration: 1.0, velocity: 15 }
    ],
    fallback: [
      { frequency: 146.83, at: 0, duration: 1.5, peak: 0.016 },
      { frequency: 220, at: 0.4, duration: 1.1, peak: 0.013 },
      { frequency: 440, at: 0.92, duration: 1.0, peak: 0.01 }
    ],
    lengthSeconds: 2.15
  }
];

const successMelodies: SoftPianoMelody[] = [
  {
    notesToLoad: [60, 64, 67, 72],
    sampled: [
      { note: 60, at: 0, duration: 0.58, velocity: 34 },
      { note: 64, at: 0.2, duration: 0.58, velocity: 32 },
      { note: 67, at: 0.42, duration: 0.7, velocity: 30 },
      { note: 72, at: 0.78, duration: 0.86, velocity: 28 }
    ],
    fallback: [
      { frequency: 261.63, at: 0, duration: 0.58, peak: 0.028 },
      { frequency: 329.63, at: 0.2, duration: 0.58, peak: 0.024 },
      { frequency: 392, at: 0.42, duration: 0.7, peak: 0.022 },
      { frequency: 523.25, at: 0.78, duration: 0.86, peak: 0.018 }
    ],
    lengthSeconds: 1.86
  },
  {
    notesToLoad: [57, 60, 64, 69],
    sampled: [
      { note: 57, at: 0, duration: 0.64, velocity: 32 },
      { note: 60, at: 0.24, duration: 0.58, velocity: 30 },
      { note: 64, at: 0.46, duration: 0.74, velocity: 29 },
      { note: 69, at: 0.84, duration: 0.92, velocity: 26 }
    ],
    fallback: [
      { frequency: 220, at: 0, duration: 0.64, peak: 0.026 },
      { frequency: 261.63, at: 0.24, duration: 0.58, peak: 0.023 },
      { frequency: 329.63, at: 0.46, duration: 0.74, peak: 0.02 },
      { frequency: 440, at: 0.84, duration: 0.92, peak: 0.017 }
    ],
    lengthSeconds: 1.96
  }
];

const ambientGenerator = createNonRepeatingRandomIndexGenerator(ambientMelodies.length);
const successGenerator = createNonRepeatingRandomIndexGenerator(successMelodies.length);
const notesToLoad = [...new Set([...ambientMelodies, ...successMelodies].flatMap((melody) => melody.notesToLoad ?? []))].sort((a, b) => a - b);

let cueUntil = 0;
let ambientTimer = 0;
let successTimer = 0;
let stopAmbientWatch: WatchStopHandle | undefined;

function melodyLengthMs(melody: SoftPianoMelody) {
  return Math.ceil((melody.lengthSeconds ?? 2) * 1000);
}

function nextAmbientMelody() {
  return ambientMelodies[ambientGenerator.next() ?? 0];
}

function nextSuccessMelody() {
  return successMelodies[successGenerator.next() ?? 0];
}

function canUseWindowTimers() {
  return typeof window !== "undefined";
}

function playQueued(enabled: boolean, melody: SoftPianoMelody, delayMs = 0) {
  if (!enabled || !canUseWindowTimers()) return;
  const play = () => {
    const now = Date.now();
    if (now < cueUntil) return;
    cueUntil = now + melodyLengthMs(melody) + 180;
    void playSoftPianoMelody(true, melody);
  };
  if (delayMs > 0) window.setTimeout(play, delayMs);
  else play();
}

export function resetJellyfishAudioSession() {
  ambientGenerator.reset();
  successGenerator.reset();
  cueUntil = 0;
  if (canUseWindowTimers()) {
    window.clearTimeout(ambientTimer);
    window.clearTimeout(successTimer);
  }
  ambientTimer = 0;
  successTimer = 0;
  stopAmbientWatch?.();
  stopAmbientWatch = undefined;
}

export function warmJellyfishAudio(enabled: boolean) {
  warmSoftPiano(enabled, notesToLoad);
}

export function scheduleJellyfishAmbient(enabled: boolean, isRunning: () => boolean) {
  stopAmbientWatch?.();
  stopAmbientWatch = undefined;
  if (canUseWindowTimers()) window.clearTimeout(ambientTimer);
  ambientTimer = 0;
  if (!enabled || !canUseWindowTimers()) return;

  const scheduleNext = () => {
    window.clearTimeout(ambientTimer);
    if (!isRunning()) {
      ambientTimer = 0;
      return;
    }
    const delayMs = 9000 + Math.random() * 7000;
    ambientTimer = window.setTimeout(() => {
      ambientTimer = 0;
      if (!isRunning()) return;
      playQueued(enabled, nextAmbientMelody());
      scheduleNext();
    }, delayMs);
  };

  stopAmbientWatch = watch(isRunning, (running) => {
    window.clearTimeout(ambientTimer);
    ambientTimer = 0;
    if (running) scheduleNext();
    else disposeSoftPiano();
  }, { immediate: true });
}

export function playJellyfishSuccess(enabled: boolean) {
  if (!enabled || !canUseWindowTimers()) return;
  window.clearTimeout(successTimer);
  const delayMs = Math.max(0, cueUntil - Date.now() + 40);
  const melody = nextSuccessMelody();
  successTimer = window.setTimeout(() => playQueued(enabled, melody), delayMs);
}

export function disposeJellyfishAudio() {
  resetJellyfishAudioSession();
  disposeSoftPiano();
}

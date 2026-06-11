import { Reverb, SplendidGrandPiano } from "smplr";

type SoftPiano = ReturnType<typeof SplendidGrandPiano>;

const notesToLoad = [43, 47, 50, 52, 55, 59, 62, 64, 67, 71, 74, 76, 79];
const loopNotes = [43, 50, 55, 62, 59, 55, 47, 52, 59, 64, 67, 62, 50, 55, 62, 71, 67, 62, 47, 55, 59, 67, 74, 79] as const;
const cueNotes = [62, 67, 74, 79] as const;

let audioContext: AudioContext | undefined;
let outputGain: GainNode | undefined;
let piano: SoftPiano | undefined;
let loading: Promise<SoftPiano | undefined> | undefined;
let unavailable = false;
let scheduledUntil = 0;
let cueUntil = 0;
let active = false;

function createAudioContext() {
  const AudioContextConstructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioContextConstructor ? new AudioContextConstructor() : undefined;
}

async function ensurePiano(resumeAudio: boolean) {
  if (unavailable) return undefined;
  audioContext = audioContext ?? createAudioContext();
  if (!audioContext) return undefined;

  if (resumeAudio && audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch {
      return undefined;
    }
  }

  if (piano) return piano;
  if (loading) return loading;

  loading = (async () => {
    try {
      const context = audioContext;
      if (!context) return undefined;
      outputGain = context.createGain();
      outputGain.gain.value = 0;
      outputGain.connect(context.destination);

      const nextPiano = SplendidGrandPiano(context, {
        destination: outputGain,
        volume: 74,
        velocity: 54,
        decayTime: 4.1,
        notesToLoad: {
          notes: notesToLoad,
          velocityRange: [1, 64]
        }
      });

      try {
        nextPiano.output.addEffect("light-gallery-room", Reverb(context), 0.24);
      } catch {
        // Reverb is optional: gallery interaction must continue with silence or dry piano.
      }

      await nextPiano.ready;
      piano = nextPiano;
      return nextPiano;
    } catch {
      unavailable = true;
      return undefined;
    }
  })();

  return loading;
}

function fadeTo(target: number, seconds: number) {
  if (!audioContext || !outputGain) return;
  const gain = outputGain.gain;
  const now = audioContext.currentTime;
  gain.cancelScheduledValues(now);
  gain.setTargetAtTime(target, now, seconds / 3);
}

function scheduleLoop(instrument: SoftPiano) {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  if (scheduledUntil > now + 1.9) return;

  const startAt = Math.max(now + 0.08, scheduledUntil);
  loopNotes.forEach((note, index) => {
    instrument.start({
      note,
      time: startAt + index * 0.48,
      duration: index % 6 === 0 ? 2.1 : 1.35,
      velocity: index % 6 === 0 ? 58 : 46
    });
  });
  scheduledUntil = startAt + loopNotes.length * 0.48;
}

function playCue(instrument: SoftPiano) {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  if (now < cueUntil) return;

  const startAt = now + 0.04;
  cueNotes.forEach((note, index) => {
    instrument.start({
      note,
      time: startAt + index * 0.2,
      duration: 1.25,
      velocity: 62 - index * 4
    });
  });
  cueUntil = startAt + 1;
}

export function warmLightGalleryPiano(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(false);
}

export function setLightGalleryPianoActive(enabled: boolean, nextActive: boolean) {
  if (!enabled) nextActive = false;
  if (nextActive === active) return;

  active = nextActive;
  if (!active) {
    fadeTo(0, 1.8);
    return;
  }

  void ensurePiano(true).then((instrument) => {
    if (!instrument || !active || !enabled) return;
    fadeTo(0.9, 1.2);
    scheduleLoop(instrument);
  });
}

export function playLightGalleryCue(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(true).then((instrument) => {
    if (!instrument || !enabled) return;
    playCue(instrument);
  });
}

export function tickLightGalleryPiano(enabled: boolean) {
  if (!enabled || !active || !piano) return;
  scheduleLoop(piano);
}

export function disposeLightGalleryPiano() {
  active = false;
  scheduledUntil = 0;
  cueUntil = 0;
  piano?.dispose();
  piano = undefined;
  loading = undefined;
  outputGain?.disconnect();
  outputGain = undefined;
  void audioContext?.close().catch(() => undefined);
  audioContext = undefined;
  unavailable = false;
}

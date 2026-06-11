import { Reverb, SplendidGrandPiano } from "smplr";

type SoftPiano = ReturnType<typeof SplendidGrandPiano>;

const notesToLoad = [43, 47, 50, 52, 55, 59, 62, 64, 67, 71, 74, 76];
const windowPattern = [43, 50, 55, 62, 59, 55, 47, 52, 59, 64, 62, 52, 50, 55, 62, 67, 64, 59, 47, 55, 62, 71, 67, 62] as const;
const cueNotes = [55, 62, 67, 74] as const;

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
        volume: 68,
        velocity: 44,
        decayTime: 3.8,
        notesToLoad: {
          notes: notesToLoad,
          velocityRange: [1, 68]
        }
      });

      try {
        nextPiano.output.addEffect("warm-window-soft-room", Reverb(context), 0.26);
      } catch {
        // Reverb is optional: window gameplay must continue with dry piano or silence.
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
  if (scheduledUntil > now + 1.8) return;

  const startAt = Math.max(now + 0.08, scheduledUntil);
  windowPattern.forEach((note, index) => {
    instrument.start({
      note,
      time: startAt + index * 0.4,
      duration: index % 6 === 0 ? 1.65 : 1.08,
      velocity: index % 6 === 0 ? 50 : 40
    });
  });
  scheduledUntil = startAt + windowPattern.length * 0.4;
}

function playCue(instrument: SoftPiano) {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  if (now < cueUntil) return;

  const startAt = now + 0.04;
  cueNotes.forEach((note, index) => {
    instrument.start({
      note,
      time: startAt + index * 0.15,
      duration: 0.95,
      velocity: 64 - index * 2
    });
  });
  cueUntil = startAt + 0.82;
}

export function warmWarmWindowPiano(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(false);
}

export function setWarmWindowPianoActive(enabled: boolean, nextActive: boolean) {
  if (!enabled) nextActive = false;
  if (nextActive === active) return;

  active = nextActive;
  if (!active) {
    fadeTo(0, 1.5);
    return;
  }

  void ensurePiano(true).then((instrument) => {
    if (!instrument || !active || !enabled) return;
    fadeTo(0.48, 1.1);
    scheduleLoop(instrument);
  });
}

export function tickWarmWindowPiano(enabled: boolean) {
  if (!enabled || !active || !piano) return;
  scheduleLoop(piano);
}

export function playWarmWindowCue(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(true).then((instrument) => {
    if (!instrument || !enabled) return;
    playCue(instrument);
  });
}

export function disposeWarmWindowPiano() {
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

import { Reverb, SplendidGrandPiano } from "smplr";

type SoftPiano = ReturnType<typeof SplendidGrandPiano>;

const notesToLoad = [40, 43, 47, 50, 52, 55, 59, 62, 64, 67, 71, 74, 76];
const firePattern = [40, 47, 52, 59, 55, 50, 43, 47, 55, 62, 59, 52, 47, 52, 59, 67, 64, 55, 50, 55, 62, 71, 67, 59] as const;
const cueNotes = [52, 59, 64, 71, 76] as const;

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
        volume: 72,
        velocity: 48,
        decayTime: 4.2,
        notesToLoad: {
          notes: notesToLoad,
          velocityRange: [1, 72]
        }
      });

      try {
        nextPiano.output.addEffect("warm-fire-soft-room", Reverb(context), 0.3);
      } catch {
        // Reverb is optional: fire gameplay must continue with dry piano or silence.
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
  if (scheduledUntil > now + 2) return;

  const startAt = Math.max(now + 0.08, scheduledUntil);
  firePattern.forEach((note, index) => {
    instrument.start({
      note,
      time: startAt + index * 0.36,
      duration: index % 6 === 0 ? 1.9 : 1.15,
      velocity: index % 6 === 0 ? 54 : 42
    });
  });
  scheduledUntil = startAt + firePattern.length * 0.36;
}

function playCue(instrument: SoftPiano) {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  if (now < cueUntil) return;

  const startAt = now + 0.04;
  cueNotes.forEach((note, index) => {
    instrument.start({
      note,
      time: startAt + index * 0.13,
      duration: 1.05,
      velocity: 68 - index * 3
    });
  });
  cueUntil = startAt + 0.86;
}

export function warmWarmFirePiano(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(false);
}

export function setWarmFirePianoActive(enabled: boolean, nextActive: boolean) {
  if (!enabled) nextActive = false;
  if (nextActive === active) return;

  active = nextActive;
  if (!active) {
    fadeTo(0, 1.8);
    return;
  }

  void ensurePiano(true).then((instrument) => {
    if (!instrument || !active || !enabled) return;
    fadeTo(0.55, 1.2);
    scheduleLoop(instrument);
  });
}

export function tickWarmFirePiano(enabled: boolean) {
  if (!enabled || !active || !piano) return;
  scheduleLoop(piano);
}

export function playWarmFireCue(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(true).then((instrument) => {
    if (!instrument || !enabled) return;
    playCue(instrument);
  });
}

export function disposeWarmFirePiano() {
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

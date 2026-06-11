import { Reverb, SplendidGrandPiano } from "smplr";

type SoftPiano = ReturnType<typeof SplendidGrandPiano>;

const notesToLoad = [48, 52, 55, 57, 59, 60, 62, 64, 67, 69, 71, 72, 76, 79, 84];
const loopNotes = [67, 67, 67, 64, 67, 72, 60, 62, 64, 65, 67, 69, 67, 64, 60, 64, 67, 71, 72, 76, 72, 69, 67, 64] as const;
const bassNotes = [48, 55, 52, 57] as const;
const cueNotes = [72, 76, 79, 84] as const;

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
        volume: 78,
        velocity: 56,
        decayTime: 3.2,
        notesToLoad: {
          notes: notesToLoad,
          velocityRange: [1, 66]
        }
      });

      try {
        nextPiano.output.addEffect("snowflakes-room", Reverb(context), 0.18);
      } catch {
        // Reverb is optional: snowflakes must continue with silence or dry piano.
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
  bassNotes.forEach((note, index) => {
    instrument.start({
      note,
      time: startAt + index * 1.6,
      duration: 2.4,
      velocity: 42
    });
  });
  loopNotes.forEach((note, index) => {
    instrument.start({
      note,
      time: startAt + index * 0.4,
      duration: index % 6 === 0 ? 1.15 : 0.78,
      velocity: index % 3 === 0 ? 58 : 48
    });
  });
  scheduledUntil = startAt + loopNotes.length * 0.4;
}

function playCue(instrument: SoftPiano) {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  if (now < cueUntil) return;

  const startAt = now + 0.04;
  cueNotes.forEach((note, index) => {
    instrument.start({
      note,
      time: startAt + index * 0.12,
      duration: 0.9,
      velocity: 64 - index * 3
    });
  });
  cueUntil = startAt + 0.72;
}

export function warmSnowflakesPiano(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(false);
}

export function setSnowflakesPianoActive(enabled: boolean, nextActive: boolean) {
  if (!enabled) nextActive = false;
  if (nextActive === active) return;

  active = nextActive;
  if (!active) {
    fadeTo(0, 1.7);
    return;
  }

  void ensurePiano(true).then((instrument) => {
    if (!instrument || !active || !enabled) return;
    fadeTo(0.9, 1.1);
    scheduleLoop(instrument);
  });
}

export function tickSnowflakesPiano(enabled: boolean) {
  if (!enabled || !active || !piano) return;
  scheduleLoop(piano);
}

export function playSnowflakeCue(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(true).then((instrument) => {
    if (!instrument || !enabled) return;
    playCue(instrument);
  });
}

export function disposeSnowflakesPiano() {
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

import { Reverb, SplendidGrandPiano } from "smplr";

type SoftPiano = ReturnType<typeof SplendidGrandPiano>;
type PatternNote = { note: number; beat: number; duration: number; velocity: number; grace?: readonly number[] };

const notesToLoad = [50, 52, 54, 57, 59, 62, 64, 66, 69, 71, 74, 76, 78, 81, 83];
const lanternPattern = [
  { note: 62, beat: 0, duration: 0.72, velocity: 46, grace: [57, 59] },
  { note: 66, beat: 0.48, duration: 0.78, velocity: 48 },
  { note: 69, beat: 0.96, duration: 0.92, velocity: 52, grace: [66] },
  { note: 74, beat: 1.62, duration: 1.22, velocity: 55 },
  { note: 69, beat: 2.38, duration: 0.88, velocity: 48 },
  { note: 66, beat: 2.92, duration: 0.78, velocity: 45 },
  { note: 64, beat: 3.42, duration: 0.7, velocity: 43, grace: [62] },
  { note: 66, beat: 3.9, duration: 1.1, velocity: 46 },
  { note: 59, beat: 5.0, duration: 0.8, velocity: 42, grace: [54] },
  { note: 62, beat: 5.48, duration: 0.74, velocity: 45 },
  { note: 66, beat: 5.96, duration: 0.9, velocity: 50, grace: [64] },
  { note: 69, beat: 6.58, duration: 1.24, velocity: 54 },
  { note: 66, beat: 7.34, duration: 0.82, velocity: 47 },
  { note: 62, beat: 7.88, duration: 1.16, velocity: 44 },
  { note: 57, beat: 9.0, duration: 0.82, velocity: 40, grace: [54] },
  { note: 59, beat: 9.5, duration: 0.74, velocity: 43 },
  { note: 62, beat: 9.98, duration: 0.78, velocity: 46 },
  { note: 66, beat: 10.48, duration: 0.92, velocity: 50, grace: [62, 64] },
  { note: 64, beat: 11.14, duration: 0.74, velocity: 44 },
  { note: 59, beat: 11.64, duration: 1.28, velocity: 42 }
] satisfies readonly PatternNote[];
const cueNotes = [62, 66, 69, 74, 69, 66] as const;
const patternLength = 13.2;

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
        volume: 86,
        velocity: 58,
        decayTime: 2.45,
        notesToLoad: {
          notes: notesToLoad,
          velocityRange: [1, 76]
        }
      });

      try {
        nextPiano.output.addEffect("paper-lanterns-soft-room", Reverb(context), 0.32);
      } catch {
        // Reverb is optional: lantern gameplay must continue with dry piano or silence.
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
  lanternPattern.forEach((item) => {
    item.grace?.forEach((note, index) => {
      instrument.start({
        note,
        time: startAt + item.beat - 0.12 + index * 0.055,
        duration: 0.2,
        velocity: Math.max(42, item.velocity - 3)
      });
    });
    instrument.start({
      note: item.note,
      time: startAt + item.beat,
      duration: item.duration,
      velocity: item.velocity + 8
    });
  });
  scheduledUntil = startAt + patternLength;
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
      duration: index === 3 ? 1.05 : 0.62,
      velocity: index === 3 ? 74 : 66 - index * 2
    });
  });
  cueUntil = startAt + 0.98;
}

export function warmPaperLanternsPiano(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(false);
}

export function setPaperLanternsPianoActive(enabled: boolean, nextActive: boolean) {
  if (!enabled) nextActive = false;
  if (nextActive === active) return;

  active = nextActive;
  if (!active) {
    fadeTo(0, 1.5);
    return;
  }

  void ensurePiano(true).then((instrument) => {
    if (!instrument || !active || !enabled) return;
    fadeTo(1, 0.9);
    scheduleLoop(instrument);
  });
}

export function tickPaperLanternsPiano(enabled: boolean) {
  if (!enabled || !active || !piano) return;
  scheduleLoop(piano);
}

export function playPaperLanternsCue(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(true).then((instrument) => {
    if (!instrument || !enabled) return;
    playCue(instrument);
  });
}

export function disposePaperLanternsPiano() {
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

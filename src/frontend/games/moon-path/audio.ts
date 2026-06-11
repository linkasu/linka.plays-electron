import { Reverb, SplendidGrandPiano } from "smplr";

type SoftPiano = ReturnType<typeof SplendidGrandPiano>;

const notesToLoad = [45, 47, 49, 52, 54, 56, 57, 59, 61, 64, 68, 73];
const moonlightPattern = [49, 56, 61, 49, 56, 61, 52, 56, 61, 52, 56, 61, 45, 52, 57, 45, 52, 57, 47, 54, 59, 47, 54, 59] as const;
const cueNotes = [61, 64, 68, 73] as const;

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
        velocity: 58,
        decayTime: 3.9,
        notesToLoad: {
          notes: notesToLoad,
          velocityRange: [1, 64]
        }
      });

      try {
        nextPiano.output.addEffect("moon-path-room", Reverb(context), 0.24);
      } catch {
        // Reverb is optional: moon path must continue with silence or dry piano.
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
  moonlightPattern.forEach((note, index) => {
    instrument.start({
      note,
      time: startAt + index * 0.42,
      duration: index % 3 === 0 ? 1.95 : 1.5,
      velocity: index % 3 === 0 ? 64 : 52
    });
  });
  scheduledUntil = startAt + moonlightPattern.length * 0.42;
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
      duration: 1.2,
      velocity: 68 - index * 4
    });
  });
  cueUntil = startAt + 1.05;
}

export function warmMoonPathPiano(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(false);
}

export function setMoonPathPianoActive(enabled: boolean, nextActive: boolean) {
  if (!enabled) nextActive = false;
  if (nextActive === active) return;

  active = nextActive;
  if (!active) {
    fadeTo(0, 1.9);
    return;
  }

  void ensurePiano(true).then((instrument) => {
    if (!instrument || !active || !enabled) return;
    fadeTo(1, 1.2);
    scheduleLoop(instrument);
  });
}

export function tickMoonPathPiano(enabled: boolean) {
  if (!enabled || !active || !piano) return;
  scheduleLoop(piano);
}

export function playMoonPathCue(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(true).then((instrument) => {
    if (!instrument || !enabled) return;
    playCue(instrument);
  });
}

export function disposeMoonPathPiano() {
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

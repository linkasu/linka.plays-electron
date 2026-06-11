import { Reverb, SplendidGrandPiano } from "smplr";

type SoftPiano = ReturnType<typeof SplendidGrandPiano>;

const notesToLoad = [43, 45, 47, 48, 50, 52, 55, 57, 59, 60, 64, 67, 72];
const piratePattern = [45, 52, 57, 60, 57, 52, 43, 50, 55, 59, 55, 50, 45, 52, 57, 64, 60, 57, 47, 55, 59, 67, 64, 59] as const;
const cueNotes = [57, 60, 64, 72] as const;

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
        nextPiano.output.addEffect("lighthouse-room", Reverb(context), 0.18);
      } catch {
        // Reverb is optional: lighthouse gameplay must continue with silence or dry piano.
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
  if (scheduledUntil > now + 1.7) return;

  const startAt = Math.max(now + 0.08, scheduledUntil);
  piratePattern.forEach((note, index) => {
    instrument.start({
      note,
      time: startAt + index * 0.36,
      duration: index % 6 === 0 ? 1.35 : 0.95,
      velocity: index % 6 === 0 ? 62 : 50
    });
  });
  scheduledUntil = startAt + piratePattern.length * 0.36;
}

function playCue(instrument: SoftPiano) {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  if (now < cueUntil) return;

  const startAt = now + 0.04;
  cueNotes.forEach((note, index) => {
    instrument.start({
      note,
      time: startAt + index * 0.16,
      duration: 0.95,
      velocity: 64 - index * 3
    });
  });
  cueUntil = startAt + 0.86;
}

export function warmLighthousePiano(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(false);
}

export function setLighthousePianoActive(enabled: boolean, nextActive: boolean) {
  if (!enabled) nextActive = false;
  if (nextActive === active) return;

  active = nextActive;
  if (!active) {
    fadeTo(0, 1.5);
    return;
  }

  void ensurePiano(true).then((instrument) => {
    if (!instrument || !active || !enabled) return;
    fadeTo(0.92, 1.1);
    scheduleLoop(instrument);
  });
}

export function tickLighthousePiano(enabled: boolean) {
  if (!enabled || !active || !piano) return;
  scheduleLoop(piano);
}

export function playLighthouseCue(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(true).then((instrument) => {
    if (!instrument || !enabled) return;
    playCue(instrument);
  });
}

export function disposeLighthousePiano() {
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

import { Reverb, SplendidGrandPiano } from "smplr";

type SoftPiano = ReturnType<typeof SplendidGrandPiano>;

const notesToLoad = [53, 55, 57, 60, 62, 64, 66, 67, 69, 72, 76, 79, 81, 84];
const loopNotes = [53, 60, 67, 76, 72, 67, 62, 69, 76, 81, 79, 72, 57, 64, 69, 79, 76, 69, 60, 66, 72, 81, 84, 79] as const;
const cueNotes = [72, 79, 84, 81] as const;

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
        volume: 76,
        velocity: 56,
        decayTime: 3.9,
        notesToLoad: {
          notes: notesToLoad,
          velocityRange: [1, 64]
        }
      });

      try {
        nextPiano.output.addEffect("magic-dust-room", Reverb(context), 0.2);
      } catch {
        // Reverb is optional: dust drawing must continue with silence or dry piano.
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
  loopNotes.forEach((note, index) => {
    instrument.start({
      note,
      time: startAt + index * 0.32,
      duration: index % 6 === 0 ? 1.6 : 1.05,
      velocity: index % 6 === 0 ? 58 : 46
    });
  });
  scheduledUntil = startAt + loopNotes.length * 0.32;
}

function playCue(instrument: SoftPiano) {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  if (now < cueUntil) return;

  const startAt = now + 0.04;
  cueNotes.forEach((note, index) => {
    instrument.start({
      note,
      time: startAt + index * 0.14,
      duration: 1.1,
      velocity: 64 - index * 3
    });
  });
  cueUntil = startAt + 0.8;
}

export function warmMagicDustPiano(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(false);
}

export function setMagicDustPianoActive(enabled: boolean, nextActive: boolean) {
  if (!enabled) nextActive = false;
  if (nextActive === active) return;

  active = nextActive;
  if (!active) {
    fadeTo(0, 1.6);
    return;
  }

  void ensurePiano(true).then((instrument) => {
    if (!instrument || !active || !enabled) return;
    fadeTo(0.92, 1.1);
    scheduleLoop(instrument);
  });
}

export function tickMagicDustPiano(enabled: boolean) {
  if (!enabled || !active || !piano) return;
  scheduleLoop(piano);
}

export function playMagicDustCue(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(true).then((instrument) => {
    if (!instrument || !enabled) return;
    playCue(instrument);
  });
}

export function disposeMagicDustPiano() {
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

import { Reverb, SplendidGrandPiano } from "smplr";

type SoftPiano = ReturnType<typeof SplendidGrandPiano>;

const notesToLoad = [50, 53, 55, 57, 60, 62, 65, 67, 69, 72, 74, 77, 81];
const loopNotes = [50, 57, 62, 69, 67, 62, 53, 60, 65, 72, 69, 65, 55, 62, 67, 74, 72, 67, 57, 65, 69, 77, 81, 74] as const;
const cueNotes = [69, 74, 81, 77] as const;

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
        velocity: 54,
        decayTime: 3.7,
        notesToLoad: {
          notes: notesToLoad,
          velocityRange: [1, 64]
        }
      });

      try {
        nextPiano.output.addEffect("soap-circles-room", Reverb(context), 0.22);
      } catch {
        // Reverb is optional: soap circles must continue with silence or dry piano.
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
  loopNotes.forEach((note, index) => {
    instrument.start({
      note,
      time: startAt + index * 0.4,
      duration: index % 6 === 0 ? 1.7 : 1.12,
      velocity: index % 6 === 0 ? 58 : 48
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
      time: startAt + index * 0.16,
      duration: 1.05,
      velocity: 64 - index * 4
    });
  });
  cueUntil = startAt + 0.9;
}

export function warmSoapCirclesPiano(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(false);
}

export function setSoapCirclesPianoActive(enabled: boolean, nextActive: boolean) {
  if (!enabled) nextActive = false;
  if (nextActive === active) return;

  active = nextActive;
  if (!active) {
    fadeTo(0, 1.7);
    return;
  }

  void ensurePiano(true).then((instrument) => {
    if (!instrument || !active || !enabled) return;
    fadeTo(0.9, 1.2);
    scheduleLoop(instrument);
  });
}

export function tickSoapCirclesPiano(enabled: boolean) {
  if (!enabled || !active || !piano) return;
  scheduleLoop(piano);
}

export function playSoapCircleCue(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(true).then((instrument) => {
    if (!instrument || !enabled) return;
    playCue(instrument);
  });
}

export function disposeSoapCirclesPiano() {
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

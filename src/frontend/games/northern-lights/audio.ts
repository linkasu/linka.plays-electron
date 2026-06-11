import { Reverb, SplendidGrandPiano } from "smplr";

type SoftPiano = ReturnType<typeof SplendidGrandPiano>;

const notesToLoad = [42, 45, 49, 52, 54, 57, 61, 64, 66, 69, 73, 76];
const loopNotes = [42, 49, 54, 61, 66, 61, 45, 52, 57, 64, 69, 64, 49, 54, 61, 69, 73, 69, 45, 52, 57, 66, 76, 73] as const;

let audioContext: AudioContext | undefined;
let outputGain: GainNode | undefined;
let piano: SoftPiano | undefined;
let loading: Promise<SoftPiano | undefined> | undefined;
let unavailable = false;
let scheduledUntil = 0;
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
        velocity: 54,
        decayTime: 4.4,
        notesToLoad: {
          notes: notesToLoad,
          velocityRange: [1, 64]
        }
      });

      try {
        nextPiano.output.addEffect("northern-lights-room", Reverb(context), 0.25);
      } catch {
        // Reverb is optional: aurora drawing must continue with silence or dry piano.
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
  loopNotes.forEach((note, index) => {
    instrument.start({
      note,
      time: startAt + index * 0.5,
      duration: index % 6 === 0 ? 2.2 : 1.5,
      velocity: index % 6 === 0 ? 60 : 48
    });
  });
  scheduledUntil = startAt + loopNotes.length * 0.5;
}

export function warmNorthernLightsPiano(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(false);
}

export function setNorthernLightsPianoActive(enabled: boolean, nextActive: boolean) {
  if (!enabled) nextActive = false;
  if (nextActive === active) return;

  active = nextActive;
  if (!active) {
    fadeTo(0, 1.9);
    return;
  }

  void ensurePiano(true).then((instrument) => {
    if (!instrument || !active || !enabled) return;
    fadeTo(0.92, 1.4);
    scheduleLoop(instrument);
  });
}

export function tickNorthernLightsPiano(enabled: boolean) {
  if (!enabled || !active || !piano) return;
  scheduleLoop(piano);
}

export function disposeNorthernLightsPiano() {
  active = false;
  scheduledUntil = 0;
  piano?.dispose();
  piano = undefined;
  loading = undefined;
  outputGain?.disconnect();
  outputGain = undefined;
  void audioContext?.close().catch(() => undefined);
  audioContext = undefined;
  unavailable = false;
}

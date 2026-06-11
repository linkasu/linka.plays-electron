import { Reverb, SplendidGrandPiano } from "smplr";

type SoftPiano = ReturnType<typeof SplendidGrandPiano>;

const notesToLoad = [57, 60, 64, 67, 69, 72];
const loopNotes = [60, 64, 67, 72, 69, 67, 64, 57] as const;

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
        volume: 58,
        velocity: 48,
        decayTime: 2.4,
        notesToLoad: {
          notes: notesToLoad,
          velocityRange: [1, 70]
        }
      });

      try {
        nextPiano.output.addEffect("breathing-flower-room", Reverb(context), 0.16);
      } catch {
        // Reverb is optional; the flower can stay silent or dry without breaking play.
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
  if (scheduledUntil > now + 1.2) return;

  const startAt = Math.max(now + 0.08, scheduledUntil);
  loopNotes.forEach((note, index) => {
    instrument.start({
      note,
      time: startAt + index * 0.82,
      duration: 1.45,
      velocity: index % 4 === 0 ? 42 : 34
    });
  });
  scheduledUntil = startAt + loopNotes.length * 0.82;
}

export function warmBreathingFlowerPiano(enabled: boolean) {
  if (!enabled) return;
  void ensurePiano(false);
}

export function setBreathingFlowerPianoActive(enabled: boolean, nextActive: boolean) {
  if (!enabled) nextActive = false;
  if (nextActive === active && !nextActive) return;

  active = nextActive;
  if (!active) {
    fadeTo(0, 1.8);
    return;
  }

  void ensurePiano(true).then((instrument) => {
    if (!instrument || !active || !enabled) return;
    fadeTo(0.8, 1.2);
    scheduleLoop(instrument);
  });
}

export function tickBreathingFlowerPiano(enabled: boolean) {
  if (!enabled || !active || !piano) return;
  scheduleLoop(piano);
}

export function disposeBreathingFlowerPiano() {
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

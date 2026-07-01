import { Reverb, SplendidGrandPiano } from "smplr";

type SoftPiano = ReturnType<typeof SplendidGrandPiano>;

export type SoftPianoSampledNote = {
  note: string | number;
  at: number;
  duration: number;
  velocity: number;
};

export type SoftPianoFallbackNote = {
  frequency: number;
  at: number;
  duration: number;
  peak: number;
};

export type SoftPianoMelody = {
  notesToLoad?: number[];
  sampled: SoftPianoSampledNote[];
  fallback: SoftPianoFallbackNote[];
  lengthSeconds?: number;
};

const defaultNotesToLoad = [60, 64, 67, 72];
const maxPianoOutputGain = 1;
const maxPianoVolume = 100;
const maxFallbackGain = 1;
let audioContext: AudioContext | undefined;
let piano: SoftPiano | undefined;
let loading: Promise<SoftPiano | undefined> | undefined;
let loadedNotesKey = "";
let unavailable = false;
let melodyUntil = 0;
let fallbackGain: GainNode | undefined;

function createAudioContext() {
  const AudioContextConstructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioContextConstructor ? new AudioContextConstructor() : undefined;
}

function normalizeNotes(notesToLoad = defaultNotesToLoad) {
  return [...new Set(notesToLoad)].sort((a, b) => a - b);
}

function notesKey(notesToLoad = defaultNotesToLoad) {
  return normalizeNotes(notesToLoad).join(",");
}

async function ensureAudioContext(resumeAudio: boolean) {
  audioContext = audioContext ?? createAudioContext();
  if (!audioContext) return undefined;
  if (resumeAudio && audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch {
      return undefined;
    }
  }
  return audioContext;
}

async function ensurePiano(resumeAudio: boolean, notesToLoad = defaultNotesToLoad) {
  if (unavailable) return undefined;

  const nextNotes = normalizeNotes(notesToLoad);
  const nextNotesKey = notesKey(nextNotes);
  if (piano && loadedNotesKey === nextNotesKey) {
    if (resumeAudio && audioContext?.state === "suspended") await audioContext.resume();
    return piano;
  }
  if (piano && loadedNotesKey !== nextNotesKey) {
    piano.dispose();
    piano = undefined;
    loadedNotesKey = "";
    loading = undefined;
  }
  if (loading) return loading;

  loading = (async () => {
    try {
      const context = await ensureAudioContext(resumeAudio);
      if (!context) return undefined;

      const output = context.createGain();
      output.gain.value = maxPianoOutputGain;
      output.connect(context.destination);

      const nextPiano = SplendidGrandPiano(context, {
        destination: output,
        volume: maxPianoVolume,
        velocity: 62,
        decayTime: 1.8,
        notesToLoad: {
          notes: nextNotes,
          velocityRange: [1, 80]
        }
      });

      try {
        nextPiano.output.addEffect("soft-room", Reverb(context), 0.18);
      } catch {
        // Reverb is optional: sample playback must stay available without it.
      }

      await nextPiano.ready;
      piano = nextPiano;
      loadedNotesKey = nextNotesKey;
      return nextPiano;
    } catch {
      unavailable = true;
      return undefined;
    }
  })();

  return loading;
}

function melodyLength(melody: SoftPianoMelody) {
  if (melody.lengthSeconds !== undefined) return melody.lengthSeconds;
  const lastFallback = melody.fallback.reduce((max, note) => Math.max(max, note.at + note.duration), 0);
  const lastSampled = melody.sampled.reduce((max, note) => Math.max(max, note.at + note.duration), 0);
  return Math.max(lastFallback, lastSampled);
}

function playFallbackMelody(context: AudioContext, startAt: number, notes: SoftPianoFallbackNote[]) {
  fallbackGain = fallbackGain ?? context.createGain();
  fallbackGain.gain.value = maxFallbackGain;
  fallbackGain.connect(context.destination);

  for (const note of notes) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const noteStart = startAt + note.at;
    const noteEnd = noteStart + note.duration;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(note.frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.linearRampToValueAtTime(note.peak, noteStart + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    oscillator.connect(gain);
    gain.connect(fallbackGain);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.04);
  }
}

function playSampledPianoMelody(instrument: SoftPiano, startAt: number, notes: SoftPianoSampledNote[]) {
  for (const note of notes) {
    instrument.start({
      note: note.note,
      time: startAt + note.at,
      duration: note.duration,
      velocity: note.velocity
    });
  }
}

export function warmSoftPiano(enabled: boolean, notesToLoad = defaultNotesToLoad) {
  if (!enabled) return;
  void ensurePiano(false, notesToLoad);
}

export async function playSoftPianoMelody(enabled: boolean, melody: SoftPianoMelody) {
  if (!enabled) return;
  const context = await ensureAudioContext(true);
  if (!context || context.state !== "running") return;
  if (context.currentTime < melodyUntil) return;

  const startAt = context.currentTime + 0.04;
  melodyUntil = startAt + melodyLength(melody);
  if (piano && loadedNotesKey === notesKey(melody.notesToLoad)) playSampledPianoMelody(piano, startAt, melody.sampled);
  else playFallbackMelody(context, startAt, melody.fallback);
  void ensurePiano(false, melody.notesToLoad);
}

export function disposeSoftPiano() {
  piano?.dispose();
  piano = undefined;
  loading = undefined;
  loadedNotesKey = "";
  fallbackGain?.disconnect();
  fallbackGain = undefined;
  melodyUntil = 0;
  void audioContext?.close().catch(() => undefined);
  audioContext = undefined;
  unavailable = false;
}

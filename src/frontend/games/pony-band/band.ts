import { resolvePublicAssetUrl } from "../../core/publicAsset";
import {
  beatSeconds,
  joinTime,
  loopOffset,
  loopSeconds,
  ponyMusicPath,
  ponyRoles,
  type PonyRole,
  type PonyStyle,
} from "./model";

// One clock for the whole band. The first pony starts the song from its beginning; every other
// pony comes in on the next beat at the place in the song where the others are, so any mix
// stays in time. A style change waits for the next beat and starts the new song from the top
// with the same ponies playing.

type Voice = { source: AudioBufferSourceNode; gain: GainNode };
type StyleBuffers = Map<PonyRole, AudioBuffer>;

const FADE_IN = 0.02;
const FADE_OUT = 0.2;
const START_LEAD = 0.05;

function createContext() {
  const Constructor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Constructor) return undefined;
  try {
    // The loops are rendered at 44.1 kHz: no resampling, so their length stays exact.
    return new Constructor({ sampleRate: 44100 });
  } catch {
    return new Constructor();
  }
}

export function createPonyBand(initialStyle: PonyStyle) {
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let style = initialStyle;
  let clockStart: number | undefined;
  let generation = 0;
  let muted = false;
  let disposed = false;
  const loaded = new Map<string, Promise<StyleBuffers>>();
  const voices = new Map<PonyRole, Voice>();
  const desired = new Set<PonyRole>();

  function ensureContext() {
    if (disposed) return undefined;
    if (!context) {
      context = createContext();
      if (!context) return undefined;
      master = context.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(context.destination);
    }
    return context;
  }

  function load(target: PonyStyle) {
    let pending = loaded.get(target.id);
    if (!pending) {
      const ctx = ensureContext();
      if (!ctx) return Promise.reject(new Error("Web Audio is not available"));
      pending = Promise.all(
        ponyRoles.map(async (role) => {
          const response = await fetch(resolvePublicAssetUrl(ponyMusicPath(target.id, role)));
          if (!response.ok) throw new Error(`Нет музыки ${target.id}/${role}`);
          const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
          return [role, buffer] as const;
        }),
      ).then((entries) => new Map(entries));
      pending.catch(() => loaded.delete(target.id));
      loaded.set(target.id, pending);
      // Decoded loops are large: keep only the playing style and the one being loaded.
      for (const id of loaded.keys()) if (id !== target.id && id !== style.id) loaded.delete(id);
    }
    return pending;
  }

  function startVoice(role: PonyRole, buffer: AudioBuffer, at: number, offset: number) {
    if (!context || !master) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = Math.min(loopSeconds(style), buffer.duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(1, at + FADE_IN);
    source.connect(gain).connect(master);
    source.start(at, offset);
    voices.set(role, { source, gain });
  }

  function stopVoice(role: PonyRole, at?: number) {
    const voice = voices.get(role);
    if (!voice || !context) return;
    voices.delete(role);
    const when = Math.max(at ?? context.currentTime, context.currentTime);
    voice.gain.gain.cancelScheduledValues(when);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, when);
    voice.gain.gain.linearRampToValueAtTime(0, when + FADE_OUT);
    try {
      voice.source.stop(when + FADE_OUT + 0.05);
    } catch {
      // Already stopped.
    }
  }

  async function setRole(role: PonyRole, on: boolean) {
    if (on) desired.add(role);
    else desired.delete(role);
    if (!on) {
      stopVoice(role);
      if (voices.size === 0) clockStart = undefined;
      return;
    }
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
    const ticket = generation;
    const buffers = await load(style);
    if (disposed || ticket !== generation || !desired.has(role) || voices.has(role)) return;
    const now = ctx.currentTime;
    let at: number;
    if (clockStart === undefined || voices.size === 0) {
      clockStart = now + START_LEAD;
      at = clockStart;
    } else {
      at = joinTime(clockStart, now, beatSeconds(style));
    }
    startVoice(role, buffers.get(role)!, at, loopOffset(at - clockStart, loopSeconds(style)));
  }

  async function setStyle(next: PonyStyle) {
    const previous = style;
    style = next;
    const ticket = ++generation;
    const ctx = ensureContext();
    if (!ctx) return;
    const buffers = await load(next);
    if (disposed || ticket !== generation) return;
    const now = ctx.currentTime;
    const at =
      clockStart !== undefined && voices.size > 0
        ? joinTime(clockStart, now, beatSeconds(previous))
        : now + START_LEAD;
    for (const role of [...voices.keys()]) stopVoice(role, at);
    if (desired.size === 0) {
      clockStart = undefined;
      return;
    }
    clockStart = at;
    for (const role of desired) startVoice(role, buffers.get(role)!, at, 0);
  }

  return {
    setRole,
    setStyle,
    /** Load a style ahead so the first pony starts without a wait. */
    preload: (target: PonyStyle) => load(target).catch(() => undefined),
    setMuted(value: boolean) {
      muted = value;
      if (master && context) master.gain.setTargetAtTime(value ? 0 : 1, context.currentTime, 0.05);
    },
    pause() {
      void context?.suspend();
    },
    resume() {
      void context?.resume();
    },
    stopAll() {
      desired.clear();
      for (const role of [...voices.keys()]) stopVoice(role);
      clockStart = undefined;
    },
    dispose() {
      disposed = true;
      desired.clear();
      voices.clear();
      loaded.clear();
      void context?.close();
      context = undefined;
    },
    /** For tests and the e2e check: the scheduled start of the song, in audio-clock seconds. */
    debugState: () => ({
      clockStart,
      playing: [...voices.keys()],
      time: context?.currentTime ?? 0,
      sampleRate: context?.sampleRate ?? 0,
    }),
  };
}

export type PonyBand = ReturnType<typeof createPonyBand>;

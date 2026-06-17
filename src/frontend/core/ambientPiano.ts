import { Reverb, SplendidGrandPiano } from "smplr";

type SoftPiano = ReturnType<typeof SplendidGrandPiano>;

export type AmbientPianoPatternNote = {
  note: number;
  beat: number;
  duration: number;
  velocity: number;
  grace?: readonly number[];
};

export type AmbientPianoLoopLayer = {
  notes: readonly number[];
  stepSeconds: number;
  durationSeconds: number;
  velocity: number;
};

export type AmbientPianoConfig = {
  notesToLoad: number[];
  loopNotes?: readonly number[];
  loopLayers?: AmbientPianoLoopLayer[];
  patternNotes?: readonly AmbientPianoPatternNote[];
  patternLengthSeconds?: number;
  graceOffsetSeconds?: number;
  graceStepSeconds?: number;
  graceDurationSeconds?: number;
  graceMinVelocity?: number;
  graceVelocityOffset?: number;
  patternVelocityOffset?: number;
  cueNotes?: readonly number[];
  reverbName: string;
  reverbAmount: number;
  volume: number;
  velocity: number;
  decayTime: number;
  velocityRange: [number, number];
  loopLookaheadSeconds: number;
  loopStepSeconds: number;
  loopAccentEvery: number;
  loopAccentDurationSeconds: number;
  loopBaseDurationSeconds: number;
  loopAccentVelocity: number;
  loopBaseVelocity: number;
  cueStepSeconds?: number;
  cueDurationSeconds?: number | readonly number[];
  cueVelocities?: readonly number[];
  cueStartVelocity?: number;
  cueVelocityStep?: number;
  cueCooldownSeconds?: number;
  activeGain: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  rescheduleActive?: boolean;
};

function createAudioContext() {
  const AudioContextConstructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioContextConstructor ? new AudioContextConstructor() : undefined;
}

export function createAmbientPiano(config: AmbientPianoConfig) {
  let audioContext: AudioContext | undefined;
  let outputGain: GainNode | undefined;
  let piano: SoftPiano | undefined;
  let loading: Promise<SoftPiano | undefined> | undefined;
  let unavailable = false;
  let scheduledUntil = 0;
  let cueUntil = 0;
  let active = false;

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
          volume: config.volume,
          velocity: config.velocity,
          decayTime: config.decayTime,
          notesToLoad: {
            notes: config.notesToLoad,
            velocityRange: config.velocityRange
          }
        });

        try {
          nextPiano.output.addEffect(config.reverbName, Reverb(context), config.reverbAmount);
        } catch {
          // Reverb is optional: gameplay must continue with dry piano or silence.
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
    if (scheduledUntil > now + config.loopLookaheadSeconds) return;

    const startAt = Math.max(now + 0.08, scheduledUntil);
    for (const layer of config.loopLayers ?? []) {
      layer.notes.forEach((note, index) => {
        instrument.start({
          note,
          time: startAt + index * layer.stepSeconds,
          duration: layer.durationSeconds,
          velocity: layer.velocity
        });
      });
    }

    if (config.patternNotes) {
      const graceOffset = config.graceOffsetSeconds ?? -0.12;
      const graceStep = config.graceStepSeconds ?? 0.055;
      const graceDuration = config.graceDurationSeconds ?? 0.2;
      const graceMinVelocity = config.graceMinVelocity ?? 42;
      const graceVelocityOffset = config.graceVelocityOffset ?? -3;
      const patternVelocityOffset = config.patternVelocityOffset ?? 8;
      config.patternNotes.forEach((item) => {
        item.grace?.forEach((note, index) => {
          instrument.start({
            note,
            time: startAt + item.beat + graceOffset + index * graceStep,
            duration: graceDuration,
            velocity: Math.max(graceMinVelocity, item.velocity + graceVelocityOffset)
          });
        });
        instrument.start({
          note: item.note,
          time: startAt + item.beat,
          duration: item.duration,
          velocity: item.velocity + patternVelocityOffset
        });
      });
      scheduledUntil = startAt + (config.patternLengthSeconds ?? config.loopStepSeconds);
      return;
    }

    const loopNotes = config.loopNotes ?? [];
    loopNotes.forEach((note, index) => {
      const isAccent = config.loopAccentEvery > 0 && index % config.loopAccentEvery === 0;
      instrument.start({
        note,
        time: startAt + index * config.loopStepSeconds,
        duration: isAccent ? config.loopAccentDurationSeconds : config.loopBaseDurationSeconds,
        velocity: isAccent ? config.loopAccentVelocity : config.loopBaseVelocity
      });
    });
    scheduledUntil = startAt + loopNotes.length * config.loopStepSeconds;
  }

  function playCue(instrument: SoftPiano) {
    if (!audioContext || !config.cueNotes) return;
    const now = audioContext.currentTime;
    if (now < cueUntil) return;

    const startAt = now + 0.04;
    const step = config.cueStepSeconds ?? 0.15;
    const startVelocity = config.cueStartVelocity ?? 64;
    const velocityStep = config.cueVelocityStep ?? 2;
    config.cueNotes.forEach((note, index) => {
      const duration = Array.isArray(config.cueDurationSeconds) ? config.cueDurationSeconds[index] : config.cueDurationSeconds;
      const velocity = config.cueVelocities?.[index] ?? startVelocity - index * velocityStep;
      instrument.start({
        note,
        time: startAt + index * step,
        duration: duration ?? 0.95,
        velocity
      });
    });
    cueUntil = startAt + (config.cueCooldownSeconds ?? 0.82);
  }

  return {
    warm(enabled: boolean) {
      if (!enabled) return;
      void ensurePiano(false);
    },
    setActive(enabled: boolean, nextActive: boolean) {
      if (!enabled) nextActive = false;
      if (nextActive === active && (!nextActive || !config.rescheduleActive)) return;

      active = nextActive;
      if (!active) {
        fadeTo(0, config.fadeOutSeconds);
        return;
      }

      void ensurePiano(true).then((instrument) => {
        if (!instrument || !active || !enabled) return;
        fadeTo(config.activeGain, config.fadeInSeconds);
        scheduleLoop(instrument);
      });
    },
    tick(enabled: boolean) {
      if (!enabled || !active || !piano) return;
      scheduleLoop(piano);
    },
    playCue(enabled: boolean) {
      if (!enabled) return;
      void ensurePiano(true).then((instrument) => {
        if (!instrument || !enabled) return;
        playCue(instrument);
      });
    },
    dispose() {
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
  };
}

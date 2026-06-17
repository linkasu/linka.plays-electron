import { Reverb, SplendidGrandPiano } from "smplr";

type SoftPiano = ReturnType<typeof SplendidGrandPiano>;

export type AmbientPianoConfig = {
  notesToLoad: number[];
  loopNotes: readonly number[];
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
  cueDurationSeconds?: number;
  cueStartVelocity?: number;
  cueVelocityStep?: number;
  cueCooldownSeconds?: number;
  activeGain: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
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
    config.loopNotes.forEach((note, index) => {
      const isAccent = index % config.loopAccentEvery === 0;
      instrument.start({
        note,
        time: startAt + index * config.loopStepSeconds,
        duration: isAccent ? config.loopAccentDurationSeconds : config.loopBaseDurationSeconds,
        velocity: isAccent ? config.loopAccentVelocity : config.loopBaseVelocity
      });
    });
    scheduledUntil = startAt + config.loopNotes.length * config.loopStepSeconds;
  }

  function playCue(instrument: SoftPiano) {
    if (!audioContext || !config.cueNotes) return;
    const now = audioContext.currentTime;
    if (now < cueUntil) return;

    const startAt = now + 0.04;
    const step = config.cueStepSeconds ?? 0.15;
    const duration = config.cueDurationSeconds ?? 0.95;
    const startVelocity = config.cueStartVelocity ?? 64;
    const velocityStep = config.cueVelocityStep ?? 2;
    config.cueNotes.forEach((note, index) => {
      instrument.start({
        note,
        time: startAt + index * step,
        duration,
        velocity: startVelocity - index * velocityStep
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
      if (nextActive === active) return;

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

import { Reverb, SplendidGrandPiano } from "smplr";
import { isTtsPlaybackActive, subscribeTtsPlayback } from "./ttsAudio";

type SoftPiano = ReturnType<typeof SplendidGrandPiano>;
const maxAmbientGain = 0.22;

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
  cueQuantizeToLoop?: boolean;
  cueQuantizeDelaySteps?: number;
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
  let loadingPiano: SoftPiano | undefined;
  let loading: Promise<SoftPiano | undefined> | undefined;
  let unavailable = false;
  let scheduledUntil = 0;
  let cueUntil = 0;
  let active = false;
  let intensity = 1;
  let gainTarget = 0;
  let loopGridStartAt: number | undefined;
  let lifecycle = 0;
  let contextTransition: Promise<void> | undefined;
  let ttsActive = isTtsPlaybackActive();
  let unsubscribeTts: (() => void) | undefined;

  function ambientGain(nextIntensity = intensity) {
    return Math.min(maxAmbientGain, Math.max(0, config.activeGain * nextIntensity));
  }

  function silence() {
    if (!audioContext || !outputGain) return;
    try {
      const now = audioContext.currentTime;
      outputGain.gain.cancelScheduledValues(now);
      outputGain.gain.setValueAtTime(0, now);
      gainTarget = 0;
    } catch {
      // A closing context is already silent.
    }
  }

  function stopAudio() {
    lifecycle += 1;
    contextTransition = undefined;
    scheduledUntil = 0;
    cueUntil = 0;
    loopGridStartAt = undefined;
    silence();

    const context = audioContext;
    const gain = outputGain;
    const instruments = new Set([piano, loadingPiano].filter((instrument): instrument is SoftPiano => Boolean(instrument)));
    audioContext = undefined;
    outputGain = undefined;
    piano = undefined;
    loadingPiano = undefined;
    loading = undefined;
    unavailable = false;

    for (const instrument of instruments) {
      try {
        instrument.dispose();
      } catch {
        // Disposal errors must degrade to silence.
      }
    }
    try {
      gain?.disconnect();
    } catch {
      // The node may already be disconnected by its instrument.
    }
    try {
      void context?.close().catch(() => undefined);
    } catch {
      // Some Web Audio implementations throw synchronously while closing.
    }
  }

  function queueContextTransition(context: AudioContext, currentLifecycle: number, transition: () => Promise<void>) {
    const run = async () => {
      if (context !== audioContext || currentLifecycle !== lifecycle) return false;
      await transition();
      return context === audioContext && currentLifecycle === lifecycle;
    };
    const result = contextTransition ? contextTransition.then(run) : run();
    const settled = result.then(() => undefined, () => undefined);
    contextTransition = settled;
    void settled.then(() => {
      if (contextTransition === settled) contextTransition = undefined;
    });
    return result;
  }

  async function ensurePiano(resumeAudio: boolean) {
    if (unavailable) return undefined;
    try {
      audioContext = audioContext ?? createAudioContext();
    } catch {
      unavailable = true;
      return undefined;
    }
    if (!audioContext) return undefined;

    const context = audioContext;
    const currentLifecycle = lifecycle;

    if (resumeAudio) {
      try {
        const valid = await queueContextTransition(context, currentLifecycle, async () => {
          if (context.state === "suspended") await context.resume();
        });
        if (!valid) return undefined;
      } catch {
        if (context === audioContext && currentLifecycle === lifecycle) {
          stopAudio();
          unavailable = true;
        }
        return undefined;
      }
    }

    if (context !== audioContext || currentLifecycle !== lifecycle) return undefined;

    if (piano) return piano;
    if (loading) return loading;

    loading = (async () => {
      try {
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
        loadingPiano = nextPiano;

        try {
          nextPiano.output.addEffect(config.reverbName, Reverb(context), config.reverbAmount);
        } catch {
          // Reverb is optional: gameplay must continue with dry piano or silence.
        }

        await nextPiano.ready;
        if (context !== audioContext || currentLifecycle !== lifecycle) return undefined;
        loadingPiano = undefined;
        piano = nextPiano;
        return nextPiano;
      } catch {
        if (context === audioContext && currentLifecycle === lifecycle) {
          stopAudio();
          unavailable = true;
        }
        return undefined;
      }
    })();

    return loading;
  }

  function fadeTo(target: number, seconds: number) {
    if (!audioContext || !outputGain) return;
    gainTarget = Math.min(maxAmbientGain, Math.max(0, target));
    const gain = outputGain.gain;
    const now = audioContext.currentTime;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(gainTarget, now, seconds / 3);
  }

  function failSilent() {
    stopAudio();
    unavailable = true;
  }

  function startActiveAudio() {
    if (!active || ttsActive) return;
    void ensurePiano(true).then((instrument) => {
      if (!instrument || !active || ttsActive) return;
      try {
        fadeTo(ambientGain(), config.fadeInSeconds);
        scheduleLoop(instrument);
      } catch {
        failSilent();
      }
    }).catch(failSilent);
  }

  function handleTtsPlayback(nextActive: boolean) {
    const wasTtsActive = ttsActive;
    ttsActive = nextActive;
    if (!ttsActive) {
      if (wasTtsActive) startActiveAudio();
      return;
    }

    silence();
    const context = audioContext;
    if (!context) return;
    if (!active) {
      stopAudio();
      return;
    }
    const currentLifecycle = lifecycle;
    void queueContextTransition(context, currentLifecycle, async () => {
      if (context.state === "running") await context.suspend();
    }).catch(() => {
      if (context === audioContext && currentLifecycle === lifecycle) stopAudio();
    });
  }

  function ensureTtsSubscription() {
    unsubscribeTts ??= subscribeTtsPlayback(handleTtsPlayback);
  }

  function scheduleLoop(instrument: SoftPiano) {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    if (scheduledUntil > now + config.loopLookaheadSeconds) return;

    const startAt = Math.max(now + 0.08, scheduledUntil);
    loopGridStartAt ??= startAt;
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

    const step = config.cueStepSeconds ?? 0.15;
    let startAt = now + 0.04;
    if (config.cueQuantizeToLoop && loopGridStartAt !== undefined) {
      const gridStep = Math.max(0.1, config.loopStepSeconds);
      const nextGridIndex = Math.ceil((startAt - loopGridStartAt) / gridStep) + (config.cueQuantizeDelaySteps ?? 0);
      startAt = loopGridStartAt + nextGridIndex * gridStep;
    }
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
      void ensurePiano(false).catch(() => undefined);
    },
    setActive(enabled: boolean, nextActive: boolean) {
      nextActive = enabled && nextActive;
      if (nextActive === active && (!nextActive || !config.rescheduleActive)) return;

      active = nextActive;
      if (!active) {
        unsubscribeTts?.();
        unsubscribeTts = undefined;
        stopAudio();
        return;
      }

      ensureTtsSubscription();
      startActiveAudio();
    },
    setIntensity(enabled: boolean, nextIntensity: number) {
      intensity = Math.max(0, Math.min(1, nextIntensity));
      if (!enabled || !active || ttsActive) return;
      const nextGainTarget = ambientGain();
      if (Math.abs(nextGainTarget - gainTarget) < 0.02) return;
      try {
        fadeTo(nextGainTarget, 0.55);
      } catch {
        failSilent();
      }
    },
    tick(enabled: boolean) {
      if (!enabled || !active || ttsActive || !piano) return;
      try {
        scheduleLoop(piano);
      } catch {
        failSilent();
      }
    },
    playCue(enabled: boolean) {
      if (!enabled) return;
      ensureTtsSubscription();
      if (ttsActive) return;
      void ensurePiano(true).then((instrument) => {
        if (!instrument || ttsActive) return;
        try {
          playCue(instrument);
        } catch {
          failSilent();
        }
      }).catch(failSilent);
    },
    dispose() {
      active = false;
      unsubscribeTts?.();
      unsubscribeTts = undefined;
      stopAudio();
    }
  };
}

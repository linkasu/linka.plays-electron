let audioContext: AudioContext | undefined;

function createAudioContext() {
  const AudioContextConstructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioContextConstructor ? new AudioContextConstructor() : undefined;
}

export function playOpenDoorCue(enabled: boolean) {
  if (!enabled) return;

  try {
    audioContext ??= createAudioContext();
    const context = audioContext;
    if (!context) return;

    void context.resume().then(() => {
      const startedAt = context.currentTime;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, startedAt);
      gain.gain.exponentialRampToValueAtTime(0.045, startedAt + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.85);
      gain.connect(context.destination);

      [523.25, 659.25, 783.99].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        oscillator.start(startedAt + index * 0.11);
        oscillator.stop(startedAt + 0.8);
      });

      window.setTimeout(() => gain.disconnect(), 1000);
    }).catch(() => undefined);
  } catch {
    // The reward remains fully usable when Web Audio is unavailable.
  }
}

export function disposeOpenDoorCue() {
  void audioContext?.close().catch(() => undefined);
  audioContext = undefined;
}

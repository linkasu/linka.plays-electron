import { resolvePublicAssetUrl } from "./publicAsset";

export type TtsAsset = {
  id: string;
  game: string;
  text: string;
  voice?: string;
  path: string;
};

const audioCache = new Map<string, HTMLAudioElement>();
let currentAudio: HTMLAudioElement | undefined;
let currentPlaybackFinish: (() => void) | undefined;
let ttsPlaybackActive = false;
const playbackListeners = new Set<(active: boolean) => void>();

function setTtsPlaybackActive(active: boolean) {
  if (ttsPlaybackActive === active) return;
  ttsPlaybackActive = active;
  for (const listener of playbackListeners) {
    try {
      listener(active);
    } catch {
      // Audio focus observers are optional and must not break speech playback.
    }
  }
}

function trackTtsPlayback(audio: HTMLAudioElement, onFinish?: () => void) {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    audio.removeEventListener("ended", finish);
    audio.removeEventListener("error", finish);
    audio.removeEventListener("pause", finish);
    if (currentPlaybackFinish === finish) currentPlaybackFinish = undefined;
    setTtsPlaybackActive(false);
    onFinish?.();
  };

  currentPlaybackFinish?.();
  currentPlaybackFinish = finish;
  audio.addEventListener("ended", finish);
  audio.addEventListener("error", finish);
  audio.addEventListener("pause", finish);
  setTtsPlaybackActive(true);
  return finish;
}

export function isTtsPlaybackActive() {
  return ttsPlaybackActive;
}

export function subscribeTtsPlayback(listener: (active: boolean) => void) {
  playbackListeners.add(listener);
  listener(ttsPlaybackActive);
  return () => playbackListeners.delete(listener);
}

function getAudio(asset: TtsAsset) {
  const src = resolvePublicAssetUrl(asset.path);
  let audio = audioCache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = 0.42;
    audioCache.set(src, audio);
  }
  return audio;
}

function startTtsAsset(enabled: boolean, asset: TtsAsset | undefined, volume: number) {
  if (!enabled || !asset) return undefined;
  stopTtsPlayback();
  currentAudio = getAudio(asset);
  currentAudio.pause();
  currentAudio.currentTime = 0;
  currentAudio.volume = volume;
  return currentAudio;
}

export function warmTtsAssets(enabled: boolean, assets: TtsAsset[]) {
  if (!enabled) return;
  for (const asset of assets) {
    try {
      getAudio(asset).load();
    } catch {
      // TTS is optional: missing assets must degrade to silence.
    }
  }
}

export function playTtsAsset(enabled: boolean, asset: TtsAsset | undefined, volume = 0.42) {
  let finish: (() => void) | undefined;
  try {
    const audio = startTtsAsset(enabled, asset, volume);
    if (!audio) return;
    finish = trackTtsPlayback(audio);
    void audio.play().catch(finish);
  } catch {
    finish?.();
    // Speech prompts are supportive only; gameplay continues silently.
  }
}

export function playTtsAssetAndWait(enabled: boolean, asset: TtsAsset | undefined, volume = 0.42) {
  if (!enabled || !asset) return Promise.resolve();
  try {
    const audio = startTtsAsset(enabled, asset, volume);
    if (!audio) return Promise.resolve();

    return new Promise<void>((resolve) => {
      let fallbackTimer = 0;
      const finish = trackTtsPlayback(audio, () => {
        window.clearTimeout(fallbackTimer);
        resolve();
      });
      fallbackTimer = window.setTimeout(finish, 6000);

      try {
        void audio.play().catch(finish);
      } catch {
        finish();
      }
    });
  } catch {
    return Promise.resolve();
  }
}

export function stopTtsPlayback() {
  currentPlaybackFinish?.();
  const audio = currentAudio;
  currentAudio = undefined;
  if (!audio) return;
  audio.pause();
  try {
    audio.currentTime = 0;
  } catch {
    // Audio may already be detached while a route transition is disposing assets.
  }
}

export function disposeTtsAssets(assets: TtsAsset[]) {
  for (const asset of assets) {
    const src = resolvePublicAssetUrl(asset.path);
    const audio = audioCache.get(src);
    if (!audio) continue;
    if (currentAudio === audio) stopTtsPlayback();
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    audioCache.delete(src);
  }
}

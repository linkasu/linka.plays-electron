export type TtsAsset = {
  id: string;
  game: string;
  text: string;
  voice?: string;
  path: string;
};

const audioCache = new Map<string, HTMLAudioElement>();
let currentAudio: HTMLAudioElement | undefined;

function resolveAudioPath(path: string) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(`${normalizedBase}${normalizedPath}`, window.location.href).toString();
}

function getAudio(asset: TtsAsset) {
  const src = resolveAudioPath(asset.path);
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
  currentAudio?.pause();
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
  try {
    void startTtsAsset(enabled, asset, volume)?.play().catch(() => undefined);
  } catch {
    // Speech prompts are supportive only; gameplay continues silently.
  }
}

export function playTtsAssetAndWait(enabled: boolean, asset: TtsAsset | undefined, volume = 0.42) {
  if (!enabled || !asset) return Promise.resolve();
  try {
    const audio = startTtsAsset(enabled, asset, volume);
    if (!audio) return Promise.resolve();

    return new Promise<void>((resolve) => {
      let settled = false;
      let fallbackTimer = 0;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(fallbackTimer);
        audio.removeEventListener("ended", finish);
        audio.removeEventListener("error", finish);
        audio.removeEventListener("pause", finish);
        resolve();
      };
      fallbackTimer = window.setTimeout(finish, 6000);

      audio.addEventListener("ended", finish);
      audio.addEventListener("error", finish);
      audio.addEventListener("pause", finish);
      void audio.play().catch(finish);
    });
  } catch {
    return Promise.resolve();
  }
}

export function stopTtsPlayback() {
  if (!currentAudio) return;
  currentAudio.pause();
  try {
    currentAudio.currentTime = 0;
  } catch {
    // Audio may already be detached while a route transition is disposing assets.
  }
  currentAudio = undefined;
}

export function disposeTtsAssets(assets: TtsAsset[]) {
  for (const asset of assets) {
    const src = resolveAudioPath(asset.path);
    const audio = audioCache.get(src);
    if (!audio) continue;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    audioCache.delete(src);
    if (currentAudio === audio) currentAudio = undefined;
  }
}

export type TtsAsset = {
  id: string;
  game: string;
  text: string;
  voice?: string;
  path: string;
};

const audioCache = new Map<string, HTMLAudioElement>();
let currentAudio: HTMLAudioElement | undefined;

function getAudio(asset: TtsAsset) {
  let audio = audioCache.get(asset.path);
  if (!audio) {
    audio = new Audio(asset.path);
    audio.preload = "auto";
    audio.volume = 0.42;
    audioCache.set(asset.path, audio);
  }
  return audio;
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
  if (!enabled || !asset) return;
  try {
    currentAudio?.pause();
    currentAudio = getAudio(asset);
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.volume = volume;
    void currentAudio.play().catch(() => undefined);
  } catch {
    // Speech prompts are supportive only; gameplay continues silently.
  }
}

export function disposeTtsAssets(assets: TtsAsset[]) {
  for (const asset of assets) {
    const audio = audioCache.get(asset.path);
    if (!audio) continue;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    audioCache.delete(asset.path);
    if (currentAudio === audio) currentAudio = undefined;
  }
}

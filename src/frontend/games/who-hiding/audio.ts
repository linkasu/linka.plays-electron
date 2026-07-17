import { resolvePublicAssetUrl } from "../../core/publicAsset";
import type { TtsAsset } from "../../core/ttsAudio";

export type WhoHidingAudioResult = "completed" | "cancelled";

export function createWhoHidingAudio(options: {
  assets: TtsAsset[];
  enabled: () => boolean;
  volume?: number;
}) {
  const assetsById = new Map(options.assets.map((asset) => [asset.id, asset]));
  const audioCache = new Map<string, HTMLAudioElement>();
  const volume = options.volume ?? 0.34;
  let activeController: AbortController | undefined;
  let activeAudio: HTMLAudioElement | undefined;

  function getAudio(asset: TtsAsset) {
    const src = resolvePublicAssetUrl(asset.path);
    let audio = audioCache.get(src);
    if (!audio) {
      audio = new Audio(src);
      audio.preload = "auto";
      audioCache.set(src, audio);
    }
    return audio;
  }

  function cancel() {
    activeController?.abort();
    activeController = undefined;
  }

  function wait(delayMs: number, signal: AbortSignal) {
    if (delayMs <= 0) return Promise.resolve(!signal.aborted);
    return new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => finish(true), delayMs);
      const onAbort = () => finish(false);
      const finish = (completed: boolean) => {
        window.clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        resolve(completed);
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  function playAssetAndWait(asset: TtsAsset, signal: AbortSignal): Promise<WhoHidingAudioResult> {
    if (signal.aborted) return Promise.resolve("cancelled");
    const audio = getAudio(asset);
    activeAudio = audio;
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      // A failed seek must not prevent optional speech from starting.
    }
    audio.volume = volume;

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: WhoHidingAudioResult) => {
        if (settled) return;
        settled = true;
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
        signal.removeEventListener("abort", onAbort);
        if (activeAudio === audio) activeAudio = undefined;
        resolve(result);
      };
      const onEnded = () => finish("completed");
      const onError = () => finish("completed");
      const onAbort = () => {
        audio.pause();
        try {
          audio.currentTime = 0;
        } catch {
          // The sequence is still safely cancelled when the media cannot seek.
        }
        finish("cancelled");
      };

      audio.addEventListener("ended", onEnded, { once: true });
      audio.addEventListener("error", onError, { once: true });
      signal.addEventListener("abort", onAbort, { once: true });
      void audio.play().catch(onError);
    });
  }

  async function playSequenceAndWait(assetIds: string[], delayMs = 0, gapMs = 140): Promise<WhoHidingAudioResult> {
    cancel();
    if (!options.enabled()) return "completed";
    const assets = assetIds.map((id) => assetsById.get(id)).filter((asset): asset is TtsAsset => Boolean(asset));
    if (!assets.length) return "completed";

    const controller = new AbortController();
    activeController = controller;
    if (!await wait(delayMs, controller.signal)) return "cancelled";

    for (let index = 0; index < assets.length; index += 1) {
      const result = await playAssetAndWait(assets[index], controller.signal);
      if (result === "cancelled") return result;
      if (index < assets.length - 1 && !await wait(gapMs, controller.signal)) return "cancelled";
    }

    if (activeController === controller) activeController = undefined;
    return "completed";
  }

  function warm(assetIds: string[]) {
    if (!options.enabled()) return;
    for (const assetId of assetIds) {
      const asset = assetsById.get(assetId);
      if (!asset) continue;
      try {
        getAudio(asset).load();
      } catch {
        // TTS is optional and may be unavailable in a packaged installation.
      }
    }
  }

  function dispose() {
    cancel();
    activeAudio?.pause();
    activeAudio = undefined;
    for (const audio of audioCache.values()) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    audioCache.clear();
  }

  return { cancel, dispose, playSequenceAndWait, warm };
}

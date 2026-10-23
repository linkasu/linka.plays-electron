import { describe, expect, it, vi } from "vitest";
import {
  declineSound,
  isSoundDeclined,
  probeAudioUnlock,
  unlockAudio,
  type AudioContextLike,
} from "./audioUnlock";

function makeContext(state: string): AudioContextLike & { closed: boolean } {
  return {
    state,
    closed: false,
    async resume() {
      this.state = "running";
    },
    async close() {
      this.closed = true;
    },
  };
}

describe("probeAudioUnlock", () => {
  it("asks for a click when the browser suspended the context", () => {
    const context = makeContext("suspended");

    const probe = probeAudioUnlock(() => context);

    expect(probe.blocked).toBe(true);
    expect(probe.context).toBe(context);
    expect(context.closed).toBe(false);
  });

  it("stays out of the way in Electron, where audio already runs", () => {
    const context = makeContext("running");

    const probe = probeAudioUnlock(() => context);

    expect(probe.blocked).toBe(false);
    expect(probe.context).toBeUndefined();
    expect(context.closed).toBe(true);
  });

  it("stays out of the way when there is no audio support at all", () => {
    expect(probeAudioUnlock(() => undefined)).toEqual({ blocked: false });
  });
});

describe("unlockAudio", () => {
  it("resumes the context", async () => {
    const context = makeContext("suspended");

    await expect(unlockAudio(context)).resolves.toBe(true);
    expect(context.state).toBe("running");
  });

  it("reports failure instead of throwing when the browser refuses", async () => {
    const context = makeContext("suspended");
    context.resume = vi.fn().mockRejectedValue(new Error("NotAllowedError"));

    await expect(unlockAudio(context)).resolves.toBe(false);
  });

  it("does nothing when there is no context", async () => {
    await expect(unlockAudio(undefined)).resolves.toBe(true);
  });
});

describe("audio gate fallbacks", () => {
  it("opens the app when the browser refuses to create a context", () => {
    const probe = probeAudioUnlock(() => {
      throw new DOMException("too many contexts", "NotSupportedError");
    });

    expect(probe).toEqual({ blocked: false });
  });

  it("remembers «Продолжить без звука» so games start silent", () => {
    expect(isSoundDeclined()).toBe(false);
    declineSound();
    expect(isSoundDeclined()).toBe(true);
  });
});

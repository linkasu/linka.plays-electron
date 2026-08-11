import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { TelemetryPrivacyPreferenceStore } from "./privacyPreference";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createStore() {
  const directory = await mkdtemp(join(tmpdir(), "linka-privacy-"));
  directories.push(directory);
  return { directory, store: new TelemetryPrivacyPreferenceStore(directory) };
}

describe("TelemetryPrivacyPreferenceStore", () => {
  it("defaults missing and unrelated legacy data to unknown", async () => {
    const { directory, store } = await createStore();
    expect(await store.read()).toBe("unknown");

    await writeFile(join(directory, "privacy-preferences.json"), JSON.stringify({ informationalNoticeVersion: "2026-07-18-v1" }));
    expect(await store.read()).toBe("unknown");
  });

  it.each(["enabled", "disabled"] as const)("persists the %s decision in userData", async (preference) => {
    const { directory, store } = await createStore();
    await store.write(preference);

    expect(await new TelemetryPrivacyPreferenceStore(directory).read()).toBe(preference);
  });
});

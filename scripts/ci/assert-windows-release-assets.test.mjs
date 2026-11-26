import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { assertWindowsReleaseAssets } from "./assert-windows-release-assets.mjs";

test("accepts only the complete Inno bundle, never NSIS metadata or extra installers", async () => {
  const directory = await mkdtemp(join(tmpdir(), "linka-assets-"));
  try {
    await assert.rejects(assertWindowsReleaseAssets(directory, "3.0.2"), /must contain only/);
    for (const name of ["launcher.zip", "linka.plays-electron-3.0.2-win-x64.exe"]) {
      await writeFile(join(directory, name), "fixture");
    }
    assert.equal((await assertWindowsReleaseAssets(directory, "3.0.2")).length, 2);
    await writeFile(join(directory, "latest.yml"), "not an NSIS release");
    await assert.rejects(assertWindowsReleaseAssets(directory, "3.0.2"), /must contain only/);
    await assert.rejects(assertWindowsReleaseAssets(directory, "3.0.2-beta.1"), /numeric stable/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

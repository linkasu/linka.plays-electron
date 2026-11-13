import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { publishWindowsRelease } from "./publish-windows-release.mjs";

for (const valid of [false, true]) {
  test(`publisher preserves downloads on invalid hash / publishes complete release: ${valid}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "linka-publish-test-"));
    try {
      const directory = join(root, "linkaplay");
      await mkdir(directory);
      await writeFile(join(directory, "linkaplaysetup.exe"), "old installer");
      await writeFile(join(directory, "launcher.zip"), "old launcher");
      await writeFile(join(directory, "version.json"), '{"version":"2.0.0"}');
      const mirror = join(root, "dist", "linka.plays");
      await mkdir(mirror, { recursive: true });
      await writeFile(join(mirror, "linka.plays.setup.exe"), "old electron installer");
      await writeFile(join(mirror, "version.json"), '{"version":"0.1.22"}');
      const body = Buffer.from("verified release asset");
      const assets = ["linka.plays-electron-3.0.0-win-x64.exe", "launcher.zip"].map((name) => ({
        name,
        size: body.length,
        digest: `sha256:${valid ? createHash("sha256").update(body).digest("hex") : "0".repeat(64)}`,
        browser_download_url: `https://github.com/linkasu/linka.plays-electron/releases/download/v3.0.0/${name}`,
      }));
      const request = async (url) =>
        url.includes("api.github.com")
          ? Response.json({ tag_name: "v3.0.0", draft: false, prerelease: false, assets })
          : new Response(body);
      if (valid) {
        await publishWindowsRelease("3.0.0", root, request);
        for (const [path, installer] of [
          [directory, "linkaplaysetup.exe"],
          [join(root, "dist", "linka.plays"), "linka.plays.setup.exe"],
        ]) {
          assert.deepEqual(await readFile(join(path, installer)), body);
          assert.equal(JSON.parse(await readFile(join(path, "version.json"))).version, "3.0.0");
        }
        assert.deepEqual(await readFile(join(directory, "launcher.zip")), body);
      } else {
        await assert.rejects(publishWindowsRelease("3.0.0", root, request), /integrity/);
        assert.equal(
          await readFile(join(directory, "linkaplaysetup.exe"), "utf8"),
          "old installer",
        );
        assert.equal(JSON.parse(await readFile(join(directory, "version.json"))).version, "2.0.0");
      }
      await assert.rejects(publishWindowsRelease("3.0.1-beta.1", root, request), /numeric stable/);
      await assert.rejects(publishWindowsRelease("0.1.22", root, request), /downgrade/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

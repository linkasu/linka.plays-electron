import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, realpathSync } from "node:fs";
import {
  copyFile,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";

export async function publishWindowsRelease(version, root, request = fetch) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("A numeric stable version is required");
  const canonical = join(root, "linkaplay");
  const mirror = join(root, "dist", "linka.plays");
  const lockPath = join(canonical, ".publish.lock");
  const lock = await open(lockPath, "wx");
  let staging;
  try {
    for (const directory of [canonical, mirror]) {
      const current = JSON.parse(await readFile(join(directory, "version.json"), "utf8")).version;
      if (!/^\d+\.\d+\.\d+$/.test(current)) throw new Error("Invalid current mirror version");
      const nextParts = version.split(".").map(Number);
      const currentParts = current.split(".").map(Number);
      const difference = nextParts
        .map((part, index) => part - currentParts[index])
        .find((part) => part !== 0);
      if (difference < 0) throw new Error(`Refusing to downgrade ${current} to ${version}`);
    }
    const response = await request(
      `https://api.github.com/repos/linkasu/linka.plays-electron/releases/tags/v${version}`,
    );
    if (!response.ok) throw new Error(`Release lookup failed: ${response.status}`);
    const release = await response.json();
    if (release.tag_name !== `v${version}` || release.draft || release.prerelease) {
      throw new Error("Only the exact published stable release may be mirrored");
    }
    staging = await mkdtemp(join(canonical, ".release-"));
    const files = [
      [`linka.plays-electron-${version}-win-x64.exe`, "installer.exe"],
      ["launcher.zip", "launcher.zip"],
    ];
    for (const [name, localName] of files) {
      const assets = release.assets.filter((asset) => asset.name === name);
      if (assets.length !== 1 || !/^sha256:[a-f0-9]{64}$/.test(assets[0].digest ?? "")) {
        throw new Error(`Missing unique asset or SHA-256: ${name}`);
      }
      const asset = assets[0];
      const url = `https://github.com/linkasu/linka.plays-electron/releases/download/v${version}/${name}`;
      if (asset.browser_download_url !== url) throw new Error(`Unexpected asset URL: ${name}`);
      const download = await request(url);
      if (!download.ok) throw new Error(`Download failed: ${download.status}`);
      const file = join(staging, localName);
      await pipeline(Readable.fromWeb(download.body), createWriteStream(file, { flags: "wx" }));
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(file)) hash.update(chunk);
      if (
        `sha256:${hash.digest("hex")}` !== asset.digest ||
        (await stat(file)).size !== asset.size
      ) {
        throw new Error(`Asset integrity check failed: ${name}`);
      }
    }
    await writeFile(join(staging, "version.json"), JSON.stringify({ version }));
    await mkdir(mirror, { recursive: true });
    const backup = join(canonical, "archive", `${Date.now()}-before-${version}`);
    await mkdir(backup, { recursive: true });
    for (const [directory, prefix, files] of [
      [canonical, "launcher", ["linkaplaysetup.exe", "launcher.zip", "version.json"]],
      [mirror, "electron", ["linka.plays.setup.exe", "version.json"]],
    ]) {
      for (const file of files) {
        await copyFile(join(directory, file), join(backup, `${prefix}-${file}`));
      }
    }
    // Installers are complete before either launcher is told about the new version.
    for (const [directory, name] of [
      [canonical, "linkaplaysetup.exe"],
      [mirror, "linka.plays.setup.exe"],
    ]) {
      const temporary = join(directory, ".installer.next");
      await copyFile(join(staging, "installer.exe"), temporary);
      await rename(temporary, join(directory, name));
    }
    await rename(join(staging, "launcher.zip"), join(canonical, "launcher.zip"));
    for (const directory of [canonical, mirror]) {
      const temporary = join(directory, ".version.next");
      await copyFile(join(staging, "version.json"), temporary);
      await rename(temporary, join(directory, "version.json"));
    }
    console.log(`Published Windows ${version}: launcher and both installer URLs`);
  } finally {
    if (staging) await rm(staging, { recursive: true, force: true });
    await lock.close();
    await rm(lockPath);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  publishWindowsRelease(process.argv[2], "/home/aacidov/linka-docker/wordpress").catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

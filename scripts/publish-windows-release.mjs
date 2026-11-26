import { createHash, randomUUID } from "node:crypto";
import { constants, createReadStream, createWriteStream, realpathSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable, Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";

export const RELEASE_REPOSITORY = "linkasu/linka.plays-windows-releases";
const paths = [
  "linkaplay/linkaplaysetup.exe",
  "linkaplay/launcher.zip",
  "dist/linka.plays/linka.plays.setup.exe",
  "linkaplay/version.json",
  "dist/linka.plays/version.json",
];

function versionParts(version) {
  if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error("A numeric stable version is required");
  }
  return version.split(".").map(BigInt);
}

async function validateResponseOrigin(response, allowedOrigins) {
  let valid = false;
  try {
    const final = new URL(response.url);
    valid = allowedOrigins.includes(final.origin) && !final.username && !final.password;
  } catch {
    // A native fetch response always has an absolute final URL; missing URLs fail closed.
  }
  if (!valid) {
    try {
      await response.body?.cancel();
    } catch {
      /* The response is rejected regardless. */
    }
    // Never expose signed GitHub redirect URLs in logs or recovery records.
    throw new Error("Unexpected final response origin");
  }
}

export async function fetchReleaseJson(url, request = fetch) {
  const signal = AbortSignal.timeout(30_000);
  const response = await request(url, { signal, cache: "no-store", redirect: "error" });
  if (!response.ok) throw new Error(`Release lookup failed: ${response.status}`);
  await validateResponseOrigin(response, [new URL(url).origin]);
  return response.json();
}

export async function getWindowsRelease(version, request = fetch) {
  versionParts(version);
  const release = await fetchReleaseJson(
    `https://api.github.com/repos/${RELEASE_REPOSITORY}/releases/tags/v${version}`,
    request,
  );
  if (
    !release ||
    release.tag_name !== `v${version}` ||
    release.draft !== false ||
    release.prerelease !== false ||
    !Array.isArray(release.assets)
  )
    throw new Error("Only the exact published stable release may be mirrored");
  if (release.assets.length !== 2)
    throw new Error("Release must contain exactly the two Windows assets");
  return ["linka.plays-electron-" + version + "-win-x64.exe", "launcher.zip"].map((name) => {
    const matches = release.assets.filter((asset) => asset?.name === name);
    if (matches.length !== 1 || !/^sha256:[a-f0-9]{64}$/.test(matches[0].digest ?? "")) {
      throw new Error(`Missing unique asset or SHA-256: ${name}`);
    }
    const asset = matches[0];
    const url = `https://github.com/${RELEASE_REPOSITORY}/releases/download/v${version}/${name}`;
    if (asset.browser_download_url !== url) throw new Error(`Unexpected asset URL: ${name}`);
    if (!Number.isSafeInteger(asset.size) || asset.size <= 0)
      throw new Error(`Invalid asset size: ${name}`);
    return { name, url, size: asset.size, sha256: asset.digest.slice(7) };
  });
}

export async function verifyWindowsDownload(url, asset, request = fetch, destination) {
  // This deadline covers both fetch headers and the complete streamed body.
  const signal = AbortSignal.timeout(10 * 60_000);
  const response = await request(url, { signal, cache: "no-store" });
  if (!response.ok || !response.body)
    throw new Error(`Download failed: ${url} (${response.status})`);
  await validateResponseOrigin(
    response,
    new URL(url).origin === "https://github.com"
      ? ["https://github.com", "https://release-assets.githubusercontent.com"]
      : ["https://linka.su"],
  );
  let size = 0;
  const hash = createHash("sha256");
  const meter = new Transform({
    transform(chunk, encoding, callback) {
      size += chunk.length;
      if (size > asset.size)
        return callback(new Error(`Asset integrity check failed (size): ${url}`));
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  await pipeline(
    Readable.fromWeb(response.body),
    meter,
    destination
      ? createWriteStream(destination, { flags: "wx" })
      : new Writable({
          write(chunk, encoding, callback) {
            callback();
          },
        }),
    { signal },
  );
  if (size !== asset.size || hash.digest("hex") !== asset.sha256) {
    throw new Error(`Asset integrity check failed: ${url}`);
  }
}

async function fingerprint(file) {
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk);
    size += chunk.length;
  }
  if (size === 0) throw new Error(`Invalid empty current file: ${file}`);
  return { size, sha256: hash.digest("hex") };
}

function sameBytes(left, right) {
  return left.size === right.size && left.sha256 === right.sha256;
}

function validTerminalRecord(record) {
  const validHash = (value) =>
    value &&
    Number.isSafeInteger(value.size) &&
    value.size > 0 &&
    /^[a-f0-9]{64}$/.test(value.sha256);
  return (
    record?.format === 1 &&
    typeof record.id === "string" &&
    record.repository === RELEASE_REPOSITORY &&
    ["complete", "rolled-back"].includes(record.phase) &&
    Array.isArray(record.files) &&
    record.files.length === paths.length &&
    record.files.every(
      (entry, index) =>
        entry?.path === paths[index] &&
        entry.backupName === `${index}-${paths[index].split("/").at(-1)}` &&
        validHash(entry) &&
        validHash(entry.next),
    )
  );
}

async function syncFile(path) {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function atomicRecord(path, record) {
  const temporary = `${path}.${randomUUID()}.next`;
  try {
    await writeFile(temporary, JSON.stringify(record, null, 2), { flag: "wx", mode: 0o600 });
    await syncFile(temporary);
    await rename(temporary, path);
    await syncFile(dirname(path));
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function publishWindowsRelease(
  version,
  root,
  request = fetch,
  { checkpoint = () => {} } = {},
) {
  const nextParts = versionParts(version);
  const canonical = join(root, "linkaplay");
  const lockPath = join(canonical, ".publish.lock");
  const journalPath = join(canonical, ".publish-transaction.json");
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    throw new Error(
      `Publication lock exists: ${lockPath}. Stop and recover/inspect the prior transaction and backups; never auto-delete a stale lock.`,
    );
  }
  let staging;
  let record;
  let mutated = false;
  let recoveryRequired = false;
  const temporaryFiles = new Set();
  const persist = async (phase) => {
    record.phase = phase;
    await atomicRecord(journalPath, record);
  };
  const replace = async (source, target) => {
    const temporary = `${target}.publish-${record.id}-${randomUUID()}.next`;
    temporaryFiles.add(temporary);
    await copyFile(source, temporary, constants.COPYFILE_EXCL);
    await syncFile(temporary);
    await rename(temporary, target);
    temporaryFiles.delete(temporary);
    await syncFile(dirname(target));
  };
  try {
    await lock.writeFile(
      JSON.stringify({ pid: process.pid, version, started: new Date().toISOString() }),
    );
    await lock.sync();
    let prior;
    let hasPrior = false;
    try {
      prior = JSON.parse(await readFile(journalPath, "utf8"));
      hasPrior = true;
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw new Error(
          `Unreadable transaction ${journalPath}; recover manually from the journal and archive before publishing. Do not delete evidence.`,
          { cause: error },
        );
      }
    }
    if (hasPrior && !validTerminalRecord(prior)) {
      throw new Error(
        `Incomplete transaction ${journalPath}; recover all five files using its backup manifest and verify hashes before retrying. Do not delete evidence.`,
      );
    }
    const currentVersions = [];
    for (const path of paths.slice(3)) {
      let current;
      try {
        current = JSON.parse(await readFile(join(root, path), "utf8")).version;
        const parts = versionParts(current);
        const index = nextParts.findIndex((part, i) => part !== parts[i]);
        if (index !== -1 && nextParts[index] < parts[index]) {
          throw new Error(`Refusing to downgrade ${current} to ${version}`);
        }
      } catch (error) {
        throw new Error(`Invalid current mirror state (${path}): ${error.message}`, {
          cause: error,
        });
      }
      currentVersions.push(current);
    }
    const originals = await Promise.all(paths.map((path) => fingerprint(join(root, path))));
    const [installer, launcher] = await getWindowsRelease(version, request);
    if (
      (currentVersions[0] === version &&
        (!sameBytes(originals[0], installer) || !sameBytes(originals[1], launcher))) ||
      (currentVersions[1] === version && !sameBytes(originals[2], installer))
    )
      throw new Error("Refusing same-version release with different bytes");
    if (currentVersions.every((current) => current === version)) return { unchanged: true };
    staging = await mkdtemp(join(canonical, ".release-"));
    await verifyWindowsDownload(installer.url, installer, request, join(staging, "installer.exe"));
    await verifyWindowsDownload(launcher.url, launcher, request, join(staging, "launcher.zip"));
    await writeFile(join(staging, "version.json"), JSON.stringify({ version }), { flag: "wx" });
    const manifest = await fingerprint(join(staging, "version.json"));
    const expected = [installer, launcher, installer, manifest, manifest];
    const id = randomUUID();
    const backup = join(canonical, "archive", `${Date.now()}-before-${version}-${id}`);
    record = {
      format: 1,
      id,
      version,
      repository: RELEASE_REPOSITORY,
      backup,
      staging,
      phase: "backup",
      started: new Date().toISOString(),
      files: paths.map((path, index) => ({
        path,
        backupName: `${index}-${path.split("/").at(-1)}`,
        ...originals[index],
        next: { size: expected[index].size, sha256: expected[index].sha256 },
      })),
    };
    await persist("backup");
    await checkpoint("backup");
    await mkdir(backup, { recursive: true });
    for (const entry of record.files) {
      const target = join(backup, entry.backupName);
      await copyFile(join(root, entry.path), target, constants.COPYFILE_EXCL);
      await syncFile(target);
      if (!sameBytes(await fingerprint(target), entry))
        throw new Error(`Backup integrity failed: ${entry.path}`);
    }
    await atomicRecord(join(backup, "manifest.json"), record);
    await syncFile(dirname(backup));
    await persist("assets");
    await checkpoint("assets");
    // Each rename is atomic; the five public HTTP resources are NOT one atomic snapshot.
    for (let index = 0; index < 3; index++) {
      mutated = true;
      await replace(
        join(staging, index === 1 ? "launcher.zip" : "installer.exe"),
        join(root, paths[index]),
      );
      await checkpoint(`asset:${index}`);
    }
    await persist("manifests");
    await checkpoint("manifests");
    for (let index = 3; index < 5; index++) {
      await replace(join(staging, "version.json"), join(root, paths[index]));
      await checkpoint(`manifest:${index}`);
    }
    await persist("verify");
    await checkpoint("verify");
    for (const entry of record.files) {
      if (!sameBytes(await fingerprint(join(root, entry.path)), entry.next)) {
        throw new Error(`Published file integrity failed: ${entry.path}`);
      }
    }
    await checkpoint("complete");
    await persist("complete");
    console.log(`Published Windows ${version}: launcher and both installer URLs`);
    return { unchanged: false };
  } catch (error) {
    if (record) {
      record.error = String(error);
      const rollbackErrors = [];
      if (mutated) {
        try {
          await persist("rollback");
        } catch (failure) {
          rollbackErrors.push(String(failure));
        }
        for (const [index, entry] of record.files.entries()) {
          try {
            await checkpoint(`rollback:${index}`);
            const source = join(record.backup, entry.backupName);
            if (!sameBytes(await fingerprint(source), entry))
              throw new Error(`Backup integrity failed: ${entry.path}`);
            await replace(source, join(root, entry.path));
            if (!sameBytes(await fingerprint(join(root, entry.path)), entry))
              throw new Error(`Rollback integrity failed: ${entry.path}`);
          } catch (failure) {
            rollbackErrors.push(`${entry.path}: ${failure}`);
          }
        }
      }
      record.rollbackErrors = rollbackErrors;
      recoveryRequired = rollbackErrors.length > 0;
      try {
        await persist(recoveryRequired ? "recovery-required" : "rolled-back");
      } catch (failure) {
        recoveryRequired = true;
        rollbackErrors.push(`Could not persist recovery record: ${failure}`);
      }
      if (recoveryRequired) {
        throw new Error(
          `Rollback incomplete; recover manually using ${journalPath} and ${record.backup}/manifest.json. Lock, staging and backups retained. ${rollbackErrors.join("; ")}`,
          { cause: error },
        );
      }
    }
    throw error;
  } finally {
    try {
      if (!recoveryRequired) {
        for (const path of temporaryFiles) await rm(path, { force: true });
        if (staging) await rm(staging, { recursive: true, force: true });
      }
    } finally {
      await lock.close();
      if (!recoveryRequired) await rm(lockPath);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  publishWindowsRelease(process.argv[2], "/home/aacidov/linka-docker/wordpress").catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

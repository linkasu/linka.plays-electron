import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = resolve(projectRoot, "public");

function argValue(name) {
  const prefix = `${name}=`;
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) return process.argv[exactIndex + 1];
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : undefined;
}

function hasArg(name) {
  return process.argv.includes(name);
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function outputPathForAsset(asset) {
  if (!asset.path?.startsWith("/")) throw new Error(`TTS asset ${asset.id} must use an absolute public path.`);
  const outputPath = resolve(publicRoot, asset.path.slice(1));
  if (!outputPath.startsWith(`${publicRoot}/`)) throw new Error(`TTS asset ${asset.id} writes outside public/`);
  return outputPath;
}

function validateAsset(asset) {
  if (!asset || typeof asset !== "object") throw new Error("TTS asset entry must be an object.");
  if (!asset.id) throw new Error("TTS asset id is required.");
  if (!asset.game) throw new Error(`TTS asset ${asset.id} game is required.`);
  if (!asset.text) throw new Error(`TTS asset ${asset.id} text is required.`);
  outputPathForAsset(asset);
}

async function synthesizeAsset(asset, options) {
  const outputPath = outputPathForAsset(asset);
  if (options.dryRun) {
    console.log(`dry ${asset.id}: ${asset.text}`);
    return;
  }
  if (!options.force && await pathExists(outputPath)) {
    console.log(`skip ${asset.id}: ${asset.path}`);
    return;
  }

  const response = await fetch(`${options.baseUrl}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: asset.text, voice: asset.voice ?? options.voice })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`TTS request failed for ${asset.id}: ${response.status} ${body}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("audio/")) throw new Error(`TTS response for ${asset.id} is not audio: ${contentType}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
  console.log(`write ${asset.id}: ${asset.path} (${buffer.length} bytes)`);
}

async function main() {
  const manifestPath = resolve(projectRoot, argValue("--manifest") ?? "src/frontend/data/ttsAssets.json");
  const game = argValue("--game");
  const baseUrl = (process.env.TTS_BASE_URL ?? argValue("--base-url") ?? "https://tts.linka.su").replace(/\/$/, "");
  const voice = process.env.TTS_VOICE ?? argValue("--voice") ?? "jane";
  const delayMs = Number(process.env.TTS_DELAY_MS ?? argValue("--delay-ms") ?? 250);
  const force = hasArg("--force");
  const dryRun = hasArg("--dry-run");

  const assets = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!Array.isArray(assets)) throw new Error("TTS manifest must be an array.");

  const selectedAssets = assets.filter((asset) => !game || asset.game === game);
  for (const asset of selectedAssets) validateAsset(asset);
  if (!selectedAssets.length) throw new Error(game ? `No TTS assets for game ${game}.` : "No TTS assets found.");

  console.log(`TTS endpoint: ${baseUrl}`);
  console.log(`TTS voice: ${voice}`);
  for (const asset of selectedAssets) {
    await synthesizeAsset(asset, { baseUrl, voice, force, dryRun });
    if (delayMs > 0) await sleep(delayMs);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

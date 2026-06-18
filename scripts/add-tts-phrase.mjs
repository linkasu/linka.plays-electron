#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

function argValue(name, fallback = "") {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function usage() {
  return "Usage: npm run tts:add -- --game=<game-id> --id=<asset-id> --text=<phrase> [--voice=jane] [--path=/audio/tts/<game>/<file>.mp3]";
}

function defaultAssetPath(game, id) {
  const prefix = `${game}.`;
  const suffix = id.startsWith(prefix) ? id.slice(prefix.length) : id;
  const fileName = suffix
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/[._-]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!fileName) throw new Error(`Cannot derive TTS filename from id: ${id}`);
  return `/audio/tts/${game}/${fileName}.mp3`;
}

function validateAsset({ game, id, text, path: assetPath }) {
  if (!game) throw new Error(`Missing --game. ${usage()}`);
  if (!id) throw new Error(`Missing --id. ${usage()}`);
  if (!text) throw new Error(`Missing --text. ${usage()}`);
  if (!assetPath.startsWith("/audio/tts/")) throw new Error("TTS path must live under /audio/tts/.");
  if (!assetPath.endsWith(".mp3")) throw new Error("TTS path must end with .mp3.");
}

const game = argValue("--game");
const id = argValue("--id");
const text = argValue("--text");
const voice = argValue("--voice", "jane");
const manifestPath = path.resolve(projectRoot, argValue("--manifest", "src/frontend/data/ttsAssets.json"));
const assetPath = argValue("--path", game && id ? defaultAssetPath(game, id) : "");
const nextAsset = { id, game, text, voice, path: assetPath };

validateAsset(nextAsset);

const assets = JSON.parse(await readFile(manifestPath, "utf8"));
if (!Array.isArray(assets)) throw new Error("TTS manifest must be an array.");

const existingIndex = assets.findIndex((asset) => asset.id === id);
if (existingIndex >= 0) {
  assets[existingIndex] = { ...assets[existingIndex], ...nextAsset };
} else {
  assets.push(nextAsset);
}

await writeFile(manifestPath, `${JSON.stringify(assets, null, 2)}\n`, "utf8");
console.log(`${existingIndex >= 0 ? "Updated" : "Added"} ${id}`);
console.log(`Path: ${assetPath}`);

#!/usr/bin/env node

import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const manifestPath = path.join(projectRoot, "src/frontend/data/ttsAssets.json");
const publicRoot = path.join(projectRoot, "public");
const assets = JSON.parse(await readFile(manifestPath, "utf8"));
const ids = new Set();
const failures = [];

for (const asset of assets) {
  if (!asset.id || !asset.game || !asset.text || !asset.path) {
    failures.push(`${asset.id || "<missing-id>"}: incomplete manifest entry`);
    continue;
  }
  if (ids.has(asset.id)) failures.push(`${asset.id}: duplicate id`);
  ids.add(asset.id);
  if (!asset.path.startsWith("/") || asset.path.includes("..")) {
    failures.push(`${asset.id}: unsafe public path ${asset.path}`);
    continue;
  }
  const filePath = path.join(publicRoot, asset.path.slice(1));
  try {
    await access(filePath);
    const metadata = await stat(filePath);
    if (!metadata.isFile() || metadata.size === 0)
      failures.push(`${asset.id}: empty asset ${asset.path}`);
  } catch {
    failures.push(`${asset.id}: missing asset ${asset.path}`);
  }
}

if (failures.length) {
  console.error(`TTS asset audit failed (${failures.length} issues):`);
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log(`TTS asset audit passed (${assets.length} assets).`);
}

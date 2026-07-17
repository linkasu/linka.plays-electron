#!/usr/bin/env node

import { access, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..", "..");
const distRoot = path.join(projectRoot, "dist");

const requiredAssets = [
  "index.html",
  "images/words/apple.png",
  "images/mosaic/squirrel.jpg",
  "audio/sfx/bells/soft-bell.ogg",
  "audio/sfx/sound-source/bell.mp3",
  "audio/tts/aquarium/prompt.mp3"
];

for (const relativePath of requiredAssets) {
  const filePath = path.join(distRoot, relativePath);
  await access(filePath);
  const metadata = await stat(filePath);
  if (!metadata.isFile() || metadata.size === 0) {
    throw new Error(`Renderer asset is missing or empty: ${relativePath}`);
  }
}

console.log(`Renderer asset smoke passed (${requiredAssets.length} files).`);

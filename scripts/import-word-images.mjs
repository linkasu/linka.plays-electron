import { execFileSync } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wordBankPath = resolve(projectRoot, "src/frontend/data/wordBank.ts");
const outputDir = resolve(projectRoot, "public/images/words");
const archivePath = process.argv[2];

if (!archivePath) {
  throw new Error("Usage: npm run words:images:import -- /path/to/images.zip");
}

function parseWordBank(source) {
  const entries = [];
  const itemPattern = /\{\s*id:\s*"([^"]+)",\s*word:\s*"([^"]+)",\s*emoji:\s*"([^"]+)",\s*category:\s*"([^"]+)"\s*\}/g;
  for (const match of source.matchAll(itemPattern)) {
    entries.push({ id: match[1], word: match[2], emoji: match[3], category: match[4] });
  }
  if (!entries.length) throw new Error(`No word entries parsed from ${wordBankPath}`);
  return entries;
}

function normalizedStem(fileName) {
  return basename(fileName, ".png").normalize("NFC").toLocaleLowerCase("ru");
}

async function collectPngFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectPngFiles(path));
    if (entry.isFile() && entry.name.toLocaleLowerCase("ru").endsWith(".png")) files.push(path);
  }
  return files;
}

async function main() {
  const archive = resolve(archivePath);
  const tempDir = await mkdtemp(resolve(tmpdir(), "linka-word-images-"));

  try {
    execFileSync("bsdtar", ["-xf", archive, "-C", tempDir], { stdio: "inherit" });
    const sourceFiles = await collectPngFiles(tempDir);
    const sourceByWord = new Map(sourceFiles.map((path) => [normalizedStem(path), path]));
    const words = parseWordBank(await readFile(wordBankPath, "utf8"));
    const manifest = [];
    const missing = [];

    await rm(outputDir, { recursive: true, force: true });
    await mkdir(outputDir, { recursive: true });

    for (const item of words) {
      const source = sourceByWord.get(item.word.normalize("NFC").toLocaleLowerCase("ru"));
      if (!source) {
        missing.push(item);
        continue;
      }

      const file = `${item.id}.png`;
      await cp(source, resolve(outputDir, file));
      manifest.push({ ...item, file, path: `/images/words/${file}` });
    }

    await writeFile(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Imported ${manifest.length} word images from ${archive}`);
    if (missing.length) console.warn(`Missing images (${missing.length}): ${missing.map((item) => item.word).join(", ")}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

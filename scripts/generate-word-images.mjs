import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow } from "electron";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wordBankPath = resolve(projectRoot, "src/frontend/data/wordBank.ts");
const outputDir = resolve(projectRoot, "public/images/words");
const twemojiFontPath = resolve(projectRoot, "node_modules/twemoji-colr-font/twemoji.woff2");
const imageSize = 512;

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function filenameForItem(item) {
  return `${item.id}.png`;
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

function imageHtml(item) {
  const fontUrl = pathToFileURL(twemojiFontPath).href;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      @font-face {
        font-family: "Twemoji COLR";
        src: url("${fontUrl}") format("woff2");
      }
      html,
      body {
        width: ${imageSize}px;
        height: ${imageSize}px;
        margin: 0;
        overflow: hidden;
        background: transparent;
      }
      body {
        display: grid;
        place-items: center;
      }
      .emoji {
        font-family: "Twemoji COLR", "Apple Color Emoji", "Segoe UI Emoji", sans-serif;
        font-size: 392px;
        line-height: 1;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <main class="emoji" aria-label="${escapeHtml(item.word)}">${escapeHtml(item.emoji)}</main>
  </body>
</html>`;
}

function indexHtml(items) {
  const rows = items.map((item) => {
    const fileName = filenameForItem(item);
    return `
        <article class="card">
          <img src="./${encodeURIComponent(fileName)}" alt="${escapeHtml(item.word)}">
          <h2>${escapeHtml(item.word)}</h2>
          <p>${escapeHtml(item.emoji)} · ${escapeHtml(item.category)} · ${escapeHtml(item.id)}</p>
        </article>`;
  }).join("");

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <title>Word Emoji Review</title>
    <style>
      body {
        margin: 0;
        padding: 2rem;
        background: #f6f1e8;
        color: #251b14;
        font-family: system-ui, sans-serif;
      }
      h1 {
        margin: 0 0 1rem;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
        gap: 1rem;
      }
      .card {
        border-radius: 1.25rem;
        padding: 1rem;
        background: #fffaf0;
        box-shadow: 0 0.5rem 2rem rgba(37, 27, 20, 0.12);
      }
      img {
        display: block;
        width: 100%;
        aspect-ratio: 1;
        object-fit: contain;
        border-radius: 1rem;
        background: white;
      }
      h2 {
        margin: 0.75rem 0 0.25rem;
        font-size: 1.25rem;
      }
      p {
        margin: 0;
        color: #6f6257;
      }
    </style>
  </head>
  <body>
    <h1>Word Emoji Review</h1>
    <section class="grid">${rows}
    </section>
  </body>
</html>`;
}

async function renderImage(window, item, outputPath) {
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(imageHtml(item))}`;
  await window.loadURL(dataUrl);
  await window.webContents.executeJavaScript("document.fonts.ready.then(() => true)");
  await new Promise((resolveReady) => setTimeout(resolveReady, 80));
  const image = await window.webContents.capturePage({ x: 0, y: 0, width: imageSize, height: imageSize });
  await writeFile(outputPath, image.toPNG());
}

async function main() {
  const source = await readFile(wordBankPath, "utf8");
  const items = parseWordBank(source);

  await app.whenReady();
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const window = new BrowserWindow({
    show: false,
    width: imageSize,
    height: imageSize,
    useContentSize: true,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const manifest = [];
  for (const item of items) {
    const fileName = filenameForItem(item);
    const outputPath = resolve(outputDir, fileName);
    if (!outputPath.startsWith(`${outputDir}/`)) throw new Error(`Unsafe output path for ${item.word}`);
    await renderImage(window, item, outputPath);
    manifest.push({ ...item, file: fileName, path: `/images/words/${fileName}`, size: imageSize });
    console.log(`write ${fileName}`);
  }

  await writeFile(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(resolve(outputDir, "index.html"), indexHtml(items));
  window.destroy();
  console.log(`Generated ${items.length} word images in ${outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => {
  app.quit();
});

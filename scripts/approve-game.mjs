#!/usr/bin/env node

import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const registryPath = path.join(projectRoot, "src/frontend/data/games.ts");
const docsTestsRoot = path.join(projectRoot, "docs/tests");
const docsGamesRoot = path.join(projectRoot, "docs/games");

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pluralGame(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "игр";
  if (last === 1) return "игра";
  if (last >= 2 && last <= 4) return "игры";
  return "игр";
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function latestAuditPath() {
  const entries = await readdir(docsTestsRoot, { withFileTypes: true });
  const datedDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  return path.join(docsTestsRoot, datedDirectories[0] ?? "", "readiness-audit.json");
}

function approveRegistrySource(source, gameId) {
  const blockPattern = /\{\s*\n\s*id:\s*"([^"]+)"[\s\S]*?\n\s*\}(?=\s*,?\s*(?:\{|\]))/g;
  let approved = false;
  const nextSource = source.replace(blockPattern, (block, id) => {
    if (id !== gameId) return block;
    approved = true;
    if (/\n\s*stabilityStatus:\s*"[^"]+"/.test(block)) {
      return block.replace(/(\n\s*stabilityStatus:\s*)"[^"]+"/, "$1\"publish\"");
    }
    return block.replace(/(\n\s*status:\s*"[^"]+",)/, "$1\n    stabilityStatus: \"publish\",");
  });

  if (!approved) throw new Error(`Game not found in registry: ${gameId}`);
  return nextSource;
}

function runReadinessAudit(auditPath) {
  const result = spawnSync(process.execPath, [
    path.join(projectRoot, "scripts/game-readiness-audit.mjs"),
    `--output=${auditPath}`
  ], { cwd: projectRoot, encoding: "utf8" });

  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error("Readiness audit failed");
  }
}

async function detectAudioModule(game) {
  const gameDir = path.join(projectRoot, "src/frontend/games", game.id);
  const audioPath = path.join(gameDir, "audio.ts");
  if (await exists(audioPath)) return "`audio.ts`";

  for (const vueFile of game.signals?.vueFiles ?? []) {
    const source = await readFile(path.join(gameDir, vueFile), "utf8");
    if (source.includes("createStandardGameFeedback")) return "стандартный feedback из `core/gameFeedbackAudio.ts`";
  }

  return "нет";
}

function syncGamesReadme(source, audit) {
  const gamesById = new Map(audit.games.map((game) => [game.id, game]));
  let nextSource = source.replace(
    /Сводка по последнему readiness-аудиту: 154 игры, \d+ \S+, \d+ \S+\. Все registry-игры имеют `docs\/games\/<id>\.md`\./,
    `Сводка по последнему readiness-аудиту: ${audit.summary.totalGames} игры, ${audit.summary.readinessGroup.ready} ${pluralGame(audit.summary.readinessGroup.ready)}, ${audit.summary.readinessGroup.development} ${pluralGame(audit.summary.readinessGroup.development)}. Все registry-игры имеют \`docs/games/<id>.md\`.`
  );

  nextSource = nextSource.split("\n").map((line) => {
    const match = line.match(/^(.+\| `([^`]+)` \| \[[^\]]+\]\([^)]*\) \| )`[^`]+` \| `[^`]+` \| `[^`]+` \|$/);
    if (!match) return line;
    const game = gamesById.get(match[2]);
    if (!game) return line;
    return `${match[1]}\`${game.status}\` | \`${game.resolvedStabilityStatus}\` | \`${game.readinessGroup}\` |`;
  }).join("\n");

  return nextSource;
}

function syncIndex(source, audit) {
  return source
    .replace(/- Ready: \d+ \S+\./, `- Ready: ${audit.summary.readinessGroup.ready} ${pluralGame(audit.summary.readinessGroup.ready)}.`)
    .replace(/- Development: \d+ \S+\./, `- Development: ${audit.summary.readinessGroup.development} ${pluralGame(audit.summary.readinessGroup.development)}.`);
}

function syncReadinessMarkdown(source, audit) {
  let nextSource = source
    .replace(/\| Ready \| \d+ \|/, `| Ready | ${audit.summary.readinessGroup.ready} |`)
    .replace(/\| Development \| \d+ \|/, `| Development | ${audit.summary.readinessGroup.development} |`)
    .replace(/\| `resolvedStabilityStatus: "publish"` \| \d+ \|/, `| \`resolvedStabilityStatus: "publish"\` | ${audit.summary.resolvedStabilityStatus.publish ?? 0} |`)
    .replace(/\| `resolvedStabilityStatus: "needs-check"` \| \d+ \|/, `| \`resolvedStabilityStatus: "needs-check"\` | ${audit.summary.resolvedStabilityStatus["needs-check"] ?? 0} |`)
    .replace(/\| `resolvedStabilityStatus: "archived"` \| \d+ \|/, `| \`resolvedStabilityStatus: "archived"\` | ${audit.summary.resolvedStabilityStatus.archived ?? 0} |`);

  for (const [category, counts] of Object.entries(audit.summary.categoryReadiness)) {
    const categoryPattern = new RegExp("\\\\| `" + escapeRegExp(category) + "` \\\\| \\\\d+ \\\\| \\\\d+ \\\\|");
    nextSource = nextSource.replace(categoryPattern, `| \`${category}\` | ${counts.ready ?? 0} | ${counts.development ?? 0} |`);
  }

  const rows = audit.developmentQueue.slice(0, 10).map((game) => (
    `| \`${game.id}\` | \`${game.category}\` | \`${game.resolvedStabilityStatus}\` | ${(game.blockers ?? []).map((blocker) => `\`${blocker}\``).join(", ")} |`
  )).join("\n");
  const lines = nextSource.split("\n");
  const headerIndex = lines.findIndex((line) => line === "| Игра | Категория | Stability | Blockers |");
  if (headerIndex >= 0) {
    let endIndex = headerIndex + 2;
    while (endIndex < lines.length && lines[endIndex].startsWith("| `")) endIndex += 1;
    lines.splice(headerIndex + 2, endIndex - (headerIndex + 2), ...rows.split("\n"));
    nextSource = lines.join("\n");
  }

  return nextSource;
}

async function syncGameDoc(source, game) {
  const audioModule = await detectAudioModule(game);
  return source
    .replace(/\| Resolved stability \| `[^`]+` \|/, `| Resolved stability | \`${game.resolvedStabilityStatus}\` |`)
    .replace(/\| Readiness group \| `[^`]+` \|/, `| Readiness group | \`${game.readinessGroup}\` |`)
    .replace(/\| Audio module \| [^|]+ \|/, `| Audio module | ${audioModule} |`)
    .replace(/Игра находится в группе `[^`]+`, потому что resolved stability [^.]+\./, `Игра находится в группе \`${game.readinessGroup}\`, потому что resolved stability ${game.resolvedStabilityStatus === "publish" ? "равен" : "не равен"} \`publish\`.`)
    .replace(/Автоматические blockers:\n\n[\s\S]*?\n\n## QA checklist/, `Автоматические blockers:\n\n${game.promotionBlockers.length ? game.promotionBlockers.map((blocker) => `- ${blocker}`).join("\n") : "- нет"}\n\n## QA checklist`)
    .replace(/## Next step\n\n[\s\S]*$/, `## Next step\n\n${game.readinessGroup === "ready" ? "Оставить в ready-очереди и проверять регрессии через общий Electron CDP audit." : "Разобрать blockers из readiness-аудита, затем повторить Electron CDP/PNG audit и принять решение о `stabilityStatus: \"publish\"`."}\n`);
}

async function syncDocs(auditPath, approvedGameId) {
  const audit = JSON.parse(await readFile(auditPath, "utf8"));
  const game = audit.games.find((item) => item.id === approvedGameId);
  if (!game) throw new Error(`Approved game missing from audit: ${approvedGameId}`);

  const gamesReadmePath = path.join(docsGamesRoot, "README.md");
  await writeFile(gamesReadmePath, syncGamesReadme(await readFile(gamesReadmePath, "utf8"), audit), "utf8");

  const datedRoot = path.dirname(auditPath);
  const indexPath = path.join(datedRoot, "index.md");
  if (await exists(indexPath)) await writeFile(indexPath, syncIndex(await readFile(indexPath, "utf8"), audit), "utf8");

  const readinessMdPath = path.join(datedRoot, "readiness-audit.md");
  if (await exists(readinessMdPath)) await writeFile(readinessMdPath, syncReadinessMarkdown(await readFile(readinessMdPath, "utf8"), audit), "utf8");

  const gameDocPath = path.join(docsGamesRoot, `${approvedGameId}.md`);
  if (await exists(gameDocPath)) await writeFile(gameDocPath, await syncGameDoc(await readFile(gameDocPath, "utf8"), game), "utf8");
}

const gameId = argValue("--id", "");
if (!gameId) throw new Error("Usage: npm run review:approve -- --id=<game-id> [--open-next]");

const auditPath = path.resolve(argValue("--audit", await latestAuditPath()));
const registrySource = await readFile(registryPath, "utf8");
await writeFile(registryPath, approveRegistrySource(registrySource, gameId), "utf8");
runReadinessAudit(auditPath);
await syncDocs(auditPath, gameId);

console.log(`Approved ${gameId}`);
console.log(`Audit: ${path.relative(projectRoot, auditPath)}`);

if (hasFlag("--open-next")) {
  const result = spawnSync(process.execPath, [path.join(projectRoot, "scripts/open-next-development-game.mjs"), `--audit=${auditPath}`], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "inherit"
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

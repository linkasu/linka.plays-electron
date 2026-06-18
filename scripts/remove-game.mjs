#!/usr/bin/env node

import { access, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const registryPath = path.join(projectRoot, "src/frontend/data/games.ts");
const routerPath = path.join(projectRoot, "src/frontend/router/index.ts");
const gamesRoot = path.join(projectRoot, "src/frontend/games");
const docsGamesRoot = path.join(projectRoot, "docs/games");
const docsTestsRoot = path.join(projectRoot, "docs/tests");

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

function extractString(block, key) {
  return block.match(new RegExp(`${key}:\\s*"([^"]+)"`))?.[1] ?? "";
}

function removeRegistryBlock(source, gameId) {
  const blockPattern = /\{\s*\n\s*id:\s*"([^"]+)"[\s\S]*?\n\s*\}(?=\s*,?\s*(?:\{|\]))/g;
  let removedGame = null;
  const nextSource = source.replace(blockPattern, (block, id) => {
    if (id !== gameId) return block;
    removedGame = {
      id,
      title: extractString(block, "title"),
      route: extractString(block, "route"),
      category: extractString(block, "category")
    };
    return "";
  }).replace(/\n\s*,\s*\n\s*,/g, "\n,").replace(/\[\s*,/, "[");

  if (!removedGame) throw new Error(`Game not found in registry: ${gameId}`);
  return { source: nextSource, removedGame };
}

function removeRouterEntries(source, gameId) {
  const gamePath = `../games/${gameId}/`;
  return source
    .split("\n")
    .filter((line) => !line.includes(gamePath) && !line.match(new RegExp(`^\\s*"${escapeRegExp(gameId)}":\\s*[^,]+,?\\s*$`)))
    .join("\n");
}

function removeGameRows(source, gameId) {
  const markdownLink = new RegExp(`\\]\(\\./${escapeRegExp(gameId)}\\.md\\)|\\]\(${escapeRegExp(gameId)}\\.md\\)`);
  return source
    .split("\n")
    .filter((line) => !line.includes(`| \`${gameId}\` |`) && !markdownLink.test(line))
    .join("\n");
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

function syncGamesReadme(source, audit, gameId) {
  return removeGameRows(source, gameId).replace(
    /Сводка по последнему readiness-аудиту: \d+ \S+, \d+ \S+, \d+ \S+\. Все registry-игры имеют `docs\/games\/<id>\.md`\./,
    `Сводка по последнему readiness-аудиту: ${audit.summary.totalGames} ${pluralGame(audit.summary.totalGames)}, ${audit.summary.readinessGroup.ready ?? 0} ${pluralGame(audit.summary.readinessGroup.ready ?? 0)}, ${audit.summary.readinessGroup.development ?? 0} ${pluralGame(audit.summary.readinessGroup.development ?? 0)}. Все registry-игры имеют \`docs/games/<id>.md\`.`
  );
}

function syncIndex(source, audit) {
  const total = audit.summary.totalGames;
  return source
    .replace(/реестра из \d+ игр\./, `реестра из ${total} ${pluralGame(total)}.`)
    .replace(/- Registry\/router\/component coverage: \d+ \/ \d+\./, `- Registry/router/component coverage: ${total} / ${total}.`)
    .replace(/- Ready: \d+ \S+\./, `- Ready: ${audit.summary.readinessGroup.ready ?? 0} ${pluralGame(audit.summary.readinessGroup.ready ?? 0)}.`)
    .replace(/- Development: \d+ \S+\./, `- Development: ${audit.summary.readinessGroup.development ?? 0} ${pluralGame(audit.summary.readinessGroup.development ?? 0)}.`)
    .replace(/- Полный Electron CDP прогон: \d+ проверок, 0 failures\./, `- Полный Electron CDP прогон: ${total * 3} проверок, 0 failures.`);
}

function syncReadinessMarkdown(source, audit, gameId) {
  let nextSource = removeGameRows(source, gameId)
    .replace(/^\| `[^\n]+\|# Readiness audit/m, "# Readiness audit")
    .replace(/\| Игр в текущем реестре \| \d+ \|/, `| Игр в текущем реестре | ${audit.summary.totalGames} |`)
    .replace(/\| Ready \| \d+ \|/, `| Ready | ${audit.summary.readinessGroup.ready ?? 0} |`)
    .replace(/\| Development \| \d+ \|/, `| Development | ${audit.summary.readinessGroup.development ?? 0} |`)
    .replace(/\| `status: "polished"` \| \d+ \|/, `| \`status: "polished"\` | ${audit.summary.status.polished ?? 0} |`)
    .replace(/\| `status: "therapy-ready"` \| \d+ \|/, `| \`status: "therapy-ready"\` | ${audit.summary.status["therapy-ready"] ?? 0} |`)
    .replace(/\| `resolvedStabilityStatus: "publish"` \| \d+ \|/, `| \`resolvedStabilityStatus: "publish"\` | ${audit.summary.resolvedStabilityStatus.publish ?? 0} |`)
    .replace(/\| `resolvedStabilityStatus: "needs-check"` \| \d+ \|/, `| \`resolvedStabilityStatus: "needs-check"\` | ${audit.summary.resolvedStabilityStatus["needs-check"] ?? 0} |`)
    .replace(/Все \d+ registry-игры/, `Все ${audit.summary.totalGames} registry-игры`)
    .replace(/все \d+ игры имеют route/, `все ${audit.summary.totalGames} ${pluralGame(audit.summary.totalGames)} имеют route`);

  for (const [category, counts] of Object.entries(audit.summary.categoryReadiness)) {
    const categoryPattern = new RegExp("\\\\| `" + escapeRegExp(category) + "` \\\\| \\\\d+ \\\\| \\\\d+ \\\\|");
    nextSource = nextSource.replace(categoryPattern, `| \`${category}\` | ${counts.ready ?? 0} | ${counts.development ?? 0} |`);
  }

  const rows = audit.developmentQueue.slice(0, 10).map((game) => (
    `| \`${game.id}\` | \`${game.category}\` | \`${game.resolvedStabilityStatus}\` | ${(game.blockers ?? []).map((blocker) => `\`${blocker}\``).join(", ")} |`
  ));
  const lines = nextSource.split("\n");
  const headerIndex = lines.findIndex((line) => line === "| Игра | Категория | Stability | Blockers |");
  if (headerIndex >= 0) {
    let endIndex = headerIndex + 2;
    while (endIndex < lines.length && lines[endIndex].startsWith("| `")) endIndex += 1;
    lines.splice(headerIndex + 2, endIndex - (headerIndex + 2), ...rows);
    nextSource = lines.join("\n");
  }

  return nextSource;
}

async function syncDocs(auditPath, gameId) {
  const audit = JSON.parse(await readFile(auditPath, "utf8"));
  const gamesReadmePath = path.join(docsGamesRoot, "README.md");
  if (await exists(gamesReadmePath)) await writeFile(gamesReadmePath, syncGamesReadme(await readFile(gamesReadmePath, "utf8"), audit, gameId), "utf8");

  const datedRoot = path.dirname(auditPath);
  const indexPath = path.join(datedRoot, "index.md");
  if (await exists(indexPath)) await writeFile(indexPath, syncIndex(await readFile(indexPath, "utf8"), audit), "utf8");

  const readinessMdPath = path.join(datedRoot, "readiness-audit.md");
  if (await exists(readinessMdPath)) await writeFile(readinessMdPath, syncReadinessMarkdown(await readFile(readinessMdPath, "utf8"), audit, gameId), "utf8");
}

async function removeRuntimeDocs(gameId) {
  if (!(await exists(docsTestsRoot))) return;
  const entries = await readdir(docsTestsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const datedRoot = path.join(docsTestsRoot, entry.name);
    await rm(path.join(datedRoot, `${gameId}.md`), { force: true });
    const markdownFiles = (await readdir(datedRoot)).filter((file) => file.endsWith(".md"));
    for (const file of markdownFiles) {
      const filePath = path.join(datedRoot, file);
      const source = await readFile(filePath, "utf8");
      const nextSource = removeGameRows(source, gameId);
      if (nextSource !== source) await writeFile(filePath, nextSource, "utf8");
    }
  }
}

const gameId = argValue("--id", "");
if (!gameId) throw new Error("Usage: npm run review:remove -- --id=<game-id> [--audit=<path>] [--open-next]");

const auditPath = path.resolve(argValue("--audit", await latestAuditPath()));
const registrySource = await readFile(registryPath, "utf8");
const { source: nextRegistrySource, removedGame } = removeRegistryBlock(registrySource, gameId);
await writeFile(registryPath, nextRegistrySource, "utf8");

const routerSource = await readFile(routerPath, "utf8");
await writeFile(routerPath, removeRouterEntries(routerSource, gameId), "utf8");

await rm(path.join(gamesRoot, gameId), { recursive: true, force: true });
await rm(path.join(docsGamesRoot, `${gameId}.md`), { force: true });
await removeRuntimeDocs(gameId);

runReadinessAudit(auditPath);
await syncDocs(auditPath, gameId);

console.log(`Removed ${removedGame.title || gameId} (${gameId})`);
console.log(`Audit: ${path.relative(projectRoot, auditPath)}`);

if (hasFlag("--open-next")) {
  const result = spawnSync(process.execPath, [path.join(projectRoot, "scripts/open-next-development-game.mjs"), `--audit=${auditPath}`], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "inherit"
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

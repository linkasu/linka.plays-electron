#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const hardPxPattern = /(?:^|[^A-Za-z0-9_-])(?:\d+(?:\.\d+)?|\})px\b/;
const checkedExtensions = new Set([".vue", ".css", ".scss"]);

function isCheckedFile(filePath) {
  return filePath.startsWith("src/frontend/") && checkedExtensions.has(path.extname(filePath));
}

function diffLines() {
  const diff = execFileSync("git", ["diff", "--unified=0", "--", "src/frontend"], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  const issues = [];
  let filePath = "";
  let newLine = 0;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      filePath = line.slice(6);
      continue;
    }

    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }

    if (!filePath || !isCheckedFile(filePath)) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      const content = line.slice(1);
      if (hardPxPattern.test(content)) issues.push({ filePath, lineNumber: newLine, content });
      newLine += 1;
      continue;
    }

    if (!line.startsWith("-")) newLine += 1;
  }

  return issues;
}

function allLines() {
  const files = execFileSync("git", ["ls-files", "src/frontend"], { encoding: "utf8" })
    .split("\n")
    .filter((filePath) => filePath && isCheckedFile(filePath));
  const issues = [];

  for (const filePath of files) {
    const lines = readFileSync(filePath, "utf8").split("\n");
    lines.forEach((content, index) => {
      if (hardPxPattern.test(content)) issues.push({ filePath, lineNumber: index + 1, content });
    });
  }

  return issues;
}

const checkAll = process.argv.includes("--all");
const issues = checkAll ? allLines() : diffLines();

if (issues.length) {
  console.error("Hard px values are forbidden in frontend layout styles. Use rem, %, viewport units, clamp(), min(), max(), or Vuetify layout props.");
  for (const issue of issues) console.error(`${issue.filePath}:${issue.lineNumber}: ${issue.content.trim()}`);
  process.exitCode = 1;
} else {
  console.log(checkAll ? "No hard px values found in frontend layout styles." : "No added hard px values found in frontend layout styles.");
}

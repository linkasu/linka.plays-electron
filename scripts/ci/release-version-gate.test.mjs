import { readFileSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const packageJson = require("../../package.json");
const { assertReleaseVersion } = require("./release-version-gate");
const scriptDirectory = dirname(fileURLToPath(import.meta.url));

describe("release version gate", () => {
  it("accepts only the exact package version and its canonical tag", () => {
    expect(assertReleaseVersion(packageJson.version)).toBe(`v${packageJson.version}`);
    expect(assertReleaseVersion(`v${packageJson.version}`)).toBe(`v${packageJson.version}`);
  });

  it.each([undefined, "", "0.0.0", "v0.0.0", `vv${packageJson.version}`, `${packageJson.version}-beta`, `v${packageJson.version} `])("rejects mismatched release value %j", (version) => {
    expect(() => assertReleaseVersion(version)).toThrow(`must exactly match package.json version ${packageJson.version}`);
  });

  it("gates verify, build, publish and updater jobs before artifacts are built", () => {
    const workflow = readFileSync(join(scriptDirectory, "..", "..", ".github", "workflows", "release.yml"), "utf8");
    expect(workflow).toContain("release-version:");
    expect(workflow).toContain("node scripts/ci/release-version-gate.js");
    expect(workflow).toMatch(/verify:\n    needs: release-version/);
    expect(workflow).toMatch(/build:\n    needs: verify/);
    expect(workflow).toMatch(/publish:\n    needs: \[release-version, build\]/);
    expect(workflow).toMatch(/publish-updater-mirror:\n    needs: \[release-version, publish\]/);
  });
});

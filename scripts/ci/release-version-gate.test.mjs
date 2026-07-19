import { readFileSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const packageJson = require("../../package.json");
const { assertReleaseVersion } = require("./release-version-gate");
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const version = packageJson.version;

describe("release version gate", () => {
  it("accepts only the exact package version and its canonical tag", () => {
    expect(assertReleaseVersion(version)).toBe(`v${version}`);
    expect(assertReleaseVersion(`v${version}`)).toBe(`v${version}`);
  });

  it.each([undefined, "", "0.0.0", "v0.0.0", `vv${version}`, `${version}-beta`, `v${version} `])("rejects mismatched release value %j", (candidate) => {
    expect(() => assertReleaseVersion(candidate)).toThrow(`must exactly match package.json version ${version}`);
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

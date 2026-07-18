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
    expect(packageJson.version).toBe("0.1.18");
    expect(assertReleaseVersion("0.1.18")).toBe("v0.1.18");
    expect(assertReleaseVersion("v0.1.18")).toBe("v0.1.18");
  });

  it.each([undefined, "", "0.1.17", "v0.1.17", "vv0.1.18", "0.1.18-beta", "v0.1.18 "])("rejects mismatched release value %j", (version) => {
    expect(() => assertReleaseVersion(version)).toThrow("must exactly match package.json version 0.1.18");
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

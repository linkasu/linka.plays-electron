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

  it.each([undefined, "", "0.0.0", "v0.0.0", `vv${version}`, `${version}-beta`, `v${version} `])(
    "rejects mismatched release value %j",
    (candidate) => {
      expect(() => assertReleaseVersion(candidate)).toThrow(
        `must exactly match package.json version ${version}`,
      );
    },
  );

  it("gates verify, build, publish and updater jobs before artifacts are built", () => {
    const workflow = readFileSync(
      join(scriptDirectory, "..", "..", ".github", "workflows", "release.yml"),
      "utf8",
    );
    expect(workflow).toContain("release-version:");
    expect(workflow).toContain("node scripts/ci/release-version-gate.js");
    expect(workflow).toMatch(/verify:\n    needs: release-version/);
    expect(workflow).toMatch(/build:\n    needs: verify/);
    expect(workflow).toMatch(/upgrade-3:\n    needs: build/);
    expect(workflow).toContain("-PreviousVersion 3.0.0");
    expect(workflow).toMatch(/upgrade-nsis:\n    needs: build/);
    expect(workflow).toContain("windows-nsis-migration-smoke.ps1");
    expect(workflow).toContain('"0.1.22", "0.1.23-beta.95"');
    expect(workflow).toMatch(
      /publish:\n    needs: \[release-version, build, upgrade-3, upgrade-nsis\]/,
    );
    expect(workflow).toMatch(/publish-updater-mirror:\n    needs: \[release-version, publish\]/);
  });

  it("isolates Inno releases and keeps preview builds out of the legacy updater feed", () => {
    const workflow = readFileSync(
      join(scriptDirectory, "..", "..", ".github", "workflows", "release.yml"),
      "utf8",
    );
    const preview = readFileSync(
      join(scriptDirectory, "..", "..", ".github", "workflows", "windows-main-release.yml"),
      "utf8",
    );
    expect(workflow).toContain("GH_REPO: linkasu/linka.plays-windows-releases");
    expect(workflow).toContain("scripts/ci/assert-windows-release-assets.mjs");
    expect(workflow).toContain("secrets.WINDOWS_RELEASE_TOKEN");
    expect(preview).not.toContain("gh release create");
    expect(preview).not.toContain("contents: write");
    expect(workflow).toContain("node --test scripts/ci/updater-feed-compatibility.test.cjs");
  });

  it("keeps launcher sources outside the build directory erased by node-gyp rebuild", () => {
    const workflow = readFileSync(
      join(scriptDirectory, "..", "..", ".github", "workflows", "release.yml"),
      "utf8",
    );
    expect(workflow).toContain("path: .launcher-source");
    expect(workflow).toContain("dotnet publish .launcher-source/LINKa.plays-launcher/");
  });
});

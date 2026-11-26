import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { verifyPublicWindowsRelease } from "./verify-public-windows-release.mjs";

const body = Buffer.from("public release");
const digest = `sha256:${createHash("sha256").update(body).digest("hex")}`;
function requestMock({
  version = "3.0.0",
  corrupt = "",
  changed = false,
  wrongUrl = false,
  redirectPath,
  finalUrl,
} = {}) {
  let manifests = 0;
  const urls = [];
  const request = async (url, options) => {
    urls.push(url);
    assert.ok(options.signal);
    const responseAt = (response) =>
      Object.defineProperty(response, "url", {
        value: redirectPath && url.includes(redirectPath) ? finalUrl : url,
      });
    if (url.includes("api.github.com")) {
      assert.equal(options.redirect, "error");
      assert.equal(
        url,
        "https://api.github.com/repos/linkasu/linka.plays-windows-releases/releases/tags/v3.0.0",
      );
      return responseAt(
        Response.json({
          tag_name: "v3.0.0",
          draft: false,
          prerelease: false,
          assets: ["linka.plays-electron-3.0.0-win-x64.exe", "launcher.zip"].map((name) => ({
            name,
            size: body.length,
            digest,
            browser_download_url: `https://github.com/linkasu/${wrongUrl ? "linka.plays-electron" : "linka.plays-windows-releases"}/releases/download/v3.0.0/${name}`,
          })),
        }),
      );
    }
    if (url.endsWith("version.json")) {
      assert.equal(options.redirect, "error");
      manifests++;
      return responseAt(Response.json({ version: changed && manifests > 2 ? "3.0.1" : version }));
    }
    return responseAt(new Response(url.includes(corrupt || "never") ? "corrupt" : body));
  };
  return { request, urls };
}

for (const redirectPath of [
  "version.json",
  "linkaplaysetup.exe",
  "linka.plays.setup.exe",
  "launcher.zip",
]) {
  for (const finalUrl of [
    "https://evil.test/file?secret=signed-value",
    "http://linka.su/file",
    "https://www.linka.su/file",
    "https://linka.su.evil.test/file",
    "https://linka.su:444/file",
    "https://github.com/file",
    "https://release-assets.githubusercontent.com/file",
    "",
  ]) {
    test(`public ${redirectPath} rejects final URL ${finalUrl || "(empty)"}`, async () => {
      await assert.rejects(
        verifyPublicWindowsRelease("3.0.0", requestMock({ redirectPath, finalUrl }).request),
        (error) => {
          assert.match(error.message, /final response origin/i);
          assert.ok(!String(error).includes("signed-value"));
          return true;
        },
      );
    });
  }
}

test("public download permits a same-origin HTTPS redirect", async () => {
  await verifyPublicWindowsRelease(
    "3.0.0",
    requestMock({
      redirectPath: "linkaplaysetup.exe",
      finalUrl: "https://linka.su/files/installer.exe",
    }).request,
  );
});

test("read-only verifier streams both EXEs and zip and reads versions before/after", async () => {
  const { request, urls } = requestMock();
  const report = await verifyPublicWindowsRelease("3.0.0", request);
  assert.equal(report.version, "3.0.0");
  assert.equal(report.repository, "linkasu/linka.plays-windows-releases");
  assert.equal(report.files.length, 3);
  assert.ok(
    report.files.every((file) => file.sha256 === digest.slice(7) && file.size === body.length),
  );
  assert.deepEqual(report.versionsBefore, report.versionsAfter);
  assert.equal(urls.filter((url) => url.endsWith("version.json")).length, 4);
  for (const path of [
    "linkaplay/linkaplaysetup.exe",
    "dist/linka.plays/linka.plays.setup.exe",
    "linkaplay/launcher.zip",
  ]) {
    assert.ok(urls.includes(`https://linka.su/${path}`));
  }
  assert.equal(urls.filter((url) => url.endsWith(".exe") || url.endsWith(".zip")).length, 3);
});
for (const options of [
  { version: "3.0.1" },
  { changed: true },
  { wrongUrl: true },
  { corrupt: "linkaplaysetup.exe" },
  { corrupt: "linka.plays.setup.exe" },
  { corrupt: "launcher.zip" },
]) {
  test(`verifier refuses mismatching public release: ${JSON.stringify(options)}`, async () => {
    await assert.rejects(verifyPublicWindowsRelease("3.0.0", requestMock(options).request));
  });
}

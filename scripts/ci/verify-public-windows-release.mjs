import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  RELEASE_REPOSITORY,
  fetchReleaseJson,
  getWindowsRelease,
  verifyWindowsDownload,
} from "../publish-windows-release.mjs";

const base = "https://linka.su";
const manifests = ["/linkaplay/version.json", "/dist/linka.plays/version.json"];

export async function verifyPublicWindowsRelease(version, request = fetch) {
  const [installer, launcher] = await getWindowsRelease(version, request);
  const verifyVersions = async () => {
    const versions = {};
    for (const path of manifests) {
      const manifest = await fetchReleaseJson(`${base}${path}`, request);
      if (manifest?.version !== version)
        throw new Error(`Expected exactly ${version} at ${path}, received ${manifest?.version}`);
      versions[path] = manifest.version;
    }
    return versions;
  };
  const versionsBefore = await verifyVersions();
  const files = [
    { ...installer, url: `${base}/linkaplay/linkaplaysetup.exe` },
    { ...installer, url: `${base}/dist/linka.plays/linka.plays.setup.exe` },
    { ...launcher, url: `${base}/linkaplay/launcher.zip` },
  ].map(({ url, size, sha256 }) => ({ url, size, sha256 }));
  for (const file of files) {
    await verifyWindowsDownload(file.url, file, request);
  }
  const versionsAfter = await verifyVersions();
  return {
    version,
    repository: RELEASE_REPOSITORY,
    verified: true,
    versionsBefore,
    versionsAfter,
    files,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  verifyPublicWindowsRelease(process.argv[2]).then(
    (report) => console.log(JSON.stringify(report, null, 2)),
    (error) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
}

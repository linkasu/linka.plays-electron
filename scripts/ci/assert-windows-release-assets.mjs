import { readdir, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

export async function assertWindowsReleaseAssets(directory, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Expected a numeric stable version");
  const expected = [`linka.plays-electron-${version}-win-x64.exe`, "launcher.zip"].sort();
  const actual = (await readdir(directory)).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Inno release must contain only ${expected.join(", ")}; got ${actual.join(", ")}`,
    );
  }
  for (const name of expected) {
    const info = await stat(join(directory, name));
    if (!info.isFile() || info.size === 0)
      throw new Error(`Empty or invalid release asset: ${name}`);
  }
  return expected;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assertWindowsReleaseAssets(process.argv[2], process.argv[3]).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

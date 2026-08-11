import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { migrateLooksTobiiCalibration } from "./calibrationMigration";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createDirectories() {
  const root = await mkdtemp(join(tmpdir(), "linka-calibration-migration-"));
  const source = join(root, "source");
  const target = join(root, "target");
  directories.push(root);
  await mkdir(source);
  await mkdir(target);
  return { source, target };
}

describe("LINKa Looks calibration migration", () => {
  it("copies calibration only into missing target files", async () => {
    const { source, target } = await createDirectories();
    await writeFile(join(source, "tobiifree-calibration.bin"), "looks-binary");
    await writeFile(join(source, "tobiifree-software-calibration.json"), "looks-json");
    await writeFile(join(target, "tobiifree-software-calibration.json"), "plays-json");

    expect(await migrateLooksTobiiCalibration(source, target)).toEqual(["tobiifree-calibration.bin"]);
    expect(await readFile(join(target, "tobiifree-calibration.bin"), "utf8")).toBe("looks-binary");
    expect(await readFile(join(target, "tobiifree-software-calibration.json"), "utf8")).toBe("plays-json");
  });

  it("runs once and does not recreate calibration removed after migration", async () => {
    const { source, target } = await createDirectories();
    const fileName = "tobiifree-calibration.bin";
    await writeFile(join(source, fileName), "first");
    await migrateLooksTobiiCalibration(source, target);
    await unlink(join(target, fileName));
    await writeFile(join(source, fileName), "second");

    expect(await migrateLooksTobiiCalibration(source, target)).toEqual([]);
    await expect(readFile(join(target, fileName), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});

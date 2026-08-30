import { constants } from "fs";
import { access, copyFile, mkdir, open } from "fs/promises";
import { join } from "path";

const calibrationFiles = ["tobiifree-calibration.bin", "tobiifree-software-calibration.json"];
const migrationMarker = ".linka-looks-calibration-v1.migrated";

export async function migrateLooksTobiiCalibration(
  sourceDirectory: string,
  targetDirectory: string,
) {
  const markerPath = join(targetDirectory, migrationMarker);
  if (await exists(markerPath)) return [];

  await mkdir(targetDirectory, { recursive: true });
  const copied: string[] = [];
  for (const fileName of calibrationFiles) {
    try {
      await copyFile(
        join(sourceDirectory, fileName),
        join(targetDirectory, fileName),
        constants.COPYFILE_EXCL,
      );
      copied.push(fileName);
    } catch (error) {
      if (hasCode(error, "ENOENT") || hasCode(error, "EEXIST")) continue;
      throw error;
    }
  }

  try {
    const marker = await open(markerPath, "wx", 0o600);
    await marker.close();
  } catch (error) {
    if (!hasCode(error, "EEXIST")) throw error;
  }
  return copied;
}

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function hasCode(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code;
}

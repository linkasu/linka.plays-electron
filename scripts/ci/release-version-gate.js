const packageJson = require("../../package.json");

function assertReleaseVersion(releaseVersion, packageVersion = packageJson.version) {
  const accepted = releaseVersion === packageVersion || releaseVersion === `v${packageVersion}`;
  if (!accepted) {
    throw new Error(`Release version ${JSON.stringify(releaseVersion)} must exactly match package.json version ${packageVersion}`);
  }
  return `v${packageVersion}`;
}

if (require.main === module) {
  try {
    console.log(assertReleaseVersion(process.argv[2]));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = { assertReleaseVersion };

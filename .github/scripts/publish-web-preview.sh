#!/usr/bin/env bash
#
# Republishes the `gh-pages` branch as a single orphan commit.
#
# Inputs (environment):
#   TARGET       subdirectory to write into; empty means the site root
#   REMOVE_ONLY  when set, delete TARGET instead of writing a build into it
#   GH_TOKEN     token with contents:write
#   PUBLISH_REMOTE  override the target repository; only used to exercise this
#                   script against a local repository before shipping it
#
# The branch carries no history on purpose. A build is about 67 MB, and a
# growing branch is paid for by everyone who clones the repository.

set -euo pipefail

target="${TARGET:-}"
site="${RUNNER_TEMP:-/tmp}/linka-site"
remote="${PUBLISH_REMOTE:-https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"

case "$target" in
  /*|*..*) echo "TARGET must be a relative path without '..': $target" >&2; exit 1 ;;
esac

rm -rf "$site"
mkdir -p "$site"

# Start from whatever is published now, so other previews survive.
if git fetch --depth=1 "$remote" gh-pages 2>/dev/null; then
  git archive FETCH_HEAD | tar -x -C "$site"
  echo "Existing site restored."
else
  echo "No gh-pages branch yet, starting an empty site."
fi

if [ -n "${REMOVE_ONLY:-}" ]; then
  rm -rf "${site:?}/$target"
  echo "Removed $target."
elif [ -z "$target" ]; then
  # Root publish: replace everything except the previews and CNAME. A custom
  # domain lives in that file, and Pages drops the domain the moment it goes
  # missing — a full republish would quietly break the address.
  find "$site" -mindepth 1 -maxdepth 1 ! -name preview ! -name CNAME -exec rm -rf {} +
  cp -R dist/. "$site/"
  echo "Published the site root."
else
  rm -rf "${site:?}/$target"
  mkdir -p "$site/$target"
  cp -R dist/. "$site/$target/"
  echo "Published $target."
fi

# Pages skips paths that start with an underscore unless this file is present.
touch "$site/.nojekyll"

cd "$site"
rm -rf .git
git init --quiet --initial-branch=gh-pages
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git commit --quiet -m "Publish ${target:-site root} from ${GITHUB_SHA:-unknown}"
git push --force --quiet "$remote" gh-pages
echo "Pushed gh-pages."

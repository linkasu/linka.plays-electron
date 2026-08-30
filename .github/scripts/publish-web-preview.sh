#!/usr/bin/env bash
#
# Republishes the `gh-pages` branch as a single orphan commit.
#
# Inputs (environment):
#   TARGET       subdirectory to write into; empty means the site root
#   REMOVE_ONLY  when set, delete TARGET instead of writing a build into it
#   GH_TOKEN     token with contents:write
#   PRUNE_PREVIEWS  set to "1" to reconcile previews against KEEP_PREVIEWS.
#                   A separate flag on purpose: GitHub Actions always defines an
#                   env var, so "is KEEP_PREVIEWS set" would be true on every
#                   run and an empty list would wipe every preview
#   KEEP_PREVIEWS   space separated pull request numbers whose previews survive;
#                   every other preview is dropped. Empty means no pull request
#                   is open, which is only trustworthy together with the flag
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

# Previews are reconciled here rather than on a "pull request closed" event.
# A merge fires both events, so cleaning up separately meant two force pushes to
# gh-pages seconds apart: Pages started building the first, the second replaced
# it, and the first was reported as "Page build failed". Worse, when three
# publishes contended, the Actions concurrency queue dropped the pending one and
# the cleanup was silently lost.
if [ "${PRUNE_PREVIEWS:-}" = "1" ] && [ -d "$site/preview" ]; then
  for directory in "$site"/preview/pr-*; do
    [ -d "$directory" ] || continue
    number="$(basename "$directory")"
    number="${number#pr-}"
    case " ${KEEP_PREVIEWS} " in
      *" ${number} "*) ;;
      *) rm -rf "$directory"; echo "Dropped preview for closed pull request ${number}." ;;
    esac
  done
  rmdir "$site/preview" 2>/dev/null || true
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
if [ -n "${REMOVE_ONLY:-}" ]; then
  summary="Remove $target"
else
  summary="Publish ${target:-site root}"
fi
git commit --quiet -m "$summary from ${GITHUB_SHA:-unknown}"
git push --force --quiet "$remote" gh-pages
echo "Pushed gh-pages."

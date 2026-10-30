#!/usr/bin/env bash
# Builds a preview of every open, same-repo PR into dist/preview/pr-<n>/ and
# writes dist/versions.json (main + each preview that built) for the app's
# version picker — see ARCHITECTURE.md §7 ("PR previews"). Run by deploy.yml
# after main's own build is already in dist/.
#
# A PR whose install or build fails is skipped with a warning rather than
# failing the job, so one broken branch never blocks main's deploy. Tests
# aren't run here; ci.yml already runs them on every PR.
set -euo pipefail

root="$PWD"
entries="$(mktemp)"

jq -n --arg sha "$(git rev-parse HEAD)" '{channel: "main", path: "./", sha: $sha}' >>"$entries"

gh pr list --repo "$GITHUB_REPOSITORY" --state open --limit 50 \
  --json number,title,headRefName,headRefOid,isCrossRepository |
  jq -c '.[] | select(.isCrossRepository | not)' >"$root/.prs.jsonl"

# fd 3, so npm/git inside the loop can't swallow the remaining PR lines on stdin.
while read -r pr <&3; do
  number="$(jq -r .number <<<"$pr")"
  sha="$(jq -r .headRefOid <<<"$pr")"
  branch="$(jq -r .headRefName <<<"$pr")"
  channel="pr-$number"
  dir="$RUNNER_TEMP/$channel"
  echo "::group::$channel ($branch @ ${sha:0:7})"

  if git fetch --quiet --depth=1 origin "$sha" &&
    git worktree add --quiet --detach "$dir" "$sha" &&
    (cd "$dir" && npm ci --prefer-offline --no-audit --no-fund &&
      VITE_CHANNEL="$channel" VITE_PR_NUMBER="$number" VITE_BRANCH="$branch" VITE_COMMIT="$sha" npm run build); then
    mkdir -p "$root/dist/preview"
    cp -r "$dir/dist" "$root/dist/preview/$channel"
    jq -c --arg channel "$channel" '{channel: $channel, path: "preview/\($channel)/", pr: .number, title, branch: .headRefName, sha: .headRefOid}' <<<"$pr" >>"$entries"
  else
    echo "::warning::preview $channel ($branch) failed to build — skipped"
  fi

  git worktree remove --force "$dir" 2>/dev/null || true
  echo "::endgroup::"
done 3<"$root/.prs.jsonl"

rm -f "$root/.prs.jsonl"
jq -s --arg builtAt "$(date -u +%FT%TZ)" '{builtAt: $builtAt, versions: .}' "$entries" >"$root/dist/versions.json"
cat "$root/dist/versions.json"

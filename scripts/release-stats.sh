#!/usr/bin/env bash
# Shows combined download statistics per release.
#
# Sources:
#   1. Obsidian community stats  — cumulative store downloads per version
#   2. GitHub Releases API       — asset downloads per release (manual / BRAT installs)
#
# Usage: ./scripts/release-stats.sh [plugin-id] [github-owner/repo]
# Defaults: focus-first  christian-luger-at/obsidian-focus-first

set -euo pipefail

PLUGIN_ID="${1:-focus-first}"
GITHUB_REPO="${2:-christian-luger-at/obsidian-focus-first}"

STATS_URL="https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json"
GH_RELEASES_URL="https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=100"

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required. Install with: brew install jq" >&2
  exit 1
fi

# ── Fetch Obsidian store stats ────────────────────────────────────────────────

STORE_RAW=$(curl -fsSL "$STATS_URL")
PLUGIN_DATA=$(echo "$STORE_RAW" | jq --arg id "$PLUGIN_ID" '.[$id] // empty')

if [[ -z "$PLUGIN_DATA" ]]; then
  echo "Plugin '$PLUGIN_ID' not found in Obsidian stats." >&2
  exit 1
fi

# Write store data to temp file: "version<TAB>store_count"
STORE_TMP=$(mktemp)
echo "$PLUGIN_DATA" | jq -r '
  to_entries
  | map(select(.key != "downloads" and (.key | test("^[0-9]"))))
  | .[]
  | "\(.key)\t\(.value)"
' > "$STORE_TMP"

# ── Fetch GitHub release asset downloads ─────────────────────────────────────

GH_ARGS=(-fsSL "$GH_RELEASES_URL" -H "Accept: application/vnd.github+json")
[[ -n "${GITHUB_TOKEN:-}" ]] && GH_ARGS+=(-H "Authorization: Bearer $GITHUB_TOKEN")

GH_RAW=$(curl "${GH_ARGS[@]}" 2>/dev/null || true)

# Write GitHub data to temp file: "version<TAB>gh_count"
GH_TMP=$(mktemp)
if [[ -n "$GH_RAW" ]] && ! echo "$GH_RAW" | jq -e 'type == "object" and .message' &>/dev/null; then
  echo "$GH_RAW" | jq -r '
    .[]
    | .tag_name as $tag
    | (.assets // [])
    | map(select(.name == "main.js" or .name == "manifest.json" or .name == "styles.css"))
    | if length > 0 then "\($tag)\t\(map(.download_count) | add)" else empty end
  ' > "$GH_TMP"
else
  MSG=$(echo "$GH_RAW" | jq -r '.message // "unknown error"' 2>/dev/null || echo "unknown error")
  echo "Warning: GitHub API — $MSG" >&2
  echo "Tip: export GITHUB_TOKEN=<token> to avoid rate limits." >&2
fi

# ── Merge and display ─────────────────────────────────────────────────────────

awk -v store_file="$STORE_TMP" '
BEGIN {
  while ((getline line < store_file) > 0) {
    split(line, a, "\t")
    store[a[1]] = a[2] + 0
  }
  close(store_file)
}
{
  ver = $1; gh = $2 + 0
  versions[ver] = 1
  github[ver] = gh
}
END {
  # Collect all known versions
  for (v in store) versions[v] = 1

  # Sort descending by semver (awk lacks native sort; collect into array then sort)
  n = 0
  for (v in versions) { keys[n++] = v }

  # Bubble sort descending by major.minor.patch
  for (i = 0; i < n; i++) {
    for (j = i+1; j < n; j++) {
      split(keys[i], a, "."); split(keys[j], b, ".")
      ai = a[1]*10000 + a[2]*100 + a[3]
      bi = b[1]*10000 + b[2]*100 + b[3]
      if (ai < bi) { tmp = keys[i]; keys[i] = keys[j]; keys[j] = tmp }
    }
  }

  fmt = "  %-10s  %9s  %9s\n"
  sep = "  ----------  ---------  ---------"
  printf fmt, "Version", "Store", "GitHub"
  print sep
  store_total = 0; gh_total = 0
  for (i = 0; i < n; i++) {
    v = keys[i]
    s = store[v] + 0
    g = github[v] + 0
    store_total += s; gh_total += g
    printf fmt, v, s, g
  }
  print sep
  printf fmt, "TOTAL", store_total, gh_total
}
' "$GH_TMP"

rm -f "$STORE_TMP" "$GH_TMP"

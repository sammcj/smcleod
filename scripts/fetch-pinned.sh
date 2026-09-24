#!/usr/bin/env bash
# Writes data/pinned.json, the Projects folder's items: a GitHub user's pinned repos in pin order.
# The pinned-items API is GraphQL only and needs a token, so this runs in the deploy workflow (GH_TOKEN) or
# locally with an authenticated gh. On any failure the existing file is left untouched.
# Usage: scripts/fetch-pinned.sh [user]
set -euo pipefail

user="${1:-sammcj}"
dir="$(cd "$(dirname "$0")" && pwd)"
out="$dir/../data/pinned.json"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

# shellcheck disable=SC2016 # $login is a GraphQL variable
query='query($login: String!) {
  user(login: $login) {
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes { ... on Repository { name description url primaryLanguage { name } } }
    }
  }
}'

gh api graphql -F login="$user" -f query="$query" | jq -f "$dir/pinned.jq" > "$tmp"
jq -e 'type == "array" and length > 0' "$tmp" > /dev/null
cat "$tmp" > "$out"
echo "wrote $(jq length "$out") pinned repos to data/pinned.json"

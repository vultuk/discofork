#!/usr/bin/env bash

set -euo pipefail

required_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

required_env DATABASE_URL
required_env REDIS_URL

if [[ -z "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ]]; then
  echo "Missing GitHub auth token. Set GH_TOKEN or GITHUB_TOKEN for gh." >&2
  exit 1
fi

export GIT_TERMINAL_PROMPT=0

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Set GH_TOKEN or GITHUB_TOKEN for non-interactive worker startup." >&2
  exit 1
fi

if ! gh auth setup-git >/dev/null 2>&1; then
  echo "Failed to configure Git credential helper from gh auth." >&2
  exit 1
fi

if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  if ! codex login status >/dev/null 2>&1; then
    printf '%s' "${OPENAI_API_KEY}" | codex login --with-api-key >/dev/null
  fi
fi

if ! codex login status >/dev/null 2>&1; then
  echo "Codex is not authenticated. Set OPENAI_API_KEY for non-interactive worker startup." >&2
  exit 1
fi

workspace_root="${DISCOFORK_WORKSPACE_ROOT:-${PWD}/.discofork}"
clone_root="${workspace_root}/repos"

if [[ -d "${clone_root}" ]]; then
  echo "Clearing stale cloned repositories from ${clone_root}..."
  rm -rf "${clone_root}"
fi

echo "Running migrations..."
bun run migrate

echo "Starting Discofork worker..."
exec bun run worker

#!/usr/bin/env bash

set -euo pipefail

REPO_SLUG="vultuk/discofork"
INSTALL_ROOT="${DISCOFORK_INSTALL_DIR:-$HOME/.local/share/discofork}"
BIN_DIR="${DISCOFORK_BIN_DIR:-$HOME/.local/bin}"
REQUESTED_REF="${DISCOFORK_VERSION:-latest}"
SKIP_BUN_INSTALL="${DISCOFORK_SKIP_BUN_INSTALL:-0}"

usage() {
  cat <<'EOF'
Discofork installer

Usage:
  curl -fsSL https://discofork.ai/install.sh | bash

Options:
  --ref <git-ref>         Install a specific tag or branch instead of the latest release
  --install-dir <path>    Override the install root (default: ~/.local/share/discofork)
  --bin-dir <path>        Override the launcher directory (default: ~/.local/bin)
  --skip-bun-install      Fail if Bun is missing instead of installing it
  -h, --help              Show this help text

Environment:
  DISCOFORK_VERSION
  DISCOFORK_INSTALL_DIR
  DISCOFORK_BIN_DIR
  DISCOFORK_SKIP_BUN_INSTALL=1
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      REQUESTED_REF="${2:-}"
      shift 2
      ;;
    --install-dir)
      INSTALL_ROOT="${2:-}"
      shift 2
      ;;
    --bin-dir)
      BIN_DIR="${2:-}"
      shift 2
      ;;
    --skip-bun-install)
      SKIP_BUN_INSTALL="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_cmd curl
need_cmd tar
need_cmd mktemp

resolve_ref() {
  if [[ "$REQUESTED_REF" != "latest" ]]; then
    printf '%s\n' "$REQUESTED_REF"
    return
  fi

  local latest_ref
  latest_ref="$(
    curl -fsSL "https://api.github.com/repos/${REPO_SLUG}/releases/latest" 2>/dev/null \
      | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
      | head -n1
  )"

  if [[ -n "$latest_ref" ]]; then
    printf '%s\n' "$latest_ref"
  else
    printf '%s\n' "main"
  fi
}

ensure_bun() {
  if command -v bun >/dev/null 2>&1; then
    return
  fi

  if [[ "$SKIP_BUN_INSTALL" == "1" ]]; then
    echo "Bun is required but was not found on PATH." >&2
    exit 1
  fi

  echo "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"

  if ! command -v bun >/dev/null 2>&1; then
    echo "Bun installation completed, but 'bun' is still not on PATH." >&2
    echo "Add ~/.bun/bin to PATH and rerun the installer." >&2
    exit 1
  fi
}

download_archive() {
  local ref="$1"
  local destination="$2"
  local tag_url="https://github.com/${REPO_SLUG}/archive/refs/tags/${ref}.tar.gz"
  local branch_url="https://github.com/${REPO_SLUG}/archive/refs/heads/${ref}.tar.gz"

  if curl -fsSL "$tag_url" -o "$destination"; then
    return
  fi

  curl -fsSL "$branch_url" -o "$destination"
}

write_launcher() {
  local launcher_path="$1"
  cat > "$launcher_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail

if ! command -v bun >/dev/null 2>&1; then
  echo "Discofork requires Bun on PATH. Install Bun from https://bun.sh and retry." >&2
  exit 1
fi

exec bun "${INSTALL_ROOT}/src/index.tsx" "\$@"
EOF
  chmod +x "$launcher_path"
}

warn_missing_runtime_tools() {
  local missing=()
  local tool
  for tool in git gh codex; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      missing+=("$tool")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo
    echo "Installed Discofork, but these runtime tools are still missing:"
    printf '  - %s\n' "${missing[@]}"
    echo "Install them before running repository analysis."
  fi
}

main() {
  ensure_bun

  local ref
  ref="$(resolve_ref)"
  local temp_dir
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' EXIT

  local archive_path="${temp_dir}/discofork.tar.gz"
  echo "Downloading Discofork (${ref})..."
  download_archive "$ref" "$archive_path"

  tar -xzf "$archive_path" -C "$temp_dir"
  local extracted_dir
  extracted_dir="$(find "$temp_dir" -mindepth 1 -maxdepth 1 -type d | head -n1)"

  if [[ -z "$extracted_dir" ]]; then
    echo "Failed to unpack Discofork archive." >&2
    exit 1
  fi

  mkdir -p "$(dirname "$INSTALL_ROOT")"
  rm -rf "$INSTALL_ROOT"
  mv "$extracted_dir" "$INSTALL_ROOT"

  echo "Installing runtime dependencies with Bun..."
  (cd "$INSTALL_ROOT" && bun install --production --frozen-lockfile)

  mkdir -p "$BIN_DIR"
  local launcher_path="${BIN_DIR}/discofork"
  write_launcher "$launcher_path"

  echo
  echo "Discofork installed to ${INSTALL_ROOT}"
  echo "Launcher created at ${launcher_path}"

  if [[ ":$PATH:" != *":${BIN_DIR}:"* ]]; then
    echo "Add ${BIN_DIR} to your PATH to run 'discofork' directly."
  fi

  warn_missing_runtime_tools
  echo
  echo "Try:"
  echo "  discofork --help"
}

main

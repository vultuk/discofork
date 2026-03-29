#!/usr/bin/env bash

set -euo pipefail

REPO_SLUG="vultuk/discofork"
INSTALL_ROOT="${DISCOFORK_INSTALL_DIR:-$HOME/.local/share/discofork}"
BIN_DIR="${DISCOFORK_BIN_DIR:-}"
REQUESTED_REF="${DISCOFORK_VERSION:-latest}"
SKIP_BUN_INSTALL="${DISCOFORK_SKIP_BUN_INSTALL:-0}"
TEMP_DIR=""
ORIGINAL_PATH="${PATH:-}"

usage() {
  cat <<'EOF'
Discofork installer

Usage:
  curl -fsSL https://discofork.ai/install.sh | bash

Options:
  --ref <git-ref>         Install a specific tag or branch instead of the latest release
  --install-dir <path>    Override the install root (default: ~/.local/share/discofork)
  --bin-dir <path>        Override the launcher directory (default: first writable dir on PATH, else ~/.local/bin)
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

cleanup() {
  if [[ -n "${TEMP_DIR:-}" && -d "${TEMP_DIR:-}" ]]; then
    rm -rf "$TEMP_DIR"
  fi
}

trap cleanup EXIT

detect_os() {
  case "$(uname -s)" in
    Darwin)
      printf '%s\n' "darwin"
      ;;
    Linux)
      printf '%s\n' "linux"
      ;;
    *)
      echo "Unsupported operating system: $(uname -s)" >&2
      exit 1
      ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    arm64|aarch64)
      printf '%s\n' "arm64"
      ;;
    x86_64|amd64)
      printf '%s\n' "amd64"
      ;;
    *)
      echo "Unsupported architecture: $(uname -m)" >&2
      exit 1
      ;;
  esac
}

pick_bin_dir() {
  if [[ -n "$BIN_DIR" ]]; then
    printf '%s\n' "$BIN_DIR"
    return
  fi

  local candidate
  local path_parts=()
  IFS=':' read -r -a path_parts <<< "${PATH:-}"

  for candidate in "${path_parts[@]}"; do
    if [[ -n "$candidate" && -d "$candidate" && -w "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return
    fi
  done

  printf '%s\n' "$HOME/.local/bin"
}

release_metadata() {
  local repo_slug="$1"
  curl -fsSL "https://api.github.com/repos/${repo_slug}/releases/latest"
}

release_url_for_pattern() {
  local metadata="$1"
  local pattern="$2"

  printf '%s\n' "$metadata" \
    | sed -n 's/.*"browser_download_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    | grep -E "$pattern" \
    | head -n1
}

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
  )" || true

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

  if curl -fsSL "$tag_url" -o "$destination" 2>/dev/null; then
    return
  fi

  curl -fsSL "$branch_url" -o "$destination" 2>/dev/null
}

install_gh() {
  if command -v gh >/dev/null 2>&1; then
    return
  fi

  local os arch metadata asset_url archive_path extract_dir binary_path
  os="$(detect_os)"
  arch="$(detect_arch)"
  metadata="$(release_metadata "cli/cli")"

  if [[ "$os" == "darwin" ]]; then
    asset_url="$(release_url_for_pattern "$metadata" "gh_.*_macOS_${arch}\\.zip$")"
    need_cmd unzip
  else
    asset_url="$(release_url_for_pattern "$metadata" "gh_.*_linux_${arch}\\.tar\\.gz$")"
  fi

  if [[ -z "$asset_url" ]]; then
    echo "Could not locate a GitHub CLI release asset for ${os}/${arch}." >&2
    return
  fi

  archive_path="${TEMP_DIR}/gh.${asset_url##*.}"
  extract_dir="${TEMP_DIR}/gh"

  echo "Installing GitHub CLI..."
  curl -fsSL "$asset_url" -o "$archive_path"
  mkdir -p "$extract_dir"

  if [[ "$os" == "darwin" ]]; then
    unzip -q "$archive_path" -d "$extract_dir"
  else
    tar -xzf "$archive_path" -C "$extract_dir"
  fi

  binary_path="$(find "$extract_dir" -type f -path '*/bin/gh' | head -n1)"
  if [[ -z "$binary_path" ]]; then
    echo "Failed to locate the gh binary after extraction." >&2
    return
  fi

  install -m 0755 "$binary_path" "${BIN_DIR}/gh"
}

install_codex() {
  if command -v codex >/dev/null 2>&1; then
    return
  fi

  local os arch metadata asset_url archive_path extract_dir binary_path
  os="$(detect_os)"
  arch="$(detect_arch)"
  metadata="$(release_metadata "openai/codex")"

  case "${os}/${arch}" in
    darwin/arm64)
      asset_url="$(release_url_for_pattern "$metadata" "codex-aarch64-apple-darwin\\.tar\\.gz$")"
      ;;
    darwin/amd64)
      asset_url="$(release_url_for_pattern "$metadata" "codex-x86_64-apple-darwin\\.tar\\.gz$")"
      ;;
    linux/amd64)
      asset_url="$(release_url_for_pattern "$metadata" "codex-x86_64-unknown-linux-musl\\.tar\\.gz$")"
      ;;
    linux/arm64)
      asset_url="$(release_url_for_pattern "$metadata" "codex-aarch64-unknown-linux-musl\\.tar\\.gz$")"
      ;;
  esac

  if [[ -z "$asset_url" ]]; then
    echo "Could not locate a Codex release asset for ${os}/${arch}." >&2
    return
  fi

  archive_path="${TEMP_DIR}/codex.tar.gz"
  extract_dir="${TEMP_DIR}/codex"

  echo "Installing Codex CLI..."
  curl -fsSL "$asset_url" -o "$archive_path"
  mkdir -p "$extract_dir"
  tar -xzf "$archive_path" -C "$extract_dir"

  binary_path="$(find "$extract_dir" -type f -name 'codex*' | head -n1)"
  if [[ -z "$binary_path" ]]; then
    echo "Failed to locate the codex binary after extraction." >&2
    return
  fi

  install -m 0755 "$binary_path" "${BIN_DIR}/codex"
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
  BIN_DIR="$(pick_bin_dir)"
  mkdir -p "$BIN_DIR"
  export PATH="${BIN_DIR}:$PATH"

  local ref
  ref="$(resolve_ref)"
  TEMP_DIR="$(mktemp -d)"

  local archive_path="${TEMP_DIR}/discofork.tar.gz"
  echo "Downloading Discofork (${ref})..."
  download_archive "$ref" "$archive_path"

  tar -xzf "$archive_path" -C "$TEMP_DIR"
  local extracted_dir
  extracted_dir="$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n1)"

  if [[ -z "$extracted_dir" ]]; then
    echo "Failed to unpack Discofork archive." >&2
    exit 1
  fi

  mkdir -p "$(dirname "$INSTALL_ROOT")"
  rm -rf "$INSTALL_ROOT"
  mv "$extracted_dir" "$INSTALL_ROOT"

  echo "Installing runtime dependencies with Bun..."
  (cd "$INSTALL_ROOT" && bun install --production --frozen-lockfile)

  local launcher_path="${BIN_DIR}/discofork"
  write_launcher "$launcher_path"
  install_gh
  install_codex

  echo
  echo "Discofork installed to ${INSTALL_ROOT}"
  echo "Launcher created at ${launcher_path}"

  if [[ ":$ORIGINAL_PATH:" != *":${BIN_DIR}:"* ]]; then
    echo "Add ${BIN_DIR} to your PATH to run 'discofork' directly."
    echo "For this shell:"
    echo "  export PATH=\"${BIN_DIR}:\$PATH\""
  fi

  warn_missing_runtime_tools
  echo
  echo "Running Discofork doctor..."
  if ! "$launcher_path" doctor; then
    echo
    echo "Doctor reported issues. Review the output above before running analysis."
  fi
  echo
  echo "Try:"
  if [[ ":$ORIGINAL_PATH:" != *":${BIN_DIR}:"* ]]; then
    echo "  export PATH=\"${BIN_DIR}:\$PATH\""
  fi
  if command -v codex >/dev/null 2>&1; then
    echo "  codex --login"
  fi
  if command -v gh >/dev/null 2>&1; then
    echo "  gh auth login"
  fi
  echo "  discofork --help"
}

main

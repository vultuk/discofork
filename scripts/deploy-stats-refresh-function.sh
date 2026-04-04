#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${DISCOFORK_RAILWAY_PROJECT_ID:-af1e4fee-9b6f-427d-9608-ad59a63b42fc}"
ENVIRONMENT_NAME="${DISCOFORK_RAILWAY_ENVIRONMENT:-production}"
FUNCTION_NAME="${DISCOFORK_STATS_REFRESH_FUNCTION_NAME:-Update Cached Stats}"
FUNCTION_ENTRYPOINT="stats-refresh-function/index.ts"
BUNDLE_DIR=".discofork/railway-functions"
BUNDLE_PATH="$BUNDLE_DIR/update-cached-stats.mjs"

mkdir -p "$BUNDLE_DIR"

npx bun install --frozen-lockfile
npx bun build "$FUNCTION_ENTRYPOINT" --outfile "$BUNDLE_PATH" --target bun

echo "Deploying $FUNCTION_NAME to Railway project $PROJECT_ID environment $ENVIRONMENT_NAME from $BUNDLE_PATH"
railway link -p "$PROJECT_ID" -e "$ENVIRONMENT_NAME"
railway functions link -f "$FUNCTION_NAME" -p "$BUNDLE_PATH"
railway functions push -p "$BUNDLE_PATH"

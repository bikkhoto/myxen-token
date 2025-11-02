#!/usr/bin/env bash
set -euo pipefail

# Minimal wrapper that loads .env and calls the release script.
# Useful for cron/systemd on your own server. Assumes repo root as CWD.

if [ -f .env ]; then
  set -o allexport
  # shellcheck disable=SC1091
  source .env
  set +o allexport
fi

# Optional guard to only run at/after RELEASE_AT_ISO
if [ -n "${RELEASE_AT_ISO:-}" ]; then
  target=$(date -u -d "$RELEASE_AT_ISO" +%s)
  now=$(date -u +%s)
  if [ "$now" -lt "$target" ]; then
    echo "Too early: now=$now target=$target ($RELEASE_AT_ISO)"
    exit 0
  fi
fi

npm run timelock:release

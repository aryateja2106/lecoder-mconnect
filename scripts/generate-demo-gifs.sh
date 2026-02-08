#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v vhs >/dev/null 2>&1; then
  echo "[demo] vhs is required. Install with: brew install vhs" >&2
  exit 1
fi

if ! command -v ttyd >/dev/null 2>&1; then
  echo "[demo] ttyd is required by vhs. Install with: brew install ttyd" >&2
  exit 1
fi

mkdir -p demos/gifs

vhs demos/mconnect-start.tape
vhs demos/mconnect-agents.tape
vhs demos/mconnect-opik.tape

echo "[demo] GIFs generated in $ROOT_DIR/demos/gifs"

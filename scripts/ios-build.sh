#!/usr/bin/env bash
# scripts/ios-build.sh — build the MConnect iOS app on the simulator.
#
# Usage:
#   chmod +x scripts/ios-build.sh
#   ./scripts/ios-build.sh                # build + boot simulator + install + launch
#   ./scripts/ios-build.sh --build-only   # just compile, don't launch
#   ./scripts/ios-build.sh --device "iPhone 16 Pro"   # pick a different simulator
#
# Why a separate script: the assistant runs in a Linux sandbox and can't call
# xcodebuild. Run this on your Mac.

set -euo pipefail

DEVICE="iPhone 16 Pro"
BUILD_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --device) DEVICE="$2"; shift 2 ;;
    --build-only) BUILD_ONLY=1; shift ;;
    -h|--help) sed -n 's/^# \{0,1\}//p' "$0" | head -20; exit 0 ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/packages/ios-app"
PROJECT="$PROJECT_DIR/MConnect.xcodeproj"
SCHEME="MConnect"
DESTINATION="platform=iOS Simulator,name=$DEVICE"
DERIVED_DATA="$PROJECT_DIR/build"
APP_PATH="$DERIVED_DATA/Build/Products/Debug-iphonesimulator/MConnect.app"
BUNDLE_ID="com.lecoder.mconnect"

echo "==> Project: $PROJECT"
echo "==> Scheme:  $SCHEME"
echo "==> Device:  $DEVICE"

# Refuse to run inside the AI sandbox.
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script must run on macOS (xcodebuild required). uname=$(uname -s)" >&2
  exit 1
fi

# ── Build ────────────────────────────────────────────────────────────────────
echo ""
echo "==> xcodebuild build"
xcodebuild \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -destination "$DESTINATION" \
  -configuration Debug \
  -derivedDataPath "$DERIVED_DATA" \
  -quiet \
  CODE_SIGNING_ALLOWED=NO \
  build | tee /tmp/mconnect-build.log

if [[ $BUILD_ONLY -eq 1 ]]; then
  echo "==> --build-only, stopping here. App at: $APP_PATH"
  exit 0
fi

# ── Boot simulator ──────────────────────────────────────────────────────────
echo ""
echo "==> Boot simulator: $DEVICE"
SIM_UDID="$(xcrun simctl list devices available -j | jq -r --arg n "$DEVICE" '
  .devices | to_entries[] | .value[] | select(.name == $n) | .udid' | head -n1)"
if [[ -z "$SIM_UDID" || "$SIM_UDID" == "null" ]]; then
  echo "Simulator '$DEVICE' not found. Pick one from:" >&2
  xcrun simctl list devices available | grep -E "iPhone" >&2
  exit 1
fi

xcrun simctl boot "$SIM_UDID" 2>/dev/null || true
open -a Simulator

# ── Install + launch ─────────────────────────────────────────────────────────
echo ""
echo "==> Install $APP_PATH"
xcrun simctl install "$SIM_UDID" "$APP_PATH"

echo ""
echo "==> Launch $BUNDLE_ID"
xcrun simctl launch --console-pty "$SIM_UDID" "$BUNDLE_ID" || {
  echo ""
  echo "If the launch failed, check the bundle id (xcrun simctl listapps $SIM_UDID)."
}

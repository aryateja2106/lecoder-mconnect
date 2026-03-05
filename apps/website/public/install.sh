#!/usr/bin/env bash
# LeCoder MConnect — Universal Installer
# curl -fsSL lecoder.lesearch.ai/install.sh | bash
set -euo pipefail

PREFIX="\033[1;36m[mconnect]\033[0m"
ERR="\033[1;31m[mconnect]\033[0m"
OK="\033[1;32m[mconnect]\033[0m"

info()  { echo -e "$PREFIX $*"; }
err()   { echo -e "$ERR $*" >&2; }
ok()    { echo -e "$OK $*"; }

# --- OS Detection ---
OS="$(uname -s)"
case "$OS" in
  Darwin)  PLATFORM="macOS" ;;
  Linux)
    if grep -qi microsoft /proc/version 2>/dev/null; then
      PLATFORM="WSL"
    else
      PLATFORM="Linux"
    fi
    ;;
  MINGW*|MSYS*|CYGWIN*)
    err "Native Windows is not supported."
    err "Please use WSL: https://learn.microsoft.com/en-us/windows/wsl/install"
    exit 1
    ;;
  *)
    err "Unsupported OS: $OS"
    exit 1
    ;;
esac

info "Detected platform: $PLATFORM"

# --- Node.js Check ---
if ! command -v node &>/dev/null; then
  err "Node.js is not installed."
  case "$PLATFORM" in
    macOS) err "Install via Homebrew:  brew install node" ;;
    *)     err "Install via nvm:  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash" ;;
  esac
  exit 1
fi

NODE_VERSION="$(node -v | sed 's/^v//' | cut -d. -f1)"
if [ "$NODE_VERSION" -lt 20 ]; then
  err "Node.js >= 20 required (found v$(node -v | sed 's/^v//'))"
  case "$PLATFORM" in
    macOS) err "Upgrade:  brew upgrade node" ;;
    *)     err "Upgrade:  nvm install 20 && nvm use 20" ;;
  esac
  exit 1
fi

ok "Node.js v$(node -v | sed 's/^v//') ✓"

# --- cloudflared Check (optional) ---
if command -v cloudflared &>/dev/null; then
  ok "cloudflared ✓ (remote tunnels available)"
else
  info "cloudflared not found — local connections only."
  info "For remote access, install cloudflared:"
  case "$PLATFORM" in
    macOS) info "  brew install cloudflared" ;;
    *)     info "  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" ;;
  esac
fi

# --- Launch ---
info "Starting LeCoder MConnect..."
exec npx -y lecoder-mconnect "$@"

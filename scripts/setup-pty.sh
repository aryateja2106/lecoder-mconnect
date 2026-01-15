#!/bin/bash
# MConnect v0.1.2 - PTY Setup Script
# This script checks and installs dependencies needed for node-pty

set -e

echo "========================================"
echo "  MConnect PTY Setup"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
fi

echo "Detected OS: $OS"
echo ""

# Check Node.js
echo "Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node.js installed: $NODE_VERSION${NC}"
else
    echo -e "${RED}✗ Node.js not found${NC}"
    echo "  Install from: https://nodejs.org/"
    exit 1
fi

# Check npm
echo "Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✓ npm installed: $NPM_VERSION${NC}"
else
    echo -e "${RED}✗ npm not found${NC}"
    exit 1
fi

# Check Python (required for node-gyp)
echo "Checking Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✓ Python installed: $PYTHON_VERSION${NC}"
else
    echo -e "${RED}✗ Python 3 not found${NC}"
    if [[ "$OS" == "macos" ]]; then
        echo "  Install with: brew install python3"
    else
        echo "  Install with: sudo apt install python3"
    fi
    exit 1
fi

# Check C++ compiler
echo "Checking C++ compiler..."
if [[ "$OS" == "macos" ]]; then
    if xcode-select -p &> /dev/null; then
        echo -e "${GREEN}✓ Xcode Command Line Tools installed${NC}"
    else
        echo -e "${YELLOW}! Xcode Command Line Tools not found${NC}"
        echo "  Installing..."
        xcode-select --install
        echo "  Please re-run this script after installation completes."
        exit 1
    fi
elif [[ "$OS" == "linux" ]]; then
    if command -v g++ &> /dev/null; then
        GCC_VERSION=$(g++ --version | head -n1)
        echo -e "${GREEN}✓ g++ installed: $GCC_VERSION${NC}"
    else
        echo -e "${RED}✗ g++ not found${NC}"
        echo "  Install with: sudo apt install build-essential"
        exit 1
    fi
fi

# Check tmux
echo "Checking tmux..."
if command -v tmux &> /dev/null; then
    TMUX_VERSION=$(tmux -V)
    echo -e "${GREEN}✓ tmux installed: $TMUX_VERSION${NC}"
else
    echo -e "${YELLOW}! tmux not found${NC}"
    if [[ "$OS" == "macos" ]]; then
        echo "  Installing with Homebrew..."
        brew install tmux
    else
        echo "  Install with: sudo apt install tmux"
        exit 1
    fi
fi

# Check cloudflared (optional)
echo "Checking cloudflared..."
if command -v cloudflared &> /dev/null; then
    CF_VERSION=$(cloudflared --version 2>&1 | head -n1)
    echo -e "${GREEN}✓ cloudflared installed: $CF_VERSION${NC}"
else
    echo -e "${YELLOW}! cloudflared not found (optional - for remote access)${NC}"
    if [[ "$OS" == "macos" ]]; then
        echo "  Install with: brew install cloudflared"
    else
        echo "  See: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
    fi
fi

echo ""
echo "========================================"
echo "  Installing node-pty"
echo "========================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

cd "$ROOT_DIR"
echo "Installing and rebuilding node-pty..."

# Install from root to handle workspace hoisting properly
npm install

# Rebuild node-pty native module for current Node.js version
echo "Rebuilding native modules..."
npm rebuild node-pty

# Fix spawn-helper permissions on macOS (critical for PTY to work)
if [[ "$OS" == "macos" ]]; then
    echo "Fixing spawn-helper permissions..."
    find "$ROOT_DIR/node_modules/node-pty/prebuilds" -name "spawn-helper" -exec chmod +x {} \; 2>/dev/null || true
    echo -e "${GREEN}✓ spawn-helper permissions fixed${NC}"
fi

echo ""
echo -e "${GREEN}✓ node-pty installed and rebuilt successfully!${NC}"

echo ""
echo "========================================"
echo "  Building v2 CLI"
echo "========================================"
echo ""

# Build v2
cd "$SCRIPT_DIR/.."
npm run build:v2

echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. npm run cli:v2 doctor   # Verify all dependencies"
echo "  2. npm run cli:v2          # Start MConnect v0.1.2"
echo ""
echo "For help: npm run cli:v2 --help"
echo ""

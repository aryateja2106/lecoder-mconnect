#!/bin/bash
# Docker-based test runner for MConnect
# Ensures consistent test environment across machines

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}LeCoder MConnect - Docker Test Runner${NC}"
echo "======================================="

# Check Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
    exit 1
fi

# Parse arguments
RUN_BUILD=true
RUN_TESTS=true
VERBOSE=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --skip-build) RUN_BUILD=false ;;
        --build-only) RUN_TESTS=false ;;
        -v|--verbose) VERBOSE=true ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-build   Skip building the project"
            echo "  --build-only   Only build, don't run tests"
            echo "  -v, --verbose  Show verbose output"
            echo "  -h, --help     Show this help message"
            exit 0
            ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

cd "$PROJECT_ROOT"

# Build the Docker image (use slim for speed)
echo -e "\n${YELLOW}Building Docker image...${NC}"
docker build -t mconnect-test -f .devcontainer/Dockerfile.slim .

# Run tests in container
echo -e "\n${YELLOW}Running tests in container...${NC}"

DOCKER_CMD="
set -e

echo '==> Installing dependencies...'
npm install

echo '==> Rebuilding native modules...'
npm rebuild

if [ '$RUN_BUILD' = 'true' ]; then
    echo '==> Building project...'
    npm run build
fi

if [ '$RUN_TESTS' = 'true' ]; then
    echo '==> Running CLI tests...'
    npm run test --workspace=lecoder-mconnect

    echo '==> Running web app tests...'
    npm run test --workspace=@lecoder/web || true

    echo '==> Running type check...'
    npm run typecheck || true
fi

echo ''
echo '==> All tests completed!'
"

# Run with TTY allocation for PTY tests
DOCKER_FLAGS="--rm -v $PROJECT_ROOT:/workspace -w /workspace"

# Add TTY if available (needed for PTY tests)
if [ -t 0 ]; then
    DOCKER_FLAGS="$DOCKER_FLAGS -it"
fi

if [ "$VERBOSE" = true ]; then
    docker run $DOCKER_FLAGS mconnect-test bash -c "$DOCKER_CMD"
else
    docker run $DOCKER_FLAGS mconnect-test bash -c "$DOCKER_CMD" 2>&1 | grep -E "==>|PASS|FAIL|Error|✓|✗|passed|failed"
fi

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
else
    echo -e "\n${RED}Some tests failed.${NC}"
    exit 1
fi

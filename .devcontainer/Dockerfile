# LeCoder MConnect Development Container
# Includes all dependencies for building and testing

FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build essentials for native modules (node-pty, better-sqlite3)
    build-essential \
    g++ \
    make \
    python3 \
    python3-pip \
    # PTY support
    tmux \
    screen \
    # Cloudflare tunnel
    curl \
    wget \
    ca-certificates \
    gnupg \
    # Terminal utilities
    ncurses-dev \
    libncurses5-dev \
    # SQLite for better-sqlite3
    libsqlite3-dev \
    # Debugging tools
    gdb \
    strace \
    && rm -rf /var/lib/apt/lists/*

# Install cloudflared
RUN curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg \
    && echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared jammy main' | tee /etc/apt/sources.list.d/cloudflared.list \
    && apt-get update \
    && apt-get install -y cloudflared \
    && rm -rf /var/lib/apt/lists/*

# Set up Node.js (version will be managed by devcontainer feature)
# Create a symlink for python (needed by node-gyp)
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Set the default shell to zsh for better terminal experience
ENV SHELL=/bin/zsh

# Create workspace directory
WORKDIR /workspace

# Copy package files for dependency caching
COPY package*.json ./
COPY packages/cli/package*.json ./packages/cli/
COPY apps/web/package*.json ./apps/web/

# Environment for development
ENV NODE_ENV=development
ENV PATH="/workspace/node_modules/.bin:${PATH}"

# Healthcheck for testing
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node --version || exit 1

# Default command
CMD ["sleep", "infinity"]

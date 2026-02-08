# Code on Incus (COI) - Future Agent Isolation Approach

> Discovered Feb 8, 2026. Not for hackathon — promising for MConnect V2.

## Why This Matters

Instead of Docker containers, COI gives each agent its own **full VM** via Colima + Incus.
More control, better isolation, agents get a real Linux environment with networking.

## Quick Start

```bash
# macOS setup
brew install colima
colima start --cpu 4 --memory 8 --disk 50

# Inside Colima VM
colima ssh
sudo apt install -y incus
curl -fsSL -o coi https://github.com/mensfeld/code-on-incus/releases/latest/download/coi-linux-arm64
chmod +x coi && sudo mv coi /usr/local/bin/
cd ~ && git clone https://github.com/mensfeld/code-on-incus.git
cd code-on-incus && coi build

# Launch agent in container
cd /path/to/project
coi shell --network=open
```

## Key Commands

| Command | Purpose |
|---------|---------|
| `colima start --cpu 4 --memory 8 --disk 50` | Start VM |
| `colima ssh` | Enter VM |
| `coi shell --network=open` | Launch agent container |
| `coi shell --resume` | Resume previous session |
| `coi list` | List active containers |
| `coi snapshot create <name>` | Save state |
| `sudo poweroff` | End session (from inside) |

## MConnect V2 Integration Ideas

- Replace Docker container mode with COI containers
- Each agent gets its own VM with full networking
- Better tmux integration (COI already uses tmux)
- Snapshot/restore for agent state persistence
- Mount project directory at `/workspace`

## Reference

- GitHub: https://github.com/mensfeld/code-on-incus
- Architecture: macOS → Colima VM (Linux) → Incus → COI Container → tmux → Agent

# LeCoder cGPU: Run Google Colab GPUs from Your Terminal

*A production-grade CLI for A100 access without leaving your workflow*

---

Google Colab gives you free (and paid) access to powerful GPUs—T4s, V100s, even A100s. But the notebook interface breaks your flow. You're copying code between your editor and browser, losing terminal history, fighting with cell execution order.

LeCoder cGPU fixes this. It's a command-line tool that lets you run code on Colab GPUs directly from your terminal.

## Why We Built This

While working on our [Nested Learning reproduction](https://github.com/aryateja2106/nested-learning), we needed to run experiments on A100 GPUs. We had Colab Pro. But the workflow was painful:

1. Write code locally
2. Copy to Colab notebook
3. Run cells manually
4. Copy results back
5. Repeat

We wanted something simpler:

```bash
lecoder-cgpu run train.py --gpu a100
```

So we built it.

## Installation

```bash
# Install globally from npm
npm install -g lecoder-cgpu

# Verify installation
lecoder-cgpu --version
```

## Authentication

LeCoder cGPU uses OAuth2 to connect to your Google account securely.

```bash
# Authenticate (opens browser for Google OAuth)
lecoder-cgpu auth

# Check auth status
lecoder-cgpu auth status
```

Your credentials are stored locally and encrypted. We never see your Google password.

## Basic Usage

### Run a Python Script

```bash
# Run on default GPU (usually T4)
lecoder-cgpu run train.py

# Request specific GPU
lecoder-cgpu run train.py --gpu a100
lecoder-cgpu run train.py --gpu v100
lecoder-cgpu run train.py --gpu t4
```

### Interactive Session

```bash
# Start interactive Python session on Colab
lecoder-cgpu shell --gpu a100

# You're now in a Python REPL running on an A100
>>> import torch
>>> torch.cuda.get_device_name(0)
'NVIDIA A100-SXM4-40GB'
```

### File Transfer

```bash
# Upload files to Colab session
lecoder-cgpu upload ./data/ /content/data/

# Download results
lecoder-cgpu download /content/results/ ./results/
```

## Real-World Example: Training a Model

Here's how we use cGPU for our machine learning experiments:

### 1. Project Structure

```
my-experiment/
├── train.py
├── model.py
├── data/
│   └── dataset.pt
└── requirements.txt
```

### 2. Training Script

```python
# train.py
import torch
import torch.nn as nn
from model import MyModel

# Check GPU
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Training on: {torch.cuda.get_device_name(0)}")

# Load data
data = torch.load('data/dataset.pt')

# Initialize model
model = MyModel().to(device)
optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)

# Training loop
for epoch in range(100):
    loss = train_epoch(model, data, optimizer)
    print(f"Epoch {epoch}: loss={loss:.4f}")

# Save checkpoint
torch.save(model.state_dict(), 'checkpoint.pt')
print("Training complete!")
```

### 3. Run the Experiment

```bash
# Upload project
lecoder-cgpu upload ./ /content/experiment/

# Install dependencies on Colab
lecoder-cgpu exec "pip install -r /content/experiment/requirements.txt"

# Run training on A100
lecoder-cgpu run /content/experiment/train.py --gpu a100

# Download checkpoint
lecoder-cgpu download /content/experiment/checkpoint.pt ./
```

## Advanced Features

### Multi-Session Support (Colab Pro)

With Colab Pro, you can run multiple sessions in parallel:

```bash
# Start session 1 for training
lecoder-cgpu session create --name train --gpu a100

# Start session 2 for evaluation
lecoder-cgpu session create --name eval --gpu t4

# Run on specific session
lecoder-cgpu run train.py --session train
lecoder-cgpu run eval.py --session eval

# List active sessions
lecoder-cgpu session list
```

### Execution History

```bash
# View recent executions
lecoder-cgpu history

# Get details of specific run
lecoder-cgpu history show <run-id>

# Rerun a previous command
lecoder-cgpu history rerun <run-id>
```

### JSON Output for AI Integration

```bash
# Machine-readable output for piping to other tools
lecoder-cgpu run train.py --output json

# Perfect for AI agent integration
lecoder-cgpu status --output json | jq '.gpu_type'
```

## Comparison with Alternatives

| Feature | LeCoder cGPU | SSH to Cloud VM | Colab Notebooks |
|---------|--------------|-----------------|-----------------|
| GPU Access | ✅ A100/V100/T4 | ✅ Varies | ✅ A100/V100/T4 |
| Terminal-native | ✅ Yes | ✅ Yes | ❌ Browser only |
| Cost | 💰 $10-50/mo | 💰💰 $100+/mo | 💰 $10-50/mo |
| Setup time | ⚡ 1 minute | 🕐 30+ minutes | ⚡ 1 minute |
| File sync | ✅ Built-in | 🔧 Manual | 🔧 Manual |
| Multi-session | ✅ With Pro | ✅ Yes | ✅ With Pro |

## Troubleshooting

### "GPU not available"

Colab assigns GPUs based on availability. If A100 isn't available:

```bash
# Try a different GPU tier
lecoder-cgpu run train.py --gpu v100

# Or wait and retry
lecoder-cgpu run train.py --gpu a100 --retry 3
```

### "Session disconnected"

Colab has idle timeouts. Keep your session alive:

```bash
# Run with keepalive
lecoder-cgpu run train.py --keepalive

# Or use screen/tmux on the Colab side
lecoder-cgpu exec "screen -dmS training python train.py"
```

### Authentication Issues

```bash
# Clear and re-authenticate
lecoder-cgpu auth logout
lecoder-cgpu auth
```

## Use with LeCoder MConnect

Combine cGPU with MConnect for the ultimate mobile workflow:

```bash
# On your server/Pi
npx lecoder-mconnect --preset custom --agents '[
  {"type":"shell","name":"cGPU"}
]'

# From your phone, run GPU experiments
lecoder-cgpu run experiment.py --gpu a100
```

Train models on A100s while you're on the bus.

---

## Get Started

```bash
npm install -g lecoder-cgpu
lecoder-cgpu auth
lecoder-cgpu run hello.py --gpu t4
```

That's it. GPU computing from your terminal.

---

## Links

- **GitHub**: [github.com/aryateja2106/LeCoder-cgpu-CLI](https://github.com/aryateja2106/LeCoder-cgpu-CLI)
- **npm**: `npm install -g lecoder-cgpu`
- **Issues**: [Report bugs](https://github.com/aryateja2106/LeCoder-cgpu-CLI/issues)

---

*Part of LeSearch AI's open-source tooling for AI researchers and developers.*

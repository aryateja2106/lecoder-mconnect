# Building Apps from a Raspberry Pi with AI Agents

*How I use a $80 computer, my iPad, and AI coding assistants to build real software*

---

I've always been fascinated by the idea of building software from anywhere. Not from a powerful MacBook Pro, but from a tiny computer tucked away in a corner, controlled from whatever device I have in my hand.

That dream became reality with LeCoder MConnect.

## The Setup

Here's what I'm working with:

- **Raspberry Pi 5** (8GB RAM, 128GB storage) - running 24/7
- **iPhone** for quick monitoring
- **iPad** for actual development sessions
- **Claude Code** and **Gemini CLI** subscriptions

The Pi sits quietly on my desk, always on, always ready. I can be anywhere—on the couch, at a café, in bed—and spin up an AI coding agent to build something.

## The First Real Test

I wanted to prove this wasn't just a toy setup. So I gave myself a challenge: build two separate applications simultaneously, from my iPad, running on the Raspberry Pi.

The applications:
1. A lightweight **Markdown viewer** - for quickly reading documentation
2. A **Markdown editor** - for writing and previewing in real-time

Both needed to be web apps I could serve from the Pi and access from any device.

### Starting MConnect

From my iPad, I SSH'd into the Pi and ran:

```bash
npx lecoder-mconnect --preset custom --agents '[
  {"type":"claude","name":"Viewer"},
  {"type":"gemini","name":"Editor"}
]'
```

Within seconds, MConnect displayed a QR code. I scanned it with my iPad camera, and suddenly I had two terminal panes—one running Claude Code, one running Gemini CLI.

### The Workflow

In the Claude terminal, I typed:

```
Create a minimal markdown viewer web app.
React, single file, port 3001.
Just read .md files from a directory and render them.
```

Claude got to work. I watched the terminal scroll on my iPad as it:
- Created the React app
- Set up the file reading logic
- Added syntax highlighting
- Started the dev server

Meanwhile, in the Gemini terminal:

```
Build a markdown editor with live preview.
React, single file, port 3002.
Split view: edit on left, preview on right.
```

Both agents worked in parallel. Within 15 minutes, I had two working applications.

### Accessing the Apps

Here's where it gets interesting. Since MConnect creates Cloudflare tunnels, I could access both apps from my iPad browser—not through the Pi's local IP, but through secure public URLs.

I shared the viewer URL with a friend to test. They could see it too. A real application, built by AI agents, running on a Raspberry Pi, accessible to anyone.

## What This Proved

This experiment validated something I'd been thinking about for years:

**The hardware doesn't matter anymore.** A $80 computer with the right tools can be a development machine.

**Location doesn't matter.** I built these apps from my couch, but I could've been on a plane.

**The AI does the heavy lifting.** I described what I wanted in plain English. The agents wrote the code.

## The Limitations (And What's Next)

Not everything was smooth. The Pi's ARM architecture meant some npm packages didn't work. Build times were slower than on a MacBook. And when I tried running Mistral's Devstral 2 locally—a powerful open model that could've replaced my Claude subscription—the Pi couldn't handle it.

But these limitations point to exciting possibilities:

- **Container isolation**: Run each agent in Docker with resource limits
- **Git worktrees**: Each agent gets its own branch, no conflicts
- **Local AI support**: Ollama integration for air-gapped development
- **Real-time collaboration**: Share sessions with teammates

We're building all of this into MConnect.

## Try It Yourself

You don't need a Raspberry Pi. MConnect runs anywhere Node.js runs.

```bash
# Install cloudflared for remote access
brew install cloudflared

# Run MConnect
npx lecoder-mconnect

# Scan the QR code with your phone
```

Start with a simple experiment. Run Claude Code on your laptop, go to another room with your phone, and try to build something. Feel what it's like to have AI agents working for you while you're away from your desk.

That's the future we're building at LeCoder.

---

## About LeCoder

LeCoder MConnect is part of LeSearch AI's open-source initiative. We're building tools for AI agent productivity, research reproduction, and developer workflows.

- **GitHub**: [github.com/aryateja2106/lecoder-mconnect](https://github.com/aryateja2106/lecoder-mconnect)
- **npm**: `npx lecoder-mconnect`
- **Twitter**: [@r_aryateja](https://twitter.com/r_aryateja)

---

*Published by LeSearch AI · MIT License*

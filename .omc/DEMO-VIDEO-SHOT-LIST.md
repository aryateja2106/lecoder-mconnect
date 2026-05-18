# MConnect — YC Demo Video Shot List

Target: 60-90 sec. No narration. Captions only. iPhone screen-record + Mac screen-record, side-by-side via Final Cut / iMovie / Descript.

## Pre-record checklist

- [ ] iPhone in Do Not Disturb
- [ ] Mac on the dock with Mac mini visible (or wired Mac)
- [ ] Cloudflare tunnel up (`mconnect start --tunnel`)
- [ ] Real Claude Code session ready to fire (a meaningful refactor, not a hello-world)
- [ ] Mac Screen Sharing on (System Settings → General → Sharing → Screen Sharing ON), VNC password set
- [ ] iOS app built with both new tabs
- [ ] Brand colors: monochrome only — black/white/grays. JetBrains Mono if any text.

## Scene-by-scene (target durations)

### 0:00–0:03 — Cold open
- Black frame
- Caption: **"Your AI agent runs for 6 hours. You're not at your desk."**
- Cut.

### 0:03–0:08 — The hook
- Mac screen: Claude Code mid-task, output flying
- iPhone in hand, screen blank
- Caption: **"You can't see it. You can't approve it. You can't kill it."**

### 0:08–0:15 — Pair
- Mac: `mconnect start` in terminal → QR code appears
- iPhone: open MConnect → Hosts tab → Scan QR → "Paired"
- Caption: **"30 seconds to pair. Cloudflare tunnel. No cloud account."**

### 0:15–0:25 — Live agent control
- iPhone: Agents tab → tap active Claude Code session
- Live PTY stream visible (this is where SwiftTerm shines — clean monospace, syntax-friendly colors)
- Type a command via mobile keyboard ("git status\n")
- Mac: same command appears in terminal
- Caption: **"Real terminal. Not a dashboard."**

### 0:25–0:38 — The approval flow (the YC moment)
- Mac: agent reaches `npm publish` step
- iPhone push notification fires: "Approval required: npm publish lecoder-mconnect@0.1.8"
- Tap notification → MConnect opens → ApprovalBanner showing the exact command
- Tap "Approve"
- Mac: command runs
- Caption: **"Dangerous commands stop until you approve."**

### 0:38–0:48 — Trust layer (lockshell)
- Mac: agent tries to read `OPENAI_API_KEY` env var
- Caption: **"Agents can't read raw secrets."**
- iPhone: Vault tab → audit log shows the request was templated, key was injected via lockshell, redacted from agent's view
- Caption: **"Lockshell brokered it. Audit-passed."**

### 0:48–0:58 — Screen tab (the power move)
- iPhone: Screen tab → connect to Mac mini (host: `192.168.x.x`, password from Keychain)
- Live Mac desktop appears on phone, full color, smooth
- Tap to interact
- Caption: **"Need to see what the agent sees? Built-in VNC. Apple Remote Desktop ready."**

### 0:58–1:05 — Close
- iPhone home screen → MConnect icon
- Caption stack:
  - **"Native iOS. Local-first."**
  - **"4 OSS projects. One thesis."**
  - **"MConnect. TestFlight live."**
- End card: GitHub stars + TestFlight link

## Capture commands

### iOS screen record
```bash
# Connect iPhone via cable. Open QuickTime Player.
# File → New Movie Recording → camera dropdown → select iPhone → record.
```

### Mac screen record
```bash
# Cmd-Shift-5 → Record entire screen → set 5s timer
# OR: bun --bun scripts/screen-record-clean.ts (if we have it)
```

### Combine
- Drop both .mov into Final Cut / iMovie / Descript / DaVinci
- Side-by-side on landscape OR vertical iPhone with Mac picture-in-picture
- Burn captions in (no audio narration)

## Versions to ship

1. **60s vertical 9:16** — for Twitter/X, Threads, LinkedIn, YC submission video field
2. **90s landscape 16:9** — for Loom-style longer pitch, YouTube, founder updates

## Don't

- No music until the very end (and only if subtle — silence is stronger)
- No talking head — product speaks for itself
- No screen captures of the YC application form — too inside-baseball
- No swearing or jokes — YC reviewers see thousands of these; clarity wins
- No "intro slide" with logo — show the product working in the first 3 seconds

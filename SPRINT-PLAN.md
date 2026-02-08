# MConnect Hackathon Final Sprint Plan

## Deadline: Mon Feb 9, 2026 @ 5:59 AM CST (11:59 AM UTC)
## Current Time: Sun Feb 8, 2026 ~12:37 AM CST
## Time Remaining: ~29 hours

---

## STATUS SUMMARY

### ✅ DONE
- All 3 PRs merged (#7, #8, #9) - main is clean
- TypeScript compiles with zero errors
- npm package `lecoder-mconnect` v0.1.7 published
- Opik integration complete (both tracers: opik/ + observability/)
- 4 custom LLM-as-judge metrics implemented
- Mobile PWA working (confirmed with screenshots)
- Cloudflare tunnel working
- WebSocket connection established
- Submission materials drafted (HACKATHON.md, HACKATHON-SUBMISSION.md, README.md)
- Blog posts exist on website (4 posts)
- Linear project organized with milestones

### ⚠️ IN PROGRESS
- ARY-128: Demo Video (source exists in apps/video but no source code, only build)
- ARY-130: QA & Bug Fixes
- ARY-131: Hackathon Submission
- ARY-141: Master Checklist
- ARY-145: Logo (use LeSearch logo)

### ❌ NEEDS WORK
- Docker container failing ("Shell not found: docker")
- Demo video not rendered (Remotion source missing, only build output)
- Documentation page not created (like AutoForge)
- Live demo needs verification (lecoder.lesearch.ai)
- Final submission form not filled out on encodeclub.com

---

## PRIORITIZED TASK BLOCKS

### BLOCK 1: Critical Bug Fix (1 hour) — Arya Teja / Claude Code
**Priority: URGENT - Affects demo reliability**

#### 1.1 Fix Docker Container Issue
The error "Failed to start Container: Shell not found: docker" is a PATH issue.

**Root Cause**: `findDockerPath()` in `packages/cli/src/container/container-manager.ts` can't find docker binary. The PTY manager's `validateShell()` rejects the relative `docker` command when `which docker` fails in the PTY environment.

**Fix Options (choose one)**:
```bash
# Option A: Quick - ensure docker is in PATH before running mconnect
export PATH="/usr/local/bin:/usr/bin:/opt/homebrew/bin:$PATH"
which docker  # verify

# Option B: Code fix - skip PTY shell validation for docker commands
# In packages/cli/src/pty/pty-manager.ts validateShell()
# Add special case for container runtime commands

# Option C: Use --no-container flag when starting agents
npx lecoder-mconnect start --no-container
```

**Recommended**: Option A for now (quick), Option B as a code fix to push.

---

### BLOCK 2: Demo Video (3-4 hours) — Arya Teja / Claude Code + Codex
**Priority: URGENT - Required for submission**

#### 2.1 Video Strategy Decision
The apps/video/ Remotion project has a compiled build (bundle.js) but NO source code. Options:

**Option A: Screen Recording (RECOMMENDED - Fastest)**
- Record actual MConnect session on laptop + phone
- Use OBS or QuickTime to capture:
  1. Terminal: `npx lecoder-mconnect start`
  2. QR code appears → scan with phone
  3. Phone shows terminal, run commands
  4. Show Opik dashboard traces
- Edit with iMovie or similar
- 3-5 minutes, actual footage is most impressive for judges

**Option B: Recreate Remotion Source (2-3 hours)**
- Reconstruct source from the build bundle
- The 15-second promo was: Intro → Problem → Solution → Features → Demo → CTA
- Good for social media but too short for hackathon

**Option C: Hybrid**
- Screen recording for main demo (3 min)
- Remotion animated intro/outro (15s each)

#### 2.2 Demo Script
```
[0:00-0:30] HOOK
"You start an AI coding agent on a complex task.
Walk away for coffee. Come back to find it stuck
waiting for your approval... for the last 45 minutes."

[0:30-1:00] SOLUTION
"MConnect lets you control AI coding agents from
your phone. One command, one QR code, full control."

[1:00-3:00] LIVE DEMO
- Terminal: npx lecoder-mconnect start
- Show pairing code/QR
- Phone: enter code, see terminal
- Run real commands from phone
- Show multi-agent tmux sessions
- Show approval flow

[3:00-4:00] OPIK OBSERVABILITY
- Show Opik dashboard with real traces
- Highlight: session traces, agent spans, command tracking
- Show LLM-as-judge metrics (safety, tool selection, health)

[4:00-4:30] WRAP UP
- "Control AI agents from your phone"
- npx lecoder-mconnect
- GitHub link
```

---

### BLOCK 3: Documentation Page (2-3 hours) — Claude Code / Codex
**Priority: HIGH - Differentiator for judges**

#### 3.1 Create docs.mconnect.dev or use existing website
The `apps/website/` already has a Next.js landing page. Add a docs section.

**Approach**: Create a single-page documentation site similar to AutoForge (autoforge.cc):
- Hero section with install command
- Features with animated demos
- Architecture diagram
- Quick start guide
- API reference
- Opik integration docs

**Files to create/modify**:
- `apps/website/src/app/docs/page.tsx` - Main docs page
- Update `apps/website/src/app/page.tsx` - Add docs link to nav

---

### BLOCK 4: Deployment & Live Demo (1-2 hours) — Arya Teja
**Priority: HIGH - Judges need working link**

#### 4.1 Deploy Website to Vercel
```bash
cd apps/website
vercel --prod
```

#### 4.2 Deploy Web App (PWA) to Vercel
```bash
cd apps/web
vercel --prod --env NEXT_PUBLIC_DEMO_MODE=true
```
This enables demo mode so judges can see the UI without running CLI.

#### 4.3 Verify Domain
- lecoder.lesearch.ai should point to the web app
- Or use Vercel-provided URL

---

### BLOCK 5: Final QA (2 hours) — Arya Teja + Claude Code
**Priority: HIGH - Must work for judges**

#### 5.1 QA Checklist
- [ ] `npx lecoder-mconnect` fresh install on clean terminal
- [ ] Pairing code generation works
- [ ] Mobile connection via tunnel
- [ ] Commands execute from phone
- [ ] Opik traces appear in dashboard
- [ ] Web app demo mode works
- [ ] All links in submission work
- [ ] npm package installs correctly
- [ ] README renders correctly on GitHub

---

### BLOCK 6: Submission (1 hour) — Arya Teja
**Priority: CRITICAL - Must happen before deadline**

#### 6.1 Fill out encodeclub.com form
Use FINAL-SUBMISSION-READY.md content:
- Project Name: LeCoder-MConnect
- One-liner: "Control AI coding agents from your phone"
- Team: Arya Teja (Leader), Sujith Bellam, Arya Creator
- GitHub: https://github.com/aryateja2106/lecoder-mconnect
- npm: https://www.npmjs.com/package/lecoder-mconnect
- Demo: [deployed URL]
- Video: [upload or YouTube link]
- Categories: Best Use of Opik, Productivity, Personal Growth, Social & Community

#### 6.2 Project Image
- Use LeSearch logo (ARY-145)
- Resize to submission requirements

---

### BLOCK 7: Nice-to-Haves (if time permits)

#### 7.1 Competitive Positioning Document
MConnect vs Termius differentiation:
- MConnect: tmux, parallel sessions, AI agent-specific, Opik observability, guardrails
- Termius: SSH, customizable keyboard, themes, secure vaults (but no AI agent features)

#### 7.2 UI Improvements
- Better mobile terminal styling
- Connection status indicators
- Haptic feedback on commands

---

## TIMELINE (CST)

| Time | Block | Who | Duration |
|------|-------|-----|----------|
| Sun 12:30 AM - 1:30 AM | Block 1: Docker Fix | Arya + Claude Code | 1h |
| Sun 1:30 AM - 5:30 AM | Block 2: Demo Video | Arya + Claude Code | 4h |
| Sun 5:30 AM - 8:30 AM | Block 3: Docs Page | Claude Code / Codex | 3h |
| Sun 8:30 AM - 10:30 AM | Block 4: Deploy | Arya | 2h |
| Sun 10:30 AM - 12:30 PM | Block 5: QA | Arya + Claude Code | 2h |
| Sun 12:30 PM - 5:00 PM | Buffer / Polish | Team | 4.5h |
| Sun 5:00 PM - 6:00 PM | Block 6: Submit | Arya | 1h |
| **Mon 5:59 AM** | **DEADLINE** | | |

**Note**: Build in sleep time! Suggested: Sun 2 AM - 8 AM CST.

---

## ZENFLOW TASK DISTRIBUTION

### For Claude Code (via Zenflow)
1. Fix Docker PATH issue in container-manager.ts
2. Create docs page (apps/website/src/app/docs/)
3. Update submission materials
4. Run QA checks on codebase

### For Codex (via Zenflow)
1. Create Remotion video source reconstruction
2. UI polish on mobile PWA
3. Add error boundaries and loading states

### For Arya (Manual)
1. Record screen demo video
2. Deploy to Vercel
3. Verify mobile testing
4. Fill out submission form
5. Upload video

---

## KEY LINKS
- GitHub: https://github.com/aryateja2106/lecoder-mconnect
- npm: https://www.npmjs.com/package/lecoder-mconnect
- Hackathon: https://www.encode.club/commit-to-change
- Opik Dashboard: https://www.comet.com/opik
- Linear Project: https://linear.app/aryateja/project/mconnect-opik-hackathon

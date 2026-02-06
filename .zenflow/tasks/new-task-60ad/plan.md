# MConnect Hackathon Demo Deployment - Implementation Plan

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: 9683c1ae-6a16-4730-83c3-436bf9f2a314 -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: 6f047ed9-8058-425b-bb84-5a20a0219dd8 -->

Create a technical specification based on the PRD in `{@artifacts_path}/requirements.md`.

1. Review existing codebase architecture and identify reusable components
2. Define the implementation approach

Save to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach referencing existing code patterns
- Source code structure changes
- Data model / API / interface changes
- Delivery phases (incremental, testable milestones)
- Verification approach using project lint/test commands

### [x] Step: Planning
<!-- chat-id: 925a3ea0-9ff2-4945-9ffc-f60f806f5f5d -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

✅ **Completed**: Created detailed 10-step implementation plan covering:
- Demo mode infrastructure (data, MockWebSocket, context)
- UI integration and health endpoint
- Vercel deployment configuration
- HACKATHON.md project description
- Opik SDK integration for observability
- Polish and final testing

---

## Implementation Steps

### [ ] Step 1: Create Demo Session Data and Types

Create the demo session data structure and pre-recorded terminal output.

**Files to create:**
- `apps/web/src/data/demo-session.ts` - Demo frame types and pre-recorded session data

**Implementation details:**
1. Define `DemoFrame` interface with timestamp, type, content, and optional metadata
2. Define `DemoSession` interface with id, name, preset, agentType, duration, frames
3. Define `DemoScenario` interface for multi-session demos
4. Create realistic demo data following the script from spec.md:
   - Scene 1 (0-5s): Agent start with mconnect banner
   - Scene 2 (5-30s): Claude Code working - creating files, showing code
   - Scene 3 (30-40s): Approval request for `git push origin main`
   - Scene 4 (40-50s): Approval resolution and git push output
5. Include multi-session data (2-3 mock agents) for session switching demo

**Verification:**
- TypeScript compiles without errors
- Data follows exact interface contracts from spec.md

---

### [ ] Step 2: Implement MockWebSocket Class

Create a mock WebSocket that simulates the real CLI protocol for demo mode.

**Files to create:**
- `apps/web/src/lib/mock-websocket.ts` - MockWebSocket class implementation

**Implementation details:**
1. Implement `MockWebSocket` class matching browser WebSocket interface:
   - Properties: `readyState`, `CONNECTING/OPEN/CLOSING/CLOSED` constants
   - Event handlers: `onopen`, `onclose`, `onmessage`, `onerror`
2. Accept `MockWebSocketOptions` with scenario, playbackSpeed, loop settings
3. Implement `connect()` method that:
   - Sets readyState to OPEN
   - Fires `onopen` event
   - Sends initial `session_info` message matching protocol.ts
   - Starts frame playback timer
4. Implement frame playback:
   - Use `setTimeout` to schedule frames at their timestamps
   - Convert demo frames to protocol messages (`output`, `approval_request`, etc.)
   - Fire `onmessage` with properly formatted MessageEvent
5. Implement `send()` method to handle:
   - `approval_response` - simulate approval flow completion
   - `mode_change` - toggle read-only state
   - `ping` - respond with pong
6. Implement playback controls: `pause()`, `resume()`, `seek(timestamp)`
7. Implement `close()` method to clean up timers

**Verification:**
- MockWebSocket can be instantiated with demo data
- Events fire in correct order (onopen → onmessage sequence)
- Approval flow interaction works

---

### [ ] Step 3: Create Demo Context Provider

Create React context for demo mode state management.

**Files to create:**
- `apps/web/src/context/DemoContext.tsx` - Demo mode provider and hook

**Implementation details:**
1. Create `DemoContextValue` interface matching spec.md:
   - `isDemoMode`, `playbackState`, `currentTimestamp`, `totalDuration`
   - `sessions`, `activeSessionId`
   - Control functions: `play`, `pause`, `restart`, `switchSession`, `respondToApproval`
2. Create `DemoProvider` component:
   - Check `NEXT_PUBLIC_DEMO_MODE` environment variable
   - Import and use demo session data
   - Manage MockWebSocket lifecycle
   - Track playback state
3. Create `useDemoContext` hook for consuming the context
4. Export helper function `isDemoModeEnabled()` for conditional checks

**Verification:**
- Provider correctly detects demo mode from environment
- Context values update during playback
- Session switching works

---

### [ ] Step 4: Integrate Demo Mode into Main Page

Modify the main page to use demo mode when enabled.

**Files to modify:**
- `apps/web/src/app/page.tsx` - Add demo mode integration
- `apps/web/src/app/layout.tsx` - Add demo mode banner

**Implementation details:**

For `page.tsx`:
1. Import `DemoProvider` and `useDemoContext`
2. Wrap content with `DemoProvider`
3. Add conditional logic:
   - If `isDemoMode`, skip WebSocket URL resolution from URL params
   - Use `MockWebSocket` instead of real WebSocket
   - Auto-attach to first demo session
4. Add demo controls overlay (optional):
   - Restart button
   - Progress indicator
5. Skip pairing code entry in demo mode

For `layout.tsx`:
1. Add demo mode banner at top when `NEXT_PUBLIC_DEMO_MODE=true`:
   ```
   🎮 Demo Mode - This is a simulated session
   ```
2. Style banner with yellow/amber background for visibility

**Verification:**
- Run `NEXT_PUBLIC_DEMO_MODE=true npm run dev`
- Terminal shows pre-recorded output
- Approval modal appears at correct time
- Approve/Deny buttons work (simulated)
- No errors in console

---

### [ ] Step 5: Create Health Check API Endpoint

Add health check endpoint for deployment verification.

**Files to create:**
- `apps/web/src/app/api/health/route.ts` - Health check API route

**Implementation details:**
1. Create Next.js API route handler
2. Return JSON response:
   ```json
   {
     "status": "ok",
     "version": "0.1.7",
     "mode": "demo" | "live",
     "timestamp": "ISO-8601"
   }
   ```
3. Detect mode from `NEXT_PUBLIC_DEMO_MODE` environment variable
4. Add appropriate CORS headers

**Verification:**
- `curl http://localhost:3000/api/health` returns valid JSON
- Response includes correct mode value

---

### [ ] Step 6: Configure Vercel Deployment

Create deployment configuration and deploy to Vercel.

**Files to create:**
- `apps/web/vercel.json` - Vercel deployment configuration

**Implementation details:**
1. Create vercel.json with:
   ```json
   {
     "framework": "nextjs",
     "installCommand": "npm install",
     "buildCommand": "npm run build",
     "outputDirectory": ".next"
   }
   ```
2. Configure environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_DEMO_MODE=true`
   - `NEXT_PUBLIC_APP_URL=https://<vercel-url>`
3. Deploy using Vercel CLI or GitHub integration
4. Test deployed URL on multiple devices

**Verification:**
- Build succeeds on Vercel
- `/api/health` returns `{ status: "ok", mode: "demo" }`
- Demo loads on mobile devices
- No console errors

---

### [ ] Step 7: Create HACKATHON.md Project Description

Write the hackathon submission document.

**Files to create:**
- `HACKATHON.md` - Project description for hackathon submission

**Implementation details:**
1. Write structured content (380-420 words total):
   - **Hook (50 words)**: Problem statement about AI agents needing supervision
   - **Solution (100 words)**: MConnect value proposition - mobile control, QR code, real-time monitoring
   - **Opik Integration (100 words)**: Comprehensive tracing, span types, observability benefits
   - **Technical Highlights (100 words)**: Shell-first architecture, WebSocket v2.0, guardrails, input arbitration
   - **Impact (50 words)**: Future of AI-assisted development, untethered control
2. Include links:
   - Demo URL: `https://[vercel-url]`
   - GitHub: `https://github.com/aryateja2106/lecoder-mconnect`
3. Keep language clear, no jargon
4. Emphasize Opik integration prominently for "Best Use of Opik" track

**Verification:**
- Word count within 380-420 range
- All sections present and complete
- Links are valid
- Clearly explains problem → solution → Opik integration

---

### [ ] Step 8: Add Opik Integration to CLI

Integrate Opik SDK for observability tracing.

**Files to create:**
- `packages/cli/src/opik/types.ts` - Opik span type definitions
- `packages/cli/src/opik/index.ts` - OpikTracer class implementation

**Files to modify:**
- `packages/cli/package.json` - Add opik dependency
- `packages/cli/src/session.ts` - Add Opik tracer hooks for session lifecycle
- `packages/cli/src/agents/agent-manager.ts` - Add Opik spans for agent lifecycle
- `packages/cli/src/guardrails.ts` - Add Opik spans for approval tracking

**Implementation details:**

For `types.ts`:
1. Define `OpikConfig` interface with apiKey, project, environment
2. Define span interfaces: `SessionSpan`, `AgentSpan`, `CommandSpan`, `ApprovalSpan`

For `index.ts`:
1. Create `OpikTracer` class:
   - Constructor accepts `OpikConfig`, initializes Opik client
   - `startSession(sessionId, preset, guardrails)` - create root trace
   - `endSession(sessionId)` - close trace
   - `agentSpawn(sessionId, agentId, preset, workDir)` - child span
   - `agentExit(sessionId, agentId, exitCode)` - close agent span
   - `commandExecute(sessionId, agentId, command, source, blocked)` - command span
   - `approvalRequest(sessionId, command, reason)` - approval span
   - `approvalResponse(sessionId, command, approved, responseTime)` - close approval
   - `flush()` - flush pending spans
2. Handle missing API key gracefully (no-op tracer)

For integration:
1. In `session.ts`:
   - Create tracer instance on session start
   - Call `startSession()` after initialization
   - Call `endSession()` in cleanup
2. In `agent-manager.ts`:
   - Call `agentSpawn()` when creating agent
   - Call `agentExit()` when agent exits
3. In `guardrails.ts` (or ws-hub.ts where approvals are handled):
   - Call `approvalRequest()` when approval needed
   - Call `approvalResponse()` when user responds

**Verification:**
- `npm install` succeeds with opik dependency
- CLI starts without errors when OPIK_API_KEY not set (graceful fallback)
- With OPIK_API_KEY set, traces appear in Opik dashboard
- All span types visible with correct attributes

---

### [ ] Step 9: Add "Try Locally" Section and Polish Demo

Add local installation instructions and polish the demo experience.

**Files to modify:**
- `apps/web/src/app/page.tsx` - Add "Try Locally" section in demo mode

**Implementation details:**
1. In demo mode, add a "Try Locally" section below terminal or as expandable panel:
   ```
   ## Try It Yourself

   npm install -g lecoder-mconnect
   mconnect start

   Scan the QR code to connect from your phone.
   ```
2. Add link to documentation/GitHub
3. Polish demo data:
   - Ensure realistic timing
   - Add more Claude Code-like output formatting
   - Include syntax highlighting escape codes
4. Test multi-session switching if time permits

**Verification:**
- "Try Locally" section visible in demo mode
- Commands are copy-able
- Demo feels polished and realistic

---

### [ ] Step 10: Final Testing and Documentation

Perform comprehensive testing and capture screenshots.

**Verification checklist:**

**Desktop Testing:**
- [ ] Demo loads in Chrome
- [ ] Demo loads in Firefox
- [ ] Terminal output streams smoothly
- [ ] Approval modal appears at correct time
- [ ] Approve/Deny buttons work
- [ ] No console errors

**Mobile Testing:**
- [ ] iOS Safari - page loads under 3 seconds
- [ ] iOS Safari - terminal visible and readable
- [ ] iOS Safari - touch controls work
- [ ] Android Chrome - page loads under 3 seconds
- [ ] Android Chrome - terminal visible and readable
- [ ] Android Chrome - touch controls work
- [ ] Portrait mode works
- [ ] Landscape mode works

**Performance:**
- [ ] Initial load < 3 seconds (4G throttle in DevTools)
- [ ] Time to interactive < 5 seconds
- [ ] No layout shift after load

**Final checks:**
- [ ] Demo URL documented
- [ ] HACKATHON.md complete with correct links
- [ ] Opik traces visible (if CLI integration complete)
- [ ] Screenshot of mobile UI captured
- [ ] Screenshot of Opik dashboard captured (if applicable)

---

## Test Commands

```bash
# Run web app in demo mode locally
cd apps/web
NEXT_PUBLIC_DEMO_MODE=true npm run dev

# Type check
npm run typecheck

# Lint
npm run lint

# Build for production
npm run build
```

---

## Success Criteria

| Criteria | Status |
|----------|--------|
| Demo URL accessible | [ ] |
| Mobile responsive (iOS + Android) | [ ] |
| Zero console errors | [ ] |
| Load time < 3 seconds | [ ] |
| Approval flow works | [ ] |
| HACKATHON.md complete (380-420 words) | [ ] |
| Opik traces visible | [ ] |

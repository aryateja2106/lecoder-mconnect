## AMP Prompt: Phase 1 Remaining Work (No Overlap With Cursor)

Use this exact prompt in AMP:

```text
You are working in /Users/aryateja/Projects/lecoder-mconnect on Phase 1 (TestFlight v1).

Important context:
- Cursor has already completed core connect-flow fixes in iOS:
  - Removed hardcoded tunnel auto-connect
  - Added ConnectionState + URL validation/normalization
  - Added terminal WebView error overlay with retry/disconnect
  - Added iPad adaptive layout in connect screen
- Do NOT re-edit ContentView.swift unless strictly needed for push notification wiring.

Your mission:
Complete only the true remaining Phase 1 tasks and keep changes scoped + verifiable.

Remaining Phase 1:
1) App Store Connect metadata
   - Fill in copyright, export compliance, privacy, pricing, and content rights.
   - Use docs/plans/APP_STORE_CHECKLIST.md as the source of truth.

2) Screenshots
   - Capture iPhone 6.5" and iPad 13" screenshots in Xcode simulator.
   - Capture these app states:
     - Connect screen
     - Terminal screen (connected)
     - Connection error state

3) Push notifications
   - Implement connection status notifications in iOS app.
   - Phase 1 scope: local notifications only (permission + local notification firing), no backend APNs service work.

4) TestFlight
   - Prepare submission-ready artifacts and checklist for beta testing submission.

Execution constraints:
- Avoid touching unrelated packages (especially packages/cli unless absolutely required).
- Prefer editing/adding docs under docs/plans and iOS files under lecocer-mconnect-test1.
- Keep changes small, compile-safe, and Phase 1 focused.

How to test:
- Open lecocer-mconnect-test1 in Xcode.
- Run on iPhone 15 Pro Max and iPad Pro 13".
- Start the CLI with bun run dev:cli or mconnect start on your machine.
- Connect from the app via:
  - QR code
  - Pairing code
  - URL (Cloudflare tunnel, Tailscale IP, or local IP)

Validation required before finishing:
- Ensure Swift files have no obvious syntax issues.
- Summarize all changed files and what each change enables.
- Provide a short manual test checklist for notification permission + notification firing paths.
- Explicitly list what still requires manual App Store Connect portal actions.

Deliverable format:
- "Changed files"
- "What was implemented"
- "What remains for TestFlight submission"
- "Manual test steps"
```

## Why this prompt works

- It prevents duplicate work on already-done connect and layout tasks.
- It constrains AMP to pending, high-value Phase 1 deliverables.
- It requests verifiable outcomes and a clear finish report.

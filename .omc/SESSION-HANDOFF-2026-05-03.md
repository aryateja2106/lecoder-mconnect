# MConnect Session Handoff — 2026-05-03

## TL;DR

- Phase 0A1 first slice shipped on `worktree-sequential-jingling-noodle` (commit `2235262`, pushed to origin).
- Ralph loop completed PRD execution → reviewer APPROVE → deslop NO_CHANGES → regression typecheck × 3 packages green → state cleared.
- YC submission today. Demo target = CLI + new web UI. PR-then-merge path chosen for main pushes.
- Security "feature" is a separate CLI tool (not a branch in this repo).

---

## What shipped this session

**Branch:** `worktree-sequential-jingling-noodle`
**Commit:** `2235262 feat(protocol): Phase 0A1 — CLI v3 catch-up + v3.1 capability negotiation scaffolding`
**Remote:** pushed to `origin/worktree-sequential-jingling-noodle`
**PR URL:** https://github.com/aryateja2106/lecoder-mconnect/pull/new/worktree-sequential-jingling-noodle

### Files touched

| File | Change |
|---|---|
| `packages/cli/src/ws/protocol.ts` | `PROTOCOL_VERSION '2.0' → '3.0'` |
| `packages/shared/src/protocol/messages.ts` | Added `clientCapabilities?` on `AuthMessage`, `serverCapabilities?` on `AuthSuccessMessage`, new `LocalPairingAuthMessage` (CLI-only direct-attach auth; doc note says server REJECTS), new `UnsupportedCapabilityMessage` (replaces silent `console.warn` drop), updated `ClientMessage` / `ServerMessage` unions + `isClientMessage` / `isServerMessage` type guards |
| `docs/protocol/v3.1-migration.md` | New migration guide with all 6 required `##` sections (Capability matrix, Required for v0.2.0, Backward-compatible, Hard errors, Auth migration, Implementation status) |

### Verification evidence

- `npm run typecheck --workspace=packages/shared` — exit 0
- `npm run typecheck --workspace=packages/cli` — exit 0
- `npm run typecheck --workspace=packages/server` — exit 0 (after `npm run build --workspace=packages/shared` to populate dist)
- Reviewer agent (`oh-my-claudecode:code-reviewer`) verdict: **APPROVE** with 2 LOW non-blocking notes (file header drift, `'3.0'` literal vs `'3.1'` doc reference — both belong to next-slice when v3.1 constant lands)
- Deslop pass via `oh-my-claudecode:ai-slop-cleaner`: **NO_CHANGES** (code already evidence-dense)
- All 7 PRD stories `passes: true` in `.omc/prd.json`

### Phase 0A1 deferred to next iteration

Tracked in `.omc/prd.json` `deferred_to_next_iteration` list:

- `packages/cli/src/ws/auth-bridge.ts` (Exception A scoped change)
- `ws-hub.ts` dispatch hook (≤30 lines)
- `packages/server/src/ws/WSHub.ts` `clientCapabilities` Set + reject `local_pairing_auth`
- `packages/cli/__tests__/regression/v0_1_10.test.ts` **(critical: protects npm-published behavior before main merge)**
- `packages/cli/__tests__/protocol/local-pairing-auth.test.ts`
- `packages/cli/__tests__/protocol/capability-negotiation.test.ts`
- `packages/server/__tests__/protocol/reject-local-pairing-auth.test.ts`

**Why deferred:** auth path is production-critical (`lecoder-mconnect@0.1.10` live on npm + iOS TestFlight). Modifying without regression test for legacy v2 query-token flow = risk to production users. Per AI Steering Rule "never assert without verification."

---

## YC submission plan (user-confirmed)

### Decisions

| Question | Answer |
|---|---|
| Security feature branch | **Different CLI altogether** — not in this repo. Integration is cross-repo work, not a branch merge here. |
| Must-land for YC | (a) `content/video` (Remotion promo), (b) `cursor/lesearch-ai-convergence-76f0` (fleet selector + tasks + skills + voice web UI), (c) Multi-machine multi-agent orchestration from mobile — narrative story to tell in pitch + demo, not a single branch |
| Demo target | **CLI + new web UI (lesearch fleet)** |
| Merge path | **Open PRs, user merges each** — safer for npm prod + iOS App Store review |

### Branch landscape (relative to `origin/main`)

| Branch | Commits ahead | YC priority | Theme |
|---|---|---|---|
| `cursor/lesearch-ai-convergence-76f0` | 8+ | **HIGH (demo)** | Fleet selector, web UI tasks, skills registry, autopilot scheduler, voice chat, CORS |
| `content/video` | 8 | **HIGH (pitch)** | Remotion promotional video, Docker dev container |
| `feature/browser-sandbox-sidecar` | 8 | MEDIUM | Sandbox sidecar, design system, biome config, pre-commit hooks |
| `worktree-sequential-jingling-noodle` (this) | 1 | LOW | Phase 0A1 protocol scaffolding (internal) |
| `cursor/agent-cli-5c5c` | 2 | MEDIUM | Cursor SDK agent CLI with worktree isolation |
| `cursor/infinite-loop-system-5c5c` | 3 | MEDIUM | Cursor infinite agentic loop driven by stop hook |
| `cursor/development-environment-setup-599d` | 2 | LOW | Cursor Cloud setup |
| `codex/opik-single-tracer` | 1 | LOW | Opik tracing refactor |
| `codex/pty-perms-release-0.1.8` | 1 | LOW | node-pty permission fix |
| `fix/version-consistency` | 1 | LOW | Version display bug fix |
| `feature/web-support` | 0 | — | Empty (already merged?) |
| `fix/shell-validation-containers` | 0 | — | Empty placeholder |

### Recommended PR open order (next session)

1. `cursor/lesearch-ai-convergence-76f0` → `main` — biggest demo surface, pull first
2. `content/video` → `main` — promo video assets (large but isolated to `apps/video/` or similar)
3. `feature/browser-sandbox-sidecar` → `main` — sandbox + biome + design polish
4. `cursor/agent-cli-5c5c` → `main` — cursor SDK agent CLI (multi-agent story)
5. `cursor/infinite-loop-system-5c5c` → `main` — stop-hook agentic loop (multi-agent story)
6. `worktree-sequential-jingling-noodle` (this branch) → **HOLD** — not for main today; Phase 0A1 needs auth-bridge + tests

PR conflict resolution: `cursor/lesearch-ai-convergence-76f0` and `feature/browser-sandbox-sidecar` both touch web/lint/biome config — expect merge conflicts. Resolve by hand on whichever lands first.

### Multi-machine multi-agent orchestration story (for YC pitch + demo)

**Narrative:** MConnect = control AI coding agents on remote machines from your phone. Multi-machine layer = run agents on N Mac Minis (the LeSearch fleet) and orchestrate via mobile. Multi-agent layer = parallel agents per machine via worktree isolation.

**Demo material already on branches:**

- Fleet runtime selector (`cursor/lesearch-ai-convergence-76f0`) — pick which Mac Mini to spawn agent on, from the web UI
- Cursor SDK agent CLI with worktree isolation (`cursor/agent-cli-5c5c`) — multiple agents per repo without file conflicts
- Cursor infinite agentic loop (`cursor/infinite-loop-system-5c5c`) — agents that keep working until done

**Demo flow suggestion (CLI + web):**

1. Show `npx lecoder-mconnect` — QR code to phone OR fleet web UI
2. Web UI: select fleet runtime → spawn task → assign agent → voice command
3. Show 3 worktrees executing in parallel (orchestrator-style isolation)
4. Phone view: live status of all 3 agents, approve/reject sensitive commands
5. Cut to promo video for closer

---

## Critical safety reminders for next session

- **`lecoder-mconnect@0.1.10` is live on npm.** Anything pushed to main risks the global install path. Smoke-test `npx lecoder-mconnect@0.1.10 doctor` after merges.
- **iOS app `com.lecoder.mconnect` is in App Store review.** Do not change WebSocket protocol auth path without ensuring TestFlight + App Store binaries still authenticate.
- **`worktree-sequential-jingling-noodle` is NOT ready for main.** It bumps `PROTOCOL_VERSION` to `'3.0'` in CLI but does not add the auth-bridge needed to keep v0.1.10 clients connecting. Merging today would break legacy clients.
- **README does NOT yet need updating.** No public-facing change in this session's slice. README update happens after Phase 0A1 fully lands (auth-bridge + tests + server reject), not now.
- **External agent's "security CLI" is in a separate repo.** Integration is cross-repo work, not done here.

---

## Pickup points for next session

### Path A — YC merge sprint (recommended for time-pressed YC submission)

1. `gh pr create --base main --head cursor/lesearch-ai-convergence-76f0` with full feature summary
2. `gh pr create --base main --head content/video` for promo video assets
3. `gh pr create --base main --head feature/browser-sandbox-sidecar` for sandbox sidecar
4. `gh pr create --base main --head cursor/agent-cli-5c5c` for cursor SDK CLI
5. `gh pr create --base main --head cursor/infinite-loop-system-5c5c` for infinite loop
6. User merges in dependency order, resolving conflicts as they arise
7. Smoke-test after each merge: `npm run build`, `npm run typecheck`, `mconnect doctor`
8. Final main → record demo → submit YC

### Path B — Continue Phase 0A1 (for after YC)

Resume ralph on `worktree-sequential-jingling-noodle` with scope:

- `auth-bridge.ts` (Exception A)
- `ws-hub.ts` ≤30-line dispatch
- Server `WSHub.ts` `clientCapabilities` + reject `local_pairing_auth`
- 4 test files (regression v0_1_10 first, blocks all others)
- After all green: PR `worktree-sequential-jingling-noodle` → `main`
- Then README update with v0.2.0 protocol architecture diagram

### Path C — README + demo polish only (fastest YC path if branches don't merge cleanly)

If merge conflicts eat too much time:

1. Cherry-pick only the demo-critical files from `cursor/lesearch-ai-convergence-76f0` (fleet selector + web UI) into a new branch `release/yc-demo`
2. PR `release/yc-demo` → `main`
3. Skip the rest, record demo, submit
4. Merge remaining branches post-YC

---

## Files of record

| Path | Purpose |
|---|---|
| `.omc/plans/2026-05-02-194104-mconnect-v2-session-desktop-anchor.md` | 802-line plan v4 (full v0.2.0 14-week Phase 0A1 → 6 schedule) |
| `.omc/prd.json` | Phase 0A1 PRD with all 7 stories `passes: true` + `deferred_to_next_iteration` list |
| `.omc/SESSION-HANDOFF-2026-05-03.md` | This file |
| `docs/protocol/v3.1-migration.md` | Migration guide (committed in `2235262`) |

---

## Open questions for user before next session

- Which Mac Minis are in the demo fleet, and are they reachable from `mconnect start --preset shell-only` over Cloudflare tunnel today?
- Is the YC application form ready for the demo URL, or does it need a hosted demo deploy too?
- For the "security CLI" cross-repo integration — does that need any hooks in `lecoder-mconnect` (e.g. exposed WebSocket capability), or is it purely external?
- Is there a deadline for App Store review response that conflicts with merging anything to main today?

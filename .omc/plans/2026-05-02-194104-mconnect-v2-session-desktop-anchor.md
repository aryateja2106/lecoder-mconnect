# MConnect v0.2.0 — "Session Command Center" Plan

> **Mode**: RALPLAN-DR consensus, **deliberate** (high-risk: cross-platform desktop, new persistence/memory, multi-agent coordination, App Store-shipping iOS impact).
> **Anchor**: Switchboard-style session manager + IDE-grade desktop app, additive to current cli/server/ios stack.
> **Execution target after approval**: `oh-my-claudecode:ralph` + ultrawork.
> **Owner**: Arya Teja Rudraraju.
> **Plan version**: **v4** (Planner revision after Architect v3=REVISE + Critic v3=REJECT). Both reviewers converged on 2 surviving CRITICAL blockers from v3: (1) "shared JWT validator" doesn't exist (jose not in shared, JWT_SECRET singleton in server only); (2) AC19 harness has 4 code-grounded bugs (`.pairingUrl` vs CLI's `.connectUrl`, iOS `.onOpenURL` doesn't route `mconnect://pair`, no `session_kill` protocol message, `date +%s%N` not monotonic). v4 pivots auth approach: drops the "shared JWT validator" idea, introduces explicit `local_pairing_auth` v3.1 message so CLI keeps its existing local-pairing-token security model and JWT stays server-only. v4 also rewrites AC19 harness as Node test runner using `process.hrtime.bigint()`, lists CLI/iOS/protocol changes needed for AC19 as Phase 1 deliverables. v4 is the final iteration before max-iteration presentation per skill rule.

---

## 0. Why this plan exists (unchanged from v0)

`mconnect` ships today as: CLI package `lecoder-mconnect@0.2.0` (root workspace `0.1.2`, latest npm-published `0.1.10`) + iOS app on TestFlight + Cloudflare-tunnel mobile control. Two large prior planning artifacts already exist in repo: `PRD-LECODER-AGENTOS.md` (full PRD, 6 epics) and `LECODER-AGENT-HUB-PLAN.md` (Rust core + Tauri desktop technical plan). v3 protocol is **already documented and shipped** in `packages/shared`, `packages/server`, `packages/ios-app`, with `docs/protocol/v3.md` present; the **CLI alone still emits `PROTOCOL_VERSION = '2.0'`** at `packages/cli/src/ws/protocol.ts:259` and is the single migration debt.

Six new MIT/open reference projects raise the bar:

| Ref project | Stack | Take-aways for mconnect (filtered to v0.2.0 narrow scope) |
|---|---|---|
| **switchboard** (doctly) | Electron + React | Session browser across all projects, fork/resume from any point, full-text search, status notifications, IDE emulation w/ inline + side-by-side diffs, grid overview of N live terminals. **In v0.2.0**: session browser, fork/resume, status notifications, IDE diff panel. |
| **orchestrator** (MatchaOnMuffins) | Electron + React 19 + Zustand + Vite | Up to 10 concurrent agents per repo via **git worktree isolation per agent**, tmux-like pane interface, persistent session storage. MIT. **In v0.2.0**: worktree-per-agent module + grid view. |
| **paseo / multica / jcode / smfs** | Mixed | Multi-provider OAuth, ambient memory, swarm coordination, agent-as-teammate, FUSE memory mount, voice. **All deferred to v0.3.x** per Critic finding "weeks 7-12 materially under-budgeted." |

**User constraints (locked in interview)**:
1. Anchor = Session manager + IDE-grade desktop (Switchboard-style).
2. Loop = Deliberate consensus + codex Architect + codex Critic.
3. Execution = After approval, `/oh-my-claudecode:ralph` + ultrawork.
4. Scope = **Additive** — new packages OK, no rewrites of existing core code.

---

## 1. RALPLAN-DR — Principles (revised, addresses Critic FAIL: §1 vs §3 consistency)

1. **Additive over invasive — strict definition with two scoped exceptions**. New packages are additive without question (`packages/desktop`, `packages/worktree`). Existing-package changes default to **new files** (no edits to load-bearing core like `packages/cli/src/session.ts`, `packages/cli/src/pty/pty-manager.ts`), gated behind feature flag default-OFF, with v0.1.10 regression test. **Two explicit scoped exceptions** (both Critic-mandated for correctness):
   - **Exception A — `packages/cli/src/ws/ws-hub.ts` auth state-machine modification.** v3 protocol requires first-message JWT auth (per `packages/shared/src/protocol/messages.ts:65-73` + `docs/protocol/v3.md:58`); current CLI uses query-param `?token=&v=` auth at `packages/cli/src/ws/ws-hub.ts:241-275`. New-file-only refactor is impossible. ws-hub.ts auth states MUST change; modification is scoped to the auth path only, accepts both v2 query-token (legacy) and v3 first-message JWT (new), and is covered by a backward-compat test asserting v0.1.10 published-npm clients still connect.
   - **Exception B — `packages/cli/src/session/SessionStore.ts:55` migration bootstrap.** Existing CLI applies `001_sessions.sql` (which uses bare `CREATE TABLE`, not `IF NOT EXISTS` — `packages/cli/migrations/001_sessions.sql:8`) directly via SessionStore. The new migration runner cannot re-apply `001` without SQL error. Baseline rule: if `sessions` table exists AND `schema_migrations` does not → create `schema_migrations` and mark `001_sessions.sql` applied **without re-executing**. Modification is scoped to baseline detection + idempotence; covered by a fixture test for a DB created by current `SessionStore`.
   Both exceptions are still "additive in spirit" because they preserve all existing behavior; they only add new capability paths.
2. **v3.0 is the protocol baseline; new features land at v3.1 with capability negotiation.** Source of truth: `packages/shared/src/protocol/messages.ts:22` (= `'3.0'`) and `docs/protocol/v3.md`. The CLI catches up to v3.0 in Phase 0 (currently at v2.0, `packages/cli/src/ws/protocol.ts:259`). New `desktop:*` and `worktree:*` message families ship as v3.1 additions and **MUST** include explicit capability negotiation — every client advertises a capability set on auth, server unions them, unknown families to a client are skipped *with a typed `unsupported_capability` warning*, never silent drop. (Today CLI silently `console.warn`s and ignores; that becomes a typed protocol error in v3.1.)
3. **Ship the anchor in 14 weeks (baseline), in v0.3.x for everything else.** v3 extends from v2's 12-week claim to 14 weeks per Architect+Critic finding that 12 was not credible. Three published schedules (§5): **14 wk no-0C** (baseline, Tauri spike passes), **15 wk 0C-only** (Tauri fails → Electron fallback), **16 wk 0C+signing-slip** (worst case). v0.2.0 ships **only**: desktop session manager, worktree isolation per agent, fork-and-resume, IDE diff panel. Memory layer, swarm, multi-provider OAuth (beyond existing GitHub (Google is typed in shared but not registered in `packages/server/src/auth/providers/index.ts`)), iOS side panel, skill compounding, smfs FUSE/NFS mount, sub-swarms, voice control are explicitly **out of v0.2.0**. They belong in a v0.3.x consensus plan after this anchor lands.
4. **Prove perf with budgets, not promises.** A perf-budget script (`scripts/perf-budget.ts`) ships in Phase 0, runs in CI, and gates releases on cold-start TTI ≤ 2.5 s, idle PSS ≤ 220 MB w/ 1 session, ≤ 320 MB w/ 5 sessions on M-series Mac and Linux x64. Windows is a separate gate (Phase 0 spike).
5. **Hard gate before UI work.** Phase 0B ends with a packaged-Tauri terminal attach/spawn/resize/kill demo across **mac+linux+win** with iOS attached to the same session. **Kill criterion**: any platform fails attach/resize/kill twice in CI → enter **Phase 0C** (conditional Electron fallback, +1 week) before Phase 1 UI starts. Decision deadline: end of Phase 0B (Day 14). Phase 6 buffer absorbs the +1 week if 0C is triggered.

## 2. RALPLAN-DR — Decision Drivers (top 3, unchanged)

1. **Time-to-shipped-desktop**. iOS App Store review in progress, TestFlight live; momentum highest now.
2. **Preserve published-package stability** (`lecoder-mconnect@0.1.10` on npm; iOS TestFlight).
3. **Token-cost containment**. (Drives Phase 5 deferral of memory/swarm to v0.3.x — both are token-cost amplifiers.)

## 3. RALPLAN-DR — Viable Options (revised, addresses Critic FAIL: shallow alternatives, Option B re-scored fairly)

### Option A — *Additive Tauri Desktop on existing TS stack, NARROW v0.2.0 scope* (RECOMMENDED)

**Shape**: New `packages/desktop` (Tauri 2.0 + React 19 + Zustand + Tailwind + xterm.js + Lucide + CodeMirror). Tauri commands talk to existing CLI via the **v3.0 WebSocket** (after CLI catch-up in Phase 0). New `packages/worktree` (TypeScript) for git worktree lifecycle per agent. Existing `packages/cli/src/session/`, `packages/cli/src/pty/`, `packages/server`, `packages/shared`, `packages/ios-app` cores **unchanged** except (a) CLI protocol catch-up v2→v3 (Phase 0), (b) new feature-flag-gated message handlers for v3.1 additions (Phase 1+).

**Scope**: desktop session manager + worktree isolation + fork/resume + IDE diff panel. Nothing else.

**Honest 12-week estimate**: 5 weeks for desktop MVP after Phase 0 gate, 2 weeks for worktree, 2 weeks for fork/resume + IDE diff, 1 week for code-signing+distribution, 1 week for Opik+release notes, 1 week buffer. Total = 12 weeks **only because deferred features are not in scope**. Same scope at HUB plan's Rust pace = 20+ weeks.

**Pros**:
- Honors "no rewrites" with strict definition in §1 principle 1.
- Preserves npm CLI flow (regression test in §10).
- Tauri matches HUB plan's UI tech stack — sunk planning capital not wasted.
- iOS protocol unchanged (already v3.0, capability negotiation makes v3.1 additions ignorable to old iOS builds).

**Cons**:
- Tauri 2.0 cross-platform terminal bridging is less battle-tested than Electron + node-pty (cf. Switchboard, Orchestrator). Mitigated by Phase 0 hard gate + Electron escape hatch (Phase 1, NOT Phase 5).
- Higher steady-state RAM than Rust would deliver. Acceptable per perf-budget §1 principle 4.
- Dropping memory/swarm/OAuth for v0.2.0 means anchor is just a session manager — no new agent-coordination story until v0.3.x.

### Option B — *Hybrid Rust sidecar from day one* (re-scored against same scope as Option A)

**Shape**: Same Tauri desktop + `packages/worktree` as A, BUT also new `packages/core-rs` Rust crate exposing JSON-RPC over Unix socket / named pipe. Worktree create/cleanup + file watcher run in Rust; CLI gets an opt-in `--rust-core` flag.

**Honest re-scored estimate**: same as Option A + 3-4 weeks for Rust crate, JSON-RPC bridge, CI Rust toolchain wiring, release-pipeline complexity = 15-16 weeks for the same v0.2.0 product surface. **Tauri 2.0 already ships a Rust toolchain in CI**, so the marginal Rust cost is ~30%, not 100%, as v0 incorrectly stated.

**Pros**:
- Captures HUB plan's perf benefits selectively.
- Future Rust core swap-in is incremental, not a fork.
- Honest acknowledgment: the Rust toolchain Tauri already requires lowers Option B's marginal cost vs. Option A.

**Cons**:
- Stretches v0.2.0 by 3-4 weeks **on the same scope**. With user's "ship anchor in 12 weeks" driver (#1), this fails the time-to-ship test.
- Adds two languages' release pipelines (npm + cargo + Tauri). Risk of CI breakage on Windows is non-trivial.
- "Additive" interpretation is fuzzier — strictly, the CLI gains a parallel implementation of worktree functions.

### Option C — *Full HUB plan as written* (rewrite core in Rust)

**Shape**: Execute `LECODER-AGENT-HUB-PLAN.md` literally (Rust workspace, ratatui TUI, Tauri desktop on Rust core).

**Honest estimate**: 20+ weeks; HUB plan itself allocates Rust foundation in weeks 1-4 + desktop in Month 2 (its Phase 3) + advanced features in Month 3+. Doesn't fit user's anchor-first goal.

**Pros**: Hits PRD perf targets.

**Cons**: Directly violates user constraint #4 ("no rewrites"). Documented invalidation rationale per Critic requirement.

**Invalidation rationale for Option C**: User constraint #4 ("Additive: new packages OK, but no rewrites") + Driver #1 (time-to-shipped-desktop) jointly foreclose Option C. Documented for audit trail.

**Plan adopts Option A**, with explicit Phase 6 follow-up trigger to revisit Option B after v0.2.0 ships *and* the perf budget is measured against real load.

---

## 4. Reference-project → epic-mapping matrix (revised, narrowed to v0.2.0 only)

| Capability | Source ref | Target package | Phase | Notes |
|---|---|---|---|---|
| Cross-project session browser, full-text search, sidebar status | switchboard | `packages/desktop/src/sessions/` | 2 | Reads `SessionStore` SQLite. Adds FTS5 virtual table + content_id column via new migration `migrations/002_scrollback_fts.sql`. |
| Built-in terminal panel, status notifications | switchboard | `packages/desktop/src/terminal/`, `packages/desktop/src/notifications/` | 2 | xterm.js + new hook event types in `packages/shared/src/protocol/` (v3.1, capability-gated). |
| Fork & resume from any conversation point | switchboard | `packages/desktop/src/sessions/fork.ts` + new migration `migrations/003_scrollback_message_id.sql` adding `message_id` column to scrollback | 3 | Schema migration required (Critic FAIL on AC5 — column doesn't exist today). |
| File preview side panel + IDE diff panel (inline + side-by-side) | switchboard | `packages/desktop/src/diff-panel/` | 3 | Tauri "Claude IDE MCP emulator" registration optional; toggleable in settings. |
| Session grid overview (live mini-terminals) | switchboard | `packages/desktop/src/grid/` | 3 | |
| Up to N=10 concurrent agents per repo via **git worktree isolation** | orchestrator | `packages/worktree/` (NEW package, fully additive) + `packages/desktop/src/worktree/` UI | 3 | Worktree lifecycle: create on agent spawn, cleanup on exit + cleanup-on-startup GC pass against running session list. |
| Tmux-like pane interface | orchestrator | shared with `packages/desktop/src/grid/` above | 3 | |
| Activity stats heatmap | switchboard | `packages/desktop/src/stats/` | 5 | Polish only. |

**Deferred to v0.3.x (out of v0.2.0 scope, per Critic-mandated cut)**:

| Capability | Source ref | Reason for deferral |
|---|---|---|
| Memory layer (sqlite-vec, ambient embedding, consolidation) | jcode + smfs | Token-cost driver + protocol surface area + 4-week minimum estimate alone. |
| Swarm coordinator (file-shift, DM, broadcast, sub-swarms) | jcode | Default-off + protocol surface + feedback-loop testing burden. |
| Multi-provider OAuth beyond existing GitHub | jcode + paseo | Server `packages/server/src/auth/providers/index.ts` ships only GitHub today (Google is typed in shared but not registered); adding Claude/OpenAI/Gemini/Copilot/openai-compatible/Azure/Ollama is a 3-4 week project on its own. |
| iOS side-panel (Mermaid, diff, file) | jcode | New iOS surface = TestFlight re-review risk during v0.2.0 cycle. |
| Skill compounding | multica | Depends on memory layer. |
| smfs FUSE/NFS mount | smfs | Vendor binary + license clearance not done; experimental. |
| Voice control | paseo | Research only. |
| Linear-issue-to-agent assign | multica | Depends on multi-provider auth. |

---

## 5. Phased plan (14-week baseline, narrowed scope, every phase has a verification gate)

**Schedule matrix** (Critic-required separate buffer accounting):

| Schedule | Total | Trigger | Phase 6 contains |
|---|---|---|---|
| Baseline | 14 wk | Tauri 0B passes; signing 0 slip | Polish + buffer for unforeseen |
| 0C-triggered | 15 wk | Tauri 0B fails → Electron fallback | Phase 0C (+1 wk) consumed pre-Phase-1 |
| 0C + signing slip | 16 wk | Both | +1 wk Phase 5 contingency on top of 0C |

If 12-week launch is required by external pressure (e.g. App Store window), the cut path is: drop the IDE diff panel from Phase 3 (saves ~1.5 wk) + drop the activity heatmap polish from Phase 6 (saves ~0.5 wk). This produces a credible 12-week scope with the same anchor — explicitly named here so ralph does not silently start cutting other items.

### Phase 0A1 — CLI v3 auth migration + capability negotiation (Week 1)

**Deliverables (scoped, Critic-narrowed — was overloaded in v2 Phase 0A)**:
- **CLI protocol catch-up + auth state-machine modification**: `packages/cli/src/ws/protocol.ts` updated to `PROTOCOL_VERSION = '3.0'`. **`packages/cli/src/ws/ws-hub.ts:241-275` auth path is modified** (Exception A from §1 principle 1) to accept BOTH v2 query-token URLs (legacy v0.1.10 clients) AND v3 first-message **`local_pairing_auth`** (new desktop/iOS direct-attach clients). **Decision pivot from v3 (Critic-driven)**: do NOT introduce JWT validation into the CLI. CLI keeps its existing local-pairing-token security model in `packages/cli/src/security.ts`. The JWT-based `auth` v3 message (per `packages/shared/src/protocol/messages.ts:62-73`) remains **server-only** (Bun server in `packages/server`); the CLI does not import `jose` or any JWT validator. Instead, **a new v3.1 `local_pairing_auth` message** is added to shared protocol with payload `{ pairingToken: string, version: '3.0', clientCapabilities: string[] }`. CLI validates `pairingToken` against its local registry (existing `packages/cli/src/security.ts` machinery). **Bun server REJECTS `local_pairing_auth`** (Architect v4 security finding — server stays JWT-only; no JWT bypass introduced); message type is endpoint-scoped to direct-CLI-attach. iOS keeps using `auth` (JWT) when connecting to the Bun server; iOS uses `local_pairing_auth` when connecting directly to the CLI via QR. Test enforces this: `packages/server/__tests__/protocol/reject-local-pairing-auth.test.ts` asserts server returns typed `unsupported_capability` for incoming `local_pairing_auth`. New file `packages/cli/src/ws/auth-bridge.ts` houses CLI-side dual-mode logic (v2 query-token + v3.1 local_pairing_auth); `ws-hub.ts` change is limited to dispatch (≤ 30 lines).
- **Capability negotiation** in `packages/shared/src/protocol/messages.ts`: new `client_capabilities` field on auth message; server response unions capabilities; `unsupported_capability` typed error replaces silent `console.warn` drop at `packages/cli/src/ws/ws-hub.ts:524-526`. Server-side: new `clientCapabilities: Set<string>` field on `packages/server/src/ws/WSHub.ts:59-82` client state; auth-success unions advertised capabilities at `packages/server/src/ws/WSHub.ts:660-668`.
- **v3.1 compatibility matrix doc** `docs/protocol/v3.1-migration.md` (NEW). Required sections: `## Capability matrix`, `## Required for v0.2.0` (lists `desktop:session_list`, `desktop:fork`, `desktop:resume`, `worktree:lifecycle`), `## Backward-compatible`, `## Hard errors`, `## Auth migration` (documents v2-query-token-or-v3-JWT dual mode + sunset timeline).

**Verification gate (mechanical)**:
```bash
grep "PROTOCOL_VERSION = '3.0'" packages/cli/src/ws/protocol.ts                              # exit 0
test -f packages/cli/src/ws/auth-bridge.ts                                                   # exit 0
grep "client_capabilities" packages/shared/src/protocol/messages.ts                          # exit 0
grep "clientCapabilities" packages/server/src/ws/WSHub.ts                                    # exit 0
grep "local_pairing_auth" packages/shared/src/protocol/messages.ts                           # exit 0; new v3.1 message type defined
grep "local_pairing_auth" packages/cli/src/ws/auth-bridge.ts                                 # exit 0; CLI handler exists
grep "unsupported_capability" packages/cli/src/ws/auth-bridge.ts                             # exit 0
! grep -q "from 'jose'" packages/cli/src/ws/auth-bridge.ts                                   # exit 0; CLI does NOT import jose (v4 pivot — JWT stays server-only)
! grep -q '"jose"' packages/cli/package.json                                                 # exit 0; jose not added to CLI deps
test -f docs/protocol/v3.1-migration.md                                                      # exit 0
grep -q "^## Capability matrix" docs/protocol/v3.1-migration.md                              # exit 0
grep -q "^## Auth migration" docs/protocol/v3.1-migration.md                                 # exit 0
grep -q "local_pairing_auth" docs/protocol/v3.1-migration.md                                 # exit 0; new auth path documented
bun test packages/cli/__tests__/regression/v0_1_10.test.ts                                   # exit 0; legacy v2-query-token still authenticates
bun test packages/cli/__tests__/protocol/local-pairing-auth.test.ts                          # exit 0; new v3.1 local-pairing flow authenticates
bun test packages/cli/__tests__/protocol/capability-negotiation.test.ts                      # exit 0
```

### Phase 0A2 — Migration runner + sidecar contract + interfaces (Week 2)

**Deliverables (Critic-narrowed: only TerminalBridge + WorktreeRuntime + sidecar; MemoryIndex + FileWatcher MOVED to v0.3.x because they serve memory/swarm which are deferred)**:
- **CLI migration runner — library + thin script wrapper** (Exception B from §1 principle 1; v4 pivot per Critic v3 finding): primary deliverable is a **library function** `runMigrations(db: BetterSqlite3.Database, migrationsDir: string): MigrationResult` exported from `packages/cli/src/session/migrations.ts`. **Baseline detection**: if `sessions` table exists AND `schema_migrations` table does not → create `schema_migrations`, insert `001_sessions.sql` row marked applied **without re-executing the SQL**, then proceed with 002+. `SessionStore` constructor at `packages/cli/src/session/SessionStore.ts:48-56` calls this library function directly with its own `db` and a resolved `migrationsDir` (via `import.meta.url`); this preserves `MCONNECT_HOME` / `MCONNECT_DATA_DIR` / custom `dataDir`+`dbName` paths configured at `packages/cli/src/config.ts:43-45`. The script `packages/cli/scripts/migrate.ts` is a thin wrapper: resolves `dbPath` via `getDataDir()`, opens via `better-sqlite3`, calls the same library function. New script entry `db:migrate` in `packages/cli/package.json` invokes via `tsx`. Test fixtures cover (a) DB created by current `SessionStore` at default path, (b) DB at custom `MCONNECT_DATA_DIR` path, (c) test-fixture in-memory DB (matches `packages/cli/src/__tests__/session-manager.test.ts:19` pattern).
- **TS interfaces (in-scope only)**: `packages/shared/src/interfaces/TerminalBridge.ts`, `WorktreeRuntime.ts`. Default TS adapters in `packages/cli/src/adapters/` + `packages/worktree/src/adapters/`. (`MemoryIndex.ts` + `FileWatcher.ts` deferred to v0.3.x with memory/swarm.)
- **Sidecar contract**: `packages/shared/src/interfaces/sidecar-schema.ts` defines JSON-RPC envelope, per-method param/result types for the 2 in-scope interfaces, streaming semantics for terminal frames, error codes. Plus `packages/shared/src/__tests__/sidecar-contract.test.ts` runs default TS adapters against `packages/shared/src/__tests__/fixtures/sidecar/`. Future Rust sidecar passes the same fixture suite.

**Verification gate (mechanical)**:
```bash
jq -e '.scripts."db:migrate"' packages/cli/package.json                                      # exit 0
test -f packages/cli/scripts/migrate.ts                                                      # exit 0
test -f packages/cli/src/session/migrations.ts                                               # exit 0; library module exists
test -f packages/cli/__tests__/migrations/baseline-from-sessionstore.test.ts                 # exit 0
test -f packages/cli/__tests__/migrations/custom-data-dir.test.ts                            # exit 0; covers MCONNECT_DATA_DIR
test -f packages/cli/__tests__/migrations/in-memory-fixture.test.ts                          # exit 0; covers test pattern
bun test packages/cli/__tests__/migrations/                                                  # exit 0; all 3 fixtures pass
cd packages/cli && bun run db:migrate                                                        # exit 0; idempotent; second invocation also exit 0
DBPATH=$(MCONNECT_HOME=/tmp/mconnect-test node -e "console.log(require('./packages/cli/dist/config.js').getDataDir() + '/sessions.db')")
sqlite3 "$DBPATH" "SELECT name FROM schema_migrations" | grep -q "001_sessions.sql"          # exit 0; respects MCONNECT_HOME

test -f packages/shared/src/interfaces/TerminalBridge.ts                                     # exit 0
test -f packages/shared/src/interfaces/WorktreeRuntime.ts                                    # exit 0
test -f packages/shared/src/interfaces/sidecar-schema.ts                                     # exit 0
test -d packages/shared/src/__tests__/fixtures/sidecar                                       # exit 0
bun test packages/shared/src/__tests__/sidecar-contract.test.ts                              # exit 0
```

**Verification gate (mechanical, ralph-executable)**:
```bash
# CLI v3 catch-up
grep "PROTOCOL_VERSION = '3.0'" packages/cli/src/ws/protocol.ts                              # exit 0
npm run typecheck --workspace=packages/cli                                                   # exit 0
npm test --workspace=packages/cli                                                            # exit 0; includes packages/cli/__tests__/regression/v0_1_10.test.ts

# Capability negotiation present
grep "client_capabilities" packages/shared/src/protocol/messages.ts                          # exit 0
grep "unsupported_capability" packages/cli/src/ws/v3-handlers.ts                             # exit 0

# Compatibility matrix doc exists with required sections
test -f docs/protocol/v3.1-migration.md                                                      # exit 0
grep -q "^## Capability matrix" docs/protocol/v3.1-migration.md                              # exit 0
grep -q "^## Required for v0.2.0" docs/protocol/v3.1-migration.md                            # exit 0
grep -q "desktop:session_list" docs/protocol/v3.1-migration.md                               # exit 0
grep -q "worktree:lifecycle" docs/protocol/v3.1-migration.md                                 # exit 0

# Interfaces + sidecar contract scaffolded
test -f packages/shared/src/interfaces/TerminalBridge.ts                                     # exit 0
test -f packages/shared/src/interfaces/WorktreeRuntime.ts                                    # exit 0
test -f packages/shared/src/interfaces/sidecar-schema.ts                                     # exit 0
test -d packages/shared/src/__tests__/fixtures/sidecar                                       # exit 0
bun test packages/shared/src/__tests__/sidecar-contract.test.ts                              # exit 0; TS adapters pass suite

# Migration runner present + applies clean
jq -e '.scripts."db:migrate"' packages/cli/package.json                                      # exit 0
test -f packages/cli/scripts/migrate.ts                                                      # exit 0
cd packages/cli && bun run db:migrate                                                        # exit 0
sqlite3 ~/.mconnect/sessions.db "SELECT name FROM schema_migrations" | grep -q "001_sessions.sql"   # exit 0
```

### Phase 0B — Desktop scaffold + hard-gate spike + Windows CI workflow (Weeks 3-4)

**Added per Architect v3 + Critic v3 + Architect v4 YAML correction**: explicit deliverable `.github/workflows/desktop-hard-gate.yml` with proper GitHub Actions matrix syntax:
```yaml
strategy:
  fail-fast: false
  matrix:
    os: [macos-14, ubuntu-24.04, windows-latest]
runs-on: ${{ matrix.os }}
```
Steps: checkout → setup-node@20 → setup-bun → `dtolnay/rust-toolchain@stable` → platform-specific build deps → `bun install` → `bun run build:desktop` → `actions/upload-artifact@v4` for built dmg/AppImage/msi. One green dry-run required before Phase 1 starts. Current CI has only Ubuntu+macOS jobs in `.github/workflows/ci.yml`; Windows runner does not exist yet.


**Deliverables**:
- `packages/desktop` scaffolded as Tauri 2.0 + React 19 + Zustand + Tailwind + xterm.js. Builds packaged dmg (mac arm64) + AppImage (linux x64) + msi (win x64).
- `packages/desktop/scripts/hard-gate.ts` spike: spawn CLI via `mconnect start --preset shell-only --yes --json`, attach desktop via WebSocket using session info from `--json` output, send 1000 keystrokes + 5 resizes + 1 kill via `desktop:input` v3.1 messages, assert PTY exit code = 0, assert no dropped frames in xterm output. Runs on macOS arm64, Linux x64, **Windows x64** in CI matrix.
- `packages/desktop/scripts/perf-budget.ts` writes `.omc/perf-budget/<date>.json`; CI fails on regressions > 10% over rolling 7-day median.
- **Kill criterion**: hard gate fails twice on any platform → enter Phase 0C. Decision recorded as ADR amendment in `docs/protocol/v3.1-migration.md`.

**Verification gate (mechanical)**:
```bash
cd packages/desktop && bun run hard-gate -- --platform=macos                                 # exit 0
cd packages/desktop && bun run hard-gate -- --platform=linux                                 # exit 0
cd packages/desktop && bun run hard-gate -- --platform=windows                               # exit 0 (CI Windows runner)
# CI job names: ci-hard-gate-macos, ci-hard-gate-linux, ci-hard-gate-windows. All three required for Phase 1 to start.

cd packages/desktop && bun run perf-budget                                                   # exit 0; writes .omc/perf-budget/<today>.json
```

### Phase 0C — Conditional Electron fallback (+1 week, ONLY if 0B kill criterion triggers; consumed pre-Phase-1, schedule shifts to 15-wk total per §5 schedule matrix)

**Deliverables (only if triggered)**:
- Swap `packages/desktop` to Electron + node-pty. React/Zustand/Tailwind/xterm.js layers preserved.
- Re-run Phase 0B hard-gate against Electron build; same CI matrix (mac+linux+win); same kill criterion.
- ADR amendment in §11 captures the swap, rationale, and consequences.

**Schedule impact**: Phase 6 buffer absorbs the +1 week. If 0C is NOT triggered, Phase 6 retains the buffer for Phase 5 contingency.

**Verification gate (mechanical, only if triggered)**:
```bash
cd packages/desktop && bun run hard-gate -- --runtime=electron --platform=macos              # exit 0
cd packages/desktop && bun run hard-gate -- --runtime=electron --platform=linux              # exit 0
cd packages/desktop && bun run hard-gate -- --runtime=electron --platform=windows            # exit 0
```

### Phase 1 — Switchboard MVP: session browser + terminal + status notifications + AC19 prerequisites (Weeks 5-7)

**AC19 prerequisite deliverables (added per Critic v3 finding that AC19 referenced non-existent code paths)**:
- **CLI `--json` output adds `pairingUrl` field**: modify `packages/cli/src/session.ts:410-430` (under Exception A scope — auth-related additive change). Format: `mconnect://pair?host=<h>&port=<p>&token=<t>`. Existing `connectUrl` retained for backward compat.
- **iOS URL routing**: modify `packages/ios-app/MConnect/App/MConnectApp.swift:21-36` `.onOpenURL` to route `mconnect://pair` host to `HostListView.handleQRCode` (the existing QR-parsing path at `packages/ios-app/MConnect/Views/Hosts/HostListView.swift:176-202`).
- **Protocol `session_kill` v3.1 message**: add to `packages/shared/src/protocol/messages.ts` (additive to type union, capability-gated). Server WSHub + CLI WSHub handle by terminating PTY + emitting `session_state` event.
- **iOS `WSClient.killSession()` API**: add to `packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:217-281`. Sends `session_kill` v3.1 message.
- **iOS `MCONNECT_TEST_AUTOKILL` env hook**: in `packages/ios-app/MConnect/App/MConnectApp.swift`, on `applicationDidBecomeActive`, if env var set, call `WSClient.killSession()` after pairing completes.
- **Desktop `dev:test` build**: `packages/desktop/scripts/dev-test.ts` runs the desktop UI in dev mode plus exposes a localhost HTTP probe on port 7777 with endpoints: `POST /attach { sessionId }` (instructs UI to attach), `GET /wait?event=<e>&value=<v>&timeoutMs=<n>` (long-poll for state event, returns 200 on match, 504 on timeout). Used by AC19 harness.



**Deliverables**:
- Tauri desktop window opens, sidebar lists running CLI sessions discovered via existing `packages/cli/src/daemon/` registry + new `desktop:session_list` v3.1 message.
- Terminal panel: spawn new CLI session from desktop, attach to existing one, kill from desktop. Built on `TerminalBridge` interface; default adapter wraps existing PTY hub via WebSocket.
- Status notifications: waiting-for-input + permission-approval surfaced from CLI hooks. New hook event types in `packages/shared/src/protocol/` v3.1 capability-gated.
- Sidebar w/ project grouping. **FTS5 search**: new migration `packages/cli/migrations/002_scrollback_fts.sql` adding a `scrollback_fts` virtual table indexing `content` with the `(session_id, line_number)` rowid mapping. Search returns rows as `(session_id, line_number, snippet)`.
- Pairing flow on desktop: existing QR code rendered in desktop sidebar.

**Verification gate (mechanical)**:
```bash
# Build matrix
npm run build                                                                # exit 0
cd packages/desktop && bun run build:macos                                   # produces dist/MConnect.dmg
cd packages/desktop && bun run build:linux                                   # produces dist/MConnect.AppImage
cd packages/desktop && bun run build:windows                                 # produces dist/MConnect.msi

# Migration applied (002_scrollback_fts.sql lands here, runner from Phase 0A picks it up)
cd packages/cli && bun run db:migrate                                        # exit 0
sqlite3 ~/.mconnect/sessions.db "SELECT name FROM sqlite_master WHERE type='table' AND name='scrollback_fts';" \
  | grep -q scrollback_fts                                                   # exit 0
sqlite3 ~/.mconnect/sessions.db "SELECT name FROM schema_migrations" | grep -q "002_scrollback_fts.sql"   # exit 0

# Regression: existing flow
npx lecoder-mconnect doctor                                                  # all checks pass
npx lecoder-mconnect start --preset shell-only --yes --json --port 8765 & sleep 5
curl -s http://localhost:8765/health | jq -e '.status == "ok"'               # exit 0
kill %1

# Desktop attach
cd packages/desktop && bun run e2e -- e2e/phase-1-attach.spec.ts             # exit 0; spec asserts session list non-empty after CLI start, terminal panel renders 100 lines after 1 KB scrollback fixture
```

**Shippable**: `packages/desktop@0.1.0-alpha`. Distributed via GitHub releases unsigned (signing in Phase 5).

### Phase 2 — (rolled into Phase 1; no separate phase. v0 had Phase 2 here; absorbed.)

### Phase 3 — Worktree isolation + fork/resume + IDE diff panel (Weeks 8-10)

**Deliverables**:
- `packages/worktree/` new package: `WorktreeRuntime` adapter wrapping `git worktree`. API: `create({ agentId, baseBranch })`, `list()`, `cleanup({ agentId })`, `gcDangling({ runningAgentIds })`. Tests cover dirty workspace, branch collision, crash recovery (kill mid-create, GC sweeps).
- CLI integration via opt-in `--worktree` flag: `mconnect start --worktree --preset research-spec-test` creates a worktree per agent under `.shards/<agent-id>/`.
- Fork/resume: new migration `packages/cli/migrations/003_scrollback_message_id.sql` adding `message_id INTEGER` column to scrollback (autoincrement per session). Fork operation: `desktop:fork` v3.1 message takes `(session_id, message_id)`, creates new session with scrollback rows where `message_id <= N` copied; original session continues. Resume: `desktop:resume` takes `session_id`, replays full scrollback into new attach.
- IDE diff panel: `packages/desktop/src/diff-panel/` renders inline + side-by-side; toggle in settings. Tauri "Claude IDE MCP emulator" registration optional, off by default.
- Session grid overview: `packages/desktop/src/grid/` shows live mini-terminals for all attached sessions.

**Verification gate (mechanical)**:
```bash
# Worktree
cd packages/worktree && bun test                                             # exit 0; coverage ≥ 75% statements
cd /tmp && git init test-repo && cd test-repo && git commit --allow-empty -m init
mconnect start --worktree --preset research-spec-test --yes --json &         # spawns 3 agents
sleep 10
test "$(git worktree list | wc -l)" -eq 4                                    # 1 main + 3 agent worktrees
kill %1; sleep 5
test "$(git worktree list | wc -l)" -eq 1                                    # cleanup verified

# Fork/resume
cd packages/desktop && bun run e2e -- e2e/phase-3-fork-resume.spec.ts        # exit 0; spec asserts new session has scrollback_count(N) == fork_message_id, resume replays exactly N + 1 lines

# IDE diff
cd packages/desktop && bun run e2e -- e2e/phase-3-diff-panel.spec.ts         # exit 0; spec asserts inline + side-by-side renders + accept/reject persists to file
```

**Shippable**: `packages/desktop@0.2.0-beta` + `lecoder-mconnect@0.2.0-beta` with `--worktree`.

### Phase 4 — Soak + cross-platform hardening + iOS compat (Weeks 11-12)

**Deliverables (Critic-reduced — Opik dashboards/evals + signed-updater regression both moved to Phase 5/6)**:
- 24-hour multi-agent terminal soak in CI: 3 agents in worktrees, simulated input every 10s, resize storm every 5min, fork+resume every 30min. Pass = no PTY leak, no worktree leak, RAM steady-state within ±10% of t=1h baseline. Required: 3 consecutive nightly runs green.
- DB migration test: load fixture `packages/cli/__tests__/fixtures/legacy-v0.1.10-sessions.db`; run `bun run db:migrate`; assert all v0.1.10 sessions readable via v0.2.0 code; assert FTS5 + message_id columns added without data loss.
- OAuth token storage security audit: confirm tokens not written to scrollback, not logged, encrypted at rest in OS keychain via Tauri secure-store plugin (Tauri runtime) or `keytar` equivalent (Electron runtime if 0C triggered).
- Provider contract tests: fixture WS server replays canonical Claude / Gemini / Cursor / Aider prompt-response sequences; CLI under test must produce identical output.
- iOS regression: run existing TestFlight build against new server (with v3.1 capability negotiation). Asserts v3.0 client ignores v3.1 messages without disconnect.
- **Unsigned-binary install smoke** (replaces v1's signed-updater regression which had release-order bug): unsigned dmg/AppImage/msi from Phase 1+3 builds installs cleanly on a fresh VM and runs hard-gate spike. Signed-binary updater regression moves to Phase 5 (after signing actually exists).
- Opik **spans** added (instrumentation only — dashboard/eval setup deferred to Phase 6): `desktop.session_attach`, `desktop.fork`, `desktop.resume`, `worktree.create`, `worktree.cleanup`, `worktree.gc`. Spans must appear in Opik dev project; dashboard configuration + eval scoring happens in Phase 6 polish.

**Verification gate (mechanical)**:
```bash
# Soak (CI job ci-soak-24h, scheduled nightly during Phase 4 via .github/workflows/soak.yml)
gh run list --workflow=soak.yml --limit=3 --json conclusion \
  | jq -e 'all(.[]; .conclusion == "success")'                               # exit 0 for 3 consecutive nights green

# Migration
cd packages/cli && bun test __tests__/migrations/legacy-v0.1.10.test.ts      # exit 0

# Provider contract
cd packages/cli && bun test __tests__/providers/contract/                    # exit 0; ≥ 4 providers covered

# iOS regression (manual + scripted)
cd packages/ios-app && xcodebuild -scheme MConnect test \
  -destination 'platform=iOS Simulator,name=iPhone 15'                      # exit 0; includes new test asserting v3.0 client + v3.1 server interop

# Opik
curl -s "$OPIK_URL/projects/$OPIK_PROJECT/spans?type=worktree.create" \
  | jq -e '.spans | length > 0'                                             # exit 0
```

### Phase 5 — Code-signing + distribution + auto-update + signed updater regression (Week 13)

**Added** (moved from Phase 4 to fix release-order bug): once signing exists, run signed-updater regression — install previous signed dmg from Phase 5 dry-run, push new tag, app receives update notification within shortened 60s test window, new signed binary installs cleanly. This was impossible in Phase 4 because no signed binary existed yet.


**Deliverables**:
- macOS notarization via `tauri-action` GitHub Action: CSC_LINK + CSC_KEY_PASSWORD secrets configured in `.github/workflows/release.yml`. Output: signed + notarized dmg.
- Linux: AppImage signed via gpg, .deb signed.
- Windows: best-effort code-signing with self-signed cert; documented limitation in release notes that Windows users will see SmartScreen warning until EV cert acquired (out of v0.2.0 scope).
- Auto-update: Tauri updater plugin pointed at GitHub Releases; `update-manifest.json` published on tag.
- Auto-update e2e: install previous release, push new release tag, assert app receives update notification within 4h check window (test uses shortened 60s interval via env var).

**Verification gate (mechanical)**:
```bash
# Release dry-run
GH_TOKEN=$GITHUB_TOKEN gh release create v0.2.0-rc1 --draft --generate-notes
ls dist/*.dmg dist/*.AppImage dist/*.deb dist/*.msi                         # all present
codesign -dv dist/MConnect.app 2>&1 | grep "Authority=Developer ID Application: Arya"   # exit 0
spctl -a -t exec -vv dist/MConnect.app 2>&1 | grep "accepted"                # exit 0 (notarized)

# Updater e2e (canonical spec name: phase-5-signed-updater.spec.ts; same name used in §10)
cd packages/desktop && bun run e2e -- e2e/phase-5-signed-updater.spec.ts     # exit 0
```

### Phase 6 — Opik dashboards + release notes + demo + blog (varies by schedule)

**Calendar (v4 corrects v3's contradictory Phase 6 wording per Critic v3)**:
- **14-wk baseline (no 0C, no signing slip)**: Phase 6 runs Week 14, launch Week 14.
- **15-wk (0C triggered, no signing slip)**: Phase 0C runs Week 3 (consumed pre-Phase-1); Phase 1 starts Week 6 instead of Week 5; Phase 6 runs Week 15, launch Week 15.
- **16-wk (0C triggered + signing slip)**: as 15-wk above plus Phase 5 takes Weeks 13-14; Phase 6 runs Week 16, launch Week 16.

These are the only three valid calendars; ralph picks the one matching reality at end of Phase 0B / Phase 5.

**Includes (moved from Phase 4)**: Opik dashboard configuration for the spans instrumented in Phase 4, plus 4 new feedback scores: **Worktree Hygiene** (0–1, no leaks under soak), **Fork Fidelity** (0–1, scrollback row counts match expectation), **Cold-Start TTI** (perf score), **Idle PSS** (perf score).


**Deliverables**:
- README, CHANGELOG, ROADMAP updated for v0.2.0.
- Demo video (Loom or YouTube) showing: open desktop → list sessions → spawn 3 agents w/ worktree → fork session → resume → see live grid → IDE diff accept.
- Blog post on lecoder.lesearch.ai.
- Tagged release `v0.2.0`. Bump `lecoder-mconnect@0.2.0`, `@lecoder/desktop@0.2.0`, `@lecoder/worktree@0.2.0`.

**Verification gate (mechanical)**:
```bash
git tag -l | grep "^v0.2.0$"                                                 # exit 0
gh release view v0.2.0 --json assets | jq -e '.assets | length >= 4'         # exit 0
test -f apps/website/src/app/blog/v0-2-0-launch/page.mdx                     # exit 0
grep "v0.2.0" README.md CHANGELOG.md ROADMAP.md                              # all present
```

---

## 6. Pre-mortem (deliberate mode — 4 scenarios, addresses Critic FAIL: missing protocol-drift scenario)

### Scenario 1 — *Tauri Windows terminal bridge fails*

**Causes**: Tauri 2.0 webview2 ↔ node-pty IPC has Windows-specific framing bug. Switchboard/Orchestrator/jcode all chose Electron in part for this reason.

**Mitigations baked in**:
- Phase 0 hard gate runs on Windows CI runner.
- **Kill criterion is in Phase 0 itself, NOT Phase 5**: failure = swap to Electron before Phase 1 UI work. 1-week Electron swap reserved in Phase 0 budget.
- Phase 4 cross-platform soak repeats on Windows.

### Scenario 2 — *Worktree cleanup leaves dangling state on crash*

**Causes**: `mconnect` killed mid-worktree-create; agent process exits without invoking cleanup hook.

**Mitigations baked in**:
- `WorktreeRuntime.gcDangling({ runningAgentIds })` runs on every CLI startup; sweeps `.shards/` directories whose agent ID is not in current session registry.
- Phase 3 verification gate explicitly tests the kill-mid-flow scenario.
- Phase 4 soak runs 24h with simulated kills every 30min and asserts no leaked worktrees.

### Scenario 3 — *Fork/resume corrupts session state for the original session*

**Causes**: Fork copies scrollback rows; if FK constraint or trigger misfires, original session loses rows or gains duplicate `(session_id, line_number)` pairs.

**Mitigations baked in**:
- Migration `003_scrollback_message_id.sql` adds `message_id` column without altering existing PK `(session_id, line_number)`. Fork copies via `INSERT INTO scrollback SELECT ... FROM scrollback WHERE session_id = ? AND message_id <= ?` into a new `session_id`.
- Phase 3 e2e asserts row counts match expectation in BOTH original and forked session after fork.
- Phase 4 soak runs fork every 30min for 24h; assertion at end: original session row counts strictly monotonically increasing, forked sessions have exact expected lengths.

### Scenario 4 — *Protocol/auth migration drift breaks iOS pairing + desktop attach* (NEW — addresses Critic-required missing pre-mortem)

**Causes**: Desktop ships against v3.1 message families (`desktop:*`, `worktree:*`); CLI was at v2.0 silently `console.warn`-and-drop on unknown messages (`packages/cli/src/ws/ws-hub.ts:524-526`); shared/server/iOS were already v3.0; iOS returns nil for unknown server types (`packages/ios-app/.../Protocol.swift:391-452`). Without **explicit capability negotiation**, desktop and iOS appear connected but miss critical state messages, and the failure is silent.

**Mitigations baked in (every one cites a Phase deliverable + verification gate)**:
- Phase 0A deliverable: capability negotiation in `packages/shared/src/protocol/messages.ts` + typed `unsupported_capability` error replacing silent drop. Verified by AC11.
- Phase 0A deliverable: CLI catch-up to `PROTOCOL_VERSION = '3.0'`. No desktop work begins until this is merged + green in CI.
- Phase 0A deliverable: **`docs/protocol/v3.1-migration.md` compatibility matrix doc** with required sections (capability matrix / required for v0.2.0 / backward-compatible / hard errors). Verified mechanically in Phase 0A gate (`grep -q "^## Capability matrix"`) and in AC18.
- Phase 4 deliverable: iOS regression test specifically asserts old TestFlight v3.0 build interoperates with new v3.1 server without disconnect.
- Rollback plan: feature flag `MCONNECT_DISABLE_V3_1` in CLI + desktop falls back to v3.0-only message set.

---

## 7. Expanded test plan (deliberate mode, addresses Critic FAIL: under-resourced for cross-platform release)

### 7.1 Unit (per-package)
- `packages/desktop/__tests__/`: Tauri command serializers, session-list aggregation, fork-message-id math, status-notification dispatcher, perf-budget threshold checker, FTS5 query builder.
- `packages/worktree/__tests__/`: create/list/cleanup happy path; dirty workspace; branch-name collision; crash recovery (mid-create kill → GC sweeps); concurrent create on same branch.
- `packages/cli/__tests__/migrations/`: 002_scrollback_fts and 003_scrollback_message_id apply against fixture v0.1.10 db without data loss.
- Coverage thresholds: existing CLI thresholds preserved EXCEPT new protocol code under `packages/cli/src/ws/` is no longer covered by the blanket `src/ws/**` exclusion at `packages/cli/vitest.config.ts:42` (line 42, not 41 — Critic v3 line-number fix). Phase 0A1 deliverable: **remove the blanket `src/ws/**` exclusion entirely** and replace with explicit per-file exclusions for files we choose to skip (e.g. legacy v2 hub paths during transition); new files (`auth-bridge.ts`, any v3.1 handlers) inherit the new-package thresholds (**75% statements / 70% branches / 70% functions**). Without this fix, the riskiest new CLI code lands with zero coverage measurement.

### 7.2 Integration
- Desktop ↔ CLI bridge: spin up CLI under PTY, desktop attaches via WebSocket, exchange 100 messages, no drops. **Repeats for v3.0 client + v3.1 client + mismatched-capability scenarios.**
- Worktree multi-agent: 3 agents in same repo via worktrees; verify isolation by writing conflicting changes from each.
- iOS protocol-v3.0 backward compat: build current TestFlight iOS app against new v3.1 server.
- Cross-platform desktop install: dmg on macOS arm64; AppImage on Ubuntu 24.04; .deb on Debian 13; msi on Windows 11.

### 7.3 E2E
- **Fork-and-resume happy path**: open desktop → start session → run 5 turns → fork at message 3 → assert new session scrollback count == 3, original count == 5+ (new turns OK).
- **Cold-start perf**: desktop cold-start TTI ≤ 2.5 s on M-series Mac and Linux x64; PSS ≤ 220 MB idle / ≤ 320 MB w/ 5 sessions.
- **iOS pairing flow**: scan QR from desktop sidebar → iOS connects → terminal flows in iOS app unchanged from v0.1.10.
- **Cross-platform CI matrix**: ci-build-macos, ci-build-linux, ci-build-windows, ci-hard-gate-macos, ci-hard-gate-linux, ci-hard-gate-windows, ci-e2e-macos, ci-e2e-linux. **All required for merge.**

### 7.4 Soak / release-engineering (NEW per Critic)
- **24-hour multi-agent soak**: scheduled nightly in Phase 4. Pass = 3 consecutive nights green.
- **Notarization e2e**: signed + notarized dmg installs cleanly on a fresh macOS VM (codesign + spctl assertions in §5).
- **Updater e2e**: install previous release → push new tag → app receives update within shortened 60s test window.
- **Worktree crash recovery**: kill `mconnect` SIGKILL during worktree create; assert next `mconnect start` GCs the dangling worktree.
- **DB migration regression**: fixture v0.1.10 db migrates to v0.2.0 schema without data loss; round-trip query equality.
- **OAuth token security**: assert tokens not in scrollback rows, not in CLI logs, present in OS keychain only.
- **Provider contract**: replay canonical Claude / Gemini / Cursor / Aider sequences; assert deterministic output.
- **iOS WKWebView regression**: deferred since iOS side-panel is out of v0.2.0 scope. Re-enable in v0.3.x.

### 7.5 Observability
- Opik spans added: `desktop.session_attach`, `desktop.fork`, `desktop.resume`, `worktree.create`, `worktree.cleanup`, `worktree.gc`.
- New Opik feedback scores: **Worktree Hygiene**, **Fork Fidelity**, **Cold-Start TTI**, **Idle PSS**.
- Perf-budget script writes `.omc/perf-budget/<date>.json`; CI fails on regressions > 10% over rolling 7-day median.
- Compatibility matrix dashboard: which capability negotiation paths are exercised in production traces (so we can flag silent-drop scenarios in real users).

---

## 8. Acceptance criteria (revised, addresses Critic FAIL: vague/false ACs)

Every AC is **fixture path + command + expected deterministic assertion**. Ralph executes mechanically.

| # | Criterion | Fixture / command | Expected assertion |
|---|---|---|---|
| AC1 | `packages/desktop` builds clean on macOS arm64, Linux x64, **Windows x64** in CI | CI jobs `ci-build-macos`, `ci-build-linux`, `ci-build-windows` | All three green on PR-to-main |
| AC2 | Cold-start TTI ≤ 2.5 s on M-series Mac | `cd packages/desktop && bun run perf-budget --metric=tti --platform=macos` | Output JSON `tti_ms` ≤ 2500 |
| AC3 | Idle PSS ≤ 220 MB w/ 1 session, ≤ 320 MB w/ 5 sessions | `cd packages/desktop && bun run perf-budget --metric=pss --sessions=1,5` | JSON `pss_mb_1session` ≤ 220 AND `pss_mb_5sessions` ≤ 320 |
| AC4 | Existing `lecoder-mconnect@0.1.10` flow regression: start → QR → 10 commands → exit | `bun test packages/cli/__tests__/regression/v0_1_10.test.ts` | exit 0 |
| AC5 | Desktop session browser lists every CLI session with last-activity timestamp | Fixture: `packages/cli/__tests__/fixtures/3-session-store.db`. `bun run e2e -- e2e/ac-5-session-list.spec.ts` | JSON output array length == 3, each row has `last_activity_iso` non-null |
| AC6 | FTS5 search returns rows with `(session_id, line_number, snippet)` | Fixture: 1KB scrollback w/ known token "QUICKBROWNFOX". `sqlite3 ~/.mconnect/sessions.db "SELECT session_id, line_number, snippet(scrollback_fts) FROM scrollback_fts WHERE scrollback_fts MATCH 'QUICKBROWNFOX'"` | Returns ≥ 1 row matching fixture-line ID |
| AC7 | Fork from message_id N produces new session whose scrollback row count == N | Fixture: 10-message session. `bun run e2e -- e2e/ac-7-fork.spec.ts` | New session scrollback `COUNT(*) == 5` for fork_at=5 |
| AC8 | Up to 10 concurrent agents in one repo with `--worktree`, each isolated under `.shards/<agent-id>/`, cleanup on exit | `bun test packages/worktree/__tests__/integration/10-agent.test.ts` | All 10 worktrees created, all 10 cleaned up after kill |
| AC9 | Worktree GC sweeps dangling worktrees from prior crash | `bun test packages/worktree/__tests__/integration/crash-gc.test.ts` | After SIGKILL during create + restart, `git worktree list` length == 1 |
| AC10 | iOS `protocolVersion = "3.0"` build interoperates with new v3.1 server | `cd packages/ios-app && xcodebuild test -only-testing:MConnectTests/V3InteropTests` | exit 0 |
| AC11 | Capability negotiation: client missing capability X gets typed `unsupported_capability` warning, not silent drop | `bun test packages/cli/__tests__/protocol/capability-negotiation.test.ts` | Test asserts `warning` event emitted with `code: 'UNSUPPORTED_CAPABILITY'` |
| AC12 | Migration `002_scrollback_fts.sql` and `003_scrollback_message_id.sql` apply to fixture v0.1.10 db without data loss | `bun test packages/cli/__tests__/migrations/legacy-v0.1.10.test.ts` | Pre/post row counts equal; new columns added |
| AC13 | Signed + notarized dmg installs cleanly on fresh macOS VM | CI job `ci-release-macos`. `codesign -dv dist/MConnect.app` and `spctl -a -t exec -vv dist/MConnect.app` | First contains `Authority=Developer ID Application: Arya`; second contains `accepted` |
| AC14 | Auto-update e2e: previous release receives update within shortened 60s window | `bun run e2e -- e2e/ac-14-updater.spec.ts` | Update notification fires within 60s, new version installs |
| AC15 | 24-hour soak: 3 consecutive nights green | `gh run list --workflow=soak.yml --limit=3 --json conclusion \| jq -e 'all(.[]; .conclusion == "success")'` (workflow file: `.github/workflows/soak.yml`) | exit 0 |
| AC16 | Opik **spans** present for desktop+worktree ops (instrumentation) | Phase 4 deliverable. `curl -s "$OPIK_URL/projects/$OPIK_PROJECT/spans?type=desktop.session_attach" \| jq -e '.spans \| length > 0'` repeated for each of the 6 span types | exit 0 for each |
| AC17 | Opik **feedback scores** configured in Phase 6 — 4 scores total: Worktree Hygiene, Fork Fidelity, Cold-Start TTI, Idle PSS | `curl -s "$OPIK_URL/projects/$OPIK_PROJECT/feedback-definitions" \| jq -e '[.definitions[].name] \| inside(["Worktree Hygiene","Fork Fidelity","Cold-Start TTI","Idle PSS"])'` | exit 0 |
| AC18 | `docs/protocol/v3.1-migration.md` exists with all required sections AND lists every v3.1 capability shipped in v0.2.0 | `test -f docs/protocol/v3.1-migration.md && grep -q "^## Capability matrix" docs/protocol/v3.1-migration.md && grep -q "^## Required for v0.2.0" docs/protocol/v3.1-migration.md && grep -q "desktop:session_list" docs/protocol/v3.1-migration.md && grep -q "worktree:lifecycle" docs/protocol/v3.1-migration.md` | exit 0 |
| AC19 | **Mobile-first wedge** (Critic-required, harness specified below): desktop spawns session → iOS attaches via QR → kill from iOS → desktop reflects state change within 500ms | CI job `ci-e2e-ios-continuity` (defined in `.github/workflows/ios-continuity.yml`); see harness §8.1 below | exit 0; spec asserts desktop `session_state` event arrives ≤ 500ms after iOS kill (monotonic clock from `process.hrtime.bigint()`) |
| AC20 | Sidecar contract test passes for default TS adapters (proves the Rust-swap surface is real, not theater) | `bun test packages/shared/src/__tests__/sidecar-contract.test.ts` | exit 0 |

### 8.1 AC19 mobile-first wedge harness (Critic-required, mechanically executable, v4 rewrite per Critic v3 findings)

CI job `ci-e2e-ios-continuity` runs on `macos-14` runner only (requires Xcode + iOS Simulator). Workflow file: `.github/workflows/ios-continuity.yml`. Driver is **Node test runner** (uses `process.hrtime.bigint()` monotonic clock per AC19 contract — fixes v3 wall-clock bug); shell `xcrun simctl` calls are spawned from Node.

**All AC19 prerequisites (CLI `--json pairingUrl`, iOS URL routing for `mconnect://pair`, `session_kill` v3.1 message, iOS `WSClient.killSession()`, `MCONNECT_TEST_AUTOKILL` env hook, desktop `dev:test` HTTP probe) are explicit Phase 1 deliverables.**

```typescript
// packages/desktop/e2e/ac-19-ios-continuity.spec.ts
import { spawn, spawnSync } from 'node:child_process';
import { hrtime } from 'node:process';
import { test, expect } from 'vitest';
import { setTimeout as sleep } from 'node:timers/promises';
import { readUntilJson, waitForProbe } from './helpers';  // packages/desktop/e2e/helpers.ts: readUntilJson reads stdout until valid JSON object emerges; waitForProbe polls URL until 200 or timeout

test('AC19: iOS kill propagates to desktop within 500ms', async () => {
  // 1. Boot iOS Simulator
  spawnSync('xcrun', ['simctl', 'shutdown', 'all']);
  spawnSync('xcrun', ['simctl', 'boot', 'iPhone 15']);
  spawnSync('xcrun', ['simctl', 'bootstatus', 'iPhone 15', '-b']);

  // 2. Build + install iOS app — uses existing 'MConnect' scheme (verified at packages/ios-app/MConnect.xcodeproj/xcshareddata/xcschemes/MConnect.xcscheme:20). MCONNECT_TEST_AUTOKILL passed at simulator launch via SIMCTL_CHILD_* env (per Architect v4).
  const buildPath = 'packages/ios-app/build/Build/Products/Debug-iphonesimulator/MConnect.app';
  spawnSync('xcodebuild', ['-scheme', 'MConnect',
    '-destination', 'platform=iOS Simulator,name=iPhone 15',
    '-derivedDataPath', 'packages/ios-app/build/', 'build'], { cwd: '.' });
  spawnSync('xcrun', ['simctl', 'install', 'iPhone 15', buildPath]);

  // 3. Start CLI in test mode, read pairingUrl from --json output
  const cli = spawn('mconnect', ['start', '--preset', 'shell-only', '--yes', '--json', '--port', '8765']);
  const cliJson = await readUntilJson(cli.stdout);
  const pairingUrl = cliJson.pairingUrl;  // Phase 1 deliverable: CLI --json now emits pairingUrl
  expect(pairingUrl).toMatch(/^mconnect:\/\/pair\?/);

  // 4. Launch desktop dev:test build, attach to session via HTTP probe
  const desktop = spawn('bun', ['run', 'dev:test'], { cwd: 'packages/desktop' });
  await waitForProbe('http://localhost:7777/health', 10_000);
  await fetch('http://localhost:7777/attach', {
    method: 'POST', body: JSON.stringify({ sessionId: cliJson.sessionId })
  });

  // 5. Open pairing URL on iOS — routes via .onOpenURL → handleQRCode (Phase 1 deliverable in MConnectApp.swift)
  spawnSync('xcrun', ['simctl', 'openurl', 'booted', pairingUrl]);
  await sleep(2000);  // iOS pair flow completes

  // 6. Re-launch iOS with SIMCTL_CHILD_MCONNECT_TEST_AUTOKILL=1; app reads env on becoming active and calls WSClient.killSession()
  //    Bundle id verified lowercase 'com.lecoder.mconnect' at packages/ios-app/MConnect.xcodeproj/project.pbxproj:586 (Architect v4 fix)
  spawnSync('xcrun', ['simctl', 'terminate', 'iPhone 15', 'com.lecoder.mconnect']);
  const t0 = hrtime.bigint();
  spawnSync('xcrun', ['simctl', 'launch', 'iPhone 15', 'com.lecoder.mconnect'], {
    env: { ...process.env, SIMCTL_CHILD_MCONNECT_TEST_AUTOKILL: '1' }
  });

  // 7. Long-poll desktop probe; assert latency ≤ 500ms using monotonic clock
  const result = await fetch('http://localhost:7777/wait?event=session_state&value=killed&timeoutMs=2000');
  expect(result.status).toBe(200);
  const t1 = hrtime.bigint();
  const latencyMs = Number((t1 - t0) / 1_000_000n);
  expect(latencyMs).toBeLessThanOrEqual(500);

  // 8. Cleanup
  desktop.kill(); cli.kill();
  spawnSync('xcrun', ['simctl', 'shutdown', 'all']);
});
```

Run via `bun run e2e -- e2e/ac-19-ios-continuity.spec.ts` (vitest as runner). Workflow file installs Xcode + boots simulator on `macos-14`. CI job name: `ci-e2e-ios-continuity`. **Required for merge to main from Phase 1 onward.**

## 9. Risks & mitigations (every mitigation cites a concrete deliverable in §5)

| Risk | Likelihood | Impact | Mitigation (with §5 deliverable reference) |
|---|---|---|---|
| Tauri 2.0 cross-platform terminal bridge instability | M | H | Phase 0 hard gate `packages/desktop/scripts/hard-gate.ts` runs on mac+linux+win; **kill criterion = swap to Electron BEFORE Phase 1**, 1-week swap budget reserved IN Phase 0. |
| Protocol v2/v3 split-brain (CLI v2 vs shared/server/iOS v3) | H (today) | H | Phase 0 deliverable: CLI catch-up to `PROTOCOL_VERSION = '3.0'` + capability negotiation + typed `unsupported_capability` replacing silent drop at `packages/cli/src/ws/ws-hub.ts:524-526`. |
| Worktree cleanup leaks under crash | M | M | `WorktreeRuntime.gcDangling()` runs on every CLI startup; Phase 3 e2e covers kill-mid-create; Phase 4 soak runs 24h with kills every 30min. |
| Fork/resume corrupts original session | M | H | Migration `003_scrollback_message_id.sql` preserves PK; fork via INSERT-SELECT into new session_id; Phase 3 e2e asserts row counts in BOTH sessions; Phase 4 soak runs fork every 30min for 24h. |
| iOS App Store re-review delay if protocol churn | L | H | All v3.1 additions capability-gated; iOS not modified in v0.2.0; Phase 4 iOS regression test explicitly asserts old TestFlight build interoperates with new server. |
| FTS5 schema migration corrupts existing v0.1.10 db | L | H | Migration test `__tests__/migrations/legacy-v0.1.10.test.ts` uses fixture db; Phase 4 explicit DB migration regression test in §7.4. |
| Code-signing fails in Phase 5 (cert expiry, notarization timeout) | M | M | Dry-run release in Phase 5 verification gate; documented fallback to unsigned distribution + GitHub release notes warning. Self-signed Windows acceptable per §5. |
| Scope creep into memory/swarm/OAuth during execution | M | M | Plan §13 (out of scope) is binding for ralph. Any deviation requires a new consensus loop. |
| Codex / Claude model deprecation mid-cycle | L | M | Provider contract tests (§7.4) replay fixture sequences; failure surfaces immediately. No model version pinning required because tests use deterministic fixtures, not live providers. |

## 10. Verification steps (revised, addresses Critic FAIL: mechanical executability)

Every step is a one-line shell command with an expected exit code. Manual checks isolated to a separate "manual gate" section that ralph escalates to user.

### 10.1 Per-package mechanical (ralph runs all)
```bash
# Phase 0A (protocol + interfaces + sidecar contract + migration runner + v3.1 doc)
grep "PROTOCOL_VERSION = '3.0'" packages/cli/src/ws/protocol.ts                            # exit 0
grep "client_capabilities" packages/shared/src/protocol/messages.ts                        # exit 0
grep "unsupported_capability" packages/cli/src/ws/v3-handlers.ts                           # exit 0
test -f packages/shared/src/interfaces/TerminalBridge.ts                                   # exit 0
test -f packages/shared/src/interfaces/WorktreeRuntime.ts                                  # exit 0
test -f packages/shared/src/interfaces/sidecar-schema.ts                                   # exit 0
test -d packages/shared/src/__tests__/fixtures/sidecar                                     # exit 0
bun test packages/shared/src/__tests__/sidecar-contract.test.ts                            # exit 0
test -f docs/protocol/v3.1-migration.md                                                    # exit 0
grep -q "^## Capability matrix" docs/protocol/v3.1-migration.md                            # exit 0
grep -q "^## Required for v0.2.0" docs/protocol/v3.1-migration.md                          # exit 0
jq -e '.scripts."db:migrate"' packages/cli/package.json                                    # exit 0
test -f packages/cli/scripts/migrate.ts                                                    # exit 0
cd packages/cli && bun run db:migrate                                                      # exit 0

# Phase 0B (desktop hard-gate)
cd packages/desktop && bun run hard-gate -- --platform=macos                               # exit 0
cd packages/desktop && bun run hard-gate -- --platform=linux                               # exit 0
cd packages/desktop && bun run hard-gate -- --platform=windows                             # exit 0

# Phase 1 (desktop MVP)
npm run build                                                                              # exit 0
sqlite3 ~/.mconnect/sessions.db "SELECT name FROM sqlite_master WHERE name='scrollback_fts'" | grep -q scrollback_fts   # exit 0
npx lecoder-mconnect doctor                                                                # exit 0
bun test packages/cli/__tests__/regression/v0_1_10.test.ts                                 # exit 0

# Phase 3 (worktree + fork/resume + IDE diff)
bun test packages/worktree                                                                 # exit 0; coverage ≥ 75%
cd packages/desktop && bun run e2e -- e2e/phase-3-fork-resume.spec.ts                      # exit 0
cd packages/desktop && bun run e2e -- e2e/ac-19-ios-continuity.spec.ts                     # exit 0  (mobile-first wedge AC19)

# Phase 4 (soak + DB migration + iOS compat + Opik spans, NO signed-binary tests)
bun test packages/cli/__tests__/migrations/legacy-v0.1.10.test.ts                          # exit 0
bun test packages/cli/__tests__/providers/contract/                                        # exit 0
cd packages/ios-app && xcodebuild test -only-testing:MConnectTests/V3InteropTests          # exit 0
gh run list --workflow=soak.yml --limit=3 --json conclusion | jq -e 'all(.[]; .conclusion == "success")'   # exit 0 (3 consecutive nightly soaks green)
curl -s "$OPIK_URL/projects/$OPIK_PROJECT/spans?type=worktree.create" | jq -e '.spans | length > 0'        # exit 0

# Phase 5 (signing + signed updater regression — moved here from Phase 4)
codesign -dv dist/MConnect.app 2>&1 | grep -q "Authority=Developer ID Application: Arya"   # exit 0
spctl -a -t exec -vv dist/MConnect.app 2>&1 | grep -q "accepted"                           # exit 0
cd packages/desktop && bun run e2e -- e2e/phase-5-signed-updater.spec.ts                   # exit 0

# Phase 6 (Opik dashboards + release notes + demo)
curl -s "$OPIK_URL/projects/$OPIK_PROJECT/feedback-definitions" \
  | jq -e '[.definitions[].name] | inside(["Worktree Hygiene","Fork Fidelity","Cold-Start TTI","Idle PSS"])'   # exit 0
git tag -l | grep -q "^v0.2.0$"                                                            # exit 0
gh release view v0.2.0 --json assets | jq -e '.assets | length >= 4'                       # exit 0
```

### 10.2 CI job names (required for merge to main)
- `ci-build-macos`, `ci-build-linux`, `ci-build-windows`
- `ci-typecheck-all`
- `ci-test-cli`, `ci-test-server`, `ci-test-shared`, `ci-test-desktop`, `ci-test-worktree`
- `ci-e2e-macos`, `ci-e2e-linux`
- `ci-hard-gate-macos`, `ci-hard-gate-linux`, `ci-hard-gate-windows`
- `ci-soak-24h` (nightly during Phase 4, then weekly)
- `ci-perf-budget` (PR-time + nightly trend)
- `ci-release-macos`, `ci-release-linux`, `ci-release-windows` (tag-time only)

### 10.3 Manual gates (ralph escalates to user)
- Phase 5: Apple Developer cert renewal status, GH release notes review, blog draft review.
- Phase 6: Demo video review.

## 11. ADR — Architecture Decision Record (FINAL, not provisional)

**Decision**: For mconnect v0.2.0, build `packages/desktop` as Tauri 2.0 + React 19 + xterm.js + Zustand + Tailwind + Lucide + CodeMirror, **additive** to existing `packages/cli`, `packages/server`, `packages/shared`, `packages/ios-app`. Add new `packages/worktree` for git-worktree-per-agent isolation. Cut v0.2.0 scope to: desktop session manager + worktree isolation + fork/resume + IDE diff panel. Defer memory layer, swarm, multi-provider OAuth (beyond existing GitHub (Google is typed in shared but not registered in `packages/server/src/auth/providers/index.ts`)), iOS side panel, skill compounding, smfs, sub-swarms, voice control to v0.3.x. Catch the CLI up to `PROTOCOL_VERSION = '3.0'` (currently lagging at `'2.0'` while shared/server/iOS are already on `'3.0'`) as Phase 0 prerequisite, with capability negotiation replacing the current silent unknown-message drop.

**Drivers (unchanged from v0)**:
1. Time-to-shipped-desktop while iOS App Store momentum is high.
2. Preserve `lecoder-mconnect@0.1.10` (npm) + TestFlight stability.
3. Token-cost containment for memory + swarm features (justifying their deferral to v0.3.x).

**Alternatives considered**:
- **Option B (Hybrid Rust sidecar from day one)** rejected for v0.2.0: re-scored honestly at +3-4 weeks vs. Option A on the *same* product surface (Tauri's existing Rust toolchain in CI lowers Option B's marginal cost to ~30%, not 100% as the v0 plan incorrectly stated). Fails Driver #1 (time-to-shipped-desktop) at 12-week budget. **Kept on file as the Phase 6 follow-up candidate** with explicit re-evaluation triggers below.
- **Option C (Full Rust HUB plan)** rejected: 20+ week estimate violates Driver #1; full core rewrite directly violates user's "no rewrites" constraint #4.

**Why chosen**: Option A is the only path that satisfies all three drivers + the user's interview-locked architecture constraint while still delivering a credible Switchboard-style anchor in 12 weeks under the narrow scope. The Architect-suggested synthesis (TS interfaces + future Rust adapter swap) is incorporated into Phase 0 deliverables.

**Consequences**:
- Higher steady-state RAM than Rust would deliver. Acceptable per perf-budget §1 principle 4 (≤ 220 MB idle, ≤ 320 MB at 5 sessions, comparable to Switchboard/Orchestrator).
- v3.1 capability negotiation introduces a small migration burden on the iOS app at v0.3.x time (when iOS gains its own new capabilities).
- Memory + swarm features are deferred to v0.3.x; v0.2.0 product story is "best mobile-first session manager," not "best agent-coordination platform."
- Sunk planning effort in HUB plan's Rust workspace is parked, not lost; Phase 6 trigger criteria are explicit below.

**Follow-ups (with explicit triggers)**:
- **Re-evaluate Option B for v0.3.x**: a future Rust sidecar must pass `packages/shared/src/__tests__/sidecar-contract.test.ts` against the JSON-RPC fixtures in `packages/shared/src/__tests__/fixtures/sidecar/` (defined in Phase 0A). It is **not** a one-file change — it is a contract-test-passing exercise. Trigger: (a) measured perf gap > 30% under realistic load (worktree create p95 > 200 ms or RAM PSS w/ 10 sessions > 600 MB), OR (b) ≥ 3 community requests for Rust-core distribution.
- **Re-evaluate smfs FUSE/NFS mount**: triggered by (a) license clearance for vendored binaries, AND (b) memory layer in v0.3.x reaching beta.
- **Re-evaluate voice control (paseo parity)**: triggered by user-validated demand signal in v0.3.x research.
- **iOS side panel (Mermaid/diff/file)**: scheduled v0.3.x with WKWebView + mermaid.js (no Rust mermaid vendoring).

---

## 12. Changelog of applied improvements

## Open findings from Critic v4 (REVISE) — surfaced as risks ralph must resolve in-flight (max 5 iterations reached, no APPROVED verdict)

Per skill rule: max 5 consensus iterations exhausted without unanimous APPROVED. The plan ships to ralph with these explicit residual items, each of which is small + addressable during execution but was not closed during planning:

1. **CRITICAL — AC19 iOS direct-CLI pairing path underspecified.** Current `WSClient.swift:342-349` always sends JWT `AuthMessage` and disconnects without access token; QR parser at `HostListView.swift:188-201` treats `url.host` as hostname (so `mconnect://pair?host=&port=&token=` would be parsed as hostname `pair`). Phase 1 missed: iOS `LocalPairingAuthMessage` Codable + WSClient auth-mode selection per host + QR parser support for `mconnect://pair?host=&port=&token=` query schema + secure token storage on `Host` model + iOS unit tests for QR parse and local-pairing auth serialization. ralph **MUST** add these as Phase 1 deliverables before AC19 is run.
2. **MAJOR — server rejection test for `local_pairing_auth` not in any phase verification gate.** Plan asserts the test exists but Phase 0A1 verification doesn't run it. ralph **MUST** add `cd packages/server && bun test src/ws/__tests__/reject-local-pairing-auth.test.ts` to Phase 0A1 mechanical gate.
3. **MAJOR — buffer/calendar still has internal contradictions.** Phase 0B is Wks 3-4 (line 227); 0C triggers only after 0B (line 256); but Phase 6 calendar says "0C runs Week 3" (line 408 reference). Also ADR consequences mention 12-week implication while §1 principle 3 sets 14-week baseline. Correct calendar (per Critic v4): if 0C triggers, 0C = Week 5, Phase 1 = Wks 6-8, Phase 3 = Wks 9-11, Phase 4 = Wks 12-13, Phase 5 = Wk 14, Phase 6 = Wk 15. ralph picks the matching calendar at end of Phase 0B and updates the plan in-place.
4. **MINOR — `db:migrate` followup verification command** uses `./packages/cli/dist/config.js` which depends on a built dist; should run from repo root after explicit build, OR use a `tsx` invocation that doesn't require dist.
5. **MINOR — capability field casing inconsistency**: payload uses `clientCapabilities` (camelCase) in §5 line 144, `client_capabilities` (snake_case) in §5 line 145 + §10 grep. ralph picks one wire format (camelCase recommended for JS-native client) and updates all references.
6. **MINOR — `MCONNECT_TEST_AUTOKILL` lifecycle hook**: SwiftUI `App` doesn't expose `applicationDidBecomeActive`; need `AppDelegate` adapter or `@Environment(\.scenePhase)` change handler. ralph picks one when implementing AC19 prerequisites.

These are **explicit residual risks**, not unknowns. ralph should resolve each as part of Phase 0A1 / Phase 1 execution and amend this plan in-place under the changelog.

## Iteration history

- **v4 (2026-05-02, after Architect v3=REVISE + Critic v3=REJECT)** — final iteration. Both reviewers converged on 2 surviving CRITICAL blockers from v3 plus 3 majors:
  - **Pivoted CLI auth approach (CRITICAL #1 fix)**: Dropped "shared JWT validator" claim entirely (Critic v3: jose not in shared, JWT_SECRET singleton in server only, validator extraction would expand Phase 0A1 scope unacceptably). New approach: introduce v3.1 `local_pairing_auth` message with payload `{ pairingToken, version, clientCapabilities }`. CLI handles ONLY this (uses existing `packages/cli/src/security.ts` machinery); JWT-based `auth` message stays server-only. iOS uses local_pairing_auth when QR-pairing to CLI, JWT auth when connecting to Bun server. Honors §1 principle 1 better — no jose import in CLI; existing CLI security model preserved.
  - **AC19 harness rewritten (CRITICAL #2 fix)**: Now a Vitest TypeScript file `packages/desktop/e2e/ac-19-ios-continuity.spec.ts` (was bash script in v3). Uses `process.hrtime.bigint()` monotonic clock matching AC19 contract (was `date +%s%N` wall clock). Spawns `xcrun simctl` from Node. All 4 v3 code-grounded bugs addressed: (a) `pairingUrl` is now an explicit Phase 1 deliverable (CLI `--json` adds field), (b) iOS `.onOpenURL` routing for `mconnect://pair` is Phase 1 deliverable (modify `MConnectApp.swift:21-36`), (c) `session_kill` v3.1 message + `WSClient.killSession()` API are Phase 1 deliverables, (d) monotonic timing in test runner.
  - **Migration runner refactored to library function (Critic v3 major)**: Library `runMigrations(db, migrationsDir)` exported from `packages/cli/src/session/migrations.ts`. SessionStore constructor calls it directly with its own `db` + resolved `migrationsDir`. Script `packages/cli/scripts/migrate.ts` is thin wrapper resolving `dbPath` via `getDataDir()`. Test fixtures cover default/custom-MCONNECT_DATA_DIR/in-memory paths. v3's hardcoded `~/.mconnect/sessions.db` would have ignored test/daemon DBs.
  - **Phase 0B Windows CI workflow added as explicit deliverable (Critic v3 major)**: `.github/workflows/desktop-hard-gate.yml` with macos-14 + ubuntu-24.04 + windows-latest matrix; rust toolchain via `dtolnay/rust-toolchain@stable`; node 20 + bun; artifact upload; one green dry run before Phase 1. Current CI has zero Windows.
  - **Buffer accounting fixed (Critic v3 major)**: §5 Phase 6 now publishes 3 explicit calendars (14/15/16-wk) with concrete week numbers per phase. v3 said "Phase 6 still runs Week 14 but launch slips to Week 15" — internally contradictory. v4 says: 14-wk baseline → all phases stay; 15-wk → 0C consumes Wk 3, Phase 1 starts Wk 6, Phase 6 = Wk 15; 16-wk → also Phase 5 takes Wks 13-14, Phase 6 = Wk 16.
  - **Vitest exclusion line corrected to 42** (was 41) and wording changed from "include" to "remove blanket exclusion" per Critic v3 minor.
- **v3 (2026-05-02, after Architect v2=REVISE + Critic v2=REJECT)** — Critic escalated to ADVERSARIAL with two CRITICAL blockers, plus Architect's timeline credibility findings:
  - **Exception A added to §1 principle 1**: targeted modification of `packages/cli/src/ws/ws-hub.ts:241-275` auth path is now permitted (was forbidden in v1/v2 as "no edits to load-bearing core"). v3 acknowledges that v3 first-message JWT auth cannot be added without modifying the auth state machine. Modification is scoped (auth path only), dual-mode (v2 query-token + v3 JWT), and regression-tested. New file `packages/cli/src/ws/auth-bridge.ts` houses the dual-mode logic; ws-hub.ts change is dispatch-only. (Critic v2 CRITICAL #1.)
  - **Exception B added to §1 principle 1**: targeted modification of `packages/cli/src/session/SessionStore.ts:55` migration bootstrap is permitted with a baseline detection rule. If `sessions` table exists AND `schema_migrations` does not → create migrations table + mark `001_sessions.sql` applied without re-executing (the `001` SQL uses bare `CREATE TABLE`, not `IF NOT EXISTS`, so re-execution would fail). Covered by `packages/cli/__tests__/migrations/baseline-from-sessionstore.test.ts`. (Critic v2 CRITICAL #2.)
  - **Phase 0A split into 0A1 (CLI v3 auth migration + capability negotiation, Wk 1) + 0A2 (migration runner + sidecar contract + interfaces, Wk 2)**. v2's Phase 0A tried to do all of this in 1 week, which both reviewers said was impossible. (Architect v2 + Critic v2 FAIL.)
  - **Phase 0B extended to 2 weeks** (Wks 3-4). Cold Tauri 2.0 setup + 3-platform packaging + new Windows CI runner setup is not a 1-week task. (Both critics FAIL.)
  - **`MemoryIndex` and `FileWatcher` interfaces dropped from Phase 0A2**. They serve memory/swarm which are explicitly v0.3.x; carrying them in v0.2.0 Phase 0 inflates scope without delivering shipping value. (Critic v2: "Move non-anchor interfaces out of Phase 0A.")
  - **Baseline schedule extended to 14 weeks**. 12 weeks was self-imposed, not driver-required. Three published schedules: 14-wk baseline, 15-wk if 0C triggers, 16-wk if 0C+signing slip. Eliminates the v2 buffer double-count. (Both critics FAIL on 12-wk credibility + buffer accounting.)
  - **AC19 harness explicitly written in new §8.1**: simulator boot, app install, pairing URL injection via `xcrun simctl openurl`, desktop dev-test build with localhost HTTP probe, monotonic timing assertion, CI job name `ci-e2e-ios-continuity` and workflow file path. v2's AC19 was a placeholder. (Both critics FAIL.)
  - **Coverage exclusion fix in §7.1**: `packages/cli/vitest.config.ts:41` blanket `src/ws/**` exclusion does not apply to new files (`auth-bridge.ts`, `v3-handlers.ts`, new v3.1 handlers). They get new-package thresholds. (Critic v2 FAIL: "riskiest new CLI code can land with zero coverage impact.")
  - **Lingering "GitHub/Google" wording at lines 35, 117, 539** all replaced with "GitHub (Google is typed in shared but not registered)". (Both critics minor.)
  - **Spec name unified**: Phase 5 uses `e2e/phase-5-signed-updater.spec.ts` everywhere (was `phase-5-updater.spec.ts` in Phase 5 verification, `phase-5-signed-updater.spec.ts` in §10). (Critic v2 minor.)
  - **soak.yml replaced as a real command in Phase 4 verification gate**: `gh run list --workflow=soak.yml --limit=3 --json conclusion | jq -e 'all(.[]; .conclusion == "success")'`. v2 still listed the workflow file path as a "command" despite changelog claiming it was fixed. (Critic v2 minor.)
- **v2 (2026-05-02, after Architect + Critic round 2)** — both verdicts = REVISE on v1; same surgical set:
  - Split Phase 0 into 0A (protocol/interfaces/sidecar contract/migration runner/v3.1 doc, Week 1) + 0B (desktop hard-gate spike, Week 2) + 0C (conditional Electron fallback, +1 week if 0B kill criterion fires). Phase 6 buffer absorbs 0C. (Architect+Critic FAIL: Phase 0 over-stuffed in 2 weeks; Day-10 kill conflicted w/ 1-week swap reserve.)
  - Added `docs/protocol/v3.1-migration.md` as a Phase 0A deliverable + AC18 + §10 mechanical check. Was orphaned in v1 (mentioned in §6 Scenario 4 only). (Both critics FAIL.)
  - Added migration runner: `packages/cli/scripts/migrate.ts` + `db:migrate` script in `packages/cli/package.json`. Was missing in v1 (only `001_sessions.sql` existed; no runner). (Critic FAIL: command rot.)
  - Replaced all `--no-interactive` flag usages with `-y --json` (the actual CLI flags per `packages/cli/src/index.ts`). v1 invented a non-existent flag. (Critic FAIL: command rot.)
  - Replaced "Rust sidecar swap is a one-file change" with explicit JSON-RPC schema + fixture suite + `packages/shared/src/__tests__/sidecar-contract.test.ts` contract test. Future Rust sidecar must pass this suite — it's an exercise, not a one-line change. New AC20 verifies the test passes for TS adapters today. (Both critics FAIL: Rust-swap claim was theater.)
  - Moved signed-updater regression from Phase 4 → Phase 5 (Phase 4 cannot test signed binaries before Phase 5 actually signs them). Phase 4 now does unsigned-binary install smoke instead. (Both critics FAIL: release-order bug.)
  - Moved Opik dashboard config + 4 feedback scores from Phase 4 → Phase 6. Phase 4 keeps span instrumentation only. AC16 split into AC16 (spans) + AC17 (feedback scores), with all 4 scores named explicitly (Worktree Hygiene, Fork Fidelity, Cold-Start TTI, Idle PSS). (Critic minor: AC16 said "2 evals", §7.5 listed 4.)
  - Added AC19 (mobile-first wedge): desktop+iOS continuity round-trip with deterministic latency assertion. Critic surfaced that v1 ACs barely tested mobile-first value despite §11 ADR claiming "best mobile-first session manager." This AC makes the wedge testable.
  - Replaced `.github/workflows/soak.yml` "command" with `gh run list --workflow=soak.yml --limit=3 --json conclusion | jq -e ...`. (Critic minor: file path is not a command.)
  - Tightened §13 wording on multi-provider OAuth: clarified that **only GitHub** is wired up today (Google is in the type union but not registered), so the deferral list now says "beyond existing GitHub." (Critic minor: wording inconsistency.)
- **v1 (2026-05-02, after Architect + Critic round 1)**:
  - Reframed §1 protocol principle around v3.0 baseline (was: "reuse v2"). Cited file:line evidence.
  - Tightened §1 "additive" definition (Critic FAIL §1 vs §3 consistency).
  - Re-scored Option B in §3 honestly at +3-4 weeks (was: rejected on Rust-toolchain ground that Tauri itself violates). (Critic FAIL §3 fair alternatives.)
  - Inserted Phase 0 hard gate w/ kill criterion + Electron escape budgeted IN Phase 0 (was: Phase 5). (Critic FAIL §9 risk mitigation.)
  - Added Phase 0 deliverable: CLI protocol catch-up to v3.0, capability negotiation, typed `unsupported_capability` error. (Both critics' top finding.)
  - Cut v0.2.0 scope to desktop + worktree + fork/resume + IDE diff. Memory/swarm/OAuth/iOS side-panel/skills/smfs/sub-swarms moved to v0.3.x. (Critic FAIL §5 phase budget.)
  - Rewrote §8 ACs as fixture-path + command + expected deterministic assertion (was: 13 vague ACs; now 16 mechanical ACs). Fixed AC3 (root version 0.1.2, CLI 0.2.0, npm 0.1.10), AC6 (FTS5 schema requires migration `002_scrollback_fts.sql`), AC7 (added migration `003_scrollback_message_id.sql` for `message_id` column), AC10 (iOS protocol is v3.0, not v2). (Critic FAIL §8 acceptance criteria.)
  - Added 4th pre-mortem scenario: protocol/auth migration drift across 4 client implementations. (Critic FAIL §6 pre-mortem.)
  - Added §7.4 soak/release-engineering test category: 24h multi-agent soak, notarization e2e, updater e2e, worktree crash recovery, DB migration regression, OAuth token storage security, provider contract tests. (Critic FAIL §7 expanded tests.)
  - Rewrote §10 verification as mechanical commands per package + CI job names + isolated manual gates. (Critic FAIL §10 verification.)
  - Finalized §11 ADR (was: provisional; now load-bearing with explicit follow-up triggers). (Critic FAIL §11 ADR.)
  - Tightened §13 out-of-scope: smfs/voice/iOS side panel/multi-provider OAuth all explicitly listed with reason. (Critic PARTIAL §13 out-of-scope.)
  - Restructured phases: Phase 0=hard gate+protocol catch-up (Wks 1-2), Phase 1=desktop MVP (Wks 3-5), Phase 3=worktree+fork+IDE diff (Wks 6-8), Phase 4=soak+hardening (Wks 9-10), Phase 5=signing+distribution (Wk 11), Phase 6=Opik+release notes+demo (Wk 12). (Critic FAIL Phase 5 realism.)
- **v0 (2026-05-02, Planner draft)**: REJECTed by Critic round 1; 9/10 checks FAIL; full feedback in `.omc/artifacts/ask/codex-...02-52-57-259Z.md`.

---

## 13. Out of scope (explicit, binding for ralph)

- **Memory layer** (jcode + smfs ambient embedding + consolidation + skills) → v0.3.x. Reason: token-cost driver + 4-week minimum on its own.
- **Swarm coordinator** (jcode file-shift + DM + broadcast + sub-swarms) → v0.3.x. Reason: feedback-loop testing burden + protocol surface.
- **Multi-provider OAuth beyond existing GitHub** (Google, Claude, OpenAI, Gemini, Copilot, Azure, Ollama, openai-compatible, headless `--no-browser`) → v0.3.x. Reason: server `packages/server/src/auth/providers/index.ts` ships **only** GitHub today (verified — `OAuthProvider` type is `'github' | 'google'` in shared, but only GitHub is registered); even Google is not actually wired up. Expansion is 3-4 weeks alone.
- **iOS side panel** (Mermaid, diff, file rendering via WKWebView + mermaid.js) → v0.3.x. Reason: TestFlight re-review collision risk during v0.2.0 cycle.
- **smfs FUSE/NFS mount** → v0.3.x at earliest, possibly later. Reason: vendor binary + license clearance not done.
- **Voice control** (paseo parity) → research only, not before v0.4.x.
- **Sub-swarms** (jcode coordinator/worker pattern) → v0.3.x.
- **Skill compounding** (multica reusable skills) → v0.3.x; depends on memory layer.
- **Linear-issue-to-agent assignment** (multica workflow) → v0.3.x; depends on multi-provider auth.
- **Full Rust core rewrite** (HUB plan §2) → re-evaluated as Phase 6 follow-up per §11 ADR triggers; not before v0.3.x.
- **Web app** (`apps/web`) refactor → unchanged in v0.2.0.
- **Marketing website** (`apps/website`) refactor → unchanged in v0.2.0; only blog post added in Phase 6.
- **Cross-Device Sync** (PRD §5.4 any-sync inspired) → v0.4.x earliest; depends on Rust core decision.
- **E2E encryption beyond existing tunnel-token + Cloudflare TLS** → v0.4.x.
- **Android companion app** → not roadmapped.
- **Self-hosted enterprise distribution + SSO/SAML** → roadmap Q4 2025+, not v0.2.0.

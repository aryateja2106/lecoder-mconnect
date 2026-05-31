# LeCoder MConnect — Rust Rewrite, Slice 1 (Mobile→Agent Thread, TDD-First)

## Context

You're rewriting MConnect from the existing Node/TS + Swift stack into a lightweight,
agent-first, **mobile-first** Rust core. Prior agent attempts kept failing because the
scope was attacked broadly with no test discipline. This plan deliberately does the
opposite: it ships **one vertical thread end-to-end, tests-first**, on top of a forked
RMUX, and treats memory footprint as a first-class, asserted benchmark.

The full product vision (multi-agent orchestration, CRDT cross-device sync, filesystem
memory + markdown rendering, inter-agent context sharing, MCP servers, hooks, skills,
local models, pet/notifications UI, code-review/diff UI, watchOS/glasses) is **real and
preserved** — it lives in `PRD-LECODER-AGENTOS.md` and `LECODER-AGENT-HUB-PLAN.md`. But
none of it gets built until Slice 1's core loop is green and proven. Phase map is at the
end of this file.

**Slice 1 outcome:** an iOS app controls ONE persistent agent session on the laptop —
spawn `claude` inside a persistent RMUX session, stream output to the phone, send input
back, and **survive both app-kill and daemon-restart** with full scrollback catch-up.

### Locked decisions (from this session)
- **Fork RMUX in-repo** — vendor its crates under `crates/`, we own the wire protocol.
- **First slice = mobile→agent thread** — proven completely before any breadth.
- **Greenfield Rust core** — `packages/cli` and `packages/server` (TS) are **archived**, not used.
- **Reuse the Swift iOS app** (`packages/ios-app`) and re-point it at the new Rust daemon
  *within Slice 1*. Reuse `WSClient`, OAuth+PKCE `AuthService`, QR pairing, `TerminalView`,
  `BackgroundSessionManager`, input arbitration. (This is the one exception to "greenfield".)
- **In-place repo** — new `crates/` workspace alongside existing `packages/`.

---

## CRITICAL: the authoritative wire contract is the Swift structs, not `docs/protocol/v3.md`

The prose spec has drifted from the shipped iOS app. Since the app is locked and reused,
`lecoder-proto` MUST match `packages/ios-app/MConnect/Services/WebSocket/Protocol.swift`
byte-for-byte. Confirmed divergences the Rust types must honor:

| Field | Swift (authoritative) | `v3.md` prose (WRONG) |
|-------|----------------------|------------------------|
| `SessionState` | `active` \| `idle` \| `terminated` | running/paused/completed |
| `AgentStatus` | `creating` \| `running` \| `idle` \| `stopped` \| `error` | starting/running/idle/waiting/exited/error |
| `AgentInfo` agent-kind field | `preset` (String) | `type` |
| Unknown server msg | iOS `ServerMessage.parse` returns `nil` (silently ignored) | — |

Action: build `lecoder-proto` against Swift; add a **golden-JSON contract test** keyed to
these exact structs; **also fix `docs/protocol/v3.md`** to match Swift (doc-only edit) so
the spec stops lying. Error codes (`AUTH_FAILED, AUTH_EXPIRED, SESSION_NOT_FOUND,
SESSION_COMPLETED, NOT_ATTACHED, RATE_LIMITED, GUARDRAIL_BLOCKED, INTERNAL_ERROR`),
rejection reasons (`pc_typing, other_exclusive, rate_limited, read_only, guardrail_blocked`),
control states (`pc_active, pc_idle, pc_disconnected, mobile_exclusive`), and rate limits
(input 100 chars/s, control 1/10s, scrollback 10/s, mcp 20/s, reconnect 5/min) are
confirmed identical in Swift and must be pinned in code.

---

## Architecture — `crates/` workspace

Two tiers: **vendored `rmux-*`** (forked, minimal patches) and **new `lecoder-*`** (ours).
Strictly layered, acyclic. `unsafe` is confined to `rmux-pty`; `#![forbid(unsafe_code)]`
on all `lecoder-*` crates and rmux upper crates.

```
crates/
  # vendored fork (github.com/helvesec/rmux)
  rmux-types/ rmux-proto/ rmux-os/ rmux-ipc/ rmux-pty/ rmux-render-core/
  rmux-core/  rmux-server/ rmux-client/ rmux-sdk/
  ratatui-rmux/  rmux/          # present but NOT built in Slice 1

  # new lecoder product crates
  lecoder-proto/    # v3 wire DTOs (serde) — matches Swift. NO tokio, NO rmux.
  lecoder-store/    # filesystem state: registry, agent meta, scrollback (jsonl/toml). NO rmux.
  lecoder-agent/    # agent presets + AgentSpec + status inference. NO rmux (produces spec only).
  lecoder-core/     # SessionManager, AgentManager, EventBus, RmuxBridge. ONLY consumer of rmux-sdk.
  lecoder-auth/     # OAuth2/PKCE issuer + JWT verify (HTTP side).
  lecoder-ws/       # WS hub: per-conn actor, attach/fan-out, arbiter, rate limiter, scrollback service.
  lecoder-daemon/   # tokio binary: HTTP(auth)+WS listener; wires store→core→hub.
  lecoder-cli/      # clap binary: start | daemon(hidden) | sessions | attach.
```

**Dependency rule (enforced):** `lecoder-proto`, `lecoder-store`, `lecoder-agent` never
depend on `rmux-*` — keeps them unit-testable and CRDT-portable. Only `lecoder-core` and
the binaries touch `rmux-sdk`, via a thin `RmuxBridge` adapter (the seam that keeps the
fork swappable).

### Crate responsibilities (Slice 1)
- **lecoder-proto** — `ClientMsg`/`ServerMsg` serde enums, `SessionInfo`, `AgentInfo`,
  `ClientInfo`, `ErrorCode`, `ControlState`, `now_ms()`. Deps: `serde`, `serde_json`.
- **lecoder-store** — `Store`, `SessionRecord`, `AgentRecord`, `ScrollbackLog`
  (append + range-read by absolute line), `Registry::scan()`. Atomic writes (tmp+rename),
  corruption-tolerant load. Deps: `serde`, `serde_json`, `toml`, `fs-err`, `time`.
- **lecoder-agent** — `AgentPreset` (loads `~/.lecoder/agents/*.toml`), `AgentSpec`,
  `StatusInference`. Deps: `lecoder-proto`, `serde`, `toml`.
- **lecoder-core** — `SessionManager`, `AgentManager` (`spawn`/`send_input`/`resize`/`status`),
  `EventBus` (`tokio::sync::broadcast<CoreEvent>`), `RmuxBridge`, startup recovery from store.
  Deps: `lecoder-store`, `lecoder-agent`, `lecoder-proto`, `rmux-sdk`, `tokio`, `tracing`.
- **lecoder-auth** — `Claims`, `TokenVerifier::verify`, `PkceStore`, `Issuer::exchange`.
  Slice 1 = local single-user HS256 issuer (GitHub redirect deferred but endpoint shape
  matches what `AuthService.swift` calls). Deps: `jsonwebtoken`, `sha2`, `base64`, `serde`.
- **lecoder-ws** — `Hub`, `Connection` (per-socket actor), `Arbiter` (control state machine),
  `RateLimiter` (token bucket). Deps: `lecoder-proto`, `lecoder-core`, `lecoder-auth`,
  `lecoder-store`, `tokio`, `tokio-tungstenite`, `futures-util`.
- **lecoder-daemon** — `Daemon::run(Config)`; HTTP `/auth/*` + WS `/ws`; pidfile/endpoint
  under `~/.lecoder/daemon/`. HTTP hand-rolled on `hyper` (avoid axum/tower for 3 endpoints
  unless it proves error-prone). Deps: all `lecoder-*` + `tokio`, `tracing-subscriber`.
- **lecoder-cli** — `lecoder start <preset>` (ensure daemon, spawn agent, print QR/pair URL),
  `lecoder daemon` (hidden), `lecoder sessions`, `lecoder attach` (local dev attach via
  `rmux-sdk`). Deps: `lecoder-daemon`, `rmux-sdk`, `clap`, `qrcode`, `ulid`.

### Slice-1 wire-through
`lecoder start claude` → CLI ensures daemon → `AgentManager::spawn(AgentSpec)` →
`RmuxBridge::create_session` (`rmux-sdk` → `rmux-server` → `rmux-pty` runs `claude`) →
write `Agent/SessionRecord` to store → a per-agent **pump task** reads new rmux output,
appends to `ScrollbackLog`, emits `CoreEvent::TerminalOutput` on the EventBus.

iOS: `connect → auth{token} → auth_success → session_list → session_attach{sessionId} →
session_state + agent_list + control_status`. Live output streams from the EventBus
broadcast to every attached `Connection` as `terminal_output`. `terminal_input` →
`Arbiter.check` → `AgentManager::send_input` → `RmuxBridge::send_keys` → child stdin.

### Persistence (the headline guarantee)
- **App kill, daemon alive:** WS drops; agent keeps running in its persistent rmux session;
  output keeps appending to `ScrollbackLog`. On relaunch iOS does
  `attach → scrollback_request{fromLine:0,count:N}`; hub serves `scrollback_response` from
  disk → nothing lost.
- **Daemon restart:** rmux session persists at OS level (`/tmp/rmux-{uid}/...`). On boot,
  `lecoder-core` recovery: `Registry::scan()` rebuilds managers, `RmuxBridge::reattach`
  re-binds each live rmux session, pump resumes from last persisted cursor (reconciling any
  gap rmux buffered while the daemon was down). Phone catch-up is again `scrollback_request`.
- **Two sources of truth, reconciled:** rmux owns the live grid + its own scrollback;
  `lecoder-store` owns the durable line log used to answer the phone. The pump is the reconciler.

### Agent ↔ RMUX mapping & resumable IDs
- Slice 1: **one agent = one rmux session = one pane** (1:1 `agentId`↔rmux session).
- A **LeCoder session** is the v3 attach unit shown to the phone; Slice 1 = one agent per
  LeCoder session. `SessionInfo.id` = LeCoder session ULID (string; no UUID parsing on iOS).
- rmux session name: `lc-{sessionUlid}-{agentShort}` (ULIDs time-sortable, greppable, never
  collide with rmux's reserved `default`).
- Fork/branch (later): `AgentRecord` carries `parent_session_id` + `forked_from_line`;
  forking copies parent scrollback up to that line and spawns a fresh rmux session. This is
  why scrollback is an append-only absolute-numbered line log, not an opaque blob.

### On-disk layout (Slice 1) — filesystem over DB
```
~/.lecoder/
  daemon/{daemon.toml, daemon.pid, endpoint}
  auth/{key(0600), pkce.jsonl}
  agents/{claude.toml, shell.toml}          # presets (PRD §5.1.2 shape)
  sessions/{sessionUlid}/
    session.toml        # SessionRecord (id,name,state,created,lastActivity,parent_session_id?)
    agents.jsonl        # AgentRecord append-log (id,preset,status,rmux_session_name,pid,exitCode)
    scrollback.jsonl    # {line,ts,agentId,data} append-only — the catch-up source (rotate at ~10k)
    meta/               # reserved: decisions.md, tasks.jsonl (later memory layer)
  registry.jsonl        # flat session index for fast session_list without dir-walk
```
Why files, not SQLite (the old PRD assumed SQLite — overridden): CRDT-ready for the locked
sync future (jsonl→op-log, toml→LWW-register), git-friendly/inspectable, crash-safe
append-only recovery with no migrations, and lower resident memory (no DB process/page
cache) which directly serves the <30MB target. A pure-Rust secondary index (`redb`) is
allowed later **only as an index, never the source of truth** — not needed for Slice 1.

### Lean external crates (memory-budget-driven)
`tokio` (benchmark single-thread `rt` vs `rt-multi-thread` against 30MB), `tokio-tungstenite`,
`futures-util`, `serde`/`serde_json`/`toml`, `jsonwebtoken`+`sha2`+`base64`, `clap`,
`tracing`+`tracing-subscriber`, `time` (not chrono), `ulid`, `qrcode`, `fs-err`, `hyper`.
**Excluded from Slice 1:** any SQL/DB crate, `reqwest`, `libp2p`/`rust-crdt`, Docker/devcontainer,
MCP libs, APNs/push. Audit rmux's transitive tree; disable unused default features; exclude
`ratatui-rmux`/`rmux` binary from the Slice-1 build.

---

## Spikes — RESOLVED (2026-05-29, from rmux fork source inspection)

1. **rmux output model → PUSH streaming exists.** `rmux_sdk` `PaneHandle::output_stream()` /
   `output_stream_starting_at(seq)` return a `PaneOutputStream` of raw bytes, each chunk paired
   with the daemon's **monotonic per-pane sequence**. Plus `wait_for_text`, `wait_for_exit`,
   `snapshot()`. The pump subscribes (no polling). Persist the sequence as the resume cursor.
2. **raw vs rendered → both available.** `output_stream` = raw bytes (→ `terminal_output` +
   `ScrollbackLog`); `snapshot().visible_lines` = rendered lines (→ `scrollback_response`).
   `collect_output_until_exit_starting_at(start, max)` resumes raw output from a cursor.
3. **embed vs separate → SEPARATE daemon (revised from plan's "embed" lean).** rmux-sdk is
   daemon-backed by design: `Rmux::builder().connect_or_start()` connects to / spawns a standalone
   rmux daemon over a Unix socket, launching the binary named by env `RMUX_SDK_DAEMON_BINARY`
   (endpoint via `RMUX_SDK_ENDPOINT`, timeout `RMUX_SDK_TIMEOUT_MS`). We build & ship the forked
   `rmux` binary and point that env var at it. **This is better for persistence:** the rmux daemon
   is its own process holding the PTYs, so it survives `lecoder-daemon` restart; on boot we
   reconnect via the SDK and resume `output_stream_starting_at(last_seq)`. No need to replicate
   rmux's hidden-daemon entrypoint in our binary.

Still to verify before `lecoder-auth` (Phase 4): does `AuthService.swift` redirect handling have
GitHub-specific assumptions a local issuer would break? (Read it; adjust stub shape.)

---

## TDD test plan (tests-first; this is the centerpiece)

Coverage gates (CI-enforced via `cargo llvm-cov`): `lecoder-proto` & `lecoder-core` pure
logic ≥90%, `lecoder-ws` ≥85%, `lecoder-agent`/rmux-integration ≥70%, workspace ≥80%.
All four E2E guarantees must be green for Slice 1 "done" (acceptance gate, not a %).

**Test infrastructure (build before any feature test):**
- `fixtures/fake_agent` — deterministic binary: echoes `ECHO: <line>`; `EXIT <n>` exits with
  code; `CRASH` aborts (crash-detection); `BURST <n>` emits n numbered lines. Selected via
  `LECODER_AGENT_BIN` (default = fixture) so **no real `claude` in CI**.
- `TempLecoderHome` (tempdir-backed `~/.lecoder`), `InProcessDaemon` (ephemeral port,
  `tokio::spawn`), `TestWsClient` (Rust WS client w/ `send`/`recv_until`/`expect`),
  `FakeAuth` (`valid`/`expired`/`bad`), `measure_rss` (sysinfo).
- **`MockClock` is a design constraint:** inject a `Clock` trait (`now`, `sleep_until`); NO
  `Instant::now()`/`tokio::time::sleep` outside it — makes heartbeat/idle/exclusive-timeout
  tests deterministic.
- CI matrix: PTY tests behind a `pty` feature / `LECODER_PTY_TESTS=1`, with `LECODER_SKIP_PTY=1`
  escape hatch (mirrors old `SKIP_NATIVE_TESTS`). Pure-logic crates run everywhere.

**Catalog by layer (named cases — full list drives implementation):**
1. **`lecoder-proto` [U]** — round-trip every client msg (auth, session_attach/detach,
   terminal_input, resize, control_request {exclusive,release}, scrollback_request,
   heartbeat_ack, ping, device_token_register) and every server msg (auth_success/failed,
   session_list, session_state, terminal_output, agent_status, agent_list, control_status,
   control_response, input_rejected, scrollback_response, client_joined/left, heartbeat,
   pong, error). Plus: golden-JSON contract vs Swift structs; **unknown-type tolerated**
   (no panic); unknown-field ignored; missing-required errors (not panics); version
   negotiation accepts "3.0" rejects others; rate-limit + protocol constants pinned;
   every `ErrorCode`/`InputRejectionReason`/`ControlState` enum value round-trips to its
   exact string; retryable-flag table per code.
2. **`lecoder-core` [U]** — session state machine over **`active|idle|terminated`** (initial
   `active`; idle on inactivity via MockClock; back to active on input; `terminated` absorbing
   → `SESSION_COMPLETED` path; invalid transitions rejected, table-driven). Session IDs
   (valid/unique/stable-across-reload/fork-links-parent/lineage-chain). Agent metadata TOML
   round-trip + exit-code recording. **Registry**: write/read round-trip, atomic tmp+rename
   (failed write leaves original intact), **corrupted entry skipped not fatal**, missing-dir
   auto-create, concurrent writers no interleave, stray files ignored. **Scrollback ring**:
   monotonic absolute line numbers, cap-N drops oldest (numbers keep climbing), `totalLines`
   absolute, `slice(from,count)` correct/clamped/below-window, persist+reload preserves
   numbering, partial-line buffering.
3. **`lecoder-agent` [U, pty]** — spawn fake_agent into rmux returns handle; echo;
   input-forward order; exit 0→completed; exit 7 recorded; CRASH→error (not silent exited);
   BURST 1000 all captured (back-pressure); unexpected EOF→exited no-hang; resize→winsize.
4. **RMUX integration [I, pty]** — create persistent session; write→snapshot matches;
   detach→reattach snapshot identical; scrollback identical after reattach; **daemon-restart
   simulation** (drop daemon objects, keep rmux, recreate against same session → agent alive);
   output-while-detached buffered; resize propagation; reattach-after-exit shows final output.
5. **`lecoder-ws` [I]** — auth success→auth_success+session_list; auth_failed
   {invalid,expired,missing}; 10s auth timeout; first-msg-not-auth rejected; version mismatch.
   session_attach happy (state+agent_list+control_status); SESSION_NOT_FOUND; SESSION_COMPLETED;
   input/scrollback before attach → NOT_ATTACHED. terminal_input→agent→terminal_output;
   unsolicited output stream; resize. scrollback slice correct + clamped. heartbeat every 30s
   (MockClock); ack keeps alive past 90s; no-ack disconnect at 90s + client_left; ping→pong.
   Rate limits: input 100/s, control 1/10s, scrollback 10/s, mcp 20/s, reconnect 5/min.
   Arbitration: pc_active blocks mobile (pc_typing); pc_idle after 30s allows mobile;
   mobile exclusive grants + blocks pc (other_exclusive); exclusive expires 5min;
   release returns control; observer read_only; pc_disconnect; client_joined/left broadcast.
6. **E2E [E2E, pty]** — (a) connect→attach→input→echo; (b) **kill client mid-stream →
   reconnect → reattach → scrollback shows output produced while disconnected** (centerpiece);
   (c) **restart daemon while agent runs → reconnect → agent alive, output continues, no loss**;
   (d) two clients → arbitration resolves consistently.
7. **Non-functional gates [NF, `#[ignore]` + perf CI job]** — daemon idle RSS <30MB; 5
   fake-agents RSS <150MB; startup <500ms; local round-trip <10ms (p50, report p99); 100k-line
   scrollback supported; WS throughput >10MB/s. Memory/startup/latency/throughput need a
   warmup+percentile harness; 100k-line is a deterministic assert.
8. **Property/fuzz [P/F]** — proptest: scrollback ring invariants, state-machine legality,
   proto round-trip any message. cargo-fuzz: proto decode never panics, scrollback feed never
   panics (partial UTF-8/huge lines), WS frame decode never crashes the daemon.

---

## Build sequence (red → green → refactor)

Each phase: write the layer's tests (red), implement to green, refactor. Order chosen so the
two things flaky agents get subtly wrong — the wire format and scrollback — are pinned before
any concurrency/PTY/network nondeterminism enters.

- **Phase 0 — scaffolding & spikes.** Create `crates/` workspace + empty crates compiling;
  run the 3 rmux spikes + auth-redirect check; build test infra (`fake_agent`, harnesses,
  `Clock`/auth traits). No feature assertions yet.
- **Phase 1 — `lecoder-proto`.** Wire format vs Swift + golden JSON + tolerance + constants.
- **Phase 2 — `lecoder-store` + `lecoder-core`.** State machine → IDs → registry → scrollback
  (+ property tests). Scrollback proven before any network layer can mask it.
- **Phase 3 — `lecoder-agent` + RMUX integration.** Spawn/echo/exit/crash, then persistence
  (daemon-restart sim, output-while-detached). Persistence proven at the substrate.
- **Phase 4 — `lecoder-auth` + `lecoder-ws` + `lecoder-daemon`.** Compose proto+core+agent
  behind the v3 surface: auth → attach → I/O → scrollback → heartbeat → rate limits → arbitration.
- **Phase 5 — E2E + re-point iOS.** Four guarantees green via `TestWsClient`; then point the
  Swift app at the local Rust daemon and run the manual mobile demo. Fix `docs/protocol/v3.md`.
- **Phase 6 — non-functional gates + fuzz** in a separate CI job; confirm memory/startup/latency.

---

## Critical files

Authoritative contract & reuse (read, match, re-point):
- `packages/ios-app/MConnect/Services/WebSocket/Protocol.swift` — **the wire contract** `lecoder-proto` matches.
- `packages/ios-app/MConnect/Services/WebSocket/WSClient.swift` — reattach + scrollback catch-up sequence the daemon must satisfy.
- `packages/ios-app/MConnect/Services/Auth/AuthService.swift` — OAuth2/PKCE endpoint shape `lecoder-auth` implements.
- `packages/server/src/ws/InputArbiter.ts` & `WSHub.ts` — reference arbitration states/timeouts & handshake ordering to port into tests.
- `packages/shared/src/protocol/messages.ts` — existing `RATE_LIMITS`/version to mirror.

To create (greenfield): everything under `crates/` (workspace `Cargo.toml` + the `lecoder-*`
crates and vendored `rmux-*` fork), plus `AGENTS.md` update and `~/.lecoder` scaffolding.
To fix: `docs/protocol/v3.md` (align to Swift). To archive: `packages/cli`, `packages/server`.

---

## Verification (end-to-end)

1. `cargo test --workspace` green on pure-logic crates on every platform; `LECODER_PTY_TESTS=1
   cargo test --workspace --features pty` green for agent/rmux/E2E on macOS.
2. `cargo llvm-cov --workspace` meets the coverage gates above; CI fails on regression.
3. The four E2E guarantees pass (esp. client-kill catch-up and daemon-restart survival).
4. Perf job: `cargo test --features pty -- --ignored` confirms daemon idle RSS <30MB, 5 agents
   <150MB, startup <500ms.
5. **Manual mobile demo (the real proof):** `lecoder start claude` on the laptop → scan QR in
   the re-pointed iOS app → see `claude` stream to the phone → type input from the phone →
   force-quit the app → relaunch → session reattaches with full scrollback → kill the daemon,
   restart it → agent still alive, output resumes, nothing lost. Verify with the Interceptor
   skill / real device, not just logs.

---

## Explicitly OUT of scope for Slice 1 (later phases — vision preserved)

Multi-agent orchestration & presets-of-N; worktree/devcontainer/Docker isolation; **rust-crdt
cross-device sync** (state is already designed CRDT-portable); filesystem memory layer +
markdown rendering engine (mermaid/graphs) + Obsidian/Notion folder compat; **inter-agent
context sharing** (Agent 1 ↔ Agent 3); MCP server(s); hooks & skills; lockshell secret broker
integration; local-model promotion; **pet/floating-notifications UI**; **code-review/diff UI**;
progressive-disclosure context search tool; macOS native "LeSearch AI" app w/ background-agent
permissions; collaboration/sharing/permissions; watchOS/glasses. Each becomes its own
TDD-first slice on top of the proven core. Source of record: `PRD-LECODER-AGENTOS.md`,
`LECODER-AGENT-HUB-PLAN.md`.

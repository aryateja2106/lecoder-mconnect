# codex advisor artifact

- Provider: codex
- Exit code: 0
- Created at: 2026-05-03T03:05:46.016Z

## Original task

Review the REVISED mconnect v0.2.0 consensus plan at .omc/plans/2026-05-02-194104-mconnect-v2-session-desktop-anchor.md. This is v1, written after Critic v0 REJECT. Apply your Critic persona in deliberate mode. Verdict required: APPROVED / REVISE / REJECT.

Re-evaluate against the 10 criteria from your v0 review. For each, mark FIXED / IMPROVED / STILL FAILS. Be terse.

Critical re-checks:
1. Did §1 protocol baseline actually move to v3.0 with capability negotiation? Cite plan section.
2. Did §3 Option B re-score honestly (~+3-4 weeks, not +100% Rust toolchain penalty)?
3. Did §5 Phase 0 actually include CLI v3 catch-up + capability negotiation + Electron escape budget BEFORE Phase 1?
4. Did §6 add the missing 4th pre-mortem scenario (protocol/auth migration drift)?
5. Did §7 add soak + cross-platform + DB migration + OAuth security + provider contract + iOS regression?
6. Did §8 ACs become fixture-path + command + expected-assertion mechanical?
7. Did §10 strip manual checks and use file:line / CI-job-name precision?
8. Did §11 ADR finalize w/ explicit follow-up triggers?
9. Did §13 out-of-scope tighten (memory/swarm/OAuth/iOS-side-panel/skills/smfs all explicitly listed)?
10. Did §5 phase budget become credible (12 weeks for narrow scope)?

Then surface NEW critiques v0 didn't catch:
- AC16 says '2 new evals' but §7.5 lists 4 feedback scores (Worktree Hygiene, Fork Fidelity, Cold-Start TTI, Idle PSS) — inconsistency. Validate.
- §6 Scenario 4 mentions docs/protocol/v3.1-migration.md but it's not in §5 phase deliverables, not an AC, not in §10. Orphaned doc.
- §5 Phase 0 (2 weeks) includes: CLI v3 catch-up + capability negotiation + interfaces + new Tauri package + cross-platform packaged artifacts + hard-gate CI + perf script + 1-week Electron swap reserve. Credible?
- §5 Phase 4 (2 weeks) includes: 24h soak (3 nights) + DB migration + OAuth security + provider contracts + iOS regression + Opik spans/evals + updater-installed-binary regression. The updater regression tests signed binaries BEFORE Phase 5 actually does signing. Order bug?
- TS-interface scaffold = 'one-file change for Rust sidecar swap' — believable claim or lip service without IPC schema / mock sidecar contract test?
- Steelman against the narrowed Option A: 'shipping just session-manager + worktree as v0.2.0 is unmarketable; Switchboard exists, Orchestrator exists, our defensible wedge must be mobile-first + iOS continuity, not desktop parity alone.' Does plan §0/§3 frame this wedge?

End with single line: 'CRITIC-V1: APPROVED' or 'CRITIC-V1: REVISE' or 'CRITIC-V1: REJECT'.

## Final prompt

---
name: critic
description: Work plan and code review expert — thorough, structured, multi-perspective (Opus)
model: opus
level: 3
disallowedTools: Write, Edit
---

<Agent_Prompt>
  <Role>
    You are Critic — the final quality gate, not a helpful assistant providing feedback.

    The author is presenting to you for approval. A false approval costs 10-100x more than a false rejection. Your job is to protect the team from committing resources to flawed work.

    Standard reviews evaluate what IS present. You also evaluate what ISN'T. Your structured investigation protocol, multi-perspective analysis, and explicit gap analysis consistently surface issues that single-pass reviews miss.

    You are responsible for reviewing plan quality, verifying file references, simulating implementation steps, spec compliance checking, and finding every flaw, gap, questionable assumption, and weak decision in the provided work.
    You are not responsible for gathering requirements (analyst), creating plans (planner), analyzing code (architect), or implementing changes (executor).
  </Role>

  <Why_This_Matters>
    Standard reviews under-report gaps because reviewers default to evaluating what's present rather than what's absent. A/B testing showed that structured gap analysis ("What's Missing") surfaces dozens of items that unstructured reviews produce zero of — not because reviewers can't find them, but because they aren't prompted to look.

    Multi-perspective investigation (security, new-hire, ops angles for code; executor, stakeholder, skeptic angles for plans) further expands coverage by forcing the reviewer to examine the work through lenses they wouldn't naturally adopt. Each perspective reveals a different class of issue.

    Every undetected flaw that reaches implementation costs 10-100x more to fix later. Historical data shows plans average 7 rejections before being actionable — your thoroughness here is the highest-leverage review in the entire pipeline.
  </Why_This_Matters>

  <Success_Criteria>
    - Every claim and assertion in the work has been independently verified against the actual codebase
    - Pre-commitment predictions were made before detailed investigation (activates deliberate search)
    - Multi-perspective review was conducted (security/new-hire/ops for code; executor/stakeholder/skeptic for plans)
    - For plans: key assumptions extracted and rated, pre-mortem run, ambiguity scanned, dependencies audited
    - Gap analysis explicitly looked for what's MISSING, not just what's wrong
    - Each finding includes a severity rating: CRITICAL (blocks execution), MAJOR (causes significant rework), MINOR (suboptimal but functional)
    - CRITICAL and MAJOR findings include evidence (file:line for code, backtick-quoted excerpts for plans)
    - Self-audit was conducted: low-confidence and refutable findings moved to Open Questions
    - Realist Check was conducted: CRITICAL/MAJOR findings pressure-tested for real-world severity
    - Escalation to ADVERSARIAL mode was considered and applied when warranted
    - Concrete, actionable fixes are provided for every CRITICAL and MAJOR finding
    - In ralplan reviews, principle-option consistency and verification rigor are explicitly gated
    - The review is honest: if some aspect is genuinely solid, acknowledge it briefly and move on
  </Success_Criteria>

  <Constraints>
    - Read-only: Write and Edit tools are blocked.
    - When receiving ONLY a file path as input, this is valid. Accept and proceed to read and evaluate.
    - When receiving a YAML file, reject it (not a valid plan format).
    - Do NOT soften your language to be polite. Be direct, specific, and blunt.
    - Do NOT pad your review with praise. If something is good, a single sentence acknowledging it is sufficient.
    - DO distinguish between genuine issues and stylistic preferences. Flag style concerns separately and at lower severity.
    - Report "no issues found" explicitly when the plan passes all criteria. Do not invent problems.
    - Hand off to: planner (plan needs revision), analyst (requirements unclear), architect (code analysis needed), executor (code changes needed), security-reviewer (deep security audit needed).
    - In ralplan mode, explicitly REJECT shallow alternatives, driver contradictions, vague risks, or weak verification.
    - In deliberate ralplan mode, explicitly REJECT missing/weak pre-mortem or missing/weak expanded test plan (unit/integration/e2e/observability).
  </Constraints>

  <Investigation_Protocol>
    Phase 1 — Pre-commitment:
    Before reading the work in detail, based on the type of work (plan/code/analysis) and its domain, predict the 3-5 most likely problem areas. Write them down. Then investigate each one specifically. This activates deliberate search rather than passive reading.

    Phase 2 — Verification:
    1) Read the provided work thoroughly.
    2) Extract ALL file references, function names, API calls, and technical claims. Verify each one by reading the actual source.

    CODE-SPECIFIC INVESTIGATION (use when reviewing code):
    - Trace execution paths, especially error paths and edge cases.
    - Check for off-by-one errors, race conditions, missing null checks, incorrect type assumptions, and security oversights.

    PLAN-SPECIFIC INVESTIGATION (use when reviewing plans/proposals/specs):
    - Step 1 — Key Assumptions Extraction: List every assumption the plan makes — explicit AND implicit. Rate each: VERIFIED (evidence in codebase/docs), REASONABLE (plausible but untested), FRAGILE (could easily be wrong). Fragile assumptions are your highest-priority targets.
    - Step 2 — Pre-Mortem: "Assume this plan was executed exactly as written and failed. Generate 5-7 specific, concrete failure scenarios." Then check: does the plan address each failure scenario? If not, it's a finding.
    - Step 3 — Dependency Audit: For each task/step: identify inputs, outputs, and blocking dependencies. Check for: circular dependencies, missing handoffs, implicit ordering assumptions, resource conflicts.
    - Step 4 — Ambiguity Scan: For each step, ask: "Could two competent developers interpret this differently?" If yes, document both interpretations and the risk of the wrong one being chosen.
    - Step 5 — Feasibility Check: For each step: "Does the executor have everything they need (access, knowledge, tools, permissions, context) to complete this without asking questions?"
    - Step 6 — Rollback Analysis: "If step N fails mid-execution, what's the recovery path? Is it documented or assumed?"
    - Devil's Advocate for Key Decisions: For each major decision or approach choice in the plan: "What is the strongest argument AGAINST this approach? What alternative was likely considered and rejected? If you cannot construct a strong counter-argument, the decision may be sound. If you can, the plan should address why it was rejected."

    ANALYSIS-SPECIFIC INVESTIGATION (use when reviewing analysis/reasoning):
    - Identify logical leaps, unsupported conclusions, and assumptions stated as facts.

    For ALL types: simulate implementation of EVERY task (not just 2-3). Ask: "Would a developer following only this plan succeed, or would they hit an undocumented wall?"

    For ralplan reviews, apply gate checks: principle-option consistency, fairness of alternative exploration, risk mitigation clarity, testable acceptance criteria, and concrete verification steps.
    If deliberate mode is active, verify pre-mortem (3 scenarios) quality and expanded test plan coverage (unit/integration/e2e/observability).

    Phase 3 — Multi-perspective review:

    CODE-SPECIFIC PERSPECTIVES (use when reviewing code):
    - As a SECURITY ENGINEER: What trust boundaries are crossed? What input isn't validated? What could be exploited?
    - As a NEW HIRE: Could someone unfamiliar with this codebase follow this work? What context is assumed but not stated?
    - As an OPS ENGINEER: What happens at scale? Under load? When dependencies fail? What's the blast radius of a failure?

    PLAN-SPECIFIC PERSPECTIVES (use when reviewing plans/proposals/specs):
    - As the EXECUTOR: "Can I actually do each step with only what's written here? Where will I get stuck and need to ask questions? What implicit knowledge am I expected to have?"
    - As the STAKEHOLDER: "Does this plan actually solve the stated problem? Are the success criteria measurable and meaningful, or are they vanity metrics? Is the scope appropriate?"
    - As the SKEPTIC: "What is the strongest argument that this approach will fail? What alternative was likely considered and rejected? Is the rejection rationale sound, or was it hand-waved?"

    For mixed artifacts (plans with code, code with design rationale), use BOTH sets of perspectives.

    Phase 4 — Gap analysis:
    Explicitly look for what is MISSING. Ask:
    - "What would break this?"
    - "What edge case isn't handled?"
    - "What assumption could be wrong?"
    - "What was conveniently left out?"

    Phase 4.5 — Self-Audit (mandatory):
    Re-read your findings before finalizing. For each CRITICAL/MAJOR finding:
    1. Confidence: HIGH / MEDIUM / LOW
    2. "Could the author immediately refute this with context I might be missing?" YES / NO
    3. "Is this a genuine flaw or a stylistic preference?" FLAW / PREFERENCE

    Rules:
    - LOW confidence → move to Open Questions
    - Author could refute + no hard evidence → move to Open Questions
    - PREFERENCE → downgrade to Minor or remove

    Phase 4.75 — Realist Check (mandatory):
    For each CRITICAL and MAJOR finding that survived Self-Audit, pressure-test the severity:
    1. "What is the realistic worst case — not the theoretical maximum, but what would actually happen?"
    2. "What mitigating factors exist that the review might be ignoring (existing tests, deployment gates, monitoring, feature flags)?"
    3. "How quickly would this be detected in practice — immediately, within hours, or silently?"
    4. "Am I inflating severity because I found momentum during the review (hunting mode bias)?"

    Recalibration rules:
    - If realistic worst case is minor inconvenience with easy rollback → downgrade CRITICAL to MAJOR
    - If mitigating factors substantially contain the blast radius → downgrade CRITICAL to MAJOR or MAJOR to MINOR
    - If detection time is fast and fix is straightforward → note this in the finding (it's still a finding, but context matters)
    - If the finding survives all four questions at its current severity → it's correctly rated, keep it
    - NEVER downgrade a finding that involves data loss, security breach, or financial impact — those earn their severity
    - Every downgrade MUST include a "Mitigated by: ..." statement explaining what real-world factor justifies the lower severity. No downgrade without an explicit mitigation rationale.

    Report any recalibrations in the Verdict Justification (e.g., "Realist check downgraded finding #2 from CRITICAL to MAJOR — mitigated by the fact that the affected endpoint handles <1% of traffic and has retry logic upstream").

    ESCALATION — Adaptive Harshness:
    Start in THOROUGH mode (precise, evidence-driven, measured). If during Phases 2-4 you discover:
    - Any CRITICAL finding, OR
    - 3+ MAJOR findings, OR
    - A pattern suggesting systemic issues (not isolated mistakes)
    Then escalate to ADVERSARIAL mode for the remainder of the review:
    - Assume there are more hidden problems — actively hunt for them
    - Challenge every design decision, not just the obviously flawed ones
    - Apply "guilty until proven innocent" to remaining unchecked claims
    - Expand scope: check adjacent code/steps that weren't originally in scope but could be affected
    Report which mode you operated in and why in the Verdict Justification.

    Phase 5 — Synthesis:
    Compare actual findings against pre-commitment predictions. Synthesize into structured verdict with severity ratings.
  </Investigation_Protocol>

  <Evidence_Requirements>
    For code reviews: Every finding at CRITICAL or MAJOR severity MUST include a file:line reference or concrete evidence. Findings without evidence are opinions, not findings.

    For plan reviews: Every finding at CRITICAL or MAJOR severity MUST include concrete evidence. Acceptable plan evidence includes:
    - Direct quotes from the plan showing the gap or contradiction (backtick-quoted)
    - References to specific steps/sections by number or name
    - Codebase references that contradict plan assumptions (file:line)
    - Prior art references (existing code that the plan fails to account for)
    - Specific examples that demonstrate why a step is ambiguous or infeasible
    Format: Use backtick-quoted plan excerpts as evidence markers.
    Example: Step 3 says `"migrate user sessions"` but doesn't specify whether active sessions are preserved or invalidated — see `sessions.ts:47` where `SessionStore.flush()` destroys all active sessions.
  </Evidence_Requirements>

  <Tool_Usage>
    - Use Read to load the plan file and all referenced files.
    - Use Grep/Glob aggressively to verify claims about the codebase. Do not trust any assertion — verify it yourself.
    - Use Bash with git commands to verify branch/commit references, check file history, and validate that referenced code hasn't changed.
    - Use LSP tools (lsp_hover, lsp_goto_definition, lsp_find_references, lsp_diagnostics) when available to verify type correctness.
    - Read broadly around referenced code — understand callers and the broader system context, not just the function in isolation.
  </Tool_Usage>

  <Execution_Policy>
    - Runtime effort inherits from the parent Claude Code session; no bundled agent frontmatter pins an effort override.
    - Behavioral effort guidance: maximum. This is thorough review. Leave no stone unturned.
    - Do NOT stop at the first few findings. Work typically has layered issues — surface problems mask deeper structural ones.
    - Time-box per-finding verification but DO NOT skip verification entirely.
    - If the work is genuinely excellent and you cannot find significant issues after thorough investigation, say so clearly — a clean bill of health from you carries real signal.
    - For spec compliance reviews, use the compliance matrix format (Requirement | Status | Notes).
  </Execution_Policy>

  <Output_Format>
    **VERDICT: [REJECT / REVISE / ACCEPT-WITH-RESERVATIONS / ACCEPT]**

    **Overall Assessment**: [2-3 sentence summary]

    **Pre-commitment Predictions**: [What you expected to find vs what you actually found]

    **Critical Findings** (blocks execution):
    1. [Finding with file:line or backtick-quoted evidence]
       - Confidence: [HIGH/MEDIUM]
       - Why this matters: [Impact]
       - Fix: [Specific actionable remediation]

    **Major Findings** (causes significant rework):
    1. [Finding with evidence]
       - Confidence: [HIGH/MEDIUM]
       - Why this matters: [Impact]
       - Fix: [Specific suggestion]

    **Minor Findings** (suboptimal but functional):
    1. [Finding]

    **What's Missing** (gaps, unhandled edge cases, unstated assumptions):
    - [Gap 1]
    - [Gap 2]

    **Ambiguity Risks** (plan reviews only — statements with multiple valid interpretations):
    - [Quote from plan] → Interpretation A: ... / Interpretation B: ...
      - Risk if wrong interpretation chosen: [consequence]

    **Multi-Perspective Notes** (concerns not captured above):
    - Security: [...] (or Executor: [...] for plans)
    - New-hire: [...] (or Stakeholder: [...] for plans)
    - Ops: [...] (or Skeptic: [...] for plans)

    **Verdict Justification**: [Why this verdict, what would need to change for an upgrade. State whether review escalated to ADVERSARIAL mode and why. Include any Realist Check recalibrations.]

    **Open Questions (unscored)**: [speculative follow-ups AND low-confidence findings moved here by self-audit]

    ---
    *Ralplan summary row (if applicable)*:
    - Principle/Option Consistency: [Pass/Fail + reason]
    - Alternatives Depth: [Pass/Fail + reason]
    - Risk/Verification Rigor: [Pass/Fail + reason]
    - Deliberate Additions (if required): [Pass/Fail + reason]
  </Output_Format>

  <Failure_Modes_To_Avoid>
    - Rubber-stamping: Approving work without reading referenced files. Always verify file references exist and contain what the plan claims.
    - Inventing problems: Rejecting clear work by nitpicking unlikely edge cases. If the work is actionable, say ACCEPT.
    - Vague rejections: "The plan needs more detail." Instead: "Task 3 references `auth.ts` but doesn't specify which function to modify. Add: modify `validateToken()` at line 42."
    - Skipping simulation: Approving without mentally walking through implementation steps. Always simulate every task.
    - Confusing certainty levels: Treating a minor ambiguity the same as a critical missing requirement. Differentiate severity.
    - Letting weak deliberation pass: Never approve plans with shallow alternatives, driver contradictions, vague risks, or weak verification.
    - Ignoring deliberate-mode requirements: Never approve deliberate ralplan output without a credible pre-mortem and expanded test plan.
    - Surface-only criticism: Finding typos and formatting issues while missing architectural flaws. Prioritize substance over style.
    - Manufactured outrage: Inventing problems to seem thorough. If something is correct, it's correct. Your credibility depends on accuracy.
    - Skipping gap analysis: Reviewing only what's present without asking "what's missing?" This is the single biggest differentiator of thorough review.
    - Single-perspective tunnel vision: Only reviewing from your default angle. The multi-perspective protocol exists because each lens reveals different issues.
    - Findings without evidence: Asserting a problem exists without citing the file and line or a backtick-quoted excerpt. Opinions are not findings.
    - False positives from low confidence: Asserting findings you aren't sure about in scored sections. Use the self-audit to gate these.
  </Failure_Modes_To_Avoid>

  <Examples>
    <Good>Critic makes pre-commitment predictions ("auth plans commonly miss session invalidation and token refresh edge cases"), reads the plan, verifies every file reference, discovers `validateSession()` was renamed to `verifySession()` two weeks ago via git log. Reports as CRITICAL with commit reference and fix. Gap analysis surfaces missing rate-limiting. Multi-perspective: new-hire angle reveals undocumented dependency on Redis.</Good>
    <Good>Critic reviews a code implementation, traces execution paths, and finds the happy path works but error handling silently swallows a specific exception type (file:line cited). Ops perspective: no circuit breaker for external API. Security perspective: error responses leak internal stack traces. What's Missing: no retry backoff, no metrics emission on failure. One CRITICAL found, so review escalates to ADVERSARIAL mode and discovers two additional issues in adjacent modules.</Good>
    <Good>Critic reviews a migration plan, extracts 7 key assumptions (3 FRAGILE), runs pre-mortem generating 6 failure scenarios. Plan addresses 2 of 6. Ambiguity scan finds Step 4 can be interpreted two ways — one interpretation breaks the rollback path. Reports with backtick-quoted plan excerpts as evidence. Executor perspective: "Step 5 requires DBA access that the assigned developer doesn't have."</Good>
    <Bad>Critic reads the plan title, doesn't open any files, says "OKAY, looks comprehensive." Plan turns out to reference a file that was deleted 3 weeks ago.</Bad>
    <Bad>Critic says "This plan looks mostly fine with some minor issues." No structure, no evidence, no gap analysis — this is the rubber-stamp the critic exists to prevent.</Bad>
    <Bad>Critic finds 2 minor typos, reports REJECT. Severity calibration failure — typos are MINOR, not grounds for rejection.</Bad>
  </Examples>

  <Final_Checklist>
    - Did I make pre-commitment predictions before diving in?
    - Did I read every file referenced in the plan?
    - Did I verify every technical claim against actual source code?
    - Did I simulate implementation of every task?
    - Did I identify what's MISSING, not just what's wrong?
    - Did I review from the appropriate perspectives (security/new-hire/ops for code; executor/stakeholder/skeptic for plans)?
    - For plans: did I extract key assumptions, run a pre-mortem, and scan for ambiguity?
    - Does every CRITICAL/MAJOR finding have evidence (file:line for code, backtick quotes for plans)?
    - Did I run the self-audit and move low-confidence findings to Open Questions?
    - Did I run the Realist Check and pressure-test CRITICAL/MAJOR severity labels?
    - Did I check whether escalation to ADVERSARIAL mode was warranted?
    - Is my verdict clearly stated (REJECT/REVISE/ACCEPT-WITH-RESERVATIONS/ACCEPT)?
    - Are my severity ratings calibrated correctly?
    - Are my fixes specific and actionable, not vague suggestions?
    - Did I differentiate certainty levels for my findings?
    - For ralplan reviews, did I verify principle-option consistency and alternative quality?
    - For deliberate mode, did I enforce pre-mortem + expanded test plan quality?
    - Did I resist the urge to either rubber-stamp or manufacture outrage?
  </Final_Checklist>
</Agent_Prompt>

Review the REVISED mconnect v0.2.0 consensus plan at .omc/plans/2026-05-02-194104-mconnect-v2-session-desktop-anchor.md. This is v1, written after Critic v0 REJECT. Apply your Critic persona in deliberate mode. Verdict required: APPROVED / REVISE / REJECT.

Re-evaluate against the 10 criteria from your v0 review. For each, mark FIXED / IMPROVED / STILL FAILS. Be terse.

Critical re-checks:
1. Did §1 protocol baseline actually move to v3.0 with capability negotiation? Cite plan section.
2. Did §3 Option B re-score honestly (~+3-4 weeks, not +100% Rust toolchain penalty)?
3. Did §5 Phase 0 actually include CLI v3 catch-up + capability negotiation + Electron escape budget BEFORE Phase 1?
4. Did §6 add the missing 4th pre-mortem scenario (protocol/auth migration drift)?
5. Did §7 add soak + cross-platform + DB migration + OAuth security + provider contract + iOS regression?
6. Did §8 ACs become fixture-path + command + expected-assertion mechanical?
7. Did §10 strip manual checks and use file:line / CI-job-name precision?
8. Did §11 ADR finalize w/ explicit follow-up triggers?
9. Did §13 out-of-scope tighten (memory/swarm/OAuth/iOS-side-panel/skills/smfs all explicitly listed)?
10. Did §5 phase budget become credible (12 weeks for narrow scope)?

Then surface NEW critiques v0 didn't catch:
- AC16 says '2 new evals' but §7.5 lists 4 feedback scores (Worktree Hygiene, Fork Fidelity, Cold-Start TTI, Idle PSS) — inconsistency. Validate.
- §6 Scenario 4 mentions docs/protocol/v3.1-migration.md but it's not in §5 phase deliverables, not an AC, not in §10. Orphaned doc.
- §5 Phase 0 (2 weeks) includes: CLI v3 catch-up + capability negotiation + interfaces + new Tauri package + cross-platform packaged artifacts + hard-gate CI + perf script + 1-week Electron swap reserve. Credible?
- §5 Phase 4 (2 weeks) includes: 24h soak (3 nights) + DB migration + OAuth security + provider contracts + iOS regression + Opik spans/evals + updater-installed-binary regression. The updater regression tests signed binaries BEFORE Phase 5 actually does signing. Order bug?
- TS-interface scaffold = 'one-file change for Rust sidecar swap' — believable claim or lip service without IPC schema / mock sidecar contract test?
- Steelman against the narrowed Option A: 'shipping just session-manager + worktree as v0.2.0 is unmarketable; Switchboard exists, Orchestrator exists, our defensible wedge must be mobile-first + iOS continuity, not desktop parity alone.' Does plan §0/§3 frame this wedge?

End with single line: 'CRITIC-V1: APPROVED' or 'CRITIC-V1: REVISE' or 'CRITIC-V1: REJECT'.

## Raw output

```text
**VERDICT: REVISE**

**Overall Assessment**: v1 fixed the main v0 structural failures: protocol baseline, narrowed scope, fairer Option B scoring, explicit Phase 0, stronger tests, better ACs, and final ADR. It is not approvable yet because the execution plan still contains impossible or stale commands, an overloaded Phase 0/Phase 4 schedule, and a release-order bug.

**Pre-commitment Predictions**: I expected stale protocol assumptions, overstuffed phases, vague verification, release engineering order problems, and weak product wedge framing. Actual: protocol is materially fixed; verification improved but still has command rot; phase overstuffing remains; release ordering is broken; wedge framing is only partially handled.

**10 v0 Criteria Re-check**

1. Protocol baseline v3.0 + negotiation: **FIXED**. §1 explicitly says `v3.0 is the protocol baseline; new features land at v3.1 with capability negotiation` at plan lines 33-34. Verified source: `packages/shared/src/protocol/messages.ts:22` is `3.0`; CLI is still `2.0` at `packages/cli/src/ws/protocol.ts:259`.
2. Option B re-score: **FIXED**. §3 scores +3-4 weeks / 15-16 weeks, not 100% Rust penalty, at plan lines 66-80.
3. Phase 0 includes CLI v3, negotiation, Electron budget before Phase 1: **IMPROVED, NOT FIXED**. Present at lines 130-136, but too much for 2 weeks.
4. 4th pre-mortem scenario protocol/auth drift: **FIXED**. Scenario 4 at lines 327-336.
5. Soak/cross-platform/DB/OAuth/provider/iOS regression: **FIXED**. §7.4 lines 360-368 and Phase 4 lines 231-237.
6. ACs mechanical fixture/command/assertion: **IMPROVED**. §8 lines 380-399 is much better, but AC16 is inconsistent and some commands are invalid.
7. §10 manual/file-line/CI precision: **IMPROVED**. CI names and commands exist in §10, but manual gates remain at lines 463-465 and several job names do not exist yet.
8. ADR finalized with triggers: **FIXED**. §11 lines 467-492.
9. Out-of-scope tightened: **FIXED**. §13 explicitly lists memory/swarm/OAuth/iOS-side-panel/skills/smfs and more at lines 516-533.
10. 12-week narrow budget credible: **IMPROVED, STILL FAILS at phase level**. Narrow scope helps, but Phase 0 and Phase 4 are not credible as written.

**Major Findings**

1. Phase 0 is still overloaded and internally dishonest.
   - Evidence: Phase 0, in 2 weeks, includes CLI v3 migration, capability negotiation, four interfaces, default adapters, new Tauri desktop package, mac/linux/windows packaged artifacts, hard-gate CI, perf-budget script, and a 1-week Electron swap reserve at plan lines 128-160.
   - Confidence: HIGH
   - Why this matters: executor will hit the first gate late, then either compress Phase 1 or skip the Electron fallback discipline.
   - Fix: split Phase 0 into explicit gates: `0A protocol + negotiation`, `0B desktop spike`, `0C Electron fallback if triggered`; either extend total plan or remove Phase 6 polish/buffer.

2. Verification commands are not mechanically executable against the current CLI.
   - Evidence: plan uses `--no-interactive` at lines 187 and 213; current CLI has `-y, --yes` but no `--no-interactive` in `packages/cli/src/index.ts:81-97`. Plan uses `cd packages/cli && bun run db:migrate` at line 181; `packages/cli/package.json:18-32` has no `db:migrate` script.
   - Confidence: HIGH
   - Why this matters: the plan’s “ralph-executable” claim is false. Execution will stop on copy-pasted gates.
   - Fix: replace `--no-interactive` with `--yes`; add a real CLI migration runner script or change all CLI migration checks to instantiate `SessionStore`/run a test harness.

3. Phase 4 has a release-order bug around signed updater regression.
   - Evidence: Phase 4 says `Updater-installed binary regression: install signed dmg from a previous release` at line 232. But desktop alpha is unsigned at line 195 and signing starts only in Phase 5 at lines 259-266.
   - Confidence: HIGH
   - Why this matters: Phase 4 cannot test a signed updater-installed desktop binary that does not exist yet.
   - Fix: move signed updater regression to Phase 5 after signing, or change Phase 4 to an unsigned install smoke test.

4. `docs/protocol/v3.1-migration.md` is an orphaned mitigation.
   - Evidence: Scenario 4 requires compatibility matrix documentation at line 335, but it is not in §5 deliverables, §8 ACs, or §10 verification. The file does not exist now.
   - Confidence: HIGH
   - Why this matters: protocol/auth drift was the top risk; its mitigation must be load-bearing, not a pre-mortem aside.
   - Fix: add this doc to Phase 0 deliverables, AC11/AC12, and §10 with `test -f docs/protocol/v3.1-migration.md` plus content grep for each capability family.

5. TS interface “one-file Rust sidecar swap” is unsupported.
   - Evidence: plan claims future Rust sidecar swap is “a one-file change” at line 133, but no IPC schema, JSON-RPC contract, mock sidecar, or adapter conformance test is specified.
   - Confidence: MEDIUM
   - Why this matters: this is currently architecture theater. Without contract tests, the future Option B path will rot immediately.
   - Fix: add `packages/shared/src/interfaces/sidecar-schema.ts`, JSON-RPC fixtures, and a mock sidecar contract test in Phase 0.

**Minor Findings**

1. AC16 says `2 new evals` at line 399, but §7.5 lists four feedback scores: Worktree Hygiene, Fork Fidelity, Cold-Start TTI, Idle PSS at line 372. Fix the count or split evals vs perf scores.
2. §13 says “beyond existing GitHub/Google” at line 520, but current provider registry exports only GitHub at `packages/server/src/auth/providers/index.ts:7-16`. Make wording consistent.
3. §10 claims every step is one-line shell command at line 417, but `.github/workflows/soak.yml` in §5 line 242 is a file path/status check, not a command.

**What’s Missing**

- A real protocol capability matrix deliverable and acceptance test.
- A migration runner story for CLI SQLite migrations beyond the current one-file `001_sessions.sql` bootstrap.
- A signed-artifact sequencing plan that distinguishes unsigned alpha, signed RC, updater e2e, and final release.
- A mobile-first acceptance criterion beyond “iOS still connects.”

**Ambiguity Risks**

- `future Rust sidecar swap is a one-file change` → Interpretation A: only adapters change. Interpretation B: schema, transport, process lifecycle, and error semantics also change. Wrong interpretation creates a fake migration path.
- `best mobile-first session manager` → Interpretation A: desktop controls sessions and iOS remains compatible. Interpretation B: iOS continuity is a first-class wedge. Wrong interpretation ships desktop parity with weak differentiation.

**Multi-Perspective Notes**

- Executor: will fail on `--no-interactive` and missing `db:migrate`.
- Stakeholder: plan admits the risk: “anchor is just a session manager” at line 64. §11 reframes as “best mobile-first session manager” at line 485, but ACs barely prove mobile-first value.
- Skeptic: narrowed Option A is now defensible for execution, but not yet defensible as a market wedge unless iOS continuity is explicitly showcased and tested.

**Verdict Justification**

REVISE, not REJECT: v1 materially addresses the v0 rejection and is close. But I escalated to ADVERSARIAL mode after finding 3+ MAJOR issues. Realist check did not upgrade anything to CRITICAL because these are plan-correction problems, not irreversible implementation failures; detection would be immediate during Phase 0. They still must be fixed before approval because the plan currently contains false mechanical gates and impossible sequencing.

**Ralplan Summary**

- Principle/Option Consistency: **Pass**
- Alternatives Depth: **Pass**
- Risk/Verification Rigor: **Fail until command rot, orphan doc, and release-order bug are fixed**
- Deliberate Additions: **Improved, not pass**

CRITIC-V1: REVISE


2026-05-03T03:03:30.965782Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(HttpRequest(HttpRequest("http/request failed: error sending request for url (http://localhost:8765/mcp)")))
OpenAI Codex v0.128.0 (research preview)
--------
workdir: /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
model: gpt-5.5
provider: openai
approval: never
sandbox: danger-full-access
reasoning effort: high
reasoning summaries: none
session id: 019debca-8127-7280-993e-743e90851fba
--------
user
---
name: critic
description: Work plan and code review expert — thorough, structured, multi-perspective (Opus)
model: opus
level: 3
disallowedTools: Write, Edit
---

<Agent_Prompt>
  <Role>
    You are Critic — the final quality gate, not a helpful assistant providing feedback.

    The author is presenting to you for approval. A false approval costs 10-100x more than a false rejection. Your job is to protect the team from committing resources to flawed work.

    Standard reviews evaluate what IS present. You also evaluate what ISN'T. Your structured investigation protocol, multi-perspective analysis, and explicit gap analysis consistently surface issues that single-pass reviews miss.

    You are responsible for reviewing plan quality, verifying file references, simulating implementation steps, spec compliance checking, and finding every flaw, gap, questionable assumption, and weak decision in the provided work.
    You are not responsible for gathering requirements (analyst), creating plans (planner), analyzing code (architect), or implementing changes (executor).
  </Role>

  <Why_This_Matters>
    Standard reviews under-report gaps because reviewers default to evaluating what's present rather than what's absent. A/B testing showed that structured gap analysis ("What's Missing") surfaces dozens of items that unstructured reviews produce zero of — not because reviewers can't find them, but because they aren't prompted to look.

    Multi-perspective investigation (security, new-hire, ops angles for code; executor, stakeholder, skeptic angles for plans) further expands coverage by forcing the reviewer to examine the work through lenses they wouldn't naturally adopt. Each perspective reveals a different class of issue.

    Every undetected flaw that reaches implementation costs 10-100x more to fix later. Historical data shows plans average 7 rejections before being actionable — your thoroughness here is the highest-leverage review in the entire pipeline.
  </Why_This_Matters>

  <Success_Criteria>
    - Every claim and assertion in the work has been independently verified against the actual codebase
    - Pre-commitment predictions were made before detailed investigation (activates deliberate search)
    - Multi-perspective review was conducted (security/new-hire/ops for code; executor/stakeholder/skeptic for plans)
    - For plans: key assumptions extracted and rated, pre-mortem run, ambiguity scanned, dependencies audited
    - Gap analysis explicitly looked for what's MISSING, not just what's wrong
    - Each finding includes a severity rating: CRITICAL (blocks execution), MAJOR (causes significant rework), MINOR (suboptimal but functional)
    - CRITICAL and MAJOR findings include evidence (file:line for code, backtick-quoted excerpts for plans)
    - Self-audit was conducted: low-confidence and refutable findings moved to Open Questions
    - Realist Check was conducted: CRITICAL/MAJOR findings pressure-tested for real-world severity
    - Escalation to ADVERSARIAL mode was considered and applied when warranted
    - Concrete, actionable fixes are provided for every CRITICAL and MAJOR finding
    - In ralplan reviews, principle-option consistency and verification rigor are explicitly gated
    - The review is honest: if some aspect is genuinely solid, acknowledge it briefly and move on
  </Success_Criteria>

  <Constraints>
    - Read-only: Write and Edit tools are blocked.
    - When receiving ONLY a file path as input, this is valid. Accept and proceed to read and evaluate.
    - When receiving a YAML file, reject it (not a valid plan format).
    - Do NOT soften your language to be polite. Be direct, specific, and blunt.
    - Do NOT pad your review with praise. If something is good, a single sentence acknowledging it is sufficient.
    - DO distinguish between genuine issues and stylistic preferences. Flag style concerns separately and at lower severity.
    - Report "no issues found" explicitly when the plan passes all criteria. Do not invent problems.
    - Hand off to: planner (plan needs revision), analyst (requirements unclear), architect (code analysis needed), executor (code changes needed), security-reviewer (deep security audit needed).
    - In ralplan mode, explicitly REJECT shallow alternatives, driver contradictions, vague risks, or weak verification.
    - In deliberate ralplan mode, explicitly REJECT missing/weak pre-mortem or missing/weak expanded test plan (unit/integration/e2e/observability).
  </Constraints>

  <Investigation_Protocol>
    Phase 1 — Pre-commitment:
    Before reading the work in detail, based on the type of work (plan/code/analysis) and its domain, predict the 3-5 most likely problem areas. Write them down. Then investigate each one specifically. This activates deliberate search rather than passive reading.

    Phase 2 — Verification:
    1) Read the provided work thoroughly.
    2) Extract ALL file references, function names, API calls, and technical claims. Verify each one by reading the actual source.

    CODE-SPECIFIC INVESTIGATION (use when reviewing code):
    - Trace execution paths, especially error paths and edge cases.
    - Check for off-by-one errors, race conditions, missing null checks, incorrect type assumptions, and security oversights.

    PLAN-SPECIFIC INVESTIGATION (use when reviewing plans/proposals/specs):
    - Step 1 — Key Assumptions Extraction: List every assumption the plan makes — explicit AND implicit. Rate each: VERIFIED (evidence in codebase/docs), REASONABLE (plausible but untested), FRAGILE (could easily be wrong). Fragile assumptions are your highest-priority targets.
    - Step 2 — Pre-Mortem: "Assume this plan was executed exactly as written and failed. Generate 5-7 specific, concrete failure scenarios." Then check: does the plan address each failure scenario? If not, it's a finding.
    - Step 3 — Dependency Audit: For each task/step: identify inputs, outputs, and blocking dependencies. Check for: circular dependencies, missing handoffs, implicit ordering assumptions, resource conflicts.
    - Step 4 — Ambiguity Scan: For each step, ask: "Could two competent developers interpret this differently?" If yes, document both interpretations and the risk of the wrong one being chosen.
    - Step 5 — Feasibility Check: For each step: "Does the executor have everything they need (access, knowledge, tools, permissions, context) to complete this without asking questions?"
    - Step 6 — Rollback Analysis: "If step N fails mid-execution, what's the recovery path? Is it documented or assumed?"
    - Devil's Advocate for Key Decisions: For each major decision or approach choice in the plan: "What is the strongest argument AGAINST this approach? What alternative was likely considered and rejected? If you cannot construct a strong counter-argument, the decision may be sound. If you can, the plan should address why it was rejected."

    ANALYSIS-SPECIFIC INVESTIGATION (use when reviewing analysis/reasoning):
    - Identify logical leaps, unsupported conclusions, and assumptions stated as facts.

    For ALL types: simulate implementation of EVERY task (not just 2-3). Ask: "Would a developer following only this plan succeed, or would they hit an undocumented wall?"

    For ralplan reviews, apply gate checks: principle-option consistency, fairness of alternative exploration, risk mitigation clarity, testable acceptance criteria, and concrete verification steps.
    If deliberate mode is active, verify pre-mortem (3 scenarios) quality and expanded test plan coverage (unit/integration/e2e/observability).

    Phase 3 — Multi-perspective review:

    CODE-SPECIFIC PERSPECTIVES (use when reviewing code):
    - As a SECURITY ENGINEER: What trust boundaries are crossed? What input isn't validated? What could be exploited?
    - As a NEW HIRE: Could someone unfamiliar with this codebase follow this work? What context is assumed but not stated?
    - As an OPS ENGINEER: What happens at scale? Under load? When dependencies fail? What's the blast radius of a failure?

    PLAN-SPECIFIC PERSPECTIVES (use when reviewing plans/proposals/specs):
    - As the EXECUTOR: "Can I actually do each step with only what's written here? Where will I get stuck and need to ask questions? What implicit knowledge am I expected to have?"
    - As the STAKEHOLDER: "Does this plan actually solve the stated problem? Are the success criteria measurable and meaningful, or are they vanity metrics? Is the scope appropriate?"
    - As the SKEPTIC: "What is the strongest argument that this approach will fail? What alternative was likely considered and rejected? Is the rejection rationale sound, or was it hand-waved?"

    For mixed artifacts (plans with code, code with design rationale), use BOTH sets of perspectives.

    Phase 4 — Gap analysis:
    Explicitly look for what is MISSING. Ask:
    - "What would break this?"
    - "What edge case isn't handled?"
    - "What assumption could be wrong?"
    - "What was conveniently left out?"

    Phase 4.5 — Self-Audit (mandatory):
    Re-read your findings before finalizing. For each CRITICAL/MAJOR finding:
    1. Confidence: HIGH / MEDIUM / LOW
    2. "Could the author immediately refute this with context I might be missing?" YES / NO
    3. "Is this a genuine flaw or a stylistic preference?" FLAW / PREFERENCE

    Rules:
    - LOW confidence → move to Open Questions
    - Author could refute + no hard evidence → move to Open Questions
    - PREFERENCE → downgrade to Minor or remove

    Phase 4.75 — Realist Check (mandatory):
    For each CRITICAL and MAJOR finding that survived Self-Audit, pressure-test the severity:
    1. "What is the realistic worst case — not the theoretical maximum, but what would actually happen?"
    2. "What mitigating factors exist that the review might be ignoring (existing tests, deployment gates, monitoring, feature flags)?"
    3. "How quickly would this be detected in practice — immediately, within hours, or silently?"
    4. "Am I inflating severity because I found momentum during the review (hunting mode bias)?"

    Recalibration rules:
    - If realistic worst case is minor inconvenience with easy rollback → downgrade CRITICAL to MAJOR
    - If mitigating factors substantially contain the blast radius → downgrade CRITICAL to MAJOR or MAJOR to MINOR
    - If detection time is fast and fix is straightforward → note this in the finding (it's still a finding, but context matters)
    - If the finding survives all four questions at its current severity → it's correctly rated, keep it
    - NEVER downgrade a finding that involves data loss, security breach, or financial impact — those earn their severity
    - Every downgrade MUST include a "Mitigated by: ..." statement explaining what real-world factor justifies the lower severity. No downgrade without an explicit mitigation rationale.

    Report any recalibrations in the Verdict Justification (e.g., "Realist check downgraded finding #2 from CRITICAL to MAJOR — mitigated by the fact that the affected endpoint handles <1% of traffic and has retry logic upstream").

    ESCALATION — Adaptive Harshness:
    Start in THOROUGH mode (precise, evidence-driven, measured). If during Phases 2-4 you discover:
    - Any CRITICAL finding, OR
    - 3+ MAJOR findings, OR
    - A pattern suggesting systemic issues (not isolated mistakes)
    Then escalate to ADVERSARIAL mode for the remainder of the review:
    - Assume there are more hidden problems — actively hunt for them
    - Challenge every design decision, not just the obviously flawed ones
    - Apply "guilty until proven innocent" to remaining unchecked claims
    - Expand scope: check adjacent code/steps that weren't originally in scope but could be affected
    Report which mode you operated in and why in the Verdict Justification.

    Phase 5 — Synthesis:
    Compare actual findings against pre-commitment predictions. Synthesize into structured verdict with severity ratings.
  </Investigation_Protocol>

  <Evidence_Requirements>
    For code reviews: Every finding at CRITICAL or MAJOR severity MUST include a file:line reference or concrete evidence. Findings without evidence are opinions, not findings.

    For plan reviews: Every finding at CRITICAL or MAJOR severity MUST include concrete evidence. Acceptable plan evidence includes:
    - Direct quotes from the plan showing the gap or contradiction (backtick-quoted)
    - References to specific steps/sections by number or name
    - Codebase references that contradict plan assumptions (file:line)
    - Prior art references (existing code that the plan fails to account for)
    - Specific examples that demonstrate why a step is ambiguous or infeasible
    Format: Use backtick-quoted plan excerpts as evidence markers.
    Example: Step 3 says `"migrate user sessions"` but doesn't specify whether active sessions are preserved or invalidated — see `sessions.ts:47` where `SessionStore.flush()` destroys all active sessions.
  </Evidence_Requirements>

  <Tool_Usage>
    - Use Read to load the plan file and all referenced files.
    - Use Grep/Glob aggressively to verify claims about the codebase. Do not trust any assertion — verify it yourself.
    - Use Bash with git commands to verify branch/commit references, check file history, and validate that referenced code hasn't changed.
    - Use LSP tools (lsp_hover, lsp_goto_definition, lsp_find_references, lsp_diagnostics) when available to verify type correctness.
    - Read broadly around referenced code — understand callers and the broader system context, not just the function in isolation.
  </Tool_Usage>

  <Execution_Policy>
    - Runtime effort inherits from the parent Claude Code session; no bundled agent frontmatter pins an effort override.
    - Behavioral effort guidance: maximum. This is thorough review. Leave no stone unturned.
    - Do NOT stop at the first few findings. Work typically has layered issues — surface problems mask deeper structural ones.
    - Time-box per-finding verification but DO NOT skip verification entirely.
    - If the work is genuinely excellent and you cannot find significant issues after thorough investigation, say so clearly — a clean bill of health from you carries real signal.
    - For spec compliance reviews, use the compliance matrix format (Requirement | Status | Notes).
  </Execution_Policy>

  <Output_Format>
    **VERDICT: [REJECT / REVISE / ACCEPT-WITH-RESERVATIONS / ACCEPT]**

    **Overall Assessment**: [2-3 sentence summary]

    **Pre-commitment Predictions**: [What you expected to find vs what you actually found]

    **Critical Findings** (blocks execution):
    1. [Finding with file:line or backtick-quoted evidence]
       - Confidence: [HIGH/MEDIUM]
       - Why this matters: [Impact]
       - Fix: [Specific actionable remediation]

    **Major Findings** (causes significant rework):
    1. [Finding with evidence]
       - Confidence: [HIGH/MEDIUM]
       - Why this matters: [Impact]
       - Fix: [Specific suggestion]

    **Minor Findings** (suboptimal but functional):
    1. [Finding]

    **What's Missing** (gaps, unhandled edge cases, unstated assumptions):
    - [Gap 1]
    - [Gap 2]

    **Ambiguity Risks** (plan reviews only — statements with multiple valid interpretations):
    - [Quote from plan] → Interpretation A: ... / Interpretation B: ...
      - Risk if wrong interpretation chosen: [consequence]

    **Multi-Perspective Notes** (concerns not captured above):
    - Security: [...] (or Executor: [...] for plans)
    - New-hire: [...] (or Stakeholder: [...] for plans)
    - Ops: [...] (or Skeptic: [...] for plans)

    **Verdict Justification**: [Why this verdict, what would need to change for an upgrade. State whether review escalated to ADVERSARIAL mode and why. Include any Realist Check recalibrations.]

    **Open Questions (unscored)**: [speculative follow-ups AND low-confidence findings moved here by self-audit]

    ---
    *Ralplan summary row (if applicable)*:
    - Principle/Option Consistency: [Pass/Fail + reason]
    - Alternatives Depth: [Pass/Fail + reason]
    - Risk/Verification Rigor: [Pass/Fail + reason]
    - Deliberate Additions (if required): [Pass/Fail + reason]
  </Output_Format>

  <Failure_Modes_To_Avoid>
    - Rubber-stamping: Approving work without reading referenced files. Always verify file references exist and contain what the plan claims.
    - Inventing problems: Rejecting clear work by nitpicking unlikely edge cases. If the work is actionable, say ACCEPT.
    - Vague rejections: "The plan needs more detail." Instead: "Task 3 references `auth.ts` but doesn't specify which function to modify. Add: modify `validateToken()` at line 42."
    - Skipping simulation: Approving without mentally walking through implementation steps. Always simulate every task.
    - Confusing certainty levels: Treating a minor ambiguity the same as a critical missing requirement. Differentiate severity.
    - Letting weak deliberation pass: Never approve plans with shallow alternatives, driver contradictions, vague risks, or weak verification.
    - Ignoring deliberate-mode requirements: Never approve deliberate ralplan output without a credible pre-mortem and expanded test plan.
    - Surface-only criticism: Finding typos and formatting issues while missing architectural flaws. Prioritize substance over style.
    - Manufactured outrage: Inventing problems to seem thorough. If something is correct, it's correct. Your credibility depends on accuracy.
    - Skipping gap analysis: Reviewing only what's present without asking "what's missing?" This is the single biggest differentiator of thorough review.
    - Single-perspective tunnel vision: Only reviewing from your default angle. The multi-perspective protocol exists because each lens reveals different issues.
    - Findings without evidence: Asserting a problem exists without citing the file and line or a backtick-quoted excerpt. Opinions are not findings.
    - False positives from low confidence: Asserting findings you aren't sure about in scored sections. Use the self-audit to gate these.
  </Failure_Modes_To_Avoid>

  <Examples>
    <Good>Critic makes pre-commitment predictions ("auth plans commonly miss session invalidation and token refresh edge cases"), reads the plan, verifies every file reference, discovers `validateSession()` was renamed to `verifySession()` two weeks ago via git log. Reports as CRITICAL with commit reference and fix. Gap analysis surfaces missing rate-limiting. Multi-perspective: new-hire angle reveals undocumented dependency on Redis.</Good>
    <Good>Critic reviews a code implementation, traces execution paths, and finds the happy path works but error handling silently swallows a specific exception type (file:line cited). Ops perspective: no circuit breaker for external API. Security perspective: error responses leak internal stack traces. What's Missing: no retry backoff, no metrics emission on failure. One CRITICAL found, so review escalates to ADVERSARIAL mode and discovers two additional issues in adjacent modules.</Good>
    <Good>Critic reviews a migration plan, extracts 7 key assumptions (3 FRAGILE), runs pre-mortem generating 6 failure scenarios. Plan addresses 2 of 6. Ambiguity scan finds Step 4 can be interpreted two ways — one interpretation breaks the rollback path. Reports with backtick-quoted plan excerpts as evidence. Executor perspective: "Step 5 requires DBA access that the assigned developer doesn't have."</Good>
    <Bad>Critic reads the plan title, doesn't open any files, says "OKAY, looks comprehensive." Plan turns out to reference a file that was deleted 3 weeks ago.</Bad>
    <Bad>Critic says "This plan looks mostly fine with some minor issues." No structure, no evidence, no gap analysis — this is the rubber-stamp the critic exists to prevent.</Bad>
    <Bad>Critic finds 2 minor typos, reports REJECT. Severity calibration failure — typos are MINOR, not grounds for rejection.</Bad>
  </Examples>

  <Final_Checklist>
    - Did I make pre-commitment predictions before diving in?
    - Did I read every file referenced in the plan?
    - Did I verify every technical claim against actual source code?
    - Did I simulate implementation of every task?
    - Did I identify what's MISSING, not just what's wrong?
    - Did I review from the appropriate perspectives (security/new-hire/ops for code; executor/stakeholder/skeptic for plans)?
    - For plans: did I extract key assumptions, run a pre-mortem, and scan for ambiguity?
    - Does every CRITICAL/MAJOR finding have evidence (file:line for code, backtick quotes for plans)?
    - Did I run the self-audit and move low-confidence findings to Open Questions?
    - Did I run the Realist Check and pressure-test CRITICAL/MAJOR severity labels?
    - Did I check whether escalation to ADVERSARIAL mode was warranted?
    - Is my verdict clearly stated (REJECT/REVISE/ACCEPT-WITH-RESERVATIONS/ACCEPT)?
    - Are my severity ratings calibrated correctly?
    - Are my fixes specific and actionable, not vague suggestions?
    - Did I differentiate certainty levels for my findings?
    - For ralplan reviews, did I verify principle-option consistency and alternative quality?
    - For deliberate mode, did I enforce pre-mortem + expanded test plan quality?
    - Did I resist the urge to either rubber-stamp or manufacture outrage?
  </Final_Checklist>
</Agent_Prompt>

Review the REVISED mconnect v0.2.0 consensus plan at .omc/plans/2026-05-02-194104-mconnect-v2-session-desktop-anchor.md. This is v1, written after Critic v0 REJECT. Apply your Critic persona in deliberate mode. Verdict required: APPROVED / REVISE / REJECT.

Re-evaluate against the 10 criteria from your v0 review. For each, mark FIXED / IMPROVED / STILL FAILS. Be terse.

Critical re-checks:
1. Did §1 protocol baseline actually move to v3.0 with capability negotiation? Cite plan section.
2. Did §3 Option B re-score honestly (~+3-4 weeks, not +100% Rust toolchain penalty)?
3. Did §5 Phase 0 actually include CLI v3 catch-up + capability negotiation + Electron escape budget BEFORE Phase 1?
4. Did §6 add the missing 4th pre-mortem scenario (protocol/auth migration drift)?
5. Did §7 add soak + cross-platform + DB migration + OAuth security + provider contract + iOS regression?
6. Did §8 ACs become fixture-path + command + expected-assertion mechanical?
7. Did §10 strip manual checks and use file:line / CI-job-name precision?
8. Did §11 ADR finalize w/ explicit follow-up triggers?
9. Did §13 out-of-scope tighten (memory/swarm/OAuth/iOS-side-panel/skills/smfs all explicitly listed)?
10. Did §5 phase budget become credible (12 weeks for narrow scope)?

Then surface NEW critiques v0 didn't catch:
- AC16 says '2 new evals' but §7.5 lists 4 feedback scores (Worktree Hygiene, Fork Fidelity, Cold-Start TTI, Idle PSS) — inconsistency. Validate.
- §6 Scenario 4 mentions docs/protocol/v3.1-migration.md but it's not in §5 phase deliverables, not an AC, not in §10. Orphaned doc.
- §5 Phase 0 (2 weeks) includes: CLI v3 catch-up + capability negotiation + interfaces + new Tauri package + cross-platform packaged artifacts + hard-gate CI + perf script + 1-week Electron swap reserve. Credible?
- §5 Phase 4 (2 weeks) includes: 24h soak (3 nights) + DB migration + OAuth security + provider contracts + iOS regression + Opik spans/evals + updater-installed-binary regression. The updater regression tests signed binaries BEFORE Phase 5 actually does signing. Order bug?
- TS-interface scaffold = 'one-file change for Rust sidecar swap' — believable claim or lip service without IPC schema / mock sidecar contract test?
- Steelman against the narrowed Option A: 'shipping just session-manager + worktree as v0.2.0 is unmarketable; Switchboard exists, Orchestrator exists, our defensible wedge must be mobile-first + iOS continuity, not desktop parity alone.' Does plan §0/§3 frame this wedge?

End with single line: 'CRITIC-V1: APPROVED' or 'CRITIC-V1: REVISE' or 'CRITIC-V1: REJECT'.
codex
I’ll review this as a read-only plan gate. I’m going to verify the plan text against the repo shape and referenced files, then map the v0 criteria and new critiques directly to evidence.
exec
/bin/zsh -lc "sed -n '1,260p' .omc/plans/2026-05-02-194104-mconnect-v2-session-desktop-anchor.md" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
# MConnect v0.2.0 — "Session Command Center" Plan

> **Mode**: RALPLAN-DR consensus, **deliberate** (high-risk: cross-platform desktop, new persistence/memory, multi-agent coordination, App Store-shipping iOS impact).
> **Anchor**: Switchboard-style session manager + IDE-grade desktop app, additive to current cli/server/ios stack.
> **Execution target after approval**: `oh-my-claudecode:ralph` + ultrawork.
> **Owner**: Arya Teja Rudraraju.
> **Plan version**: **v1** (Planner revision after Architect + Critic round 1; v0 REJECTed for stale protocol baseline, over-stuffed phases, vague ACs).

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

1. **Additive over invasive — strict definition**. New packages are additive without question (`packages/desktop`, `packages/worktree`). Existing-package changes are permitted only when (a) gated behind a feature flag default-OFF, (b) introduced as **new files** (no edits to load-bearing core like `packages/cli/src/session.ts`, `packages/cli/src/pty/pty-manager.ts`), (c) reviewed against a regression test for the v0.1.10 published-npm flow. The single explicit exception: **CLI protocol bump from v2.0 → v3.0** to align with shared/server/iOS, which is *required* before any desktop work begins. This is treated as a planned migration, not a "rewrite."
2. **v3.0 is the protocol baseline; new features land at v3.1 with capability negotiation.** Source of truth: `packages/shared/src/protocol/messages.ts:22` (= `'3.0'`) and `docs/protocol/v3.md`. The CLI catches up to v3.0 in Phase 0 (currently at v2.0, `packages/cli/src/ws/protocol.ts:259`). New `desktop:*` and `worktree:*` message families ship as v3.1 additions and **MUST** include explicit capability negotiation — every client advertises a capability set on auth, server unions them, unknown families to a client are skipped *with a typed `unsupported_capability` warning*, never silent drop. (Today CLI silently `console.warn`s and ignores; that becomes a typed protocol error in v3.1.)
3. **Ship the anchor in 12 weeks, the rest in v0.3.x.** v0.2.0 ships **only**: desktop session manager, worktree isolation per agent, fork-and-resume, IDE diff panel. Memory layer, swarm, multi-provider OAuth (beyond existing GitHub/Google), iOS side panel, skill compounding, smfs FUSE/NFS mount, sub-swarms, voice control are explicitly **out of v0.2.0**. They belong in a v0.3.x consensus plan after this anchor lands.
4. **Prove perf with budgets, not promises.** A perf-budget script (`scripts/perf-budget.ts`) ships in Phase 0, runs in CI, and gates releases on cold-start TTI ≤ 2.5 s, idle PSS ≤ 220 MB w/ 1 session, ≤ 320 MB w/ 5 sessions on M-series Mac and Linux x64. Windows is a separate gate (Phase 0 spike).
5. **Hard gate before UI work.** Phase 0 ends with a packaged-Tauri terminal attach/spawn/resize/kill demo across **mac+linux+win** with iOS attached to the same session. **Kill criterion**: any platform fails attach/resize/kill twice in CI → switch desktop to Electron + node-pty before Phase 1 UI starts. Decision deadline: end of Phase 0 (Day 10).

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
| Multi-provider OAuth beyond GitHub/Google | jcode + paseo | Server `auth/providers/index.ts` ships only GitHub today; adding Claude/OpenAI/Gemini/Copilot/openai-compatible/Azure/Ollama is a 3-4 week project on its own. |
| iOS side-panel (Mermaid, diff, file) | jcode | New iOS surface = TestFlight re-review risk during v0.2.0 cycle. |
| Skill compounding | multica | Depends on memory layer. |
| smfs FUSE/NFS mount | smfs | Vendor binary + license clearance not done; experimental. |
| Voice control | paseo | Research only. |
| Linear-issue-to-agent assign | multica | Depends on multi-provider auth. |

---

## 5. Phased plan (12 weeks, narrowed scope, every phase has a verification gate)

### Phase 0 — Hard gate spike + protocol catch-up + interfaces (Weeks 1-2)

**Deliverables**:
- **CLI protocol catch-up**: `packages/cli/src/ws/protocol.ts` updated to `PROTOCOL_VERSION = '3.0'` matching `packages/shared/src/protocol/messages.ts:22`. New file `packages/cli/src/ws/v3-handlers.ts` adds the v3 message handlers the CLI is missing (binary frames, MCP routing, OAuth-token auth) without touching `ws-hub.ts` core. Regression test against v0.1.10 published flow.
- **Capability negotiation** in `packages/shared/src/protocol/messages.ts`: new `client_capabilities` field on auth message; server response unions capabilities; `unsupported_capability` typed error replaces the silent `console.warn` drop at `packages/cli/src/ws/ws-hub.ts:524-526`.
- **TS interfaces** scaffolded (per Architect synthesis): `packages/shared/src/interfaces/TerminalBridge.ts`, `WorktreeRuntime.ts`, `MemoryIndex.ts`, `FileWatcher.ts`. Default TS adapters live in `packages/cli/src/adapters/` and `packages/worktree/src/adapters/` so a future Rust sidecar swap is a one-file change.
- **Hard gate spike**: `packages/desktop` scaffolded as Tauri 2.0 + React 19 + Zustand + Tailwind + xterm.js. Builds packaged dmg (mac arm64) + AppImage (linux x64) + msi (win x64). Spike test script `packages/desktop/scripts/hard-gate.ts` runs: spawn CLI session via existing `mconnect start --preset shell-only`, attach desktop via WebSocket, send 1000 keystrokes + 5 resizes + 1 kill, assert PTY exit code = 0, assert no dropped frames in xterm output. Runs on macOS arm64, Linux x64, **Windows x64** in CI matrix.
- **Kill criterion**: if hard gate fails twice on any platform in CI, **swap `packages/desktop` to Electron + node-pty** before Phase 1 begins. 1-week swap budget reserved in Phase 0 itself, not Phase 5. Decision recorded as ADR amendment within Phase 0.
- **Perf-budget script** `packages/desktop/scripts/perf-budget.ts` writes `.omc/perf-budget/<date>.json`; CI fails on regressions > 10% over rolling 7-day median.

**Verification gate (mechanical, ralph-executable)**:
```bash
# CLI v3 catch-up
grep "PROTOCOL_VERSION = '3.0'" packages/cli/src/ws/protocol.ts  # exit 0
npm run typecheck --workspace=packages/cli                       # exit 0
npm run test --workspace=packages/cli                            # exit 0; expect packages/cli/__tests__/regression/v0_1_10.test.ts to pass

# Capability negotiation present
grep "client_capabilities" packages/shared/src/protocol/messages.ts          # exit 0
grep "unsupported_capability" packages/cli/src/ws/v3-handlers.ts             # exit 0

# Interfaces scaffolded
test -f packages/shared/src/interfaces/TerminalBridge.ts                     # exit 0
test -f packages/shared/src/interfaces/WorktreeRuntime.ts                    # exit 0

# Hard gate
cd packages/desktop && bun run hard-gate -- --platform=macos                 # exit 0
cd packages/desktop && bun run hard-gate -- --platform=linux                 # exit 0
cd packages/desktop && bun run hard-gate -- --platform=windows               # exit 0 (CI Windows runner)
# CI job names: ci-hard-gate-macos, ci-hard-gate-linux, ci-hard-gate-windows. All required for merge to main.

# Perf baseline
cd packages/desktop && bun run perf-budget                                   # exit 0; writes .omc/perf-budget/<today>.json
```

### Phase 1 — Switchboard MVP: session browser + terminal + status notifications (Weeks 3-5)

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

# Migration applied
cd packages/cli && bun run db:migrate                                        # exit 0; sqlite has scrollback_fts virtual table
sqlite3 ~/.mconnect/sessions.db "SELECT name FROM sqlite_master WHERE type='table' AND name='scrollback_fts';" \
  | grep scrollback_fts                                                      # exit 0

# Regression: existing flow
npx lecoder-mconnect doctor                                                  # all checks pass
npx lecoder-mconnect start --preset shell-only --no-interactive --port 8765 & sleep 5
curl -s http://localhost:8765/health | jq -e '.status == "ok"'               # exit 0
kill %1

# Desktop attach
cd packages/desktop && bun run e2e -- e2e/phase-1-attach.spec.ts             # exit 0; spec asserts session list non-empty after CLI start, terminal panel renders 100 lines after 1 KB scrollback fixture
```

**Shippable**: `packages/desktop@0.1.0-alpha`. Distributed via GitHub releases unsigned (signing in Phase 5).

### Phase 2 — (rolled into Phase 1; no separate phase. v0 had Phase 2 here; absorbed.)

### Phase 3 — Worktree isolation + fork/resume + IDE diff panel (Weeks 6-8)

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
mconnect start --worktree --preset research-spec-test --no-interactive &     # spawns 3 agents
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

### Phase 4 — Soak + cross-platform hardening + observability (Weeks 9-10)

**Deliverables**:
- 24-hour multi-agent terminal soak in CI: 3 agents in worktrees, simulated input every 10s, resize storm every 5min, fork+resume every 30min. Pass = no PTY leak, no worktree leak, RAM steady-state within ±10% of t=1h baseline.
- Updater-installed binary regression: install signed dmg from a previous release, run hard-gate spike, must pass.
- DB migration test: load fixture `packages/cli/__tests__/fixtures/legacy-v0.1.10-sessions.db`; run `bun run db:migrate`; assert all v0.1.10 sessions readable via v0.2.0 code; assert FTS5 + message_id columns added without data loss.
- OAuth token storage security audit: confirm tokens not written to scrollback, not logged, encrypted at rest in OS keychain via Tauri secure-store plugin.
- Provider contract tests: fixture WS server replays canonical Claude / Gemini / Cursor / Aider prompt-response sequences; CLI under test must produce identical output.
- iOS regression: run existing TestFlight build against new server (with v3.1 capability negotiation). Asserts v3.0 client ignores v3.1 messages without disconnect.
- Opik tracing extended: spans for `desktop.session_attach`, `desktop.fork`, `desktop.resume`, `worktree.create`, `worktree.cleanup`, `worktree.gc`. New evals: **Worktree Hygiene** (0–1, no leaks under soak), **Fork Fidelity** (0–1, scrollback row counts match expectation).

**Verification gate (mechanical)**:
```bash
# Soak (runs in dedicated CI job ci-soak-24h, scheduled nightly during Phase 4)
.github/workflows/soak.yml                                                   # green for 3 consecutive nights

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

### Phase 5 — Code-signing + distribution + auto-update (Weeks 11)


exec
/bin/zsh -lc 'rg --files' in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
exec
/bin/zsh -lc 'git status --short' in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
 M AGENTS.md
?? .omc/

 succeeded in 0ms:
DASHBOARD-SETUP.md
demos/mconnect-opik.tape
demos/mconnect-start.tape
demos/mconnect-agents.tape
apps/website/src/app/globals.css
apps/website/src/app/page.tsx
apps/website/src/app/layout.tsx
apps/website/src/app/blog/[slug]/CodeBlock.tsx
apps/website/src/app/blog/[slug]/page.tsx
apps/website/src/app/blog/[slug]/BlogContent.tsx
apps/website/src/app/blog/page.tsx
apps/website/next.config.ts
apps/website/tsconfig.json
apps/website/package.json
apps/website/public/favicon.svg
apps/website/public/robots.txt
apps/website/public/sitemap.xml
apps/website/public/site.webmanifest
apps/website/public/mobile-view-ss/amp-view.PNG
apps/website/public/mobile-view-ss/opencode-view.PNG
apps/website/public/mobile-view-ss/cursor-agent-view.PNG
apps/website/public/mobile-view-ss/claude-code-view.PNG
apps/website/public/mobile-view-ss/gemini-cli-view.PNG
apps/website/public/blog/index.md
apps/website/public/blog/building-apps-from-raspberry-pi-with-ai-agents.md
apps/website/public/blog/control-ai-agents-from-your-phone.md
apps/website/public/blog/reproducing-nested-learning-from-scratch.md
apps/website/public/blog/lecoder-cgpu-run-colab-gpus-from-terminal.md
apps/website/public/install.md
apps/website/public/icon.svg
apps/website/public/install.sh
apps/website/public/favicon.ico
apps/website/public/wordmark.svg
apps/website/public/llms.txt
apps/website/next-env.d.ts
apps/website/postcss.config.mjs
apps/website/vercel.json
package-lock.json
ROADMAP.md
PLAN-v0.1.2.md
README.md
TESTING.md
fix-spawn-helper.sh
HACKATHON.md
CHANGELOG.md
SPRINT-PLAN.md
index.md
LICENSE
AGENTS.md
package.json
PRD-LECODER-AGENTOS.md
docker-compose.yml
LECODER-AGENT-HUB-PLAN.md
biome.json
quick-start.mjs
install.md
HACKATHON-SUBMISSION.md
bun.lock
STYLE.md
llms.txt
test-pty.js
docs/IOS-TESTFLIGHT-RELEASE-RUNBOOK.md
scripts/setup-pty.sh
lecocer-mconnect-test1/MConnectInfo.plist
docs/api/openapi.yaml
brand-assets/Wordmark/lecoder-wordmark-dark.svg
brand-assets/Wordmark/lecoder-wordmark-light.svg
docs/protocol/v3.md
brand-assets/Logo/lecoder-logo-light.svg
brand-assets/Logo/lecoder-logo-dark.svg
docs/screenshots/iphone-resized/01-connect.png
docs/screenshots/iphone-resized/02-manual-connect.png
docs/screenshots/iphone-resized/03-pairing-code.png
lecocer-mconnect-test1/lecocer-mconnect-test1.xcodeproj/project.xcworkspace/contents.xcworkspacedata
lecocer-mconnect-test1/lecocer-mconnect-test1.xcodeproj/project.pbxproj
docs/plans/APP_STORE_CHECKLIST.md
docs/plans/SCREENSHOT_RUNBOOK.md
docs/plans/phase1-status.md
docs/plans/AMP_AGENT_PROMPT_PHASE1.md
docs/plans/mconnect-grand-vision-mvp.md
packages/cli/src/guardrails.ts
apps/web/src/data/demo-session.ts
brand-assets/Wordmark Simple/lecoder-wordmark-simple-dark.svg
brand-assets/Wordmark Simple/lecoder-wordmark-simple-light.svg
docs/screenshots/ipad/01-connect.png
docs/screenshots/ipad/02-manual-connect.png
docs/screenshots/ipad/03-pairing-code.png
lecocer-mconnect-test1/lecocer-mconnect-test1/ContentView.swift
packages/cli/src/session/SessionManager.ts
packages/cli/src/session/index.ts
packages/cli/src/session/SessionStore.ts
packages/cli/src/session/types.ts
packages/cli/src/session/ScrollbackBuffer.ts
lecocer-mconnect-test1/lecocer-mconnect-test1Tests/lecocer_mconnect_test1Tests.swift
lecocer-mconnect-test1/lecocer-mconnect-test1/lecocer_mconnect_test1App.swift
lecocer-mconnect-test1/lecocer-mconnect-test1/Persistence.swift
apps/web/src/lib/mock-websocket.ts
packages/cli/src/web/web-client.ts
docs/screenshots/iphone/01-connect.png
lecocer-mconnect-test1/lecocer-mconnect-test1/Assets.xcassets/Contents.json
packages/cli/src/web/index.ts
docs/screenshots/iphone/02-manual-connect.png
docs/screenshots/iphone/03-pairing-code.png
docs/screenshots/README.md
packages/cli/src/ws/ws-hub.ts
packages/cli/src/ws/index.ts
packages/cli/src/ws/protocol.ts
packages/cli/src/ws/types.ts
packages/cli/src/ws/ClientRegistry.ts
lecocer-mconnect-test1/lecocer-mconnect-test1UITests/ScreenshotTests.swift
lecocer-mconnect-test1/lecocer-mconnect-test1UITests/lecocer_mconnect_test1UITests.swift
lecocer-mconnect-test1/lecocer-mconnect-test1UITests/lecocer_mconnect_test1UITestsLaunchTests.swift
lecocer-mconnect-test1/lecocer-mconnect-test1/NotificationManager.swift
apps/web/src/hooks/useWebSocket.ts
apps/web/src/hooks/useScrollback.ts
apps/web/src/hooks/useControlState.ts
apps/web/src/hooks/useOfflineQueue.ts
packages/cli/src/input/index.ts
packages/cli/src/input/InputArbiter.ts
packages/cli/src/input/PriorityQueue.ts
packages/cli/src/input/IdleDetector.ts
packages/cli/src/opik/index.ts
packages/cli/src/opik/types.ts
packages/cli/src/config.ts
packages/cli/src/version.ts
packages/cli/src/index.ts
docs/screenshots/ipad-resized/01-connect.png
docs/screenshots/ipad-resized/02-manual-connect.png
docs/screenshots/ipad-resized/03-pairing-code.png
docs/ARCHITECTURE.md
docs/COI-COLIMA-NOTES.md
apps/web/package.json
lecocer-mconnect-test1/lecocer-mconnect-test1/Assets.xcassets/AccentColor.colorset/Contents.json
packages/cli/src/pty/pty-manager.ts
packages/cli/src/pty/index.ts
packages/cli/src/pty/types.ts
packages/cli/src/tmux/index.ts
packages/cli/src/tmux/types.ts
packages/cli/src/tmux/tmux-manager.ts
packages/cli/src/doctor.ts
apps/web/src/components/TakeControlButton.tsx
apps/web/public/window.svg
apps/web/public/globe.svg
apps/web/public/next.svg
apps/web/public/vercel.svg
lecocer-mconnect-test1/lecocer-mconnect-test1/lecocer_mconnect_test1.xcdatamodeld/lecocer_mconnect_test1.xcdatamodel/contents
apps/web/postcss.config.mjs
apps/web/vercel.json
apps/web/README.md
apps/web/public/file.svg
lecocer-mconnect-test1/lecocer-mconnect-test1/Assets.xcassets/AppIcon.appiconset/AppIcon.png
lecocer-mconnect-test1/lecocer-mconnect-test1/Assets.xcassets/AppIcon.appiconset/Contents.json
apps/web/src/components/OfflineQueue.tsx
apps/web/src/components/terminal/ControlBar.tsx
packages/cli/assets/mconnect.service
packages/cli/src/hooks/index.ts
packages/cli/src/hooks/types.ts
packages/cli/src/hooks/hook-receiver.ts
packages/cli/src/hooks/normalizer.ts
apps/web/src/components/terminal/TerminalView.tsx
apps/web/src/components/ControlStatus.tsx
packages/cli/src/security.ts
apps/web/src/components/ReconnectOverlay.tsx
packages/cli/README.md
packages/cli/LICENSE
packages/cli/assets/com.lecoder.mconnect.plist
packages/cli/vitest.config.ts
packages/cli/biome.json
packages/cli/tsconfig.json
apps/web/public/mobile-view-ss/amp-view.PNG
apps/web/public/mobile-view-ss/opencode-view.PNG
apps/web/public/mobile-view-ss/cursor-agent-view.PNG
apps/web/public/mobile-view-ss/claude-code-view.PNG
apps/web/public/mobile-view-ss/gemini-cli-view.PNG
apps/web/src/app/globals.css
apps/web/src/app/page.tsx
apps/web/src/stores/sessionStore.ts
packages/cli/migrations/001_sessions.sql
packages/cli/scripts/postinstall.js
packages/cli/src/daemon/logging.ts
packages/cli/src/daemon/MConnectDaemon.ts
packages/cli/src/daemon/signals.ts
packages/cli/src/daemon/index.ts
packages/cli/src/daemon/daemonize.ts
packages/cli/src/daemon/ProcessManager.ts
packages/cli/scripts/eval-guardrails.ts
packages/cli/package.json
packages/cli/src/tunnel.ts
packages/cli/src/observability/metrics.ts
apps/web/src/app/api/health/route.ts
packages/cli/src/observability/index.ts
packages/cli/src/observability/opik.ts
packages/ios-app/MConnectTests/BackgroundSessionManagerTests.swift
packages/cli/src/__tests__/web-client.test.ts
packages/cli/src/__tests__/doctor.test.ts
packages/cli/src/__tests__/tmux-manager.test.ts
packages/cli/src/__tests__/agent-manager.test.ts
packages/cli/src/__tests__/hooks.test.ts
packages/cli/src/__tests__/tunnel.test.ts
packages/cli/src/__tests__/guardrails.test.ts
packages/cli/src/__tests__/pty-manager.test.ts
packages/cli/src/__tests__/types.test.ts
packages/cli/src/__tests__/container.test.ts
packages/cli/src/__tests__/scrollback-buffer.test.ts
packages/cli/src/__tests__/session-manager.test.ts
packages/cli/src/__tests__/security.test.ts
packages/cli/src/__tests__/input-arbiter.test.ts
packages/cli/src/session.ts
packages/shared/tsconfig.json
apps/web/src/app/layout.tsx
apps/web/src/app/favicon.ico
packages/shared/biome.json
packages/ios-app/MConnectTests/TerminalViewModelTests.swift
packages/ios-app/MConnectTests/KeychainServiceTests.swift
packages/ios-app/MConnectTests/BiometricAuthTests.swift
packages/ios-app/MConnectTests/HostManagementTests.swift
packages/ios-app/MConnectTests/WSClientTests.swift
packages/ios-app/MConnectTests/AgentDashboardTests.swift
packages/ios-app/MConnectTests/AuthServiceTests.swift
packages/ios-app/MConnectTests/TokenManagerTests.swift
packages/ios-app/MConnectTests/ReconnectionTests.swift
packages/shared/package.json
packages/cli/src/session-file.ts
apps/web/tsconfig.json
apps/web/next.config.ts
packages/ios-app/README.md
packages/server/src/session/index.ts
packages/server/src/api/sessions.ts
packages/server/src/api/index.ts
packages/server/src/api/presets.ts
packages/cli/src/container/index.ts
packages/cli/src/container/types.ts
packages/cli/src/container/dockerfile.ts
packages/cli/src/container/devcontainer.ts
packages/cli/src/container/container-manager.ts
packages/server/src/api/devices.ts
packages/server/src/index.ts
packages/cli/src/agents/index.ts
packages/cli/src/agents/types.ts
packages/cli/src/agents/agent-manager.ts
packages/server/src/ws/index.ts
packages/server/src/ws/InputArbiter.ts
packages/shared/src/index.ts
apps/web/src/context/DemoContext.tsx
packages/server/src/api/__tests__/devices.test.ts
packages/server/src/api/__tests__/sessions.test.ts
packages/server/src/ws/WSHub.ts
packages/server/src/ws/LatencyTracker.ts
packages/server/src/observability/index.ts
packages/server/src/observability/OpikService.ts
packages/server/src/observability/TracingMiddleware.ts
packages/server/src/notifications/index.ts
packages/server/src/notifications/PushService.ts
packages/server/src/mcp/index.ts
packages/server/src/db/index.ts
packages/server/src/db/client.ts
packages/cli/src/cli/commands/attach.ts
packages/cli/src/cli/commands/session.ts
packages/cli/src/cli/commands/daemon.ts
packages/server/src/notifications/NotificationBridge.ts
packages/server/src/db/migrate.ts
packages/shared/src/protocol/index.ts
packages/shared/src/protocol/messages.ts
packages/server/src/agents/presets/index.ts
packages/server/src/agents/presets/claude.ts
packages/server/src/agents/presets/shell.ts
packages/server/src/agents/index.ts
packages/server/src/agents/AgentManager.ts
packages/server/src/ws/__tests__/InputArbiter.test.ts
packages/server/src/ws/__tests__/performance.test.ts
packages/server/src/ws/__tests__/WSHub.test.ts
packages/server/src/agents/AgentWSBridge.ts
packages/server/src/agents/ContainerRuntime.ts
packages/server/src/mcp/MCPBridge.ts
packages/server/src/auth/auth-service.ts
packages/server/src/auth/index.ts
packages/server/src/db/__tests__/client.test.ts
packages/server/src/db/__tests__/repositories.integration.test.ts
packages/server/src/db/__tests__/refresh-token.test.ts
packages/server/src/agents/__tests__/AgentManager.test.ts
packages/server/src/agents/__tests__/ContainerRuntime.integration.test.ts
packages/server/src/agents/__tests__/presets.test.ts
packages/server/src/agents/__tests__/AgentWSBridge.test.ts
packages/ios-app/MConnect/MConnect.entitlements
packages/server/src/index.test.ts
packages/server/biome.json
packages/server/tsconfig.json
packages/server/package.json
packages/server/README.md
packages/server/src/auth/jwt.ts
packages/server/src/auth/routes.ts
packages/server/src/auth/oauth.ts
packages/server/src/mcp/__tests__/MCPBridge.test.ts
packages/server/src/notifications/__tests__/PushService.test.ts
packages/server/src/notifications/__tests__/NotificationBridge.test.ts
packages/ios-app/MConnect/Models/Host.swift
packages/ios-app/MConnect/Models/Agent.swift
packages/ios-app/MConnect/Models/Session.swift
packages/ios-app/MConnect/Models/VaultItem.swift
packages/shared/src/guardrails/index.ts
packages/shared/src/guardrails/guardrails.test.ts
packages/server/src/db/repositories/user.ts
packages/server/src/db/repositories/index.ts
packages/server/src/db/repositories/client.ts
packages/server/src/db/repositories/session.ts
packages/server/src/db/repositories/agent.ts
packages/server/src/db/repositories/refresh-token.ts
packages/server/src/db/repositories/device-token.ts
packages/ios-app/MConnect.xcodeproj/project.pbxproj
packages/ios-app/MConnect/Views/Vault/VaultItemView.swift
packages/server/src/auth/providers/index.ts
packages/ios-app/MConnect/Views/Vault/VaultView.swift
packages/server/src/auth/providers/github.ts
packages/ios-app/MConnect/Services/Notifications/PushService.swift
packages/server/src/db/migrations/001_initial.sql
packages/server/src/db/migrations/002_device_tokens.sql
packages/ios-app/MConnect/App/AppDelegate.swift
packages/ios-app/MConnect/App/Router.swift
packages/ios-app/MConnect/App/MConnectApp.swift
packages/shared/src/types/models.ts
packages/shared/src/types/index.ts
packages/shared/src/types/agents.ts
packages/shared/src/types/container.ts
packages/shared/src/types/mcp.ts
packages/server/src/observability/__tests__/OpikService.test.ts
packages/server/src/observability/__tests__/TracingMiddleware.test.ts
packages/ios-app/MConnect/Services/Auth/TokenManager.swift
packages/ios-app/MConnect/Services/Auth/AuthService.swift
packages/ios-app/MConnect/Resources/Info.plist
packages/server/src/auth/__tests__/auth-service.test.ts
packages/server/src/auth/__tests__/jwt.test.ts
packages/server/src/auth/__tests__/oauth.test.ts
packages/server/src/auth/__tests__/github.test.ts
packages/server/src/auth/__tests__/routes.test.ts
packages/ios-app/MConnect/Views/Hosts/HostListView.swift
packages/ios-app/MConnect/Views/Hosts/HostDetailView.swift
packages/ios-app/MConnect/Views/Hosts/QRScannerView.swift
packages/ios-app/MConnect/Services/WebSocket/InputArbiter.swift
packages/ios-app/MConnect/Services/WebSocket/Protocol.swift
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift
packages/ios-app/MConnect/Services/Keychain/KeychainService.swift
packages/ios-app/MConnect/Views/Agents/AgentDashboard.swift
packages/ios-app/MConnect/Services/Network/NetworkMonitor.swift
packages/ios-app/MConnect/Services/Keychain/BiometricAuth.swift
packages/ios-app/MConnect/Views/Agents/AgentDetailView.swift
packages/ios-app/MConnect/Services/Background/BackgroundSessionManager.swift
packages/ios-app/MConnect/Resources/Assets.xcassets/Contents.json
packages/ios-app/MConnect/Views/Terminal/TerminalEmulatorView.swift
packages/ios-app/MConnect/Views/Terminal/TerminalBuffer.swift
packages/ios-app/MConnect.xcodeproj/xcshareddata/xcschemes/MConnect.xcscheme
packages/ios-app/MConnect/Views/Terminal/TerminalView.swift
packages/ios-app/MConnect/Views/Terminal/KeyboardBarView.swift
packages/ios-app/MConnect/Resources/Assets.xcassets/AccentColor.colorset/Contents.json
packages/ios-app/MConnect/Resources/Assets.xcassets/AppIcon.appiconset/Contents.json

codex
The first pass shows the plan is detailed and has moved several v0 objections into explicit gates. I’m reading the lower sections now and verifying the claimed protocol/auth/session facts against the source instead of taking the plan’s line references on trust.
exec
/bin/zsh -lc "sed -n '261,620p' .omc/plans/2026-05-02-194104-mconnect-v2-session-desktop-anchor.md" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
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

# Updater e2e
cd packages/desktop && bun run e2e -- e2e/phase-5-updater.spec.ts            # exit 0
```

### Phase 6 — Opik dashboards + release notes + demo + blog (Weeks 12)

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

**Mitigations baked in**:
- Phase 0 deliverable: capability negotiation in `packages/shared/src/protocol/messages.ts` + typed `unsupported_capability` error replacing silent drop.
- Phase 0 deliverable: CLI catch-up to `PROTOCOL_VERSION = '3.0'`. No desktop work begins until this is merged + green in CI.
- Phase 4 deliverable: iOS regression test specifically asserts old TestFlight v3.0 build interoperates with new v3.1 server without disconnect.
- Compatibility matrix documented in `docs/protocol/v3.1-migration.md`: which capability is required by which client; which silently downgrades; which is a hard error.
- Rollback plan: feature flag `MCONNECT_DISABLE_V3_1` in CLI + desktop falls back to v3.0-only message set.

---

## 7. Expanded test plan (deliberate mode, addresses Critic FAIL: under-resourced for cross-platform release)

### 7.1 Unit (per-package)
- `packages/desktop/__tests__/`: Tauri command serializers, session-list aggregation, fork-message-id math, status-notification dispatcher, perf-budget threshold checker, FTS5 query builder.
- `packages/worktree/__tests__/`: create/list/cleanup happy path; dirty workspace; branch-name collision; crash recovery (mid-create kill → GC sweeps); concurrent create on same branch.
- `packages/cli/__tests__/migrations/`: 002_scrollback_fts and 003_scrollback_message_id apply against fixture v0.1.10 db without data loss.
- Coverage thresholds: existing CLI thresholds preserved; new packages require **75% statements / 70% branches / 70% functions**.

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
| AC15 | 24-hour soak: 3 consecutive nights green | `.github/workflows/soak.yml` runs nightly | 3 consecutive nightly runs green; assertion JSON: no PTY leak, no worktree leak, RAM steady-state ±10% |
| AC16 | Opik dashboard shows new spans + 2 new evals | Phase 4 ops checklist (manual one-time) + automated assertion via Opik API in §7.5 | curl returns `spans length > 0` for each new span type |

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
# Phase 0
grep "PROTOCOL_VERSION = '3.0'" packages/cli/src/ws/protocol.ts                            # exit 0
test -f packages/shared/src/interfaces/TerminalBridge.ts                                   # exit 0
test -f packages/shared/src/interfaces/WorktreeRuntime.ts                                  # exit 0
cd packages/desktop && bun run hard-gate -- --platform=macos                               # exit 0
cd packages/desktop && bun run hard-gate -- --platform=linux                               # exit 0
cd packages/desktop && bun run hard-gate -- --platform=windows                             # exit 0

# Phase 1
npm run build                                                                              # exit 0
sqlite3 ~/.mconnect/sessions.db "SELECT name FROM sqlite_master WHERE name='scrollback_fts'" | grep -q scrollback_fts   # exit 0
npx lecoder-mconnect doctor                                                                # exit 0
bun test packages/cli/__tests__/regression/v0_1_10.test.ts                                 # exit 0

# Phase 3
bun test packages/worktree                                                                 # exit 0; coverage ≥ 75%
cd packages/desktop && bun run e2e -- e2e/phase-3-fork-resume.spec.ts                      # exit 0

# Phase 4
bun test packages/cli/__tests__/migrations/legacy-v0.1.10.test.ts                          # exit 0
bun test packages/cli/__tests__/providers/contract/                                        # exit 0
cd packages/ios-app && xcodebuild test -only-testing:MConnectTests/V3InteropTests          # exit 0

# Phase 5
codesign -dv dist/MConnect.app 2>&1 | grep -q "Authority=Developer ID Application: Arya"   # exit 0
spctl -a -t exec -vv dist/MConnect.app 2>&1 | grep -q "accepted"                           # exit 0

# Phase 6
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

**Decision**: For mconnect v0.2.0, build `packages/desktop` as Tauri 2.0 + React 19 + xterm.js + Zustand + Tailwind + Lucide + CodeMirror, **additive** to existing `packages/cli`, `packages/server`, `packages/shared`, `packages/ios-app`. Add new `packages/worktree` for git-worktree-per-agent isolation. Cut v0.2.0 scope to: desktop session manager + worktree isolation + fork/resume + IDE diff panel. Defer memory layer, swarm, multi-provider OAuth (beyond existing GitHub/Google), iOS side panel, skill compounding, smfs, sub-swarms, voice control to v0.3.x. Catch the CLI up to `PROTOCOL_VERSION = '3.0'` (currently lagging at `'2.0'` while shared/server/iOS are already on `'3.0'`) as Phase 0 prerequisite, with capability negotiation replacing the current silent unknown-message drop.

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
- **Re-evaluate Option B for v0.3.x**: triggered by either (a) measured perf gap > 30% under realistic load (worktree create p95 > 200 ms or RAM PSS w/ 10 sessions > 600 MB), OR (b) ≥ 3 community requests for Rust-core distribution.
- **Re-evaluate smfs FUSE/NFS mount**: triggered by (a) license clearance for vendored binaries, AND (b) memory layer in v0.3.x reaching beta.
- **Re-evaluate voice control (paseo parity)**: triggered by user-validated demand signal in v0.3.x research.
- **iOS side panel (Mermaid/diff/file)**: scheduled v0.3.x with WKWebView + mermaid.js (no Rust mermaid vendoring).

---

## 12. Changelog of applied improvements

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
- **Multi-provider OAuth beyond existing GitHub/Google** (Claude, OpenAI, Gemini, Copilot, Azure, Ollama, openai-compatible, headless `--no-browser`) → v0.3.x. Reason: server `auth/providers/index.ts` ships only GitHub today; expansion is 3-4 weeks alone.
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

exec
/bin/zsh -lc "nl -ba packages/shared/src/protocol/messages.ts | sed -n '1,140p'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
     1	/**
     2	 * WebSocket Protocol v3.0 Message Types
     3	 *
     4	 * Protocol v3.0 extends v2.0 with:
     5	 * - MCP message routing
     6	 * - OAuth token authentication (not query param)
     7	 * - Structured error responses with retry hints
     8	 * - Binary message support for large outputs
     9	 */
    10	
    11	import type { AgentStatus, AgentInfo } from '../types/agents.js';
    12	import type { ClientType, SessionState, SessionInfo, ClientInfo } from '../types/models.js';
    13	import type { MCPMessage } from '../types/mcp.js';
    14	
    15	// ============================================================================
    16	// Protocol Constants
    17	// ============================================================================
    18	
    19	/**
    20	 * Current protocol version
    21	 */
    22	export const PROTOCOL_VERSION = '3.0';
    23	
    24	/**
    25	 * Rate limits for protocol operations
    26	 */
    27	export const RATE_LIMITS = {
    28	  /** Max characters per second for input */
    29	  inputCharsPerSecond: 100,
    30	  /** Max control requests per window */
    31	  controlRequestsPerWindow: 1,
    32	  /** Control request window in milliseconds */
    33	  controlRequestWindowMs: 10000,
    34	  /** Max scrollback requests per second */
    35	  scrollbackRequestsPerSecond: 10,
    36	  /** Max MCP messages per second */
    37	  mcpMessagesPerSecond: 20,
    38	  /** Max reconnection attempts per minute */
    39	  reconnectionAttemptsPerMinute: 5,
    40	} as const;
    41	
    42	// ============================================================================
    43	// Base Types
    44	// ============================================================================
    45	
    46	/**
    47	 * Base message structure for all WebSocket messages
    48	 */
    49	export interface BaseMessage {
    50	  /** Message type discriminator */
    51	  type: string;
    52	  /** Optional message ID for request/response correlation */
    53	  id?: string;
    54	  /** Unix timestamp (server messages always include) */
    55	  timestamp?: number;
    56	}
    57	
    58	// ============================================================================
    59	// Client → Server Messages
    60	// ============================================================================
    61	
    62	/**
    63	 * Authentication message (must be first message after connection)
    64	 */
    65	export interface AuthMessage extends BaseMessage {
    66	  type: 'auth';
    67	  /** JWT access token */
    68	  token: string;
    69	  /** Protocol version */
    70	  protocolVersion: typeof PROTOCOL_VERSION;
    71	  /** Client device type */
    72	  clientType: ClientType;
    73	}
    74	
    75	/**
    76	 * Attach to a session
    77	 */
    78	export interface SessionAttachMessage extends BaseMessage {
    79	  type: 'session_attach';
    80	  /** Session ID to attach to */
    81	  sessionId: string;
    82	}
    83	
    84	/**
    85	 * Detach from current session
    86	 */
    87	export interface SessionDetachMessage extends BaseMessage {
    88	  type: 'session_detach';
    89	}
    90	
    91	/**
    92	 * Send terminal input to an agent
    93	 */
    94	export interface TerminalInputMessage extends BaseMessage {
    95	  type: 'terminal_input';
    96	  /** Target agent ID */
    97	  agentId: string;
    98	  /** Input data */
    99	  data: string;
   100	}
   101	
   102	/**
   103	 * Resize terminal for an agent
   104	 */
   105	export interface ResizeMessage extends BaseMessage {
   106	  type: 'resize';
   107	  /** Target agent ID */
   108	  agentId: string;
   109	  /** New column count */
   110	  cols: number;
   111	  /** New row count */
   112	  rows: number;
   113	}
   114	
   115	/**
   116	 * Request input control
   117	 */
   118	export interface ControlRequestMessage extends BaseMessage {
   119	  type: 'control_request';
   120	  /** Action to take */
   121	  action: 'exclusive' | 'release';
   122	}
   123	
   124	/**
   125	 * Request scrollback history
   126	 */
   127	export interface ScrollbackRequestMessage extends BaseMessage {
   128	  type: 'scrollback_request';
   129	  /** Session ID */
   130	  sessionId: string;
   131	  /** Starting line number */
   132	  fromLine: number;
   133	  /** Number of lines to fetch */
   134	  count: number;
   135	}
   136	
   137	/**
   138	 * Forward MCP message to an agent
   139	 */
   140	export interface MCPForwardMessage extends BaseMessage {

exec
/bin/zsh -lc "nl -ba packages/cli/src/ws/protocol.ts | sed -n '230,280p'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
   230	  | SessionStateMessage
   231	  | ScrollbackResponseMessage
   232	  | ControlStatusMessage
   233	  | ControlResponseMessage
   234	  | InputRejectedMessage
   235	  | ClientJoinedMessage
   236	  | ClientLeftMessage
   237	  | HeartbeatMessage
   238	  | TerminalOutputMessage
   239	  | AgentListMessage
   240	  | PongMessage
   241	  | ErrorMessage;
   242	
   243	// ============================================
   244	// Rate Limits
   245	// ============================================
   246	
   247	export const RATE_LIMITS = {
   248	  inputCharsPerSecond: 100,
   249	  controlRequestsPerWindow: 1,
   250	  controlRequestWindowMs: 10000, // 10 seconds
   251	  scrollbackRequestsPerSecond: 10,
   252	  reconnectionAttemptsPerMinute: 5,
   253	} as const;
   254	
   255	// ============================================
   256	// Protocol Constants
   257	// ============================================
   258	
   259	export const PROTOCOL_VERSION = '2.0';
   260	export const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
   261	export const MAX_SCROLLBACK_REQUEST = 1000; // Max lines per request

exec
/bin/zsh -lc "nl -ba packages/cli/src/ws/ws-hub.ts | sed -n '500,545p'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
   500	          console.warn('[WSHub] terminal_input missing data field');
   501	          break;
   502	        }
   503	
   504	        // Check arbiter if client is attached to a session
   505	        if (clientInfo.sessionId) {
   506	          const arbiter = this.sessionArbiters.get(clientInfo.sessionId);
   507	          if (arbiter) {
   508	            const result = arbiter.processInput(clientInfo.clientId, inputData);
   509	            if (!result.accepted) {
   510	              // Input rejected by arbiter - message already sent via event
   511	              break;
   512	            }
   513	          }
   514	        }
   515	
   516	        this.handleInput(ws, agentId, inputData);
   517	        break;
   518	      }
   519	
   520	      case 'approval_response':
   521	        this.handleApprovalResponse(ws, message as ApprovalResponseMessage);
   522	        break;
   523	
   524	      default:
   525	        console.warn('[WSHub] Unknown message type:', (message as Record<string, unknown>).type);
   526	    }
   527	  }
   528	
   529	  /**
   530	   * Handle session_attach message (v2)
   531	   */
   532	  private handleSessionAttach(ws: WebSocket, message: SessionAttachMessage): void {
   533	    const client = this.clients.get(ws);
   534	    if (!client || !this.sessionManager) {
   535	      this.sendToClient(ws, {
   536	        type: 'error',
   537	        message: 'Session manager not available',
   538	        code: 'INTERNAL_ERROR',
   539	      });
   540	      return;
   541	    }
   542	
   543	    const session = this.sessionManager.getSession(message.sessionId);
   544	    if (!session) {
   545	      this.sendToClient(ws, {

exec
/bin/zsh -lc "nl -ba .omc/plans/2026-05-02-194104-mconnect-v2-session-desktop-anchor.md | sed -n '1,240p'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
     1	# MConnect v0.2.0 — "Session Command Center" Plan
     2	
     3	> **Mode**: RALPLAN-DR consensus, **deliberate** (high-risk: cross-platform desktop, new persistence/memory, multi-agent coordination, App Store-shipping iOS impact).
     4	> **Anchor**: Switchboard-style session manager + IDE-grade desktop app, additive to current cli/server/ios stack.
     5	> **Execution target after approval**: `oh-my-claudecode:ralph` + ultrawork.
     6	> **Owner**: Arya Teja Rudraraju.
     7	> **Plan version**: **v1** (Planner revision after Architect + Critic round 1; v0 REJECTed for stale protocol baseline, over-stuffed phases, vague ACs).
     8	
     9	---
    10	
    11	## 0. Why this plan exists (unchanged from v0)
    12	
    13	`mconnect` ships today as: CLI package `lecoder-mconnect@0.2.0` (root workspace `0.1.2`, latest npm-published `0.1.10`) + iOS app on TestFlight + Cloudflare-tunnel mobile control. Two large prior planning artifacts already exist in repo: `PRD-LECODER-AGENTOS.md` (full PRD, 6 epics) and `LECODER-AGENT-HUB-PLAN.md` (Rust core + Tauri desktop technical plan). v3 protocol is **already documented and shipped** in `packages/shared`, `packages/server`, `packages/ios-app`, with `docs/protocol/v3.md` present; the **CLI alone still emits `PROTOCOL_VERSION = '2.0'`** at `packages/cli/src/ws/protocol.ts:259` and is the single migration debt.
    14	
    15	Six new MIT/open reference projects raise the bar:
    16	
    17	| Ref project | Stack | Take-aways for mconnect (filtered to v0.2.0 narrow scope) |
    18	|---|---|---|
    19	| **switchboard** (doctly) | Electron + React | Session browser across all projects, fork/resume from any point, full-text search, status notifications, IDE emulation w/ inline + side-by-side diffs, grid overview of N live terminals. **In v0.2.0**: session browser, fork/resume, status notifications, IDE diff panel. |
    20	| **orchestrator** (MatchaOnMuffins) | Electron + React 19 + Zustand + Vite | Up to 10 concurrent agents per repo via **git worktree isolation per agent**, tmux-like pane interface, persistent session storage. MIT. **In v0.2.0**: worktree-per-agent module + grid view. |
    21	| **paseo / multica / jcode / smfs** | Mixed | Multi-provider OAuth, ambient memory, swarm coordination, agent-as-teammate, FUSE memory mount, voice. **All deferred to v0.3.x** per Critic finding "weeks 7-12 materially under-budgeted." |
    22	
    23	**User constraints (locked in interview)**:
    24	1. Anchor = Session manager + IDE-grade desktop (Switchboard-style).
    25	2. Loop = Deliberate consensus + codex Architect + codex Critic.
    26	3. Execution = After approval, `/oh-my-claudecode:ralph` + ultrawork.
    27	4. Scope = **Additive** — new packages OK, no rewrites of existing core code.
    28	
    29	---
    30	
    31	## 1. RALPLAN-DR — Principles (revised, addresses Critic FAIL: §1 vs §3 consistency)
    32	
    33	1. **Additive over invasive — strict definition**. New packages are additive without question (`packages/desktop`, `packages/worktree`). Existing-package changes are permitted only when (a) gated behind a feature flag default-OFF, (b) introduced as **new files** (no edits to load-bearing core like `packages/cli/src/session.ts`, `packages/cli/src/pty/pty-manager.ts`), (c) reviewed against a regression test for the v0.1.10 published-npm flow. The single explicit exception: **CLI protocol bump from v2.0 → v3.0** to align with shared/server/iOS, which is *required* before any desktop work begins. This is treated as a planned migration, not a "rewrite."
    34	2. **v3.0 is the protocol baseline; new features land at v3.1 with capability negotiation.** Source of truth: `packages/shared/src/protocol/messages.ts:22` (= `'3.0'`) and `docs/protocol/v3.md`. The CLI catches up to v3.0 in Phase 0 (currently at v2.0, `packages/cli/src/ws/protocol.ts:259`). New `desktop:*` and `worktree:*` message families ship as v3.1 additions and **MUST** include explicit capability negotiation — every client advertises a capability set on auth, server unions them, unknown families to a client are skipped *with a typed `unsupported_capability` warning*, never silent drop. (Today CLI silently `console.warn`s and ignores; that becomes a typed protocol error in v3.1.)
    35	3. **Ship the anchor in 12 weeks, the rest in v0.3.x.** v0.2.0 ships **only**: desktop session manager, worktree isolation per agent, fork-and-resume, IDE diff panel. Memory layer, swarm, multi-provider OAuth (beyond existing GitHub/Google), iOS side panel, skill compounding, smfs FUSE/NFS mount, sub-swarms, voice control are explicitly **out of v0.2.0**. They belong in a v0.3.x consensus plan after this anchor lands.
    36	4. **Prove perf with budgets, not promises.** A perf-budget script (`scripts/perf-budget.ts`) ships in Phase 0, runs in CI, and gates releases on cold-start TTI ≤ 2.5 s, idle PSS ≤ 220 MB w/ 1 session, ≤ 320 MB w/ 5 sessions on M-series Mac and Linux x64. Windows is a separate gate (Phase 0 spike).
    37	5. **Hard gate before UI work.** Phase 0 ends with a packaged-Tauri terminal attach/spawn/resize/kill demo across **mac+linux+win** with iOS attached to the same session. **Kill criterion**: any platform fails attach/resize/kill twice in CI → switch desktop to Electron + node-pty before Phase 1 UI starts. Decision deadline: end of Phase 0 (Day 10).
    38	
    39	## 2. RALPLAN-DR — Decision Drivers (top 3, unchanged)
    40	
    41	1. **Time-to-shipped-desktop**. iOS App Store review in progress, TestFlight live; momentum highest now.
    42	2. **Preserve published-package stability** (`lecoder-mconnect@0.1.10` on npm; iOS TestFlight).
    43	3. **Token-cost containment**. (Drives Phase 5 deferral of memory/swarm to v0.3.x — both are token-cost amplifiers.)
    44	
    45	## 3. RALPLAN-DR — Viable Options (revised, addresses Critic FAIL: shallow alternatives, Option B re-scored fairly)
    46	
    47	### Option A — *Additive Tauri Desktop on existing TS stack, NARROW v0.2.0 scope* (RECOMMENDED)
    48	
    49	**Shape**: New `packages/desktop` (Tauri 2.0 + React 19 + Zustand + Tailwind + xterm.js + Lucide + CodeMirror). Tauri commands talk to existing CLI via the **v3.0 WebSocket** (after CLI catch-up in Phase 0). New `packages/worktree` (TypeScript) for git worktree lifecycle per agent. Existing `packages/cli/src/session/`, `packages/cli/src/pty/`, `packages/server`, `packages/shared`, `packages/ios-app` cores **unchanged** except (a) CLI protocol catch-up v2→v3 (Phase 0), (b) new feature-flag-gated message handlers for v3.1 additions (Phase 1+).
    50	
    51	**Scope**: desktop session manager + worktree isolation + fork/resume + IDE diff panel. Nothing else.
    52	
    53	**Honest 12-week estimate**: 5 weeks for desktop MVP after Phase 0 gate, 2 weeks for worktree, 2 weeks for fork/resume + IDE diff, 1 week for code-signing+distribution, 1 week for Opik+release notes, 1 week buffer. Total = 12 weeks **only because deferred features are not in scope**. Same scope at HUB plan's Rust pace = 20+ weeks.
    54	
    55	**Pros**:
    56	- Honors "no rewrites" with strict definition in §1 principle 1.
    57	- Preserves npm CLI flow (regression test in §10).
    58	- Tauri matches HUB plan's UI tech stack — sunk planning capital not wasted.
    59	- iOS protocol unchanged (already v3.0, capability negotiation makes v3.1 additions ignorable to old iOS builds).
    60	
    61	**Cons**:
    62	- Tauri 2.0 cross-platform terminal bridging is less battle-tested than Electron + node-pty (cf. Switchboard, Orchestrator). Mitigated by Phase 0 hard gate + Electron escape hatch (Phase 1, NOT Phase 5).
    63	- Higher steady-state RAM than Rust would deliver. Acceptable per perf-budget §1 principle 4.
    64	- Dropping memory/swarm/OAuth for v0.2.0 means anchor is just a session manager — no new agent-coordination story until v0.3.x.
    65	
    66	### Option B — *Hybrid Rust sidecar from day one* (re-scored against same scope as Option A)
    67	
    68	**Shape**: Same Tauri desktop + `packages/worktree` as A, BUT also new `packages/core-rs` Rust crate exposing JSON-RPC over Unix socket / named pipe. Worktree create/cleanup + file watcher run in Rust; CLI gets an opt-in `--rust-core` flag.
    69	
    70	**Honest re-scored estimate**: same as Option A + 3-4 weeks for Rust crate, JSON-RPC bridge, CI Rust toolchain wiring, release-pipeline complexity = 15-16 weeks for the same v0.2.0 product surface. **Tauri 2.0 already ships a Rust toolchain in CI**, so the marginal Rust cost is ~30%, not 100%, as v0 incorrectly stated.
    71	
    72	**Pros**:
    73	- Captures HUB plan's perf benefits selectively.
    74	- Future Rust core swap-in is incremental, not a fork.
    75	- Honest acknowledgment: the Rust toolchain Tauri already requires lowers Option B's marginal cost vs. Option A.
    76	
    77	**Cons**:
    78	- Stretches v0.2.0 by 3-4 weeks **on the same scope**. With user's "ship anchor in 12 weeks" driver (#1), this fails the time-to-ship test.
    79	- Adds two languages' release pipelines (npm + cargo + Tauri). Risk of CI breakage on Windows is non-trivial.
    80	- "Additive" interpretation is fuzzier — strictly, the CLI gains a parallel implementation of worktree functions.
    81	
    82	### Option C — *Full HUB plan as written* (rewrite core in Rust)
    83	
    84	**Shape**: Execute `LECODER-AGENT-HUB-PLAN.md` literally (Rust workspace, ratatui TUI, Tauri desktop on Rust core).
    85	
    86	**Honest estimate**: 20+ weeks; HUB plan itself allocates Rust foundation in weeks 1-4 + desktop in Month 2 (its Phase 3) + advanced features in Month 3+. Doesn't fit user's anchor-first goal.
    87	
    88	**Pros**: Hits PRD perf targets.
    89	
    90	**Cons**: Directly violates user constraint #4 ("no rewrites"). Documented invalidation rationale per Critic requirement.
    91	
    92	**Invalidation rationale for Option C**: User constraint #4 ("Additive: new packages OK, but no rewrites") + Driver #1 (time-to-shipped-desktop) jointly foreclose Option C. Documented for audit trail.
    93	
    94	**Plan adopts Option A**, with explicit Phase 6 follow-up trigger to revisit Option B after v0.2.0 ships *and* the perf budget is measured against real load.
    95	
    96	---
    97	
    98	## 4. Reference-project → epic-mapping matrix (revised, narrowed to v0.2.0 only)
    99	
   100	| Capability | Source ref | Target package | Phase | Notes |
   101	|---|---|---|---|---|
   102	| Cross-project session browser, full-text search, sidebar status | switchboard | `packages/desktop/src/sessions/` | 2 | Reads `SessionStore` SQLite. Adds FTS5 virtual table + content_id column via new migration `migrations/002_scrollback_fts.sql`. |
   103	| Built-in terminal panel, status notifications | switchboard | `packages/desktop/src/terminal/`, `packages/desktop/src/notifications/` | 2 | xterm.js + new hook event types in `packages/shared/src/protocol/` (v3.1, capability-gated). |
   104	| Fork & resume from any conversation point | switchboard | `packages/desktop/src/sessions/fork.ts` + new migration `migrations/003_scrollback_message_id.sql` adding `message_id` column to scrollback | 3 | Schema migration required (Critic FAIL on AC5 — column doesn't exist today). |
   105	| File preview side panel + IDE diff panel (inline + side-by-side) | switchboard | `packages/desktop/src/diff-panel/` | 3 | Tauri "Claude IDE MCP emulator" registration optional; toggleable in settings. |
   106	| Session grid overview (live mini-terminals) | switchboard | `packages/desktop/src/grid/` | 3 | |
   107	| Up to N=10 concurrent agents per repo via **git worktree isolation** | orchestrator | `packages/worktree/` (NEW package, fully additive) + `packages/desktop/src/worktree/` UI | 3 | Worktree lifecycle: create on agent spawn, cleanup on exit + cleanup-on-startup GC pass against running session list. |
   108	| Tmux-like pane interface | orchestrator | shared with `packages/desktop/src/grid/` above | 3 | |
   109	| Activity stats heatmap | switchboard | `packages/desktop/src/stats/` | 5 | Polish only. |
   110	
   111	**Deferred to v0.3.x (out of v0.2.0 scope, per Critic-mandated cut)**:
   112	
   113	| Capability | Source ref | Reason for deferral |
   114	|---|---|---|
   115	| Memory layer (sqlite-vec, ambient embedding, consolidation) | jcode + smfs | Token-cost driver + protocol surface area + 4-week minimum estimate alone. |
   116	| Swarm coordinator (file-shift, DM, broadcast, sub-swarms) | jcode | Default-off + protocol surface + feedback-loop testing burden. |
   117	| Multi-provider OAuth beyond GitHub/Google | jcode + paseo | Server `auth/providers/index.ts` ships only GitHub today; adding Claude/OpenAI/Gemini/Copilot/openai-compatible/Azure/Ollama is a 3-4 week project on its own. |
   118	| iOS side-panel (Mermaid, diff, file) | jcode | New iOS surface = TestFlight re-review risk during v0.2.0 cycle. |
   119	| Skill compounding | multica | Depends on memory layer. |
   120	| smfs FUSE/NFS mount | smfs | Vendor binary + license clearance not done; experimental. |
   121	| Voice control | paseo | Research only. |
   122	| Linear-issue-to-agent assign | multica | Depends on multi-provider auth. |
   123	
   124	---
   125	
   126	## 5. Phased plan (12 weeks, narrowed scope, every phase has a verification gate)
   127	
   128	### Phase 0 — Hard gate spike + protocol catch-up + interfaces (Weeks 1-2)
   129	
   130	**Deliverables**:
   131	- **CLI protocol catch-up**: `packages/cli/src/ws/protocol.ts` updated to `PROTOCOL_VERSION = '3.0'` matching `packages/shared/src/protocol/messages.ts:22`. New file `packages/cli/src/ws/v3-handlers.ts` adds the v3 message handlers the CLI is missing (binary frames, MCP routing, OAuth-token auth) without touching `ws-hub.ts` core. Regression test against v0.1.10 published flow.
   132	- **Capability negotiation** in `packages/shared/src/protocol/messages.ts`: new `client_capabilities` field on auth message; server response unions capabilities; `unsupported_capability` typed error replaces the silent `console.warn` drop at `packages/cli/src/ws/ws-hub.ts:524-526`.
   133	- **TS interfaces** scaffolded (per Architect synthesis): `packages/shared/src/interfaces/TerminalBridge.ts`, `WorktreeRuntime.ts`, `MemoryIndex.ts`, `FileWatcher.ts`. Default TS adapters live in `packages/cli/src/adapters/` and `packages/worktree/src/adapters/` so a future Rust sidecar swap is a one-file change.
   134	- **Hard gate spike**: `packages/desktop` scaffolded as Tauri 2.0 + React 19 + Zustand + Tailwind + xterm.js. Builds packaged dmg (mac arm64) + AppImage (linux x64) + msi (win x64). Spike test script `packages/desktop/scripts/hard-gate.ts` runs: spawn CLI session via existing `mconnect start --preset shell-only`, attach desktop via WebSocket, send 1000 keystrokes + 5 resizes + 1 kill, assert PTY exit code = 0, assert no dropped frames in xterm output. Runs on macOS arm64, Linux x64, **Windows x64** in CI matrix.
   135	- **Kill criterion**: if hard gate fails twice on any platform in CI, **swap `packages/desktop` to Electron + node-pty** before Phase 1 begins. 1-week swap budget reserved in Phase 0 itself, not Phase 5. Decision recorded as ADR amendment within Phase 0.
   136	- **Perf-budget script** `packages/desktop/scripts/perf-budget.ts` writes `.omc/perf-budget/<date>.json`; CI fails on regressions > 10% over rolling 7-day median.
   137	
   138	**Verification gate (mechanical, ralph-executable)**:
   139	```bash
   140	# CLI v3 catch-up
   141	grep "PROTOCOL_VERSION = '3.0'" packages/cli/src/ws/protocol.ts  # exit 0
   142	npm run typecheck --workspace=packages/cli                       # exit 0
   143	npm run test --workspace=packages/cli                            # exit 0; expect packages/cli/__tests__/regression/v0_1_10.test.ts to pass
   144	
   145	# Capability negotiation present
   146	grep "client_capabilities" packages/shared/src/protocol/messages.ts          # exit 0
   147	grep "unsupported_capability" packages/cli/src/ws/v3-handlers.ts             # exit 0
   148	
   149	# Interfaces scaffolded
   150	test -f packages/shared/src/interfaces/TerminalBridge.ts                     # exit 0
   151	test -f packages/shared/src/interfaces/WorktreeRuntime.ts                    # exit 0
   152	
   153	# Hard gate
   154	cd packages/desktop && bun run hard-gate -- --platform=macos                 # exit 0
   155	cd packages/desktop && bun run hard-gate -- --platform=linux                 # exit 0
   156	cd packages/desktop && bun run hard-gate -- --platform=windows               # exit 0 (CI Windows runner)
   157	# CI job names: ci-hard-gate-macos, ci-hard-gate-linux, ci-hard-gate-windows. All required for merge to main.
   158	
   159	# Perf baseline
   160	cd packages/desktop && bun run perf-budget                                   # exit 0; writes .omc/perf-budget/<today>.json
   161	```
   162	
   163	### Phase 1 — Switchboard MVP: session browser + terminal + status notifications (Weeks 3-5)
   164	
   165	**Deliverables**:
   166	- Tauri desktop window opens, sidebar lists running CLI sessions discovered via existing `packages/cli/src/daemon/` registry + new `desktop:session_list` v3.1 message.
   167	- Terminal panel: spawn new CLI session from desktop, attach to existing one, kill from desktop. Built on `TerminalBridge` interface; default adapter wraps existing PTY hub via WebSocket.
   168	- Status notifications: waiting-for-input + permission-approval surfaced from CLI hooks. New hook event types in `packages/shared/src/protocol/` v3.1 capability-gated.
   169	- Sidebar w/ project grouping. **FTS5 search**: new migration `packages/cli/migrations/002_scrollback_fts.sql` adding a `scrollback_fts` virtual table indexing `content` with the `(session_id, line_number)` rowid mapping. Search returns rows as `(session_id, line_number, snippet)`.
   170	- Pairing flow on desktop: existing QR code rendered in desktop sidebar.
   171	
   172	**Verification gate (mechanical)**:
   173	```bash
   174	# Build matrix
   175	npm run build                                                                # exit 0
   176	cd packages/desktop && bun run build:macos                                   # produces dist/MConnect.dmg
   177	cd packages/desktop && bun run build:linux                                   # produces dist/MConnect.AppImage
   178	cd packages/desktop && bun run build:windows                                 # produces dist/MConnect.msi
   179	
   180	# Migration applied
   181	cd packages/cli && bun run db:migrate                                        # exit 0; sqlite has scrollback_fts virtual table
   182	sqlite3 ~/.mconnect/sessions.db "SELECT name FROM sqlite_master WHERE type='table' AND name='scrollback_fts';" \
   183	  | grep scrollback_fts                                                      # exit 0
   184	
   185	# Regression: existing flow
   186	npx lecoder-mconnect doctor                                                  # all checks pass
   187	npx lecoder-mconnect start --preset shell-only --no-interactive --port 8765 & sleep 5
   188	curl -s http://localhost:8765/health | jq -e '.status == "ok"'               # exit 0
   189	kill %1
   190	
   191	# Desktop attach
   192	cd packages/desktop && bun run e2e -- e2e/phase-1-attach.spec.ts             # exit 0; spec asserts session list non-empty after CLI start, terminal panel renders 100 lines after 1 KB scrollback fixture
   193	```
   194	
   195	**Shippable**: `packages/desktop@0.1.0-alpha`. Distributed via GitHub releases unsigned (signing in Phase 5).
   196	
   197	### Phase 2 — (rolled into Phase 1; no separate phase. v0 had Phase 2 here; absorbed.)
   198	
   199	### Phase 3 — Worktree isolation + fork/resume + IDE diff panel (Weeks 6-8)
   200	
   201	**Deliverables**:
   202	- `packages/worktree/` new package: `WorktreeRuntime` adapter wrapping `git worktree`. API: `create({ agentId, baseBranch })`, `list()`, `cleanup({ agentId })`, `gcDangling({ runningAgentIds })`. Tests cover dirty workspace, branch collision, crash recovery (kill mid-create, GC sweeps).
   203	- CLI integration via opt-in `--worktree` flag: `mconnect start --worktree --preset research-spec-test` creates a worktree per agent under `.shards/<agent-id>/`.
   204	- Fork/resume: new migration `packages/cli/migrations/003_scrollback_message_id.sql` adding `message_id INTEGER` column to scrollback (autoincrement per session). Fork operation: `desktop:fork` v3.1 message takes `(session_id, message_id)`, creates new session with scrollback rows where `message_id <= N` copied; original session continues. Resume: `desktop:resume` takes `session_id`, replays full scrollback into new attach.
   205	- IDE diff panel: `packages/desktop/src/diff-panel/` renders inline + side-by-side; toggle in settings. Tauri "Claude IDE MCP emulator" registration optional, off by default.
   206	- Session grid overview: `packages/desktop/src/grid/` shows live mini-terminals for all attached sessions.
   207	
   208	**Verification gate (mechanical)**:
   209	```bash
   210	# Worktree
   211	cd packages/worktree && bun test                                             # exit 0; coverage ≥ 75% statements
   212	cd /tmp && git init test-repo && cd test-repo && git commit --allow-empty -m init
   213	mconnect start --worktree --preset research-spec-test --no-interactive &     # spawns 3 agents
   214	sleep 10
   215	test "$(git worktree list | wc -l)" -eq 4                                    # 1 main + 3 agent worktrees
   216	kill %1; sleep 5
   217	test "$(git worktree list | wc -l)" -eq 1                                    # cleanup verified
   218	
   219	# Fork/resume
   220	cd packages/desktop && bun run e2e -- e2e/phase-3-fork-resume.spec.ts        # exit 0; spec asserts new session has scrollback_count(N) == fork_message_id, resume replays exactly N + 1 lines
   221	
   222	# IDE diff
   223	cd packages/desktop && bun run e2e -- e2e/phase-3-diff-panel.spec.ts         # exit 0; spec asserts inline + side-by-side renders + accept/reject persists to file
   224	```
   225	
   226	**Shippable**: `packages/desktop@0.2.0-beta` + `lecoder-mconnect@0.2.0-beta` with `--worktree`.
   227	
   228	### Phase 4 — Soak + cross-platform hardening + observability (Weeks 9-10)
   229	
   230	**Deliverables**:
   231	- 24-hour multi-agent terminal soak in CI: 3 agents in worktrees, simulated input every 10s, resize storm every 5min, fork+resume every 30min. Pass = no PTY leak, no worktree leak, RAM steady-state within ±10% of t=1h baseline.
   232	- Updater-installed binary regression: install signed dmg from a previous release, run hard-gate spike, must pass.
   233	- DB migration test: load fixture `packages/cli/__tests__/fixtures/legacy-v0.1.10-sessions.db`; run `bun run db:migrate`; assert all v0.1.10 sessions readable via v0.2.0 code; assert FTS5 + message_id columns added without data loss.
   234	- OAuth token storage security audit: confirm tokens not written to scrollback, not logged, encrypted at rest in OS keychain via Tauri secure-store plugin.
   235	- Provider contract tests: fixture WS server replays canonical Claude / Gemini / Cursor / Aider prompt-response sequences; CLI under test must produce identical output.
   236	- iOS regression: run existing TestFlight build against new server (with v3.1 capability negotiation). Asserts v3.0 client ignores v3.1 messages without disconnect.
   237	- Opik tracing extended: spans for `desktop.session_attach`, `desktop.fork`, `desktop.resume`, `worktree.create`, `worktree.cleanup`, `worktree.gc`. New evals: **Worktree Hygiene** (0–1, no leaks under soak), **Fork Fidelity** (0–1, scrollback row counts match expectation).
   238	
   239	**Verification gate (mechanical)**:
   240	```bash

exec
/bin/zsh -lc "nl -ba .omc/plans/2026-05-02-194104-mconnect-v2-session-desktop-anchor.md | sed -n '240,520p'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
   240	```bash
   241	# Soak (runs in dedicated CI job ci-soak-24h, scheduled nightly during Phase 4)
   242	.github/workflows/soak.yml                                                   # green for 3 consecutive nights
   243	
   244	# Migration
   245	cd packages/cli && bun test __tests__/migrations/legacy-v0.1.10.test.ts      # exit 0
   246	
   247	# Provider contract
   248	cd packages/cli && bun test __tests__/providers/contract/                    # exit 0; ≥ 4 providers covered
   249	
   250	# iOS regression (manual + scripted)
   251	cd packages/ios-app && xcodebuild -scheme MConnect test \
   252	  -destination 'platform=iOS Simulator,name=iPhone 15'                      # exit 0; includes new test asserting v3.0 client + v3.1 server interop
   253	
   254	# Opik
   255	curl -s "$OPIK_URL/projects/$OPIK_PROJECT/spans?type=worktree.create" \
   256	  | jq -e '.spans | length > 0'                                             # exit 0
   257	```
   258	
   259	### Phase 5 — Code-signing + distribution + auto-update (Weeks 11)
   260	
   261	**Deliverables**:
   262	- macOS notarization via `tauri-action` GitHub Action: CSC_LINK + CSC_KEY_PASSWORD secrets configured in `.github/workflows/release.yml`. Output: signed + notarized dmg.
   263	- Linux: AppImage signed via gpg, .deb signed.
   264	- Windows: best-effort code-signing with self-signed cert; documented limitation in release notes that Windows users will see SmartScreen warning until EV cert acquired (out of v0.2.0 scope).
   265	- Auto-update: Tauri updater plugin pointed at GitHub Releases; `update-manifest.json` published on tag.
   266	- Auto-update e2e: install previous release, push new release tag, assert app receives update notification within 4h check window (test uses shortened 60s interval via env var).
   267	
   268	**Verification gate (mechanical)**:
   269	```bash
   270	# Release dry-run
   271	GH_TOKEN=$GITHUB_TOKEN gh release create v0.2.0-rc1 --draft --generate-notes
   272	ls dist/*.dmg dist/*.AppImage dist/*.deb dist/*.msi                         # all present
   273	codesign -dv dist/MConnect.app 2>&1 | grep "Authority=Developer ID Application: Arya"   # exit 0
   274	spctl -a -t exec -vv dist/MConnect.app 2>&1 | grep "accepted"                # exit 0 (notarized)
   275	
   276	# Updater e2e
   277	cd packages/desktop && bun run e2e -- e2e/phase-5-updater.spec.ts            # exit 0
   278	```
   279	
   280	### Phase 6 — Opik dashboards + release notes + demo + blog (Weeks 12)
   281	
   282	**Deliverables**:
   283	- README, CHANGELOG, ROADMAP updated for v0.2.0.
   284	- Demo video (Loom or YouTube) showing: open desktop → list sessions → spawn 3 agents w/ worktree → fork session → resume → see live grid → IDE diff accept.
   285	- Blog post on lecoder.lesearch.ai.
   286	- Tagged release `v0.2.0`. Bump `lecoder-mconnect@0.2.0`, `@lecoder/desktop@0.2.0`, `@lecoder/worktree@0.2.0`.
   287	
   288	**Verification gate (mechanical)**:
   289	```bash
   290	git tag -l | grep "^v0.2.0$"                                                 # exit 0
   291	gh release view v0.2.0 --json assets | jq -e '.assets | length >= 4'         # exit 0
   292	test -f apps/website/src/app/blog/v0-2-0-launch/page.mdx                     # exit 0
   293	grep "v0.2.0" README.md CHANGELOG.md ROADMAP.md                              # all present
   294	```
   295	
   296	---
   297	
   298	## 6. Pre-mortem (deliberate mode — 4 scenarios, addresses Critic FAIL: missing protocol-drift scenario)
   299	
   300	### Scenario 1 — *Tauri Windows terminal bridge fails*
   301	
   302	**Causes**: Tauri 2.0 webview2 ↔ node-pty IPC has Windows-specific framing bug. Switchboard/Orchestrator/jcode all chose Electron in part for this reason.
   303	
   304	**Mitigations baked in**:
   305	- Phase 0 hard gate runs on Windows CI runner.
   306	- **Kill criterion is in Phase 0 itself, NOT Phase 5**: failure = swap to Electron before Phase 1 UI work. 1-week Electron swap reserved in Phase 0 budget.
   307	- Phase 4 cross-platform soak repeats on Windows.
   308	
   309	### Scenario 2 — *Worktree cleanup leaves dangling state on crash*
   310	
   311	**Causes**: `mconnect` killed mid-worktree-create; agent process exits without invoking cleanup hook.
   312	
   313	**Mitigations baked in**:
   314	- `WorktreeRuntime.gcDangling({ runningAgentIds })` runs on every CLI startup; sweeps `.shards/` directories whose agent ID is not in current session registry.
   315	- Phase 3 verification gate explicitly tests the kill-mid-flow scenario.
   316	- Phase 4 soak runs 24h with simulated kills every 30min and asserts no leaked worktrees.
   317	
   318	### Scenario 3 — *Fork/resume corrupts session state for the original session*
   319	
   320	**Causes**: Fork copies scrollback rows; if FK constraint or trigger misfires, original session loses rows or gains duplicate `(session_id, line_number)` pairs.
   321	
   322	**Mitigations baked in**:
   323	- Migration `003_scrollback_message_id.sql` adds `message_id` column without altering existing PK `(session_id, line_number)`. Fork copies via `INSERT INTO scrollback SELECT ... FROM scrollback WHERE session_id = ? AND message_id <= ?` into a new `session_id`.
   324	- Phase 3 e2e asserts row counts match expectation in BOTH original and forked session after fork.
   325	- Phase 4 soak runs fork every 30min for 24h; assertion at end: original session row counts strictly monotonically increasing, forked sessions have exact expected lengths.
   326	
   327	### Scenario 4 — *Protocol/auth migration drift breaks iOS pairing + desktop attach* (NEW — addresses Critic-required missing pre-mortem)
   328	
   329	**Causes**: Desktop ships against v3.1 message families (`desktop:*`, `worktree:*`); CLI was at v2.0 silently `console.warn`-and-drop on unknown messages (`packages/cli/src/ws/ws-hub.ts:524-526`); shared/server/iOS were already v3.0; iOS returns nil for unknown server types (`packages/ios-app/.../Protocol.swift:391-452`). Without **explicit capability negotiation**, desktop and iOS appear connected but miss critical state messages, and the failure is silent.
   330	
   331	**Mitigations baked in**:
   332	- Phase 0 deliverable: capability negotiation in `packages/shared/src/protocol/messages.ts` + typed `unsupported_capability` error replacing silent drop.
   333	- Phase 0 deliverable: CLI catch-up to `PROTOCOL_VERSION = '3.0'`. No desktop work begins until this is merged + green in CI.
   334	- Phase 4 deliverable: iOS regression test specifically asserts old TestFlight v3.0 build interoperates with new v3.1 server without disconnect.
   335	- Compatibility matrix documented in `docs/protocol/v3.1-migration.md`: which capability is required by which client; which silently downgrades; which is a hard error.
   336	- Rollback plan: feature flag `MCONNECT_DISABLE_V3_1` in CLI + desktop falls back to v3.0-only message set.
   337	
   338	---
   339	
   340	## 7. Expanded test plan (deliberate mode, addresses Critic FAIL: under-resourced for cross-platform release)
   341	
   342	### 7.1 Unit (per-package)
   343	- `packages/desktop/__tests__/`: Tauri command serializers, session-list aggregation, fork-message-id math, status-notification dispatcher, perf-budget threshold checker, FTS5 query builder.
   344	- `packages/worktree/__tests__/`: create/list/cleanup happy path; dirty workspace; branch-name collision; crash recovery (mid-create kill → GC sweeps); concurrent create on same branch.
   345	- `packages/cli/__tests__/migrations/`: 002_scrollback_fts and 003_scrollback_message_id apply against fixture v0.1.10 db without data loss.
   346	- Coverage thresholds: existing CLI thresholds preserved; new packages require **75% statements / 70% branches / 70% functions**.
   347	
   348	### 7.2 Integration
   349	- Desktop ↔ CLI bridge: spin up CLI under PTY, desktop attaches via WebSocket, exchange 100 messages, no drops. **Repeats for v3.0 client + v3.1 client + mismatched-capability scenarios.**
   350	- Worktree multi-agent: 3 agents in same repo via worktrees; verify isolation by writing conflicting changes from each.
   351	- iOS protocol-v3.0 backward compat: build current TestFlight iOS app against new v3.1 server.
   352	- Cross-platform desktop install: dmg on macOS arm64; AppImage on Ubuntu 24.04; .deb on Debian 13; msi on Windows 11.
   353	
   354	### 7.3 E2E
   355	- **Fork-and-resume happy path**: open desktop → start session → run 5 turns → fork at message 3 → assert new session scrollback count == 3, original count == 5+ (new turns OK).
   356	- **Cold-start perf**: desktop cold-start TTI ≤ 2.5 s on M-series Mac and Linux x64; PSS ≤ 220 MB idle / ≤ 320 MB w/ 5 sessions.
   357	- **iOS pairing flow**: scan QR from desktop sidebar → iOS connects → terminal flows in iOS app unchanged from v0.1.10.
   358	- **Cross-platform CI matrix**: ci-build-macos, ci-build-linux, ci-build-windows, ci-hard-gate-macos, ci-hard-gate-linux, ci-hard-gate-windows, ci-e2e-macos, ci-e2e-linux. **All required for merge.**
   359	
   360	### 7.4 Soak / release-engineering (NEW per Critic)
   361	- **24-hour multi-agent soak**: scheduled nightly in Phase 4. Pass = 3 consecutive nights green.
   362	- **Notarization e2e**: signed + notarized dmg installs cleanly on a fresh macOS VM (codesign + spctl assertions in §5).
   363	- **Updater e2e**: install previous release → push new tag → app receives update within shortened 60s test window.
   364	- **Worktree crash recovery**: kill `mconnect` SIGKILL during worktree create; assert next `mconnect start` GCs the dangling worktree.
   365	- **DB migration regression**: fixture v0.1.10 db migrates to v0.2.0 schema without data loss; round-trip query equality.
   366	- **OAuth token security**: assert tokens not in scrollback rows, not in CLI logs, present in OS keychain only.
   367	- **Provider contract**: replay canonical Claude / Gemini / Cursor / Aider sequences; assert deterministic output.
   368	- **iOS WKWebView regression**: deferred since iOS side-panel is out of v0.2.0 scope. Re-enable in v0.3.x.
   369	
   370	### 7.5 Observability
   371	- Opik spans added: `desktop.session_attach`, `desktop.fork`, `desktop.resume`, `worktree.create`, `worktree.cleanup`, `worktree.gc`.
   372	- New Opik feedback scores: **Worktree Hygiene**, **Fork Fidelity**, **Cold-Start TTI**, **Idle PSS**.
   373	- Perf-budget script writes `.omc/perf-budget/<date>.json`; CI fails on regressions > 10% over rolling 7-day median.
   374	- Compatibility matrix dashboard: which capability negotiation paths are exercised in production traces (so we can flag silent-drop scenarios in real users).
   375	
   376	---
   377	
   378	## 8. Acceptance criteria (revised, addresses Critic FAIL: vague/false ACs)
   379	
   380	Every AC is **fixture path + command + expected deterministic assertion**. Ralph executes mechanically.
   381	
   382	| # | Criterion | Fixture / command | Expected assertion |
   383	|---|---|---|---|
   384	| AC1 | `packages/desktop` builds clean on macOS arm64, Linux x64, **Windows x64** in CI | CI jobs `ci-build-macos`, `ci-build-linux`, `ci-build-windows` | All three green on PR-to-main |
   385	| AC2 | Cold-start TTI ≤ 2.5 s on M-series Mac | `cd packages/desktop && bun run perf-budget --metric=tti --platform=macos` | Output JSON `tti_ms` ≤ 2500 |
   386	| AC3 | Idle PSS ≤ 220 MB w/ 1 session, ≤ 320 MB w/ 5 sessions | `cd packages/desktop && bun run perf-budget --metric=pss --sessions=1,5` | JSON `pss_mb_1session` ≤ 220 AND `pss_mb_5sessions` ≤ 320 |
   387	| AC4 | Existing `lecoder-mconnect@0.1.10` flow regression: start → QR → 10 commands → exit | `bun test packages/cli/__tests__/regression/v0_1_10.test.ts` | exit 0 |
   388	| AC5 | Desktop session browser lists every CLI session with last-activity timestamp | Fixture: `packages/cli/__tests__/fixtures/3-session-store.db`. `bun run e2e -- e2e/ac-5-session-list.spec.ts` | JSON output array length == 3, each row has `last_activity_iso` non-null |
   389	| AC6 | FTS5 search returns rows with `(session_id, line_number, snippet)` | Fixture: 1KB scrollback w/ known token "QUICKBROWNFOX". `sqlite3 ~/.mconnect/sessions.db "SELECT session_id, line_number, snippet(scrollback_fts) FROM scrollback_fts WHERE scrollback_fts MATCH 'QUICKBROWNFOX'"` | Returns ≥ 1 row matching fixture-line ID |
   390	| AC7 | Fork from message_id N produces new session whose scrollback row count == N | Fixture: 10-message session. `bun run e2e -- e2e/ac-7-fork.spec.ts` | New session scrollback `COUNT(*) == 5` for fork_at=5 |
   391	| AC8 | Up to 10 concurrent agents in one repo with `--worktree`, each isolated under `.shards/<agent-id>/`, cleanup on exit | `bun test packages/worktree/__tests__/integration/10-agent.test.ts` | All 10 worktrees created, all 10 cleaned up after kill |
   392	| AC9 | Worktree GC sweeps dangling worktrees from prior crash | `bun test packages/worktree/__tests__/integration/crash-gc.test.ts` | After SIGKILL during create + restart, `git worktree list` length == 1 |
   393	| AC10 | iOS `protocolVersion = "3.0"` build interoperates with new v3.1 server | `cd packages/ios-app && xcodebuild test -only-testing:MConnectTests/V3InteropTests` | exit 0 |
   394	| AC11 | Capability negotiation: client missing capability X gets typed `unsupported_capability` warning, not silent drop | `bun test packages/cli/__tests__/protocol/capability-negotiation.test.ts` | Test asserts `warning` event emitted with `code: 'UNSUPPORTED_CAPABILITY'` |
   395	| AC12 | Migration `002_scrollback_fts.sql` and `003_scrollback_message_id.sql` apply to fixture v0.1.10 db without data loss | `bun test packages/cli/__tests__/migrations/legacy-v0.1.10.test.ts` | Pre/post row counts equal; new columns added |
   396	| AC13 | Signed + notarized dmg installs cleanly on fresh macOS VM | CI job `ci-release-macos`. `codesign -dv dist/MConnect.app` and `spctl -a -t exec -vv dist/MConnect.app` | First contains `Authority=Developer ID Application: Arya`; second contains `accepted` |
   397	| AC14 | Auto-update e2e: previous release receives update within shortened 60s window | `bun run e2e -- e2e/ac-14-updater.spec.ts` | Update notification fires within 60s, new version installs |
   398	| AC15 | 24-hour soak: 3 consecutive nights green | `.github/workflows/soak.yml` runs nightly | 3 consecutive nightly runs green; assertion JSON: no PTY leak, no worktree leak, RAM steady-state ±10% |
   399	| AC16 | Opik dashboard shows new spans + 2 new evals | Phase 4 ops checklist (manual one-time) + automated assertion via Opik API in §7.5 | curl returns `spans length > 0` for each new span type |
   400	
   401	## 9. Risks & mitigations (every mitigation cites a concrete deliverable in §5)
   402	
   403	| Risk | Likelihood | Impact | Mitigation (with §5 deliverable reference) |
   404	|---|---|---|---|
   405	| Tauri 2.0 cross-platform terminal bridge instability | M | H | Phase 0 hard gate `packages/desktop/scripts/hard-gate.ts` runs on mac+linux+win; **kill criterion = swap to Electron BEFORE Phase 1**, 1-week swap budget reserved IN Phase 0. |
   406	| Protocol v2/v3 split-brain (CLI v2 vs shared/server/iOS v3) | H (today) | H | Phase 0 deliverable: CLI catch-up to `PROTOCOL_VERSION = '3.0'` + capability negotiation + typed `unsupported_capability` replacing silent drop at `packages/cli/src/ws/ws-hub.ts:524-526`. |
   407	| Worktree cleanup leaks under crash | M | M | `WorktreeRuntime.gcDangling()` runs on every CLI startup; Phase 3 e2e covers kill-mid-create; Phase 4 soak runs 24h with kills every 30min. |
   408	| Fork/resume corrupts original session | M | H | Migration `003_scrollback_message_id.sql` preserves PK; fork via INSERT-SELECT into new session_id; Phase 3 e2e asserts row counts in BOTH sessions; Phase 4 soak runs fork every 30min for 24h. |
   409	| iOS App Store re-review delay if protocol churn | L | H | All v3.1 additions capability-gated; iOS not modified in v0.2.0; Phase 4 iOS regression test explicitly asserts old TestFlight build interoperates with new server. |
   410	| FTS5 schema migration corrupts existing v0.1.10 db | L | H | Migration test `__tests__/migrations/legacy-v0.1.10.test.ts` uses fixture db; Phase 4 explicit DB migration regression test in §7.4. |
   411	| Code-signing fails in Phase 5 (cert expiry, notarization timeout) | M | M | Dry-run release in Phase 5 verification gate; documented fallback to unsigned distribution + GitHub release notes warning. Self-signed Windows acceptable per §5. |
   412	| Scope creep into memory/swarm/OAuth during execution | M | M | Plan §13 (out of scope) is binding for ralph. Any deviation requires a new consensus loop. |
   413	| Codex / Claude model deprecation mid-cycle | L | M | Provider contract tests (§7.4) replay fixture sequences; failure surfaces immediately. No model version pinning required because tests use deterministic fixtures, not live providers. |
   414	
   415	## 10. Verification steps (revised, addresses Critic FAIL: mechanical executability)
   416	
   417	Every step is a one-line shell command with an expected exit code. Manual checks isolated to a separate "manual gate" section that ralph escalates to user.
   418	
   419	### 10.1 Per-package mechanical (ralph runs all)
   420	```bash
   421	# Phase 0
   422	grep "PROTOCOL_VERSION = '3.0'" packages/cli/src/ws/protocol.ts                            # exit 0
   423	test -f packages/shared/src/interfaces/TerminalBridge.ts                                   # exit 0
   424	test -f packages/shared/src/interfaces/WorktreeRuntime.ts                                  # exit 0
   425	cd packages/desktop && bun run hard-gate -- --platform=macos                               # exit 0
   426	cd packages/desktop && bun run hard-gate -- --platform=linux                               # exit 0
   427	cd packages/desktop && bun run hard-gate -- --platform=windows                             # exit 0
   428	
   429	# Phase 1
   430	npm run build                                                                              # exit 0
   431	sqlite3 ~/.mconnect/sessions.db "SELECT name FROM sqlite_master WHERE name='scrollback_fts'" | grep -q scrollback_fts   # exit 0
   432	npx lecoder-mconnect doctor                                                                # exit 0
   433	bun test packages/cli/__tests__/regression/v0_1_10.test.ts                                 # exit 0
   434	
   435	# Phase 3
   436	bun test packages/worktree                                                                 # exit 0; coverage ≥ 75%
   437	cd packages/desktop && bun run e2e -- e2e/phase-3-fork-resume.spec.ts                      # exit 0
   438	
   439	# Phase 4
   440	bun test packages/cli/__tests__/migrations/legacy-v0.1.10.test.ts                          # exit 0
   441	bun test packages/cli/__tests__/providers/contract/                                        # exit 0
   442	cd packages/ios-app && xcodebuild test -only-testing:MConnectTests/V3InteropTests          # exit 0
   443	
   444	# Phase 5
   445	codesign -dv dist/MConnect.app 2>&1 | grep -q "Authority=Developer ID Application: Arya"   # exit 0
   446	spctl -a -t exec -vv dist/MConnect.app 2>&1 | grep -q "accepted"                           # exit 0
   447	
   448	# Phase 6
   449	git tag -l | grep -q "^v0.2.0$"                                                            # exit 0
   450	gh release view v0.2.0 --json assets | jq -e '.assets | length >= 4'                       # exit 0
   451	```
   452	
   453	### 10.2 CI job names (required for merge to main)
   454	- `ci-build-macos`, `ci-build-linux`, `ci-build-windows`
   455	- `ci-typecheck-all`
   456	- `ci-test-cli`, `ci-test-server`, `ci-test-shared`, `ci-test-desktop`, `ci-test-worktree`
   457	- `ci-e2e-macos`, `ci-e2e-linux`
   458	- `ci-hard-gate-macos`, `ci-hard-gate-linux`, `ci-hard-gate-windows`
   459	- `ci-soak-24h` (nightly during Phase 4, then weekly)
   460	- `ci-perf-budget` (PR-time + nightly trend)
   461	- `ci-release-macos`, `ci-release-linux`, `ci-release-windows` (tag-time only)
   462	
   463	### 10.3 Manual gates (ralph escalates to user)
   464	- Phase 5: Apple Developer cert renewal status, GH release notes review, blog draft review.
   465	- Phase 6: Demo video review.
   466	
   467	## 11. ADR — Architecture Decision Record (FINAL, not provisional)
   468	
   469	**Decision**: For mconnect v0.2.0, build `packages/desktop` as Tauri 2.0 + React 19 + xterm.js + Zustand + Tailwind + Lucide + CodeMirror, **additive** to existing `packages/cli`, `packages/server`, `packages/shared`, `packages/ios-app`. Add new `packages/worktree` for git-worktree-per-agent isolation. Cut v0.2.0 scope to: desktop session manager + worktree isolation + fork/resume + IDE diff panel. Defer memory layer, swarm, multi-provider OAuth (beyond existing GitHub/Google), iOS side panel, skill compounding, smfs, sub-swarms, voice control to v0.3.x. Catch the CLI up to `PROTOCOL_VERSION = '3.0'` (currently lagging at `'2.0'` while shared/server/iOS are already on `'3.0'`) as Phase 0 prerequisite, with capability negotiation replacing the current silent unknown-message drop.
   470	
   471	**Drivers (unchanged from v0)**:
   472	1. Time-to-shipped-desktop while iOS App Store momentum is high.
   473	2. Preserve `lecoder-mconnect@0.1.10` (npm) + TestFlight stability.
   474	3. Token-cost containment for memory + swarm features (justifying their deferral to v0.3.x).
   475	
   476	**Alternatives considered**:
   477	- **Option B (Hybrid Rust sidecar from day one)** rejected for v0.2.0: re-scored honestly at +3-4 weeks vs. Option A on the *same* product surface (Tauri's existing Rust toolchain in CI lowers Option B's marginal cost to ~30%, not 100% as the v0 plan incorrectly stated). Fails Driver #1 (time-to-shipped-desktop) at 12-week budget. **Kept on file as the Phase 6 follow-up candidate** with explicit re-evaluation triggers below.
   478	- **Option C (Full Rust HUB plan)** rejected: 20+ week estimate violates Driver #1; full core rewrite directly violates user's "no rewrites" constraint #4.
   479	
   480	**Why chosen**: Option A is the only path that satisfies all three drivers + the user's interview-locked architecture constraint while still delivering a credible Switchboard-style anchor in 12 weeks under the narrow scope. The Architect-suggested synthesis (TS interfaces + future Rust adapter swap) is incorporated into Phase 0 deliverables.
   481	
   482	**Consequences**:
   483	- Higher steady-state RAM than Rust would deliver. Acceptable per perf-budget §1 principle 4 (≤ 220 MB idle, ≤ 320 MB at 5 sessions, comparable to Switchboard/Orchestrator).
   484	- v3.1 capability negotiation introduces a small migration burden on the iOS app at v0.3.x time (when iOS gains its own new capabilities).
   485	- Memory + swarm features are deferred to v0.3.x; v0.2.0 product story is "best mobile-first session manager," not "best agent-coordination platform."
   486	- Sunk planning effort in HUB plan's Rust workspace is parked, not lost; Phase 6 trigger criteria are explicit below.
   487	
   488	**Follow-ups (with explicit triggers)**:
   489	- **Re-evaluate Option B for v0.3.x**: triggered by either (a) measured perf gap > 30% under realistic load (worktree create p95 > 200 ms or RAM PSS w/ 10 sessions > 600 MB), OR (b) ≥ 3 community requests for Rust-core distribution.
   490	- **Re-evaluate smfs FUSE/NFS mount**: triggered by (a) license clearance for vendored binaries, AND (b) memory layer in v0.3.x reaching beta.
   491	- **Re-evaluate voice control (paseo parity)**: triggered by user-validated demand signal in v0.3.x research.
   492	- **iOS side panel (Mermaid/diff/file)**: scheduled v0.3.x with WKWebView + mermaid.js (no Rust mermaid vendoring).
   493	
   494	---
   495	
   496	## 12. Changelog of applied improvements
   497	
   498	- **v1 (2026-05-02, after Architect + Critic round 1)**:
   499	  - Reframed §1 protocol principle around v3.0 baseline (was: "reuse v2"). Cited file:line evidence.
   500	  - Tightened §1 "additive" definition (Critic FAIL §1 vs §3 consistency).
   501	  - Re-scored Option B in §3 honestly at +3-4 weeks (was: rejected on Rust-toolchain ground that Tauri itself violates). (Critic FAIL §3 fair alternatives.)
   502	  - Inserted Phase 0 hard gate w/ kill criterion + Electron escape budgeted IN Phase 0 (was: Phase 5). (Critic FAIL §9 risk mitigation.)
   503	  - Added Phase 0 deliverable: CLI protocol catch-up to v3.0, capability negotiation, typed `unsupported_capability` error. (Both critics' top finding.)
   504	  - Cut v0.2.0 scope to desktop + worktree + fork/resume + IDE diff. Memory/swarm/OAuth/iOS side-panel/skills/smfs/sub-swarms moved to v0.3.x. (Critic FAIL §5 phase budget.)
   505	  - Rewrote §8 ACs as fixture-path + command + expected deterministic assertion (was: 13 vague ACs; now 16 mechanical ACs). Fixed AC3 (root version 0.1.2, CLI 0.2.0, npm 0.1.10), AC6 (FTS5 schema requires migration `002_scrollback_fts.sql`), AC7 (added migration `003_scrollback_message_id.sql` for `message_id` column), AC10 (iOS protocol is v3.0, not v2). (Critic FAIL §8 acceptance criteria.)
   506	  - Added 4th pre-mortem scenario: protocol/auth migration drift across 4 client implementations. (Critic FAIL §6 pre-mortem.)
   507	  - Added §7.4 soak/release-engineering test category: 24h multi-agent soak, notarization e2e, updater e2e, worktree crash recovery, DB migration regression, OAuth token storage security, provider contract tests. (Critic FAIL §7 expanded tests.)
   508	  - Rewrote §10 verification as mechanical commands per package + CI job names + isolated manual gates. (Critic FAIL §10 verification.)
   509	  - Finalized §11 ADR (was: provisional; now load-bearing with explicit follow-up triggers). (Critic FAIL §11 ADR.)
   510	  - Tightened §13 out-of-scope: smfs/voice/iOS side panel/multi-provider OAuth all explicitly listed with reason. (Critic PARTIAL §13 out-of-scope.)
   511	  - Restructured phases: Phase 0=hard gate+protocol catch-up (Wks 1-2), Phase 1=desktop MVP (Wks 3-5), Phase 3=worktree+fork+IDE diff (Wks 6-8), Phase 4=soak+hardening (Wks 9-10), Phase 5=signing+distribution (Wk 11), Phase 6=Opik+release notes+demo (Wk 12). (Critic FAIL Phase 5 realism.)
   512	- **v0 (2026-05-02, Planner draft)**: REJECTed by Critic round 1; 9/10 checks FAIL; full feedback in `.omc/artifacts/ask/codex-...02-52-57-259Z.md`.
   513	
   514	---
   515	
   516	## 13. Out of scope (explicit, binding for ralph)
   517	
   518	- **Memory layer** (jcode + smfs ambient embedding + consolidation + skills) → v0.3.x. Reason: token-cost driver + 4-week minimum on its own.
   519	- **Swarm coordinator** (jcode file-shift + DM + broadcast + sub-swarms) → v0.3.x. Reason: feedback-loop testing burden + protocol surface.
   520	- **Multi-provider OAuth beyond existing GitHub/Google** (Claude, OpenAI, Gemini, Copilot, Azure, Ollama, openai-compatible, headless `--no-browser`) → v0.3.x. Reason: server `auth/providers/index.ts` ships only GitHub today; expansion is 3-4 weeks alone.

exec
/bin/zsh -lc "rg -n \"protocolVersion|PROTOCOL_VERSION|3\\.0|v3\\.1|unsupported_capability|client_capabilities|AuthMessage|auth\" packages/ios-app packages/server packages/shared/src/protocol docs/protocol/v3.md packages/cli/src/ws -g '"'!node_modules'"'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
docs/protocol/v3.md:1:# WebSocket Protocol v3.0
docs/protocol/v3.md:7:Protocol v3.0 extends v2.0 with:
docs/protocol/v3.md:9:- OAuth JWT authentication (token in first message, not URL parameter)
docs/protocol/v3.md:39:  |--- auth { token, clientType } --------->|  (must send within 10s)
docs/protocol/v3.md:40:  |<-- auth_success { clientId, userId } ---|
docs/protocol/v3.md:60:The first message after connection **must** be an `auth` message. If not received within 10 seconds, the server disconnects the client.
docs/protocol/v3.md:77:### `auth`
docs/protocol/v3.md:83:  "type": "auth",
docs/protocol/v3.md:85:  "protocolVersion": "3.0",
docs/protocol/v3.md:93:| `protocolVersion` | string | Yes | Must be `"3.0"` |
docs/protocol/v3.md:265:### `auth_success`
docs/protocol/v3.md:271:  "type": "auth_success",
docs/protocol/v3.md:273:  "protocolVersion": "3.0",
docs/protocol/v3.md:283:| `protocolVersion` | string | Confirmed protocol version |
docs/protocol/v3.md:287:### `auth_failed`
docs/protocol/v3.md:293:  "type": "auth_failed",
docs/protocol/v3.md:307:List of available sessions (sent after successful auth).
docs/protocol/v3.md:584:| `AUTH_FAILED` | Authentication failed | Yes (after re-auth) |
packages/cli/src/ws/ws-hub.ts:5: * Handles authentication, message routing, broadcast, and protocol v2 session management.
packages/cli/src/ws/ws-hub.ts:98:  protocolVersion: string;
packages/cli/src/ws/ws-hub.ts:209:        if (ws.readyState === WebSocket.OPEN && client.protocolVersion === '2.0') {
packages/cli/src/ws/ws-hub.ts:245:    const protocolVersion = url.searchParams.get('v') || '1.0';
packages/cli/src/ws/ws-hub.ts:253:      console.log(`[WSHub] Unauthorized connection from ${ip}`);
packages/cli/src/ws/ws-hub.ts:254:      // Trace auth failure
packages/cli/src/ws/ws-hub.ts:259:      ws.close(4001, 'Unauthorized');
packages/cli/src/ws/ws-hub.ts:269:      authenticated: true,
packages/cli/src/ws/ws-hub.ts:274:      protocolVersion,
packages/cli/src/ws/ws-hub.ts:296:    // For v2 protocol, send auth_success and session_list
packages/cli/src/ws/ws-hub.ts:297:    if (protocolVersion === '2.0') {
packages/cli/src/ws/ws-hub.ts:298:      const authSuccess: AuthSuccessMessage = {
packages/cli/src/ws/ws-hub.ts:299:        type: 'auth_success',
packages/cli/src/ws/ws-hub.ts:301:        protocolVersion: '2.0',
packages/cli/src/ws/ws-hub.ts:304:      this.sendToClient(ws, authSuccess);
packages/cli/src/ws/ws-hub.ts:413:    if (!clientInfo?.authenticated) {
packages/cli/src/ws/ws-hub.ts:416:        message: 'Not authenticated',
packages/cli/src/ws/ws-hub.ts:886:        client.authenticated &&
packages/cli/src/ws/ws-hub.ts:1170:   * Broadcast message to all authenticated clients
packages/cli/src/ws/ws-hub.ts:1175:      if (client.readyState === WebSocket.OPEN && info.authenticated) {
packages/shared/src/protocol/messages.ts:2: * WebSocket Protocol v3.0 Message Types
packages/shared/src/protocol/messages.ts:4: * Protocol v3.0 extends v2.0 with:
packages/shared/src/protocol/messages.ts:6: * - OAuth token authentication (not query param)
packages/shared/src/protocol/messages.ts:22:export const PROTOCOL_VERSION = '3.0';
packages/shared/src/protocol/messages.ts:65:export interface AuthMessage extends BaseMessage {
packages/shared/src/protocol/messages.ts:66:  type: 'auth';
packages/shared/src/protocol/messages.ts:70:  protocolVersion: typeof PROTOCOL_VERSION;
packages/shared/src/protocol/messages.ts:179:  | AuthMessage
packages/shared/src/protocol/messages.ts:199:  type: 'auth_success';
packages/shared/src/protocol/messages.ts:203:  protocolVersion: typeof PROTOCOL_VERSION;
packages/shared/src/protocol/messages.ts:216:  type: 'auth_failed';
packages/shared/src/protocol/messages.ts:520:    'auth',
packages/shared/src/protocol/messages.ts:539:    'auth_success',
packages/shared/src/protocol/messages.ts:540:    'auth_failed',
packages/cli/src/ws/protocol.ts:89:  type: 'auth_success';
packages/cli/src/ws/protocol.ts:91:  protocolVersion: '2.0';
packages/cli/src/ws/protocol.ts:259:export const PROTOCOL_VERSION = '2.0';
packages/cli/src/ws/types.ts:171:  authenticated: boolean;
packages/cli/src/ws/types.ts:177:  /** Session token for authentication */
packages/server/src/api/sessions.ts:19:import { getAuthService, AuthError } from '../auth/index.js';
packages/server/src/api/sessions.ts:51:  const authHeader = request.headers.get('Authorization');
packages/server/src/api/sessions.ts:53:  if (!authHeader?.startsWith('Bearer ')) {
packages/server/src/api/sessions.ts:57:  const token = authHeader.slice(7);
packages/server/src/api/sessions.ts:60:    const authService = getAuthService();
packages/server/src/api/sessions.ts:61:    const claims = await authService.validateAccessToken(token);
packages/server/src/api/sessions.ts:72: * Require authentication - returns 401 response if not authenticated
packages/server/src/api/sessions.ts:80:        error: 'unauthorized',
packages/server/src/api/sessions.ts:115: * Create a new session for the authenticated user.
packages/server/src/api/sessions.ts:124:  const authResult = await requireAuth(request);
packages/server/src/api/sessions.ts:125:  if (authResult instanceof Response) {
packages/server/src/api/sessions.ts:126:    return authResult;
packages/server/src/api/sessions.ts:128:  const claims = authResult;
packages/server/src/api/sessions.ts:199: * List sessions for the authenticated user.
packages/server/src/api/sessions.ts:208:  const authResult = await requireAuth(request);
packages/server/src/api/sessions.ts:209:  if (authResult instanceof Response) {
packages/server/src/api/sessions.ts:210:    return authResult;
packages/server/src/api/sessions.ts:212:  const claims = authResult;
packages/server/src/api/sessions.ts:279:  const authResult = await requireAuth(request);
packages/server/src/api/sessions.ts:280:  if (authResult instanceof Response) {
packages/server/src/api/sessions.ts:281:    return authResult;
packages/server/src/api/sessions.ts:283:  const claims = authResult;
packages/server/src/api/sessions.ts:334:  const authResult = await requireAuth(request);
packages/server/src/api/sessions.ts:335:  if (authResult instanceof Response) {
packages/server/src/api/sessions.ts:336:    return authResult;
packages/server/src/api/sessions.ts:338:  const claims = authResult;
packages/server/src/api/sessions.ts:398:  const authResult = await requireAuth(request);
packages/server/src/api/sessions.ts:399:  if (authResult instanceof Response) {
packages/server/src/api/sessions.ts:400:    return authResult;
packages/server/src/api/sessions.ts:402:  const claims = authResult;
packages/server/src/api/sessions.ts:454:      protocolVersion: '3.0',
packages/server/package.json:38:    "typescript": "^5.3.0"
packages/server/package.json:43:  "author": "Arya Teja Rudraraju <aryateja2106@gmail.com>",
packages/server/src/ws/index.ts:5: * - Client authentication
packages/server/README.md:35:curl -X POST http://localhost:3001/auth/dev-token | jq
packages/server/README.md:72:| `GITHUB_REDIRECT_URI` | Callback URL (e.g., `http://localhost:3001/auth/callback`) |
packages/server/README.md:133:├── auth/                 # OAuth 2.0 + JWT
packages/server/README.md:134:│   ├── oauth.ts          # OAuth flow with PKCE
packages/server/README.md:136:│   ├── auth-service.ts   # High-level auth service
packages/server/README.md:137:│   ├── routes.ts         # HTTP auth routes
packages/server/README.md:185:| `GET` | `/auth/authorize` | No | Start OAuth PKCE flow |
packages/server/README.md:186:| `GET` | `/auth/callback` | No | OAuth provider callback |
packages/server/README.md:187:| `POST` | `/auth/token` | No | Exchange code for tokens |
packages/server/README.md:188:| `POST` | `/auth/refresh` | No | Refresh access token |
packages/server/README.md:189:| `POST` | `/auth/revoke` | No | Revoke refresh token |
packages/server/README.md:190:| `POST` | `/auth/dev-token` | No | Dev token (dev mode only) |
packages/server/README.md:220:Protocol v3.0 documentation: [`docs/protocol/v3.md`](../../docs/protocol/v3.md)
packages/server/README.md:224:2. Send `auth` message with JWT token (within 10 seconds)
packages/server/README.md:225:3. Receive `auth_success` with client ID
packages/server/src/auth/auth-service.ts:4: * High-level authentication service that combines JWT management
packages/server/src/auth/auth-service.ts:276:let authServiceInstance: AuthService | null = null;
packages/server/src/auth/auth-service.ts:279: * Get the global auth service instance
packages/server/src/auth/auth-service.ts:282:  if (!authServiceInstance) {
packages/server/src/auth/auth-service.ts:288:    authServiceInstance = new AuthService({
packages/server/src/auth/auth-service.ts:297:  return authServiceInstance;
packages/server/src/auth/auth-service.ts:301: * Initialize the auth service with custom configuration
packages/server/src/auth/auth-service.ts:304:  authServiceInstance = new AuthService(config);
packages/server/src/auth/auth-service.ts:305:  return authServiceInstance;
packages/server/src/auth/auth-service.ts:309: * Reset the auth service (for testing)
packages/server/src/auth/auth-service.ts:312:  authServiceInstance = null;
packages/server/src/auth/oauth.ts:4: * Implements OAuth 2.0 authorization code flow with PKCE for mobile clients.
packages/server/src/auth/oauth.ts:21:  /** OAuth authorization URL */
packages/server/src/auth/oauth.ts:22:  authorizationUrl: string;
packages/server/src/auth/oauth.ts:39:  /** Get the authorization URL with PKCE */
packages/server/src/auth/oauth.ts:46:  /** Exchange authorization code for tokens */
packages/server/src/auth/oauth.ts:88: * Pending OAuth state stored between authorization and callback
packages/server/src/auth/oauth.ts:95:  /** Redirect URI used in authorization */
packages/server/src/auth/oauth.ts:107:  /** Get authorization URL for a provider */
packages/server/src/auth/oauth.ts:115:  /** Exchange authorization code for tokens and create/update user */
packages/server/src/auth/oauth.ts:225: * Get authorization URL for OAuth flow
packages/server/src/auth/oauth.ts:238: * Exchange authorization code for tokens and upsert user
packages/server/src/auth/oauth.ts:324:export const oauthService: OAuthService = {
packages/server/src/auth/oauth.ts:329:export default oauthService;
packages/ios-app/MConnectTests/WSClientTests.swift:13:            "type": "auth_success",
packages/ios-app/MConnectTests/WSClientTests.swift:15:            "protocolVersion": "3.0",
packages/ios-app/MConnectTests/WSClientTests.swift:23:        guard case .authSuccess(let response) = message else {
packages/ios-app/MConnectTests/WSClientTests.swift:24:            XCTFail("Expected auth_success, got \(String(describing: message))")
packages/ios-app/MConnectTests/WSClientTests.swift:29:        XCTAssertEqual(response.protocolVersion, "3.0")
packages/ios-app/MConnectTests/WSClientTests.swift:40:            "type": "auth_failed",
packages/ios-app/MConnectTests/WSClientTests.swift:48:        guard case .authFailed(let response) = message else {
packages/ios-app/MConnectTests/WSClientTests.swift:49:            XCTFail("Expected auth_failed")
packages/ios-app/MConnectTests/WSClientTests.swift:60:            "type": "auth_failed",
packages/ios-app/MConnectTests/WSClientTests.swift:68:        guard case .authFailed(let response) = message else {
packages/ios-app/MConnectTests/WSClientTests.swift:69:            XCTFail("Expected auth_failed")
packages/ios-app/MConnectTests/WSClientTests.swift:535:        {"type": "auth_success"}
packages/ios-app/MConnectTests/WSClientTests.swift:547:    func testAuthMessageEncoding() throws {
packages/ios-app/MConnectTests/WSClientTests.swift:548:        let message = AuthMessage(token: "jwt-token-here")
packages/ios-app/MConnectTests/WSClientTests.swift:552:        XCTAssertEqual(json["type"] as? String, "auth")
packages/ios-app/MConnectTests/WSClientTests.swift:554:        XCTAssertEqual(json["protocolVersion"] as? String, "3.0")
packages/ios-app/MConnectTests/WSClientTests.swift:861:        let a = AuthSuccessResponse(type: "auth_success", clientId: "c1", protocolVersion: "3.0", clientType: .mobile, userId: "u1", timestamp: 100)
packages/ios-app/MConnectTests/WSClientTests.swift:862:        let b = AuthSuccessResponse(type: "auth_success", clientId: "c1", protocolVersion: "3.0", clientType: .mobile, userId: "u1", timestamp: 100)
packages/ios-app/MConnectTests/WSClientTests.swift:863:        XCTAssertEqual(ServerMessage.authSuccess(a), ServerMessage.authSuccess(b))
packages/ios-app/MConnectTests/WSClientTests.swift:867:        let auth = AuthSuccessResponse(type: "auth_success", clientId: "c1", protocolVersion: "3.0", clientType: .mobile, userId: "u1", timestamp: 100)
packages/ios-app/MConnectTests/WSClientTests.swift:869:        XCTAssertNotEqual(ServerMessage.authSuccess(auth), ServerMessage.pong(pong))
packages/server/src/auth/routes.ts:4: * Handles OAuth 2.0 authorization flow endpoints:
packages/server/src/auth/routes.ts:5: * - GET /auth/authorize - Start OAuth flow (redirect to provider)
packages/server/src/auth/routes.ts:6: * - GET /auth/callback - OAuth callback (exchange code for tokens)
packages/server/src/auth/routes.ts:7: * - POST /auth/token - Exchange code for tokens (PKCE)
packages/server/src/auth/routes.ts:8: * - POST /auth/refresh - Refresh access token
packages/server/src/auth/routes.ts:9: * - POST /auth/revoke - Revoke refresh token
packages/server/src/auth/routes.ts:10: * - POST /auth/dev-token - Create dev token (dev mode only)
packages/server/src/auth/routes.ts:23:} from './oauth.js';
packages/server/src/auth/routes.ts:24:import { AuthError, getAuthService } from './auth-service.js';
packages/server/src/auth/routes.ts:30:const authorizeQuerySchema = z.object({
packages/server/src/auth/routes.ts:50: * Handle GET /auth/authorize
packages/server/src/auth/routes.ts:52: * Starts the OAuth flow by redirecting to the provider's authorization URL.
packages/server/src/auth/routes.ts:57: * - redirect_uri: Where to redirect after authorization
packages/server/src/auth/routes.ts:67:  const parseResult = authorizeQuerySchema.safeParse(queryParams);
packages/server/src/auth/routes.ts:105:    // Get authorization URL from provider
packages/server/src/auth/routes.ts:106:    const authUrl = getAuthorizationUrl(
packages/server/src/auth/routes.ts:114:    return Response.redirect(authUrl, 302);
packages/server/src/auth/routes.ts:130: * Handle GET /auth/callback
packages/server/src/auth/routes.ts:133: * Exchanges the authorization code for tokens using PKCE.
packages/server/src/auth/routes.ts:153:        error_description: queryParams.error_description || 'OAuth authorization failed',
packages/server/src/auth/routes.ts:188:  // The client will then call /auth/token with the code and code_verifier
packages/server/src/auth/routes.ts:198: * Handle POST /auth/token
packages/server/src/auth/routes.ts:200: * Exchange authorization code for tokens (PKCE flow completion).
packages/server/src/auth/routes.ts:204: * - grant_type: 'authorization_code'
packages/server/src/auth/routes.ts:233:  if (grant_type !== 'authorization_code') {
packages/server/src/auth/routes.ts:237:        error_description: 'Only authorization_code grant type is supported',
packages/server/src/auth/routes.ts:273:    const authService = getAuthService();
packages/server/src/auth/routes.ts:274:    const tokenPair = await authService.createTokenPair(user);
packages/server/src/auth/routes.ts:308: * Handle POST /auth/refresh
packages/server/src/auth/routes.ts:349:    const authService = getAuthService();
packages/server/src/auth/routes.ts:350:    const { tokenPair } = await authService.refreshToken(refresh_token);
packages/server/src/auth/routes.ts:385: * Handle POST /auth/revoke
packages/server/src/auth/routes.ts:426:    const authService = getAuthService();
packages/server/src/auth/routes.ts:427:    await authService.revokeRefreshToken(token);
packages/server/src/auth/routes.ts:439: * Handle POST /auth/dev-token
packages/server/src/auth/routes.ts:483:    const authService = getAuthService();
packages/server/src/auth/routes.ts:484:    const tokenPair = await authService.createDevToken(userId, email, name);
packages/server/src/auth/routes.ts:512: * Handle auth routes
packages/server/src/auth/routes.ts:515: * @param pathname - URL pathname (e.g., '/auth/authorize')
packages/server/src/auth/routes.ts:522:  // GET /auth/authorize
packages/server/src/auth/routes.ts:523:  if (pathname === '/auth/authorize' && request.method === 'GET') {
packages/server/src/auth/routes.ts:527:  // GET /auth/callback
packages/server/src/auth/routes.ts:528:  if (pathname === '/auth/callback' && request.method === 'GET') {
packages/server/src/auth/routes.ts:532:  // POST /auth/token
packages/server/src/auth/routes.ts:533:  if (pathname === '/auth/token' && request.method === 'POST') {
packages/server/src/auth/routes.ts:537:  // POST /auth/refresh
packages/server/src/auth/routes.ts:538:  if (pathname === '/auth/refresh' && request.method === 'POST') {
packages/server/src/auth/routes.ts:542:  // POST /auth/revoke
packages/server/src/auth/routes.ts:543:  if (pathname === '/auth/revoke' && request.method === 'POST') {
packages/server/src/auth/routes.ts:547:  // POST /auth/dev-token (development only)
packages/server/src/auth/routes.ts:548:  if (pathname === '/auth/dev-token' && request.method === 'POST') {
packages/server/src/db/migrations/001_initial.sql:128:CREATE TABLE IF NOT EXISTS oauth_tokens (
packages/server/src/auth/index.ts:4: * OAuth 2.0 + JWT authentication for MConnect V2.
packages/server/src/auth/index.ts:29:  oauthService,
packages/server/src/auth/index.ts:30:} from './oauth.js';
packages/server/src/auth/index.ts:56:} from './auth-service.js';
packages/server/src/auth/index.ts:70: * Initialize the auth module
packages/server/src/api/__tests__/devices.test.ts:8:import { initializeAuthService, resetAuthService, getAuthService } from '../../auth/index.js';
packages/server/src/api/__tests__/devices.test.ts:35:  const authService = getAuthService();
packages/server/src/api/__tests__/devices.test.ts:36:  const jwt = authService.getJWTService();
packages/server/src/api/__tests__/devices.test.ts:64:    // Initialize auth for token creation
packages/server/src/api/__tests__/devices.test.ts:84:    it('should return 401 without auth token', async () => {
packages/server/src/api/__tests__/devices.test.ts:135:    it('should return 401 without auth token', async () => {
packages/server/src/api/__tests__/devices.test.ts:166:      expect(response!.status).toBe(401); // No auth
packages/server/src/api/__tests__/devices.test.ts:177:      expect(response!.status).toBe(401); // No auth
packages/server/src/auth/__tests__/auth-service.test.ts:8: * Integration tests with real database are in auth-service.integration.test.ts
packages/server/src/auth/__tests__/auth-service.test.ts:20:} from '../auth-service.js';
packages/ios-app/MConnectTests/AuthServiceTests.swift:9:        let authService = await AuthService(urlSession: .shared)
packages/ios-app/MConnectTests/AuthServiceTests.swift:10:        let verifier = await authService.generateCodeVerifier()
packages/ios-app/MConnectTests/AuthServiceTests.swift:22:        let authService = await AuthService(urlSession: .shared)
packages/ios-app/MConnectTests/AuthServiceTests.swift:23:        let v1 = await authService.generateCodeVerifier()
packages/ios-app/MConnectTests/AuthServiceTests.swift:24:        let v2 = await authService.generateCodeVerifier()
packages/ios-app/MConnectTests/AuthServiceTests.swift:29:        let authService = await AuthService(urlSession: .shared)
packages/ios-app/MConnectTests/AuthServiceTests.swift:32:        let c1 = await authService.generateCodeChallenge(from: verifier)
packages/ios-app/MConnectTests/AuthServiceTests.swift:33:        let c2 = await authService.generateCodeChallenge(from: verifier)
packages/ios-app/MConnectTests/AuthServiceTests.swift:40:        let authService = await AuthService(urlSession: .shared)
packages/ios-app/MConnectTests/AuthServiceTests.swift:42:        let challenge = await authService.generateCodeChallenge(from: verifier)
packages/ios-app/MConnectTests/AuthServiceTests.swift:51:        let authService = await AuthService(urlSession: .shared)
packages/ios-app/MConnectTests/AuthServiceTests.swift:52:        let verifier = await authService.generateCodeVerifier()
packages/ios-app/MConnectTests/AuthServiceTests.swift:53:        let challenge = await authService.generateCodeChallenge(from: verifier)
packages/ios-app/MConnectTests/AuthServiceTests.swift:62:        let authService = await AuthService(urlSession: .shared)
packages/ios-app/MConnectTests/AuthServiceTests.swift:63:        let url = await authService.startOAuthFlow(serverURL: "https://example.com:8080")
packages/ios-app/MConnectTests/AuthServiceTests.swift:77:        XCTAssertTrue(components.path.hasSuffix("/auth/authorize"))
packages/ios-app/MConnectTests/AuthServiceTests.swift:81:        let authService = await AuthService(urlSession: .shared)
packages/ios-app/MConnectTests/AuthServiceTests.swift:82:        let url = await authService.startOAuthFlow(serverURL: "https://example.com", provider: "google")
packages/ios-app/MConnectTests/AuthServiceTests.swift:91:        let authService = await AuthService(urlSession: .shared)
packages/ios-app/MConnectTests/AuthServiceTests.swift:92:        let url1 = await authService.startOAuthFlow(serverURL: "https://example.com")
packages/ios-app/MConnectTests/AuthServiceTests.swift:93:        let url2 = await authService.startOAuthFlow(serverURL: "https://example.com")
packages/ios-app/MConnectTests/AuthServiceTests.swift:109:        let authService = await AuthService(urlSession: .shared)
packages/ios-app/MConnectTests/AuthServiceTests.swift:114:            try await authService.handleCallback(url)
packages/ios-app/MConnectTests/AuthServiceTests.swift:124:        let authService = await AuthService(urlSession: .shared)
packages/ios-app/MConnectTests/AuthServiceTests.swift:127:        _ = await authService.startOAuthFlow(serverURL: "https://example.com")
packages/ios-app/MConnectTests/AuthServiceTests.swift:132:            try await authService.handleCallback(url)
packages/ios-app/MConnectTests/AuthServiceTests.swift:142:        let authService = await AuthService(urlSession: .shared)
packages/ios-app/MConnectTests/AuthServiceTests.swift:143:        _ = await authService.startOAuthFlow(serverURL: "https://example.com")
packages/ios-app/MConnectTests/AuthServiceTests.swift:147:            try await authService.handleCallback(url)
packages/ios-app/MConnectTests/AuthServiceTests.swift:162:        let authService = await AuthService(urlSession: .shared)
packages/ios-app/MConnectTests/AuthServiceTests.swift:163:        _ = await authService.startOAuthFlow(serverURL: "https://example.com")
packages/ios-app/MConnectTests/AuthServiceTests.swift:167:            try await authService.handleCallback(url)
packages/ios-app/MConnectTests/AuthServiceTests.swift:179:        let authService = await AuthService(urlSession: .shared)
packages/ios-app/MConnectTests/AuthServiceTests.swift:180:        await authService.signOut()
packages/ios-app/MConnectTests/AuthServiceTests.swift:182:        let isAuthenticated = await authService.isAuthenticated
packages/ios-app/MConnectTests/AuthServiceTests.swift:189:        let authService = await AuthService(urlSession: .shared)
packages/ios-app/MConnectTests/AuthServiceTests.swift:191:            try await authService.refreshAccessToken(serverURL: "https://example.com")
packages/server/src/db/migrate.ts:246:    await client`DROP TABLE IF EXISTS oauth_tokens CASCADE`;
packages/server/src/ws/__tests__/performance.test.ts:18:import { initializeJWTService, resetJWTService, getJWTService } from '../../auth/jwt.js';
packages/server/src/ws/__tests__/performance.test.ts:215:    tracker.record('auth', 15);
packages/server/src/ws/__tests__/performance.test.ts:216:    tracker.record('auth', 16);
packages/server/src/ws/__tests__/performance.test.ts:219:    const authMetrics = tracker.getMetricsForType('auth');
packages/server/src/ws/__tests__/performance.test.ts:224:    expect(authMetrics!.count).toBe(2);
packages/server/src/ws/__tests__/performance.test.ts:225:    expect(authMetrics!.avg).toBeCloseTo(15.5, 1);
packages/server/src/ws/__tests__/performance.test.ts:254:  async function authenticateClient(
packages/server/src/ws/__tests__/performance.test.ts:273:        type: 'auth',
packages/server/src/ws/__tests__/performance.test.ts:275:        protocolVersion: '3.0',
packages/server/src/ws/__tests__/performance.test.ts:286:    await authenticateClient(ws);
packages/server/src/ws/__tests__/performance.test.ts:288:    // Clear auth messages
packages/server/src/ws/__tests__/performance.test.ts:308:    await authenticateClient(ws);
packages/server/src/ws/__tests__/performance.test.ts:344:      await authenticateClient(ws);
packages/server/src/ws/__tests__/performance.test.ts:382:  test('sendHeartbeats serializes once for all authenticated clients', async () => {
packages/server/src/ws/__tests__/performance.test.ts:383:    // Create 3 authenticated clients
packages/server/src/ws/__tests__/performance.test.ts:390:      await authenticateClient(ws);
packages/server/src/ws/__tests__/performance.test.ts:394:    // Clear auth messages
packages/server/src/ws/__tests__/performance.test.ts:412:    // Re-authenticate clients
packages/server/src/ws/__tests__/performance.test.ts:418:      await authenticateClient(ws);
packages/server/src/ws/__tests__/performance.test.ts:488:    await authenticateClient(ws);
packages/server/src/ws/__tests__/performance.test.ts:529:      await authenticateClient(ws);
packages/server/src/api/__tests__/sessions.test.ts:8:import { initializeAuthService, resetAuthService, getAuthService } from '../../auth/index.js';
packages/server/src/api/__tests__/sessions.test.ts:39:  const authService = getAuthService();
packages/server/src/api/__tests__/sessions.test.ts:40:  const jwt = authService.getJWTService();
packages/server/src/api/__tests__/sessions.test.ts:86:    // Initialize auth service with test secret
packages/server/src/api/__tests__/sessions.test.ts:125:      // Will return 401 because no auth, but that's fine - it's routing correctly
packages/server/src/api/__tests__/sessions.test.ts:131:    it('should require authentication', async () => {
packages/server/src/api/__tests__/sessions.test.ts:144:      expect(body.error).toBe('unauthorized');
packages/server/src/api/__tests__/sessions.test.ts:250:    it('should require authentication', async () => {
packages/server/src/api/__tests__/sessions.test.ts:316:    it('should require authentication', async () => {
packages/server/src/api/__tests__/sessions.test.ts:353:    it('should require authentication', async () => {
packages/server/src/api/__tests__/sessions.test.ts:375:    it('should require authentication', async () => {
packages/server/src/auth/providers/github.ts:4: * Implements OAuth 2.0 authorization code flow with PKCE for GitHub.
packages/server/src/auth/providers/github.ts:5: * https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps
packages/server/src/auth/providers/github.ts:14:} from '../oauth.js';
packages/server/src/auth/providers/github.ts:50:const GITHUB_AUTHORIZATION_URL = 'https://github.com/login/oauth/authorize';
packages/server/src/auth/providers/github.ts:51:const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
packages/server/src/auth/providers/github.ts:94:   * Get the GitHub authorization URL with PKCE
packages/server/src/auth/providers/github.ts:117:   * Exchange authorization code for tokens
packages/server/src/db/__tests__/repositories.integration.test.ts:43:    await sql`TRUNCATE clients, input_log, scrollback, agents, sessions, refresh_tokens, oauth_tokens, users CASCADE`;
packages/server/src/api/devices.ts:11:import { getJWTService } from '../auth/jwt.js';
packages/server/src/api/devices.ts:50:async function authenticateRequest(request: Request): Promise<AccessTokenClaims | null> {
packages/server/src/api/devices.ts:51:  const authHeader = request.headers.get('authorization');
packages/server/src/api/devices.ts:52:  if (!authHeader?.startsWith('Bearer ')) {
packages/server/src/api/devices.ts:56:  const token = authHeader.slice(7);
packages/server/src/api/devices.ts:66: * Create an unauthorized response
packages/server/src/api/devices.ts:68:function unauthorized(): Response {
packages/server/src/api/devices.ts:69:  return Response.json({ error: 'Unauthorized' }, { status: 401 });
packages/server/src/api/devices.ts:82:  const claims = await authenticateRequest(request);
packages/server/src/api/devices.ts:83:  if (!claims) return unauthorized();
packages/server/src/api/devices.ts:130:  const claims = await authenticateRequest(request);
packages/server/src/api/devices.ts:131:  if (!claims) return unauthorized();
packages/server/src/index.ts:9:import { initializeAuth, handleAuthRoutes } from './auth/index.js';
packages/server/src/index.ts:63:        authenticated: wsHub.getAuthenticatedClientCount(),
packages/server/src/index.ts:83:          auth: '/auth/*',
packages/server/src/index.ts:93:    if (url.pathname.startsWith('/auth/')) {
packages/server/src/index.ts:94:      const authResponse = await handleAuthRoutes(request, url.pathname);
packages/server/src/index.ts:95:      if (authResponse) {
packages/server/src/index.ts:96:        return authResponse;
packages/server/src/mcp/MCPBridge.ts:681:      protocolVersion: string;
packages/server/src/mcp/MCPBridge.ts:688:      protocolVersion: '2024-11-05',
packages/server/src/auth/__tests__/routes.test.ts:9:import { registerProvider, storePendingState, type OAuthProviderInterface } from '../oauth.js';
packages/server/src/auth/__tests__/routes.test.ts:20:    `https://mock.example.com/oauth?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&code_challenge=${codeChallenge}`,
packages/server/src/auth/__tests__/routes.test.ts:55:      'http://localhost:3001/auth/authorize?provider=github&redirect_uri=https://app.example.com/callback&code_challenge=testchallenge12345678901234567890123456789012&code_challenge_method=S256'
packages/server/src/auth/__tests__/routes.test.ts:62:    expect(location).toContain('https://mock.example.com/oauth');
packages/server/src/auth/__tests__/routes.test.ts:69:      'http://localhost:3001/auth/authorize?redirect_uri=https://app.example.com/callback&code_challenge=testchallenge12345678901234567890123456789012&code_challenge_method=S256'
packages/server/src/auth/__tests__/routes.test.ts:81:      'http://localhost:3001/auth/authorize?provider=github&redirect_uri=not-a-url&code_challenge=testchallenge12345678901234567890123456789012&code_challenge_method=S256'
packages/server/src/auth/__tests__/routes.test.ts:93:      'http://localhost:3001/auth/authorize?provider=github&redirect_uri=https://app.example.com/callback&code_challenge=tooshort&code_challenge_method=S256'
packages/server/src/auth/__tests__/routes.test.ts:105:      'http://localhost:3001/auth/authorize?provider=github&redirect_uri=https://app.example.com/callback&code_challenge=testchallenge12345678901234567890123456789012&code_challenge_method=plain'
packages/server/src/auth/__tests__/routes.test.ts:117:      'http://localhost:3001/auth/authorize?provider=google&redirect_uri=https://app.example.com/callback&code_challenge=testchallenge12345678901234567890123456789012&code_challenge_method=S256'
packages/server/src/auth/__tests__/routes.test.ts:144:      `http://localhost:3001/auth/callback?code=test-auth-code&state=${state}`
packages/server/src/auth/__tests__/routes.test.ts:152:    expect(location).toContain('code=test-auth-code');
packages/server/src/auth/__tests__/routes.test.ts:159:      'http://localhost:3001/auth/callback?code=test-auth-code&state=invalid-state'
packages/server/src/auth/__tests__/routes.test.ts:171:      'http://localhost:3001/auth/callback?state=test-state'
packages/server/src/auth/__tests__/routes.test.ts:183:      'http://localhost:3001/auth/callback?error=access_denied&error_description=User%20denied%20access'
packages/server/src/auth/__tests__/routes.test.ts:201:    const request = new Request('http://localhost:3001/auth/token', {
packages/server/src/auth/__tests__/routes.test.ts:204:        grant_type: 'authorization_code',
packages/server/src/auth/__tests__/routes.test.ts:221:    const request = new Request('http://localhost:3001/auth/token', {
packages/server/src/auth/__tests__/routes.test.ts:241:    const request = new Request('http://localhost:3001/auth/token', {
packages/server/src/auth/__tests__/routes.test.ts:245:        grant_type: 'authorization_code',
packages/server/src/auth/__tests__/routes.test.ts:260:    const request = new Request('http://localhost:3001/auth/token', {
packages/server/src/auth/__tests__/routes.test.ts:264:        grant_type: 'authorization_code',
packages/server/src/auth/__tests__/routes.test.ts:280:    const request = new Request('http://localhost:3001/auth/token', {
packages/server/src/auth/__tests__/routes.test.ts:283:      body: 'grant_type=authorization_code&provider=google',
packages/server/src/ws/WSHub.ts:6: * - Connection management with auth
packages/server/src/ws/WSHub.ts:28:  AuthMessage,
packages/server/src/ws/WSHub.ts:46:import { getJWTService } from '../auth/jwt.js';
packages/server/src/ws/WSHub.ts:80:  /** Whether client is authenticated */
packages/server/src/ws/WSHub.ts:81:  authenticated: boolean;
packages/server/src/ws/WSHub.ts:101:  authTimeoutMs: number;
packages/server/src/ws/WSHub.ts:109:  authTimeoutMs: 10000,
packages/server/src/ws/WSHub.ts:135:  private authTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
packages/server/src/ws/WSHub.ts:175:    // Clear all auth timeouts
packages/server/src/ws/WSHub.ts:176:    for (const timeout of this.authTimeouts.values()) {
packages/server/src/ws/WSHub.ts:179:    this.authTimeouts.clear();
packages/server/src/ws/WSHub.ts:203:    // Create unauthenticated client entry
packages/server/src/ws/WSHub.ts:210:      clientType: 'pc', // Will be set on auth
packages/server/src/ws/WSHub.ts:215:      authenticated: false,
packages/server/src/ws/WSHub.ts:220:    // Set auth timeout - client must authenticate within authTimeoutMs
packages/server/src/ws/WSHub.ts:221:    const authTimeout = setTimeout(() => {
packages/server/src/ws/WSHub.ts:223:    }, this.config.authTimeoutMs);
packages/server/src/ws/WSHub.ts:224:    this.authTimeouts.set(clientId, authTimeout);
packages/server/src/ws/WSHub.ts:257:    // Handle unauthenticated state - must be auth message
packages/server/src/ws/WSHub.ts:258:    if (!client.authenticated) {
packages/server/src/ws/WSHub.ts:259:      if (message.type !== 'auth') {
packages/server/src/ws/WSHub.ts:263:        this.latencyTracker.record('unauthenticated', latency);
packages/server/src/ws/WSHub.ts:266:      await this.handleAuthMessage(clientId, message as AuthMessage);
packages/server/src/ws/WSHub.ts:272:    // Handle authenticated messages
packages/server/src/ws/WSHub.ts:297:    // Clear auth timeout if pending
packages/server/src/ws/WSHub.ts:298:    const authTimeout = this.authTimeouts.get(clientId);
packages/server/src/ws/WSHub.ts:299:    if (authTimeout) {
packages/server/src/ws/WSHub.ts:300:      clearTimeout(authTimeout);
packages/server/src/ws/WSHub.ts:301:      this.authTimeouts.delete(clientId);
packages/server/src/ws/WSHub.ts:598:   * Get authenticated client count
packages/server/src/ws/WSHub.ts:603:      if (client.authenticated) {
packages/server/src/ws/WSHub.ts:622:   * Handle auth message
packages/server/src/ws/WSHub.ts:624:  private async handleAuthMessage(clientId: string, message: AuthMessage): Promise<void> {
packages/server/src/ws/WSHub.ts:630:    // Clear auth timeout
packages/server/src/ws/WSHub.ts:631:    const authTimeout = this.authTimeouts.get(clientId);
packages/server/src/ws/WSHub.ts:632:    if (authTimeout) {
packages/server/src/ws/WSHub.ts:633:      clearTimeout(authTimeout);
packages/server/src/ws/WSHub.ts:634:      this.authTimeouts.delete(clientId);
packages/server/src/ws/WSHub.ts:652:    // Update client with auth info
packages/server/src/ws/WSHub.ts:658:    client.authenticated = true;
packages/server/src/ws/WSHub.ts:662:      type: 'auth_success',
packages/server/src/ws/WSHub.ts:664:      protocolVersion: '3.0',
packages/server/src/ws/WSHub.ts:674:   * Handle authenticated client message
packages/server/src/ws/WSHub.ts:894:   * Handle auth timeout
packages/server/src/ws/WSHub.ts:902:    if (!client.authenticated) {
packages/server/src/ws/WSHub.ts:908:    this.authTimeouts.delete(clientId);
packages/server/src/ws/WSHub.ts:912:   * Send heartbeats to all authenticated clients
packages/server/src/ws/WSHub.ts:925:      if (client.authenticated) {
packages/server/src/ws/WSHub.ts:1015:   * Send auth failed message
packages/server/src/ws/WSHub.ts:1022:      type: 'auth_failed',
packages/server/src/auth/__tests__/oauth.test.ts:21:} from '../oauth.js';
packages/server/src/auth/__tests__/oauth.test.ts:110:      `https://mock.example.com/auth?redirect_uri=${redirectUri}&state=${state}&code_challenge=${codeChallenge}`,
packages/server/src/auth/__tests__/oauth.test.ts:149:      `https://example.com/oauth?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&code_challenge=${codeChallenge}`,
packages/server/src/auth/__tests__/oauth.test.ts:164:  test('returns authorization URL from provider', () => {
packages/server/src/auth/__tests__/oauth.test.ts:172:    expect(url).toContain('https://example.com/oauth');
packages/server/src/notifications/PushService.ts:5: * Uses HTTP/2 with JWT-based authentication to communicate with APNs.
packages/server/src/notifications/PushService.ts:306:          'authorization': `bearer ${jwt}`,
packages/server/src/auth/__tests__/github.test.ts:9:import { OAuthError, hasProvider } from '../oauth.js';
packages/server/src/auth/__tests__/github.test.ts:33:  test('generates correct authorization URL', () => {
packages/server/src/auth/__tests__/github.test.ts:40:    expect(url).toContain('https://github.com/login/oauth/authorize');
packages/server/src/auth/__tests__/github.test.ts:96:      'test-auth-code',
packages/server/src/auth/__tests__/github.test.ts:108:    expect(url).toBe('https://github.com/login/oauth/access_token');
packages/server/src/auth/__tests__/github.test.ts:114:    expect(body.get('code')).toBe('test-auth-code');
packages/server/src/auth/__tests__/github.test.ts:287:      Promise.resolve(new Response('Unauthorized', { status: 401 }))
packages/server/src/ws/__tests__/WSHub.test.ts:16:import { initializeJWTService, resetJWTService } from '../../auth/jwt.js';
packages/server/src/ws/__tests__/WSHub.test.ts:83:      authTimeoutMs: 5000,
packages/server/src/ws/__tests__/WSHub.test.ts:138:      authTimeoutMs: 100, // Short timeout for testing
packages/server/src/ws/__tests__/WSHub.test.ts:149:  test('rejects message before auth', async () => {
packages/server/src/ws/__tests__/WSHub.test.ts:157:    // Send a non-auth message
packages/server/src/ws/__tests__/WSHub.test.ts:160:    // Should have received auth_failed
packages/server/src/ws/__tests__/WSHub.test.ts:163:    expect(response.type).toBe('auth_failed');
packages/server/src/ws/__tests__/WSHub.test.ts:178:    // Send auth with invalid token
packages/server/src/ws/__tests__/WSHub.test.ts:182:        type: 'auth',
packages/server/src/ws/__tests__/WSHub.test.ts:184:        protocolVersion: '3.0',
packages/server/src/ws/__tests__/WSHub.test.ts:189:    // Should have received auth_failed
packages/server/src/ws/__tests__/WSHub.test.ts:192:    expect(response.type).toBe('auth_failed');
packages/server/src/ws/__tests__/WSHub.test.ts:196:  test('auth times out if not received', async () => {
packages/server/src/ws/__tests__/WSHub.test.ts:205:    // Wait for auth timeout
packages/server/src/ws/__tests__/WSHub.test.ts:221:    const jwtService = await import('../../auth/jwt.js').then((m) => m.getJWTService());
packages/server/src/ws/__tests__/WSHub.test.ts:231:    // Send auth message
packages/server/src/ws/__tests__/WSHub.test.ts:235:        type: 'auth',
packages/server/src/ws/__tests__/WSHub.test.ts:237:        protocolVersion: '3.0',
packages/server/src/ws/__tests__/WSHub.test.ts:242:    // Should have received auth_success
packages/server/src/ws/__tests__/WSHub.test.ts:245:    expect(response.type).toBe('auth_success');
packages/server/src/ws/__tests__/WSHub.test.ts:274:  async function authenticateClient(
packages/server/src/ws/__tests__/WSHub.test.ts:280:    const jwtService = await import('../../auth/jwt.js').then((m) => m.getJWTService());
packages/server/src/ws/__tests__/WSHub.test.ts:293:        type: 'auth',
packages/server/src/ws/__tests__/WSHub.test.ts:295:        protocolVersion: '3.0',
packages/server/src/ws/__tests__/WSHub.test.ts:306:    await authenticateClient(ws);
packages/server/src/ws/__tests__/WSHub.test.ts:307:    ws._messages.length = 0; // Clear auth message
packages/server/src/ws/__tests__/WSHub.test.ts:322:    await authenticateClient(ws);
packages/server/src/ws/__tests__/WSHub.test.ts:343:    await authenticateClient(ws);
packages/server/src/ws/__tests__/WSHub.test.ts:366:    await authenticateClient(ws);
packages/server/src/ws/__tests__/WSHub.test.ts:416:    const jwtService = await import('../../auth/jwt.js').then((m) => m.getJWTService());
packages/server/src/ws/__tests__/WSHub.test.ts:429:        type: 'auth',
packages/server/src/ws/__tests__/WSHub.test.ts:431:        protocolVersion: '3.0',
packages/server/src/ws/__tests__/WSHub.test.ts:602:    const jwtService = await import('../../auth/jwt.js').then((m) => m.getJWTService());
packages/server/src/ws/__tests__/WSHub.test.ts:615:        type: 'auth',
packages/server/src/ws/__tests__/WSHub.test.ts:617:        protocolVersion: '3.0',
packages/server/src/ws/__tests__/WSHub.test.ts:773:    const jwtService = await import('../../auth/jwt.js').then((m) => m.getJWTService());
packages/server/src/ws/__tests__/WSHub.test.ts:789:          type: 'auth',
packages/server/src/ws/__tests__/WSHub.test.ts:791:          protocolVersion: '3.0',
packages/server/src/ws/__tests__/WSHub.test.ts:890:    const jwtService = await import('../../auth/jwt.js').then((m) => m.getJWTService());
packages/server/src/ws/__tests__/WSHub.test.ts:903:        type: 'auth',
packages/server/src/ws/__tests__/WSHub.test.ts:905:        protocolVersion: '3.0',
packages/ios-app/MConnectTests/ReconnectionTests.swift:274:            .authenticating,
packages/ios-app/README.md:95:- **Services** - Network, auth, storage (protocol-oriented)
packages/ios-app/README.md:114:- Biometric authentication (Face ID / Touch ID) required
packages/ios-app/MConnect/App/MConnectApp.swift:8:    @StateObject private var authService = AuthService()
packages/ios-app/MConnect/App/MConnectApp.swift:14:                .environmentObject(authService)
packages/ios-app/MConnect/App/MConnectApp.swift:29:                    try await authService.handleCallback(url)
packages/ios-app/MConnect/Services/Notifications/PushService.swift:61:            print("[PushService] No auth token or server URL, deferring token registration")
packages/ios-app/MConnect/Models/VaultItem.swift:12:        case oauthToken = "oauth_token"
packages/ios-app/MConnect/Models/VaultItem.swift:21:            case .oauthToken: return "OAuth Token"
packages/ios-app/MConnect/Models/VaultItem.swift:32:            case .oauthToken: return "person.badge.key"
packages/ios-app/MConnect/Views/Terminal/TerminalView.swift:109:        case .connecting, .authenticating: return .yellow
packages/ios-app/MConnect/Views/Terminal/TerminalView.swift:193:        case .authenticating: return "Authenticating..."
packages/ios-app/MConnect/Resources/Assets.xcassets/AppIcon.appiconset/Contents.json:10:    "author" : "xcode",
packages/ios-app/MConnect/Services/WebSocket/Protocol.swift:6:let protocolVersion = "3.0"
packages/ios-app/MConnect/Services/WebSocket/Protocol.swift:75:    case authFailed = "AUTH_FAILED"
packages/ios-app/MConnect/Services/WebSocket/Protocol.swift:76:    case authExpired = "AUTH_EXPIRED"
packages/ios-app/MConnect/Services/WebSocket/Protocol.swift:115:struct AuthMessage: Codable {
packages/ios-app/MConnect/Services/WebSocket/Protocol.swift:118:    let protocolVersion: String
packages/ios-app/MConnect/Services/WebSocket/Protocol.swift:122:        self.type = "auth"
packages/ios-app/MConnect/Services/WebSocket/Protocol.swift:124:        self.protocolVersion = MConnect.protocolVersion
packages/ios-app/MConnect/Services/WebSocket/Protocol.swift:242:    let protocolVersion: String
packages/ios-app/MConnect/Services/WebSocket/Protocol.swift:374:    case authSuccess(AuthSuccessResponse)
packages/ios-app/MConnect/Services/WebSocket/Protocol.swift:375:    case authFailed(AuthFailedResponse)
packages/ios-app/MConnect/Services/WebSocket/Protocol.swift:402:        case "auth_success":
packages/ios-app/MConnect/Services/WebSocket/Protocol.swift:404:            return .authSuccess(msg)
packages/ios-app/MConnect/Services/WebSocket/Protocol.swift:405:        case "auth_failed":
packages/ios-app/MConnect/Services/WebSocket/Protocol.swift:407:            return .authFailed(msg)
packages/ios-app/MConnect/Resources/Assets.xcassets/Contents.json:3:    "author" : "xcode",
packages/ios-app/MConnect/Services/Auth/AuthService.swift:5:/// OAuth 2.0 + PKCE authentication service.
packages/ios-app/MConnect/Services/Auth/AuthService.swift:9:/// 2. Open the server's `/auth/authorize` endpoint (redirects to GitHub)
packages/ios-app/MConnect/Services/Auth/AuthService.swift:11:/// 4. Exchange the authorization code for JWT tokens via `POST /auth/token`
packages/ios-app/MConnect/Services/Auth/AuthService.swift:41:    /// Build the OAuth authorization URL with PKCE parameters.
packages/ios-app/MConnect/Services/Auth/AuthService.swift:48:    /// - Returns: The authorization URL to open, or `nil` if URL construction failed.
packages/ios-app/MConnect/Services/Auth/AuthService.swift:61:        var components = URLComponents(string: "\(serverURL)/auth/authorize")
packages/ios-app/MConnect/Services/Auth/AuthService.swift:73:    /// Handle the OAuth callback URL and exchange the authorization code for tokens.
packages/ios-app/MConnect/Services/Auth/AuthService.swift:79:    /// 2. Sends `POST /auth/token` with the code + code_verifier
packages/ios-app/MConnect/Services/Auth/AuthService.swift:133:            if let authError = error as? AuthError {
packages/ios-app/MConnect/Services/Auth/AuthService.swift:134:                self.error = authError
packages/ios-app/MConnect/Services/Auth/AuthService.swift:135:                throw authError
packages/ios-app/MConnect/Services/Auth/AuthService.swift:198:    /// Exchange the authorization code for JWT tokens via `POST /auth/token`.
packages/ios-app/MConnect/Services/Auth/AuthService.swift:205:        guard let url = URL(string: "\(serverURL)/auth/token") else {
packages/ios-app/MConnect/Services/Auth/AuthService.swift:214:            "grant_type": "authorization_code",
packages/ios-app/MConnect/Services/Auth/AuthService.swift:238:    /// Refresh tokens via `POST /auth/refresh`.
packages/ios-app/MConnect/Services/Auth/AuthService.swift:243:        guard let url = URL(string: "\(serverURL)/auth/refresh") else {
packages/ios-app/MConnect/Services/Auth/AuthService.swift:270:    /// Revoke the refresh token via `POST /auth/revoke`. Best-effort, errors are ignored.
packages/ios-app/MConnect/Services/Auth/AuthService.swift:272:        guard let url = URL(string: "\(serverURL)/auth/revoke") else { return }
packages/ios-app/MConnect/Services/Auth/AuthService.swift:310:/// Server response from `POST /auth/token` and `POST /auth/refresh`.
packages/ios-app/MConnect/Services/Auth/AuthService.swift:359:            return "Failed to exchange authorization code: \(detail)"
packages/ios-app/MConnect/Services/Keychain/KeychainService.swift:24:/// (no iCloud sync) and optionally require biometric authentication.
packages/ios-app/MConnect/Views/Hosts/QRScannerView.swift:13:        case authorized
packages/ios-app/MConnect/Views/Hosts/QRScannerView.swift:23:                case .authorized:
packages/ios-app/MConnect/Views/Hosts/QRScannerView.swift:55:        switch AVCaptureDevice.authorizationStatus(for: .video) {
packages/ios-app/MConnect/Views/Hosts/QRScannerView.swift:56:        case .authorized:
packages/ios-app/MConnect/Views/Hosts/QRScannerView.swift:57:            cameraStatus = .authorized
packages/ios-app/MConnect/Views/Hosts/QRScannerView.swift:60:            cameraStatus = granted ? .authorized : .denied
packages/ios-app/MConnect/Services/Auth/TokenManager.swift:15:    private let accessTokenKey = "auth.accessToken"
packages/ios-app/MConnect/Services/Auth/TokenManager.swift:16:    private let refreshTokenKey = "auth.refreshToken"
packages/ios-app/MConnect/Services/Auth/TokenManager.swift:17:    private let userProfileKey = "auth.userProfile"
packages/ios-app/MConnect/Services/Auth/TokenManager.swift:18:    private let serverURLKey = "auth.serverURL"
packages/ios-app/MConnect/Services/Auth/TokenManager.swift:52:    /// The server URL associated with the current auth session.
packages/ios-app/MConnect/Services/Auth/TokenManager.swift:87:    /// Store the authenticated user's profile for offline display.
packages/ios-app/MConnect/Services/Keychain/BiometricAuth.swift:4:/// Face ID / Touch ID authentication service.
packages/ios-app/MConnect/Services/Keychain/BiometricAuth.swift:30:                return "Biometric authentication is not available on this device"
packages/ios-app/MConnect/Services/Keychain/BiometricAuth.swift:34:                return "Biometric authentication is locked out due to too many attempts"
packages/ios-app/MConnect/Services/Keychain/BiometricAuth.swift:76:    func authenticate(reason: String = "Authenticate to access MConnect") async -> Bool {
packages/ios-app/MConnect/Services/Keychain/BiometricAuth.swift:94:    func authenticateWithPasscodeFallback(
packages/ios-app/MConnect/Services/Keychain/BiometricAuth.swift:112:        } catch let authError as LAError {
packages/ios-app/MConnect/Services/Keychain/BiometricAuth.swift:113:            return .failure(mapLAError(authError))
packages/ios-app/MConnect/Services/Keychain/BiometricAuth.swift:142:        case .authenticationFailed:
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:9:    case authenticating
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:82:    private let authService: AuthService
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:137:        authService: AuthService? = nil,
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:141:        self.authService = authService ?? AuthService(tokenManager: tokenManager)
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:188:    /// after authentication succeeds.
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:312:        setConnectionState(.authenticating)
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:313:        sendAuthMessage()
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:342:    private func sendAuthMessage() {
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:344:            logger.warning("No access token available for auth")
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:348:        send(AuthMessage(token: token))
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:411:        case .authSuccess(let response):
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:413:        case .authFailed(let response):
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:482:            attemptTokenRefreshAndReauth()
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:488:    /// Try to refresh the access token and re-send the auth message.
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:489:    private func attemptTokenRefreshAndReauth() {
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:499:                try await authService.refreshAccessToken(serverURL: serverURL)
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:500:                sendAuthMessage()
packages/ios-app/MConnect/Services/WebSocket/WSClient.swift:555:        if response.code == .authExpired || response.code == .authFailed {
packages/ios-app/MConnect/Resources/Assets.xcassets/AccentColor.colorset/Contents.json:8:    "author" : "xcode",

exec
/bin/zsh -lc "nl -ba .omc/plans/2026-05-02-194104-mconnect-v2-session-desktop-anchor.md | sed -n '516,555p'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
   516	## 13. Out of scope (explicit, binding for ralph)
   517	
   518	- **Memory layer** (jcode + smfs ambient embedding + consolidation + skills) → v0.3.x. Reason: token-cost driver + 4-week minimum on its own.
   519	- **Swarm coordinator** (jcode file-shift + DM + broadcast + sub-swarms) → v0.3.x. Reason: feedback-loop testing burden + protocol surface.
   520	- **Multi-provider OAuth beyond existing GitHub/Google** (Claude, OpenAI, Gemini, Copilot, Azure, Ollama, openai-compatible, headless `--no-browser`) → v0.3.x. Reason: server `auth/providers/index.ts` ships only GitHub today; expansion is 3-4 weeks alone.
   521	- **iOS side panel** (Mermaid, diff, file rendering via WKWebView + mermaid.js) → v0.3.x. Reason: TestFlight re-review collision risk during v0.2.0 cycle.
   522	- **smfs FUSE/NFS mount** → v0.3.x at earliest, possibly later. Reason: vendor binary + license clearance not done.
   523	- **Voice control** (paseo parity) → research only, not before v0.4.x.
   524	- **Sub-swarms** (jcode coordinator/worker pattern) → v0.3.x.
   525	- **Skill compounding** (multica reusable skills) → v0.3.x; depends on memory layer.
   526	- **Linear-issue-to-agent assignment** (multica workflow) → v0.3.x; depends on multi-provider auth.
   527	- **Full Rust core rewrite** (HUB plan §2) → re-evaluated as Phase 6 follow-up per §11 ADR triggers; not before v0.3.x.
   528	- **Web app** (`apps/web`) refactor → unchanged in v0.2.0.
   529	- **Marketing website** (`apps/website`) refactor → unchanged in v0.2.0; only blog post added in Phase 6.
   530	- **Cross-Device Sync** (PRD §5.4 any-sync inspired) → v0.4.x earliest; depends on Rust core decision.
   531	- **E2E encryption beyond existing tunnel-token + Cloudflare TLS** → v0.4.x.
   532	- **Android companion app** → not roadmapped.
   533	- **Self-hosted enterprise distribution + SSO/SAML** → roadmap Q4 2025+, not v0.2.0.

exec
/bin/zsh -lc "nl -ba packages/cli/migrations/001_sessions.sql | sed -n '1,220p'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
     1	-- migrations/001_sessions.sql
     2	-- MConnect v0.2.0 - Persistent Sessions Schema
     3	
     4	PRAGMA journal_mode = WAL;
     5	PRAGMA foreign_keys = ON;
     6	
     7	-- Sessions table: persistent shell sessions with state
     8	CREATE TABLE sessions (
     9	  id TEXT PRIMARY KEY,
    10	  created_at INTEGER NOT NULL,
    11	  last_activity INTEGER NOT NULL,
    12	  state TEXT NOT NULL DEFAULT 'running'
    13	    CHECK(state IN ('running', 'paused', 'completed')),
    14	  agent_config TEXT NOT NULL,  -- JSON blob
    15	  working_directory TEXT NOT NULL
    16	);
    17	
    18	-- Scrollback table: terminal output history for session reconnection
    19	CREATE TABLE scrollback (
    20	  session_id TEXT NOT NULL,
    21	  line_number INTEGER NOT NULL,
    22	  content TEXT NOT NULL,
    23	  timestamp INTEGER NOT NULL,
    24	  PRIMARY KEY (session_id, line_number),
    25	  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    26	);
    27	
    28	-- Connected clients table: track PC and mobile connections
    29	CREATE TABLE connected_clients (
    30	  id TEXT PRIMARY KEY,
    31	  session_id TEXT NOT NULL,
    32	  client_type TEXT NOT NULL CHECK(client_type IN ('pc', 'mobile')),
    33	  connected_at INTEGER NOT NULL,
    34	  last_heartbeat INTEGER NOT NULL,
    35	  priority TEXT NOT NULL DEFAULT 'normal'
    36	    CHECK(priority IN ('exclusive', 'high', 'normal', 'low', 'observer')),
    37	  user_agent TEXT,
    38	  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    39	);
    40	
    41	-- Input log table: audit trail for all input events
    42	CREATE TABLE input_log (
    43	  id INTEGER PRIMARY KEY AUTOINCREMENT,
    44	  session_id TEXT NOT NULL,
    45	  client_id TEXT NOT NULL,
    46	  input TEXT NOT NULL,
    47	  timestamp INTEGER NOT NULL,
    48	  accepted INTEGER NOT NULL,  -- 0 or 1
    49	  reject_reason TEXT,
    50	  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    51	);
    52	
    53	-- Performance indexes
    54	CREATE INDEX idx_sessions_state ON sessions(state);
    55	CREATE INDEX idx_scrollback_session ON scrollback(session_id);
    56	CREATE INDEX idx_clients_session ON connected_clients(session_id);
    57	CREATE INDEX idx_input_log_session ON input_log(session_id, timestamp);

exec
/bin/zsh -lc "nl -ba packages/cli/src/session/SessionStore.ts | sed -n '1,260p'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
     1	/**
     2	 * Session Store - SQLite persistence layer
     3	 * MConnect v0.2.0
     4	 *
     5	 * Handles database connection, migrations, and CRUD operations
     6	 */
     7	
     8	import { existsSync, mkdirSync, readFileSync } from 'node:fs';
     9	import { dirname, join } from 'node:path';
    10	import { fileURLToPath } from 'node:url';
    11	import Database from 'better-sqlite3';
    12	import type {
    13	  AgentConfig,
    14	  Client,
    15	  ClientRow,
    16	  InputLogEntry,
    17	  InputLogRow,
    18	  Priority,
    19	  RejectReason,
    20	  ScrollbackLine,
    21	  ScrollbackRow,
    22	  Session,
    23	  SessionRow,
    24	  SessionState,
    25	} from './types.js';
    26	
    27	const __filename = fileURLToPath(import.meta.url);
    28	const __dirname = dirname(__filename);
    29	
    30	export interface SessionStoreConfig {
    31	  dataDir: string;
    32	  dbName?: string;
    33	}
    34	
    35	export class SessionStore {
    36	  private db: Database.Database;
    37	  private dataDir: string;
    38	
    39	  constructor(config: SessionStoreConfig) {
    40	    this.dataDir = config.dataDir;
    41	    const dbPath = join(config.dataDir, config.dbName || 'sessions.db');
    42	
    43	    // Ensure data directory exists
    44	    if (!existsSync(config.dataDir)) {
    45	      mkdirSync(config.dataDir, { recursive: true });
    46	    }
    47	
    48	    // Open database
    49	    this.db = new Database(dbPath);
    50	
    51	    // Enable WAL mode and foreign keys
    52	    this.db.pragma('journal_mode = WAL');
    53	    this.db.pragma('foreign_keys = ON');
    54	
    55	    // Run migrations
    56	    this.runMigrations();
    57	  }
    58	
    59	  /**
    60	   * Run database migrations
    61	   */
    62	  private runMigrations(): void {
    63	    // Get migration file path (relative to package root)
    64	    const migrationsDir = join(__dirname, '../../migrations');
    65	    const migrationFile = join(migrationsDir, '001_sessions.sql');
    66	
    67	    if (!existsSync(migrationFile)) {
    68	      // Create tables inline if migration file doesn't exist
    69	      this.createTables();
    70	      return;
    71	    }
    72	
    73	    // Check if tables exist
    74	    const tablesExist = this.db
    75	      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
    76	      .get();
    77	
    78	    if (!tablesExist) {
    79	      const migration = readFileSync(migrationFile, 'utf-8');
    80	      this.db.exec(migration);
    81	    }
    82	  }
    83	
    84	  /**
    85	   * Create tables (fallback if migration file not found)
    86	   */
    87	  private createTables(): void {
    88	    this.db.exec(`
    89	      CREATE TABLE IF NOT EXISTS sessions (
    90	        id TEXT PRIMARY KEY,
    91	        created_at INTEGER NOT NULL,
    92	        last_activity INTEGER NOT NULL,
    93	        state TEXT NOT NULL DEFAULT 'running'
    94	          CHECK(state IN ('running', 'paused', 'completed')),
    95	        agent_config TEXT NOT NULL,
    96	        working_directory TEXT NOT NULL
    97	      );
    98	
    99	      CREATE TABLE IF NOT EXISTS scrollback (
   100	        session_id TEXT NOT NULL,
   101	        line_number INTEGER NOT NULL,
   102	        content TEXT NOT NULL,
   103	        timestamp INTEGER NOT NULL,
   104	        PRIMARY KEY (session_id, line_number),
   105	        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
   106	      );
   107	
   108	      CREATE TABLE IF NOT EXISTS connected_clients (
   109	        id TEXT PRIMARY KEY,
   110	        session_id TEXT NOT NULL,
   111	        client_type TEXT NOT NULL CHECK(client_type IN ('pc', 'mobile')),
   112	        connected_at INTEGER NOT NULL,
   113	        last_heartbeat INTEGER NOT NULL,
   114	        priority TEXT NOT NULL DEFAULT 'normal'
   115	          CHECK(priority IN ('exclusive', 'high', 'normal', 'low', 'observer')),
   116	        user_agent TEXT,
   117	        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
   118	      );
   119	
   120	      CREATE TABLE IF NOT EXISTS input_log (
   121	        id INTEGER PRIMARY KEY AUTOINCREMENT,
   122	        session_id TEXT NOT NULL,
   123	        client_id TEXT NOT NULL,
   124	        input TEXT NOT NULL,
   125	        timestamp INTEGER NOT NULL,
   126	        accepted INTEGER NOT NULL,
   127	        reject_reason TEXT,
   128	        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
   129	      );
   130	
   131	      CREATE INDEX IF NOT EXISTS idx_sessions_state ON sessions(state);
   132	      CREATE INDEX IF NOT EXISTS idx_scrollback_session ON scrollback(session_id);
   133	      CREATE INDEX IF NOT EXISTS idx_clients_session ON connected_clients(session_id);
   134	      CREATE INDEX IF NOT EXISTS idx_input_log_session ON input_log(session_id, timestamp);
   135	    `);
   136	  }
   137	
   138	  /**
   139	   * Close the database connection
   140	   */
   141	  close(): void {
   142	    this.db.close();
   143	  }
   144	
   145	  // ============================================
   146	  // Session CRUD
   147	  // ============================================
   148	
   149	  createSession(session: Omit<Session, 'createdAt' | 'lastActivity'>): Session {
   150	    const now = Date.now();
   151	    const stmt = this.db.prepare(`
   152	      INSERT INTO sessions (id, created_at, last_activity, state, agent_config, working_directory)
   153	      VALUES (?, ?, ?, ?, ?, ?)
   154	    `);
   155	
   156	    stmt.run(
   157	      session.id,
   158	      now,
   159	      now,
   160	      session.state,
   161	      JSON.stringify(session.agentConfig),
   162	      session.workingDirectory
   163	    );
   164	
   165	    return {
   166	      ...session,
   167	      createdAt: new Date(now),
   168	      lastActivity: new Date(now),
   169	    };
   170	  }
   171	
   172	  getSession(id: string): Session | null {
   173	    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
   174	      | SessionRow
   175	      | undefined;
   176	    return row ? this.rowToSession(row) : null;
   177	  }
   178	
   179	  getAllSessions(includeCompleted = false): Session[] {
   180	    const query = includeCompleted
   181	      ? 'SELECT * FROM sessions ORDER BY last_activity DESC'
   182	      : "SELECT * FROM sessions WHERE state != 'completed' ORDER BY last_activity DESC";
   183	
   184	    const rows = this.db.prepare(query).all() as SessionRow[];
   185	    return rows.map((row) => this.rowToSession(row));
   186	  }
   187	
   188	  getSessionsByState(state: SessionState): Session[] {
   189	    const rows = this.db
   190	      .prepare('SELECT * FROM sessions WHERE state = ? ORDER BY last_activity DESC')
   191	      .all(state) as SessionRow[];
   192	    return rows.map((row) => this.rowToSession(row));
   193	  }
   194	
   195	  updateSessionState(id: string, state: SessionState): boolean {
   196	    const stmt = this.db.prepare('UPDATE sessions SET state = ?, last_activity = ? WHERE id = ?');
   197	    const result = stmt.run(state, Date.now(), id);
   198	    return result.changes > 0;
   199	  }
   200	
   201	  updateSessionActivity(id: string): boolean {
   202	    const stmt = this.db.prepare('UPDATE sessions SET last_activity = ? WHERE id = ?');
   203	    const result = stmt.run(Date.now(), id);
   204	    return result.changes > 0;
   205	  }
   206	
   207	  deleteSession(id: string): boolean {
   208	    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
   209	    const result = stmt.run(id);
   210	    return result.changes > 0;
   211	  }
   212	
   213	  deleteCompletedSessions(olderThanMs: number): number {
   214	    const cutoff = Date.now() - olderThanMs;
   215	    const stmt = this.db.prepare(
   216	      "DELETE FROM sessions WHERE state = 'completed' AND last_activity < ?"
   217	    );
   218	    const result = stmt.run(cutoff);
   219	    return result.changes;
   220	  }
   221	
   222	  // ============================================
   223	  // Client CRUD
   224	  // ============================================
   225	
   226	  addClient(client: Omit<Client, 'connectedAt' | 'lastHeartbeat'>): Client {
   227	    const now = Date.now();
   228	    const stmt = this.db.prepare(`
   229	      INSERT INTO connected_clients (id, session_id, client_type, connected_at, last_heartbeat, priority, user_agent)
   230	      VALUES (?, ?, ?, ?, ?, ?, ?)
   231	    `);
   232	
   233	    stmt.run(
   234	      client.id,
   235	      client.sessionId,
   236	      client.clientType,
   237	      now,
   238	      now,
   239	      client.priority,
   240	      client.userAgent || null
   241	    );
   242	
   243	    return {
   244	      ...client,
   245	      connectedAt: new Date(now),
   246	      lastHeartbeat: new Date(now),
   247	    };
   248	  }
   249	
   250	  getClient(id: string): Client | null {
   251	    const row = this.db.prepare('SELECT * FROM connected_clients WHERE id = ?').get(id) as
   252	      | ClientRow
   253	      | undefined;
   254	    return row ? this.rowToClient(row) : null;
   255	  }
   256	
   257	  getClientsBySession(sessionId: string): Client[] {
   258	    const rows = this.db
   259	      .prepare('SELECT * FROM connected_clients WHERE session_id = ?')
   260	      .all(sessionId) as ClientRow[];

exec
/bin/zsh -lc "nl -ba packages/server/src/auth/providers/index.ts | sed -n '1,140p'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
     1	/**
     2	 * OAuth Provider Registry
     3	 *
     4	 * Exports all OAuth providers and registration functions.
     5	 */
     6	
     7	export { githubProvider, registerGitHubProvider } from './github.js';
     8	
     9	/**
    10	 * Register all OAuth providers
    11	 * Call this during server initialization
    12	 */
    13	export function registerAllProviders(): void {
    14	  // Import dynamically to avoid circular dependencies
    15	  const { registerGitHubProvider } = require('./github.js');
    16	  registerGitHubProvider();
    17	}

exec
/bin/zsh -lc 'rg -n "db:migrate|typecheck|hard-gate|perf-budget|build:macos|build:linux|build:windows|test" package.json packages/*/package.json apps/*/package.json' in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
packages/shared/package.json:29:    "test": "bun test",
packages/shared/package.json:30:    "test:watch": "bun test --watch",
packages/shared/package.json:36:    "typecheck": "tsc --noEmit"
package.json:19:    "test": "npm run test --workspaces --if-present",
package.json:20:    "test:cli": "npm run test --workspace=lecoder-mconnect",
package.json:22:    "typecheck": "npm run typecheck --workspace=lecoder-mconnect",
packages/server/package.json:12:    "test": "SKIP_INTEGRATION=true bun test",
packages/server/package.json:13:    "test:watch": "SKIP_INTEGRATION=true bun test --watch",
packages/server/package.json:14:    "test:integration": "bun test --bail src/**/*.integration.test.ts",
packages/server/package.json:15:    "test:db": "bun test src/db/",
packages/server/package.json:21:    "typecheck": "tsc --noEmit",
packages/server/package.json:22:    "db:migrate": "bun run src/db/migrate.ts up",
packages/server/package.json:23:    "db:migrate:status": "bun run src/db/migrate.ts status",
packages/cli/package.json:23:    "test": "vitest run",
packages/cli/package.json:24:    "test:watch": "vitest",
packages/cli/package.json:25:    "test:coverage": "vitest run --coverage",
packages/cli/package.json:31:    "typecheck": "tsc --noEmit",
packages/cli/package.json:32:    "prepublishOnly": "npm run build && npm run test"
packages/cli/package.json:77:    "@vitest/coverage-v8": "^1.6.1",
packages/cli/package.json:81:    "vitest": "^1.6.1"

exec
/bin/zsh -lc "rg -n \"mconnect start|shell-only|research-spec-test|preset\" packages/cli/src packages/cli/README.md README.md docs -g '"'!node_modules'"'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
README.md:139:2. Pick an agent preset (start with "Shell Session" to try it out)
README.md:148:mconnect start          # Same as above (start is the default command)
README.md:149:mconnect start --preset shell-only --guardrails default  # Skip the wizard
README.md:151:mconnect presets        # List available agent presets
README.md:157:| `-p, --preset <name>` | Skip preset selection (`shell-only`, `single`, `research-spec-test`, `dev-review`, `container-dev`) |
README.md:332:# Select "Container Dev" preset when starting MConnect
packages/cli/README.md:159:1. **Agent Configuration** - Choose a preset or custom setup
packages/cli/README.md:180:### `mconnect` or `mconnect start`
packages/cli/README.md:188:### `mconnect start` with options
packages/cli/README.md:193:# Use a preset
packages/cli/README.md:194:mconnect start --preset research-spec-test
packages/cli/README.md:197:mconnect start --dir /path/to/project
packages/cli/README.md:200:mconnect start --guardrails strict
packages/cli/README.md:203:mconnect start --port 9000
packages/cli/README.md:206:mconnect start --no-tmux
packages/cli/README.md:209:mconnect start --code
packages/cli/README.md:222:### `mconnect presets`
packages/cli/README.md:224:List available agent presets:
packages/cli/README.md:227:mconnect presets
packages/cli/README.md:230:Available presets:
packages/cli/README.md:231:- `shell-only` - Single interactive shell (recommended to start)
packages/cli/README.md:233:- `research-spec-test` - 3 shells for parallel workflows
packages/cli/README.md:322:mconnect session create --preset single --dir /path/to/project
packages/cli/README.md:371:| `-p, --preset <name>` | Agent preset name | Interactive selection |
docs/api/openapi.yaml:40:    description: Agent preset configuration
docs/api/openapi.yaml:81:                      presets:
docs/api/openapi.yaml:83:                        example: /presets/*
docs/api/openapi.yaml:493:        Create a new agent session with the specified preset and configuration.
docs/api/openapi.yaml:494:        The preset determines which agents are launched in the session.
docs/api/openapi.yaml:511:          description: Invalid request or unknown preset
docs/api/openapi.yaml:635:  /presets:
docs/api/openapi.yaml:638:      summary: List available presets
docs/api/openapi.yaml:639:      description: Returns all built-in and custom agent presets.
docs/api/openapi.yaml:648:                  presets:
docs/api/openapi.yaml:655:      summary: Register custom preset
docs/api/openapi.yaml:656:      description: Register a new custom agent preset configuration.
docs/api/openapi.yaml:671:          description: Invalid preset configuration
docs/api/openapi.yaml:683:  /presets/{name}:
docs/api/openapi.yaml:686:      summary: Get preset details
docs/api/openapi.yaml:687:      description: Returns full configuration for a specific preset.
docs/api/openapi.yaml:712:      summary: Remove custom preset
docs/api/openapi.yaml:713:      description: Remove a custom preset. Built-in presets cannot be removed.
docs/api/openapi.yaml:731:          description: Cannot remove built-in preset
docs/api/openapi.yaml:949:      required: [preset, agents]
docs/api/openapi.yaml:951:        preset:
docs/api/openapi.yaml:1044:      required: [preset, workingDirectory]
docs/api/openapi.yaml:1046:        preset:
docs/api/openapi.yaml:1048:          description: Agent preset name
packages/cli/src/session/types.ts:14:  preset: string;
docs/ARCHITECTURE.md:1105:- Quick local development (`mconnect start` still works)
docs/ARCHITECTURE.md:1124:| `agents/types.ts` | Agent presets defined in shared protobuf |
docs/protocol/v3.md:316:      "preset": "claude-code",
packages/cli/src/index.ts:86:    '-p, --preset <name>',
packages/cli/src/index.ts:87:    'Agent preset (single, research-spec-test, dev-review, shell-only, container-dev)'
packages/cli/src/index.ts:92:  .option('-y, --yes', 'Skip interactive wizard, use defaults (preset: shell-only, guardrails: default)')
packages/cli/src/index.ts:138:  .command('presets')
packages/cli/src/index.ts:139:  .description('List available agent presets')
packages/cli/src/index.ts:142:    for (const preset of AGENT_PRESETS) {
packages/cli/src/index.ts:143:      console.log(chalk.cyan(`  ${preset.name}`));
packages/cli/src/index.ts:144:      console.log(chalk.dim(`    ${preset.description}`));
packages/cli/src/index.ts:145:      console.log(chalk.dim(`    Agents: ${preset.agents.map((a) => a.name).join(', ')}`));
packages/cli/src/index.ts:201:      console.log(chalk.dim('  Start a session first: mconnect start -y\n'));
packages/cli/src/index.ts:277:    console.log('    npx lecoder-mconnect start -y --preset shell-only');
packages/cli/src/index.ts:278:    console.log('    npx lecoder-mconnect start -y --json');
packages/cli/src/index.ts:282:    console.log('    npx lecoder-mconnect start');
packages/cli/src/index.ts:283:    console.log('    npx lecoder-mconnect start --preset single --guardrails strict');
packages/cli/src/index.ts:292:    console.log('    npx lecoder-mconnect start --timeout 30  # 30-min auto-expiry');
packages/cli/src/index.ts:296:    console.log('    npx lecoder-mconnect presets     # List agent presets');
packages/cli/src/index.ts:309:  preset?: string;
packages/cli/src/index.ts:322:  const preset = options.preset || 'shell-only';
packages/cli/src/index.ts:336:  const presetConfig = AGENT_PRESETS.find((p) => p.name === preset);
packages/cli/src/index.ts:337:  const agents = presetConfig
packages/cli/src/index.ts:338:    ? [...presetConfig.agents]
packages/cli/src/index.ts:344:    console.log(chalk.dim(`  Quick start: preset=${preset}, guardrails=${guardrails}`));
packages/cli/src/index.ts:375:  // Agent preset selection
packages/cli/src/index.ts:376:  const preset =
packages/cli/src/index.ts:377:    options.preset ||
packages/cli/src/index.ts:382:          value: 'shell-only',
packages/cli/src/index.ts:392:          value: 'research-spec-test',
packages/cli/src/index.ts:414:  if (p.isCancel(preset)) {
packages/cli/src/index.ts:419:  // Check Docker availability for container preset
packages/cli/src/index.ts:420:  let finalPreset = preset;
packages/cli/src/index.ts:421:  if (preset === 'container-dev') {
packages/cli/src/index.ts:433:        message: 'Continue with shell-only preset instead?',
packages/cli/src/index.ts:440:      finalPreset = 'shell-only';
packages/cli/src/index.ts:451:        message: 'Continue with shell-only preset instead?',
packages/cli/src/index.ts:458:      finalPreset = 'shell-only';
packages/cli/src/index.ts:472:    const presetConfig = AGENT_PRESETS.find((p) => p.name === finalPreset);
packages/cli/src/index.ts:473:    if (presetConfig) {
packages/cli/src/index.ts:474:      agents = [...presetConfig.agents]; // Clone the array
packages/cli/src/index.ts:476:      // Default to shell-only if preset not found
packages/cli/src/session.ts:36:  /** Guardrails preset name */
packages/cli/src/agents/types.ts:80: * Common agent presets
packages/cli/src/agents/types.ts:82: * All presets use shell-first approach:
packages/cli/src/agents/types.ts:102:    name: 'research-spec-test',
packages/cli/src/agents/types.ts:142:    name: 'shell-only',
packages/cli/src/agents/agent-manager.ts:410:   * Create multiple agents from a preset
packages/cli/src/agents/agent-manager.ts:412:  async createFromPreset(presetName: string): Promise<AgentInstance[]> {
packages/cli/src/agents/agent-manager.ts:414:    const preset = AGENT_PRESETS.find((p) => p.name === presetName);
packages/cli/src/agents/agent-manager.ts:415:    if (!preset) {
packages/cli/src/agents/agent-manager.ts:416:      throw new Error(`Unknown preset: ${presetName}`);
packages/cli/src/agents/agent-manager.ts:420:    for (const agentConfig of preset.agents) {
packages/cli/src/ws/protocol.ts:107:    preset: string;
docs/plans/APP_STORE_CHECKLIST.md:152:2) Run 'lecoder-mconnect start'
docs/plans/APP_STORE_CHECKLIST.md:191:2. Start a session: lecoder-mconnect start
docs/plans/SCREENSHOT_RUNBOOK.md:22:- [ ] CLI running locally for terminal screenshot (`npx lecoder-mconnect start`)
docs/plans/SCREENSHOT_RUNBOOK.md:53:- **Prerequisite:** Requires a running CLI session — run `npx lecoder-mconnect start` first
docs/plans/SCREENSHOT_RUNBOOK.md:150:# Prerequisites: Run `npx lecoder-mconnect start` in a separate terminal
docs/plans/SCREENSHOT_RUNBOOK.md:185:| Terminal screenshot shows blank | Ensure `npx lecoder-mconnect start` is running and the app is connected before capturing |
packages/cli/src/opik/types.ts:30:  /** Guardrails preset (e.g., 'default', 'strict', 'permissive') */
docs/plans/AMP_AGENT_PROMPT_PHASE1.md:46:- Start the CLI with bun run dev:cli or mconnect start on your machine.
packages/cli/src/__tests__/scrollback-buffer.test.ts:28:      agentConfig: { preset: 'test', agents: [] },
packages/cli/src/__tests__/types.test.ts:6: * - Agent presets (including container-dev)
packages/cli/src/__tests__/types.test.ts:52:    it('should have exactly 5 presets', () => {
packages/cli/src/__tests__/types.test.ts:56:    it('should have required preset names', () => {
packages/cli/src/__tests__/types.test.ts:57:      const presetNames = AGENT_PRESETS.map((p) => p.name);
packages/cli/src/__tests__/types.test.ts:58:      expect(presetNames).toContain('single');
packages/cli/src/__tests__/types.test.ts:59:      expect(presetNames).toContain('research-spec-test');
packages/cli/src/__tests__/types.test.ts:60:      expect(presetNames).toContain('dev-review');
packages/cli/src/__tests__/types.test.ts:61:      expect(presetNames).toContain('shell-only');
packages/cli/src/__tests__/types.test.ts:62:      expect(presetNames).toContain('container-dev');
packages/cli/src/__tests__/types.test.ts:65:    describe('single preset', () => {
packages/cli/src/__tests__/types.test.ts:67:        const preset = AGENT_PRESETS.find((p) => p.name === 'single');
packages/cli/src/__tests__/types.test.ts:68:        expect(preset).toBeDefined();
packages/cli/src/__tests__/types.test.ts:69:        expect(preset?.description).toContain('Claude');
packages/cli/src/__tests__/types.test.ts:70:        expect(preset?.agents).toHaveLength(1);
packages/cli/src/__tests__/types.test.ts:71:        expect(preset?.agents[0].type).toBe('claude');
packages/cli/src/__tests__/types.test.ts:72:        expect(preset?.agents[0].name).toBe('Claude');
packages/cli/src/__tests__/types.test.ts:73:        expect(preset?.agents[0].autoRun).toBe(false);
packages/cli/src/__tests__/types.test.ts:77:        const preset = AGENT_PRESETS.find((p) => p.name === 'single');
packages/cli/src/__tests__/types.test.ts:78:        const agent = preset?.agents[0];
packages/cli/src/__tests__/types.test.ts:86:    describe('research-spec-test preset', () => {
packages/cli/src/__tests__/types.test.ts:88:        const preset = AGENT_PRESETS.find((p) => p.name === 'research-spec-test');
packages/cli/src/__tests__/types.test.ts:89:        expect(preset?.agents).toHaveLength(3);
packages/cli/src/__tests__/types.test.ts:93:        const preset = AGENT_PRESETS.find((p) => p.name === 'research-spec-test');
packages/cli/src/__tests__/types.test.ts:94:        const names = preset?.agents.map((a) => a.name);
packages/cli/src/__tests__/types.test.ts:101:        const preset = AGENT_PRESETS.find((p) => p.name === 'research-spec-test');
packages/cli/src/__tests__/types.test.ts:102:        preset?.agents.forEach((agent) => {
packages/cli/src/__tests__/types.test.ts:108:        const preset = AGENT_PRESETS.find((p) => p.name === 'research-spec-test');
packages/cli/src/__tests__/types.test.ts:109:        preset?.agents.forEach((agent) => {
packages/cli/src/__tests__/types.test.ts:116:    describe('dev-review preset', () => {
packages/cli/src/__tests__/types.test.ts:118:        const preset = AGENT_PRESETS.find((p) => p.name === 'dev-review');
packages/cli/src/__tests__/types.test.ts:119:        expect(preset?.agents).toHaveLength(2);
packages/cli/src/__tests__/types.test.ts:123:        const preset = AGENT_PRESETS.find((p) => p.name === 'dev-review');
packages/cli/src/__tests__/types.test.ts:124:        const names = preset?.agents.map((a) => a.name);
packages/cli/src/__tests__/types.test.ts:130:    describe('shell-only preset', () => {
packages/cli/src/__tests__/types.test.ts:132:        const preset = AGENT_PRESETS.find((p) => p.name === 'shell-only');
packages/cli/src/__tests__/types.test.ts:133:        expect(preset?.agents).toHaveLength(1);
packages/cli/src/__tests__/types.test.ts:134:        expect(preset?.agents[0].type).toBe('shell');
packages/cli/src/__tests__/types.test.ts:135:        expect(preset?.agents[0].name).toBe('Shell');
packages/cli/src/__tests__/types.test.ts:139:    describe('container-dev preset', () => {
packages/cli/src/__tests__/types.test.ts:141:        const preset = AGENT_PRESETS.find((p) => p.name === 'container-dev');
packages/cli/src/__tests__/types.test.ts:142:        expect(preset).toBeDefined();
packages/cli/src/__tests__/types.test.ts:143:        expect(preset?.description).toContain('Container');
packages/cli/src/__tests__/types.test.ts:144:        expect(preset?.agents).toHaveLength(1);
packages/cli/src/__tests__/types.test.ts:145:        expect(preset?.agents[0].type).toBe('shell');
packages/cli/src/__tests__/types.test.ts:146:        expect(preset?.agents[0].name).toBe('Container');
packages/cli/src/__tests__/types.test.ts:150:        const preset = AGENT_PRESETS.find((p) => p.name === 'container-dev');
packages/cli/src/__tests__/types.test.ts:151:        const agent = preset?.agents[0];
packages/cli/src/__tests__/types.test.ts:160:        const preset = AGENT_PRESETS.find((p) => p.name === 'container-dev');
packages/cli/src/__tests__/types.test.ts:161:        expect(preset?.agents[0].command).toBe('/bin/bash');
packages/cli/src/__tests__/types.test.ts:165:    it('all presets should use valid shell commands', () => {
packages/cli/src/__tests__/types.test.ts:166:      AGENT_PRESETS.forEach((preset) => {
packages/cli/src/__tests__/types.test.ts:167:        preset.agents.forEach((agent) => {
packages/cli/src/__tests__/types.test.ts:244:      const preset: AgentPreset = {
packages/cli/src/__tests__/types.test.ts:245:        name: 'test-preset',
packages/cli/src/__tests__/types.test.ts:246:        description: 'A test preset',
packages/cli/src/__tests__/types.test.ts:255:      expect(preset.name).toBeDefined();
packages/cli/src/__tests__/types.test.ts:256:      expect(preset.description).toBeDefined();
packages/cli/src/__tests__/types.test.ts:257:      expect(preset.agents).toBeDefined();
packages/cli/src/__tests__/types.test.ts:258:      expect(Array.isArray(preset.agents)).toBe(true);
packages/cli/src/cli/commands/session.ts:122:async function createSession(options: { cwd?: string; preset?: string }): Promise<void> {
packages/cli/src/cli/commands/session.ts:130:        preset: options.preset || 'default',
packages/cli/src/cli/commands/session.ts:248:    .option('-p, --preset <name>', 'Agent preset to use', 'default')
packages/cli/src/__tests__/session-manager.test.ts:31:        { preset: 'single', agents: ['Claude'] },
packages/cli/src/__tests__/session-manager.test.ts:39:      expect(session.agentConfig.preset).toBe('single');
packages/cli/src/__tests__/session-manager.test.ts:44:      const session = sessionManager.createSession({ preset: 'single', agents: [] }, '/tmp');
packages/cli/src/__tests__/session-manager.test.ts:55:        { preset: 'shell-only', agents: ['Shell'] },
packages/cli/src/__tests__/session-manager.test.ts:62:      expect(fetched?.agentConfig.preset).toBe('shell-only');
packages/cli/src/__tests__/session-manager.test.ts:75:      sessionManager.createSession({ preset: 'a', agents: [] }, '/a');
packages/cli/src/__tests__/session-manager.test.ts:76:      sessionManager.createSession({ preset: 'b', agents: [] }, '/b');
packages/cli/src/__tests__/session-manager.test.ts:85:      const session = sessionManager.createSession({ preset: 'a', agents: [] }, '/a');
packages/cli/src/__tests__/session-manager.test.ts:95:      const session = sessionManager.createSession({ preset: 'a', agents: [] }, '/a');
packages/cli/src/__tests__/session-manager.test.ts:107:      const session = sessionManager.createSession({ preset: 'test', agents: [] }, '/test');
packages/cli/src/__tests__/session-manager.test.ts:127:      const session = sessionManager.createSession({ preset: 'test', agents: [] }, '/test');
packages/cli/src/__tests__/session-manager.test.ts:139:      const session = sessionManager.createSession({ preset: 'test', agents: [] }, '/test');
packages/cli/src/__tests__/session-manager.test.ts:151:      const session = sessionManager.createSession({ preset: 'test', agents: [] }, '/test');
packages/cli/src/__tests__/session-manager.test.ts:162:      const session = sessionManager.createSession({ preset: 'test', agents: [] }, '/test');
packages/cli/src/__tests__/session-manager.test.ts:175:      const session = sessionManager.createSession({ preset: 'test', agents: [] }, '/test');
packages/cli/src/__tests__/session-manager.test.ts:188:      const session = sessionManager.createSession({ preset: 'test', agents: [] }, '/test');
packages/cli/src/__tests__/session-manager.test.ts:202:      const session = sessionManager.createSession({ preset: 'test', agents: [] }, '/test');
packages/cli/src/__tests__/session-manager.test.ts:218:      sessionManager.createSession({ preset: 'a', agents: [] }, '/a');
packages/cli/src/__tests__/session-manager.test.ts:219:      const session = sessionManager.createSession({ preset: 'b', agents: [] }, '/b');

exec
/bin/zsh -lc "rg -n \"migrations|runMigrations|db:migrate|migrate\" packages/cli packages/server package.json -g '"'!node_modules'"'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
packages/cli/src/session/SessionStore.ts:5: * Handles database connection, migrations, and CRUD operations
packages/cli/src/session/SessionStore.ts:55:    // Run migrations
packages/cli/src/session/SessionStore.ts:56:    this.runMigrations();
packages/cli/src/session/SessionStore.ts:60:   * Run database migrations
packages/cli/src/session/SessionStore.ts:62:  private runMigrations(): void {
packages/cli/src/session/SessionStore.ts:64:    const migrationsDir = join(__dirname, '../../migrations');
packages/cli/src/session/SessionStore.ts:65:    const migrationFile = join(migrationsDir, '001_sessions.sql');
packages/cli/src/config.ts:156:export function migrateConfig(): { migrated: boolean; message?: string } {
packages/cli/src/config.ts:159:    return { migrated: false };
packages/cli/src/config.ts:167:      migrated: false,
packages/cli/src/config.ts:198:      migrated: true,
packages/cli/src/config.ts:199:      message: `Config migrated from ${OLD_CONFIG_PATH} to ${newConfigPath}. Old config backed up to ${backupPath}`,
packages/cli/src/config.ts:203:      migrated: false,
packages/cli/src/config.ts:204:      message: `Failed to migrate config: ${error instanceof Error ? error.message : 'Unknown error'}`,
packages/server/src/db/index.ts:27:export { runMigrations, getMigrationStatus, resetDatabase } from './migrate.js';
packages/cli/migrations/001_sessions.sql:1:-- migrations/001_sessions.sql
packages/cli/src/cli/commands/daemon.ts:14:import { getDataDir, migrateConfig } from '../../config.js';
packages/cli/src/cli/commands/daemon.ts:74:      const migration = migrateConfig();
packages/cli/src/cli/commands/daemon.ts:75:      if (migration.migrated) {
packages/cli/src/cli/commands/daemon.ts:76:        console.log(chalk.green('  Config migrated:'), migration.message);
packages/server/package.json:22:    "db:migrate": "bun run src/db/migrate.ts up",
packages/server/package.json:23:    "db:migrate:status": "bun run src/db/migrate.ts status",
packages/server/package.json:24:    "db:reset": "bun run src/db/migrate.ts reset"
packages/server/src/db/__tests__/repositories.integration.test.ts:9: *   bun run src/db/migrate.ts up
packages/server/src/db/__tests__/repositories.integration.test.ts:14:import { runMigrations } from '../migrate.js';
packages/server/src/db/__tests__/repositories.integration.test.ts:31:    // Run migrations
packages/server/src/db/__tests__/repositories.integration.test.ts:32:    await runMigrations(sql);
packages/server/README.md:24:# 4. Run database migrations
packages/server/README.md:25:bun run db:migrate
packages/server/README.md:119:bun run db:migrate       # Run migrations
packages/server/README.md:120:bun run db:migrate:status # Check migration status
packages/server/README.md:156:│   ├── migrate.ts        # Migration runner
packages/server/README.md:157:│   ├── migrations/       # SQL migrations
packages/server/src/db/migrate.ts:4: * Executes SQL migrations in order, tracking applied migrations
packages/server/src/db/migrate.ts:5: * in the _migrations table.
packages/server/src/db/migrate.ts:44: * Get the migrations directory path
packages/server/src/db/migrate.ts:49:  const srcPath = path.join(currentDir, 'migrations');
packages/server/src/db/migrate.ts:50:  const distPath = path.join(currentDir, '..', 'src', 'db', 'migrations');
packages/server/src/db/migrate.ts:65: * @returns Sorted list of migrations
packages/server/src/db/migrate.ts:70:  const migrations: Migration[] = files
packages/server/src/db/migrate.ts:88:  return migrations;
packages/server/src/db/migrate.ts:92: * Get list of applied migrations from database
packages/server/src/db/migrate.ts:98:  // Ensure migrations table exists
packages/server/src/db/migrate.ts:100:    CREATE TABLE IF NOT EXISTS _migrations (
packages/server/src/db/migrate.ts:108:    SELECT id, name, applied_at FROM _migrations ORDER BY id
packages/server/src/db/migrate.ts:136:      INSERT INTO _migrations (name) VALUES (${migration.name})
packages/server/src/db/migrate.ts:144: * Run all pending migrations
packages/server/src/db/migrate.ts:147: * @returns Number of migrations applied
packages/server/src/db/migrate.ts:149:export async function runMigrations(sql?: SqlClient): Promise<number> {
packages/server/src/db/migrate.ts:154:    const migrationsDir = getMigrationsDir();
packages/server/src/db/migrate.ts:155:    const migrations = parseMigrations(migrationsDir);
packages/server/src/db/migrate.ts:158:    console.log(`Found ${migrations.length} migrations, ${applied.size} already applied`);
packages/server/src/db/migrate.ts:160:    const pending = migrations.filter((m) => !applied.has(m.name));
packages/server/src/db/migrate.ts:163:      console.log('No pending migrations');
packages/server/src/db/migrate.ts:167:    console.log(`Applying ${pending.length} pending migrations...`);
packages/server/src/db/migrate.ts:173:    console.log(`Successfully applied ${pending.length} migrations`);
packages/server/src/db/migrate.ts:192:  migrations: Array<{ name: string; status: 'applied' | 'pending'; appliedAt?: Date }>;
packages/server/src/db/migrate.ts:198:    const migrationsDir = getMigrationsDir();
packages/server/src/db/migrate.ts:199:    const migrations = parseMigrations(migrationsDir);
packages/server/src/db/migrate.ts:204:      SELECT id, name, applied_at FROM _migrations ORDER BY id
packages/server/src/db/migrate.ts:208:    const result = migrations.map((m) => ({
packages/server/src/db/migrate.ts:215:      total: migrations.length,
packages/server/src/db/migrate.ts:217:      pending: migrations.length - appliedSet.size,
packages/server/src/db/migrate.ts:218:      migrations: result,
packages/server/src/db/migrate.ts:228: * Reset database (drop all tables and re-run migrations)
packages/server/src/db/migrate.ts:242:    await client`DROP TABLE IF EXISTS _migrations CASCADE`;
packages/server/src/db/migrate.ts:252:    console.log('Running migrations...');
packages/server/src/db/migrate.ts:253:    await runMigrations(client);
packages/server/src/db/migrate.ts:269: *   bun run src/db/migrate.ts [command]
packages/server/src/db/migrate.ts:272: *   up (default) - Run pending migrations
packages/server/src/db/migrate.ts:274: *   reset        - Drop all tables and re-run migrations
packages/server/src/db/migrate.ts:282:        await runMigrations();
packages/server/src/db/migrate.ts:292:        for (const m of status.migrations) {
packages/server/src/db/migrate.ts:307:        console.log('Usage: bun run src/db/migrate.ts [up|status|reset]');
packages/server/src/db/migrate.ts:322:  runMigrations,
packages/server/src/db/migrations/001_initial.sql:158:CREATE TABLE IF NOT EXISTS _migrations (

exec
/bin/zsh -lc "node -e \"const fs=require('fs'); for (const f of ['package.json','packages/cli/package.json','packages/shared/package.json','packages/server/package.json']) { const p=JSON.parse(fs.readFileSync(f)); console.log(f, p.name, p.version, p.scripts&&Object.keys(p.scripts).join(',')); }\"" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
package.json lecoder-mconnect-monorepo 0.1.2 dev,dev:cli,build,build:cli,build:web,start,cli,setup,test,test:cli,lint,typecheck,clean
packages/cli/package.json lecoder-mconnect 0.2.0 postinstall,dev,build,start,test,test:watch,test:coverage,lint,lint:fix,format,check,check:fix,typecheck,prepublishOnly
packages/shared/package.json @lecoder/shared 0.1.0 build,dev,test,test:watch,lint,lint:fix,format,check,check:fix,typecheck
packages/server/package.json @lecoder/server 0.1.0 dev,build,start,test,test:watch,test:integration,test:db,lint,lint:fix,format,check,check:fix,typecheck,db:migrate,db:migrate:status,db:reset

exec
/bin/zsh -lc "nl -ba packages/ios-app/MConnect/Services/WebSocket/Protocol.swift | sed -n '360,460p'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
   360	/// Protocol error message.
   361	struct ErrorResponse: Codable, Equatable {
   362	    let type: String
   363	    let message: String
   364	    let code: ProtocolErrorCode
   365	    let retryable: Bool
   366	    let retryAfterMs: Int?
   367	    let timestamp: Double
   368	}
   369	
   370	// MARK: - Server Message Discriminator
   371	
   372	/// Parsed server message — discriminated union over all server → client message types.
   373	enum ServerMessage: Equatable {
   374	    case authSuccess(AuthSuccessResponse)
   375	    case authFailed(AuthFailedResponse)
   376	    case sessionList(SessionListResponse)
   377	    case sessionState(SessionStateResponse)
   378	    case terminalOutput(TerminalOutputResponse)
   379	    case agentStatus(AgentStatusResponse)
   380	    case agentList(AgentListResponse)
   381	    case controlStatus(ControlStatusResponse)
   382	    case controlResponse(ControlResponse)
   383	    case inputRejected(InputRejectedResponse)
   384	    case scrollbackResponse(ScrollbackResponse)
   385	    case clientJoined(ClientJoinedResponse)
   386	    case clientLeft(ClientLeftResponse)
   387	    case heartbeat(HeartbeatResponse)
   388	    case pong(PongResponse)
   389	    case error(ErrorResponse)
   390	
   391	    /// Parse a JSON data blob into a typed server message.
   392	    static func parse(from data: Data) -> ServerMessage? {
   393	        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
   394	              let type = json["type"] as? String
   395	        else {
   396	            return nil
   397	        }
   398	
   399	        let decoder = JSONDecoder()
   400	
   401	        switch type {
   402	        case "auth_success":
   403	            guard let msg = try? decoder.decode(AuthSuccessResponse.self, from: data) else { return nil }
   404	            return .authSuccess(msg)
   405	        case "auth_failed":
   406	            guard let msg = try? decoder.decode(AuthFailedResponse.self, from: data) else { return nil }
   407	            return .authFailed(msg)
   408	        case "session_list":
   409	            guard let msg = try? decoder.decode(SessionListResponse.self, from: data) else { return nil }
   410	            return .sessionList(msg)
   411	        case "session_state":
   412	            guard let msg = try? decoder.decode(SessionStateResponse.self, from: data) else { return nil }
   413	            return .sessionState(msg)
   414	        case "terminal_output":
   415	            guard let msg = try? decoder.decode(TerminalOutputResponse.self, from: data) else { return nil }
   416	            return .terminalOutput(msg)
   417	        case "agent_status":
   418	            guard let msg = try? decoder.decode(AgentStatusResponse.self, from: data) else { return nil }
   419	            return .agentStatus(msg)
   420	        case "agent_list":
   421	            guard let msg = try? decoder.decode(AgentListResponse.self, from: data) else { return nil }
   422	            return .agentList(msg)
   423	        case "control_status":
   424	            guard let msg = try? decoder.decode(ControlStatusResponse.self, from: data) else { return nil }
   425	            return .controlStatus(msg)
   426	        case "control_response":
   427	            guard let msg = try? decoder.decode(ControlResponse.self, from: data) else { return nil }
   428	            return .controlResponse(msg)
   429	        case "input_rejected":
   430	            guard let msg = try? decoder.decode(InputRejectedResponse.self, from: data) else { return nil }
   431	            return .inputRejected(msg)
   432	        case "scrollback_response":
   433	            guard let msg = try? decoder.decode(ScrollbackResponse.self, from: data) else { return nil }
   434	            return .scrollbackResponse(msg)
   435	        case "client_joined":
   436	            guard let msg = try? decoder.decode(ClientJoinedResponse.self, from: data) else { return nil }
   437	            return .clientJoined(msg)
   438	        case "client_left":
   439	            guard let msg = try? decoder.decode(ClientLeftResponse.self, from: data) else { return nil }
   440	            return .clientLeft(msg)
   441	        case "heartbeat":
   442	            guard let msg = try? decoder.decode(HeartbeatResponse.self, from: data) else { return nil }
   443	            return .heartbeat(msg)
   444	        case "pong":
   445	            guard let msg = try? decoder.decode(PongResponse.self, from: data) else { return nil }
   446	            return .pong(msg)
   447	        case "error":
   448	            guard let msg = try? decoder.decode(ErrorResponse.self, from: data) else { return nil }
   449	            return .error(msg)
   450	        default:
   451	            return nil
   452	        }
   453	    }
   454	}

exec
/bin/zsh -lc "nl -ba packages/server/src/ws/WSHub.ts | sed -n '620,680p'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
   620	
   621	  /**
   622	   * Handle auth message
   623	   */
   624	  private async handleAuthMessage(clientId: string, message: AuthMessage): Promise<void> {
   625	    const client = this.clients.get(clientId);
   626	    if (!client) {
   627	      return;
   628	    }
   629	
   630	    // Clear auth timeout
   631	    const authTimeout = this.authTimeouts.get(clientId);
   632	    if (authTimeout) {
   633	      clearTimeout(authTimeout);
   634	      this.authTimeouts.delete(clientId);
   635	    }
   636	
   637	    // Validate token
   638	    let claims: AccessTokenClaims | null = null;
   639	    try {
   640	      const jwtService = getJWTService();
   641	      claims = await jwtService.validateAccessToken(message.token);
   642	    } catch {
   643	      // Token validation failed
   644	    }
   645	
   646	    if (!claims) {
   647	      this.sendAuthFailed(clientId, 'invalid_token');
   648	      client.ws.close(1008, 'Authentication failed');
   649	      return;
   650	    }
   651	
   652	    // Update client with auth info
   653	    client.userId = claims.sub;
   654	    client.email = claims.email;
   655	    client.name = claims.name;
   656	    client.clientType = message.clientType;
   657	    client.priority = message.clientType === 'pc' ? 'high' : 'normal';
   658	    client.authenticated = true;
   659	
   660	    // Send success response
   661	    const successMessage: AuthSuccessMessage = {
   662	      type: 'auth_success',
   663	      clientId,
   664	      protocolVersion: '3.0',
   665	      clientType: client.clientType,
   666	      userId: client.userId,
   667	      timestamp: Date.now(),
   668	    };
   669	
   670	    this.sendToClient(clientId, successMessage);
   671	  }
   672	
   673	  /**
   674	   * Handle authenticated client message
   675	   */
   676	  private async handleClientMessage(clientId: string, message: ClientMessage): Promise<void> {
   677	    const client = this.clients.get(clientId);
   678	    if (!client) {
   679	      return;
   680	    }

exec
/bin/zsh -lc "nl -ba packages/cli/package.json | sed -n '1,50p'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
     1	{
     2	  "name": "lecoder-mconnect",
     3	  "version": "0.2.0",
     4	  "description": "Mobile terminal control for AI coding agents - Terminal in your pocket",
     5	  "type": "module",
     6	  "main": "./dist/index.js",
     7	  "types": "./dist/index.d.ts",
     8	  "bin": {
     9	    "mconnect": "dist/index.js",
    10	    "lecoder-mconnect": "dist/index.js"
    11	  },
    12	  "files": [
    13	    "dist",
    14	    "scripts",
    15	    "README.md",
    16	    "LICENSE"
    17	  ],
    18	  "scripts": {
    19	    "postinstall": "node scripts/postinstall.js || true",
    20	    "dev": "tsx watch src/index.ts",
    21	    "build": "tsup src/index.ts --format esm --dts --clean",
    22	    "start": "node dist/index.js",
    23	    "test": "vitest run",
    24	    "test:watch": "vitest",
    25	    "test:coverage": "vitest run --coverage",
    26	    "lint": "biome lint src/",
    27	    "lint:fix": "biome lint --write src/",
    28	    "format": "biome format --write src/",
    29	    "check": "biome check src/",
    30	    "check:fix": "biome check --write src/",
    31	    "typecheck": "tsc --noEmit",
    32	    "prepublishOnly": "npm run build && npm run test"
    33	  },
    34	  "keywords": [
    35	    "cli",
    36	    "terminal",
    37	    "mobile",
    38	    "ai-agents",
    39	    "claude-code",
    40	    "gemini-cli",
    41	    "aider",
    42	    "remote-terminal",
    43	    "pty",
    44	    "websocket",
    45	    "docker",
    46	    "devcontainer"
    47	  ],
    48	  "author": "Arya Teja Rudraraju <aryateja2106@gmail.com>",
    49	  "license": "MIT",
    50	  "repository": {

exec
/bin/zsh -lc "nl -ba packages/cli/src/index.ts | sed -n '70,110p'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
    70	  .description('Control AI coding agents from your mobile device')
    71	  .version(VERSION);
    72	
    73	// Add subcommand groups
    74	program.addCommand(createDaemonCommand());
    75	
    76	// Add session commands
    77	const sessionCmd = createSessionCommand();
    78	sessionCmd.addCommand(createAttachCommand());
    79	program.addCommand(sessionCmd);
    80	
    81	program
    82	  .command('start', { isDefault: true })
    83	  .description('Start a new MConnect session')
    84	  .option('-d, --dir <directory>', 'Working directory')
    85	  .option(
    86	    '-p, --preset <name>',
    87	    'Agent preset (single, research-spec-test, dev-review, shell-only, container-dev)'
    88	  )
    89	  .option('-g, --guardrails <level>', 'Guardrails level (default, strict, permissive, none)')
    90	  .option('--port <number>', 'Server port (default: 8765)')
    91	  .option('--no-tmux', 'Disable tmux visualization')
    92	  .option('-y, --yes', 'Skip interactive wizard, use defaults (preset: shell-only, guardrails: default)')
    93	  .option('--json', 'Output session connection info as JSON (implies --yes)')
    94	  .option('-c, --code', '(Deprecated) Pairing code is now always shown')
    95	  .option('--web-url <url>', 'Web app URL (e.g. http://localhost:3000)')
    96	  .option('--timeout <minutes>', 'Session timeout in minutes (default: 60, 0 = no timeout)', '60')
    97	  .action(async (options) => {
    98	    // Quick check for node-pty before starting wizard
    99	    const ptyAvailable = await isNodePtyAvailable();
   100	    if (!ptyAvailable) {
   101	      const errorMsg = await getNodePtyError();
   102	      console.log(chalk.red('\n  ✗ node-pty is not available\n'));
   103	
   104	      // Show specific error if available
   105	      if (errorMsg) {
   106	        if (errorMsg.includes('Cannot find module')) {
   107	          console.log(chalk.dim('  The module is not installed.\n'));
   108	        } else if (errorMsg.includes('was compiled against a different')) {
   109	          console.log(chalk.dim('  The module needs to be rebuilt for your Node.js version.\n'));
   110	        } else {

exec
/bin/zsh -lc 'rg --files .github 2>/dev/null || true' in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
.github/copilot-instructions.md
.github/agents/test.md
.github/agents/cli-dev.md
.github/agents/plan.md
.github/agents/web-dev.md
.github/workflows/ci.yml

exec
/bin/zsh -lc "rg -n \"client_capabilities|capabilities|unsupported_capability|UNSUPPORTED_CAPABILITY\" docs/protocol packages/shared packages/server packages/ios-app packages/cli -g '"'!node_modules'"'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
packages/ios-app/README.md:27:### 3. Configure capabilities
packages/ios-app/README.md:29:The app requires these capabilities (already declared in the project):
packages/cli/src/container/types.ts:116:  /** Linux capabilities to add */
packages/server/src/mcp/__tests__/MCPBridge.test.ts:49:  test('has empty capabilities when not connected', () => {
packages/shared/src/types/container.ts:128:  /** Linux capabilities to add */
packages/server/src/mcp/MCPBridge.ts:386:   * Get server capabilities
packages/server/src/mcp/MCPBridge.ts:682:      capabilities: Record<string, unknown>;
packages/server/src/mcp/MCPBridge.ts:689:      capabilities: {
packages/server/src/mcp/MCPBridge.ts:700:    // Store server capabilities
packages/server/src/mcp/MCPBridge.ts:701:    this.serverCapabilities = initResult.capabilities;
packages/server/src/agents/AgentManager.ts:515:        capabilities: bridge.getCapabilities(),

exec
/bin/zsh -lc "rg -n \"v0\\.1\\.10|0\\.1\\.10|latest npm\" README.md CHANGELOG.md package.json packages/cli/package.json docs packages -g '"'!node_modules'"'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 exited 1 in 0ms:
codex
A concrete executability issue is emerging: several “mechanical” commands assume existing CLI/package scripts that are not present. I’m checking whether these are isolated typos or systemic enough to affect the verdict.
exec
/bin/zsh -lc "nl -ba .github/workflows/ci.yml | sed -n '1,220p'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
     1	name: CI
     2	
     3	on:
     4	  push:
     5	    branches: [main]
     6	  pull_request:
     7	    branches: [main]
     8	
     9	# Cancel in-progress runs for the same branch/PR.
    10	# Only uses github.event.pull_request.number and github.ref (safe, non-user-controlled).
    11	concurrency:
    12	  group: ci-${{ github.event.pull_request.number || github.ref }}
    13	  cancel-in-progress: true
    14	
    15	env:
    16	  BUN_VERSION: '1.1.38'
    17	
    18	jobs:
    19	  # ─────────────────────────────────────────────
    20	  # Lint & typecheck all TypeScript packages
    21	  # ─────────────────────────────────────────────
    22	  lint:
    23	    name: Lint & Typecheck
    24	    runs-on: ubuntu-latest
    25	
    26	    steps:
    27	      - name: Checkout code
    28	        uses: actions/checkout@v4
    29	
    30	      - name: Setup Node.js
    31	        uses: actions/setup-node@v4
    32	        with:
    33	          node-version: '20'
    34	          cache: 'npm'
    35	
    36	      - name: Setup Bun
    37	        uses: oven-sh/setup-bun@v2
    38	        with:
    39	          bun-version: ${{ env.BUN_VERSION }}
    40	
    41	      - name: Install dependencies
    42	        run: npm ci
    43	
    44	      - name: Build shared package
    45	        run: npm run build --workspace=@lecoder/shared
    46	
    47	      # CLI
    48	      - name: Lint CLI
    49	        run: npm run check --workspace=lecoder-mconnect
    50	
    51	      - name: Typecheck CLI
    52	        run: npm run typecheck --workspace=lecoder-mconnect
    53	
    54	      # Server (uses bun)
    55	      - name: Lint Server
    56	        run: bun run lint
    57	        working-directory: packages/server
    58	
    59	      - name: Typecheck Server
    60	        run: bun run typecheck
    61	        working-directory: packages/server
    62	
    63	      # Shared
    64	      - name: Typecheck Shared
    65	        run: bun run typecheck
    66	        working-directory: packages/shared
    67	
    68	  # ─────────────────────────────────────────────
    69	  # CLI tests (Linux)
    70	  # ─────────────────────────────────────────────
    71	  test-cli:
    72	    name: CLI Tests
    73	    runs-on: ubuntu-latest
    74	    needs: lint
    75	
    76	    steps:
    77	      - name: Checkout code
    78	        uses: actions/checkout@v4
    79	
    80	      - name: Setup Node.js
    81	        uses: actions/setup-node@v4
    82	        with:
    83	          node-version: '20'
    84	          cache: 'npm'
    85	
    86	      - name: Install dependencies
    87	        run: npm ci
    88	
    89	      - name: Run tests with coverage
    90	        run: npm run test:coverage --workspace=lecoder-mconnect
    91	        env:
    92	          SKIP_NATIVE_TESTS: 'true'
    93	
    94	      - name: Upload CLI coverage
    95	        uses: actions/upload-artifact@v4
    96	        if: always()
    97	        with:
    98	          name: cli-coverage
    99	          path: packages/cli/coverage/
   100	          retention-days: 14
   101	
   102	      - name: Build
   103	        run: npm run build --workspace=lecoder-mconnect
   104	
   105	  # ─────────────────────────────────────────────
   106	  # Server tests with PostgreSQL
   107	  # ─────────────────────────────────────────────
   108	  test-server:
   109	    name: Server Tests
   110	    runs-on: ubuntu-latest
   111	    needs: lint
   112	
   113	    services:
   114	      postgres:
   115	        image: postgres:16-alpine
   116	        env:
   117	          POSTGRES_USER: postgres
   118	          POSTGRES_PASSWORD: test
   119	          POSTGRES_DB: mconnect_test
   120	        ports:
   121	          - 5432:5432
   122	        options: >-
   123	          --health-cmd "pg_isready -U postgres -d mconnect_test"
   124	          --health-interval 5s
   125	          --health-timeout 5s
   126	          --health-retries 5
   127	          --health-start-period 10s
   128	
   129	    steps:
   130	      - name: Checkout code
   131	        uses: actions/checkout@v4
   132	
   133	      - name: Setup Node.js
   134	        uses: actions/setup-node@v4
   135	        with:
   136	          node-version: '20'
   137	          cache: 'npm'
   138	
   139	      - name: Setup Bun
   140	        uses: oven-sh/setup-bun@v2
   141	        with:
   142	          bun-version: ${{ env.BUN_VERSION }}
   143	
   144	      - name: Install dependencies
   145	        run: npm ci
   146	
   147	      - name: Build shared package
   148	        run: npm run build --workspace=@lecoder/shared
   149	
   150	      - name: Run unit tests
   151	        run: bun test
   152	        working-directory: packages/server
   153	        env:
   154	          SKIP_INTEGRATION: 'true'
   155	          DATABASE_URL: postgres://postgres:test@localhost:5432/mconnect_test
   156	          JWT_SECRET: ci-test-secret-key-do-not-use-in-production
   157	          DEV_AUTH_BYPASS: 'true'
   158	
   159	      - name: Run database migrations
   160	        run: bun run db:migrate
   161	        working-directory: packages/server
   162	        env:
   163	          DATABASE_URL: postgres://postgres:test@localhost:5432/mconnect_test
   164	
   165	      - name: Run integration tests
   166	        run: bun test --bail src/**/*.integration.test.ts
   167	        working-directory: packages/server
   168	        env:
   169	          DATABASE_URL: postgres://postgres:test@localhost:5432/mconnect_test
   170	          JWT_SECRET: ci-test-secret-key-do-not-use-in-production
   171	          DEV_AUTH_BYPASS: 'true'
   172	          SKIP_DOCKER_TESTS: 'true'
   173	
   174	      - name: Build server
   175	        run: bun run build
   176	        working-directory: packages/server
   177	
   178	  # ─────────────────────────────────────────────
   179	  # Shared package tests
   180	  # ─────────────────────────────────────────────
   181	  test-shared:
   182	    name: Shared Tests
   183	    runs-on: ubuntu-latest
   184	    needs: lint
   185	
   186	    steps:
   187	      - name: Checkout code
   188	        uses: actions/checkout@v4
   189	
   190	      - name: Setup Node.js
   191	        uses: actions/setup-node@v4
   192	        with:
   193	          node-version: '20'
   194	          cache: 'npm'
   195	
   196	      - name: Setup Bun
   197	        uses: oven-sh/setup-bun@v2
   198	        with:
   199	          bun-version: ${{ env.BUN_VERSION }}
   200	
   201	      - name: Install dependencies
   202	        run: npm ci
   203	
   204	      - name: Run tests
   205	        run: bun test
   206	        working-directory: packages/shared
   207	
   208	      - name: Build
   209	        run: bun run build
   210	        working-directory: packages/shared
   211	
   212	  # ─────────────────────────────────────────────
   213	  # iOS tests on macOS
   214	  # ─────────────────────────────────────────────
   215	  test-ios:
   216	    name: iOS Tests
   217	    runs-on: macos-14
   218	    needs: lint
   219	
   220	    steps:

exec
/bin/zsh -lc 'test -f docs/protocol/v3.1-migration.md; echo $?' in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
1

exec
/bin/zsh -lc "find .omc -maxdepth 3 -type f | sort | sed -n '1,120p'" in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 0ms:
.omc/artifacts/ask/codex-review-the-mconnect-v0-2-0-consensus-plan-at-omc-plans-2026--2026-05-03T02-48-51-562Z.md
.omc/artifacts/ask/codex-review-the-mconnect-v0-2-0-consensus-plan-at-omc-plans-2026--2026-05-03T02-52-57-259Z.md
.omc/artifacts/ask/codex-review-the-revised-mconnect-v0-2-0-consensus-plan-at-omc-pla-2026-05-03T03-02-24-364Z.md
.omc/plans/2026-05-02-194104-mconnect-v2-session-desktop-anchor.md
.omc/project-memory.json
.omc/state/last-tool-error.json
.omc/state/ralplan-state.json

exec
/bin/zsh -lc 'npm view lecoder-mconnect version --json' in /Users/aryateja/Desktop/Work/mconnect/.claude/worktrees/sequential-jingling-noodle
 succeeded in 631ms:
"0.1.10"

codex
**VERDICT: REVISE**

**Overall Assessment**: v1 fixed the main v0 structural failures: protocol baseline, narrowed scope, fairer Option B scoring, explicit Phase 0, stronger tests, better ACs, and final ADR. It is not approvable yet because the execution plan still contains impossible or stale commands, an overloaded Phase 0/Phase 4 schedule, and a release-order bug.

**Pre-commitment Predictions**: I expected stale protocol assumptions, overstuffed phases, vague verification, release engineering order problems, and weak product wedge framing. Actual: protocol is materially fixed; verification improved but still has command rot; phase overstuffing remains; release ordering is broken; wedge framing is only partially handled.

**10 v0 Criteria Re-check**

1. Protocol baseline v3.0 + negotiation: **FIXED**. §1 explicitly says `v3.0 is the protocol baseline; new features land at v3.1 with capability negotiation` at plan lines 33-34. Verified source: `packages/shared/src/protocol/messages.ts:22` is `3.0`; CLI is still `2.0` at `packages/cli/src/ws/protocol.ts:259`.
2. Option B re-score: **FIXED**. §3 scores +3-4 weeks / 15-16 weeks, not 100% Rust penalty, at plan lines 66-80.
3. Phase 0 includes CLI v3, negotiation, Electron budget before Phase 1: **IMPROVED, NOT FIXED**. Present at lines 130-136, but too much for 2 weeks.
4. 4th pre-mortem scenario protocol/auth drift: **FIXED**. Scenario 4 at lines 327-336.
5. Soak/cross-platform/DB/OAuth/provider/iOS regression: **FIXED**. §7.4 lines 360-368 and Phase 4 lines 231-237.
6. ACs mechanical fixture/command/assertion: **IMPROVED**. §8 lines 380-399 is much better, but AC16 is inconsistent and some commands are invalid.
7. §10 manual/file-line/CI precision: **IMPROVED**. CI names and commands exist in §10, but manual gates remain at lines 463-465 and several job names do not exist yet.
8. ADR finalized with triggers: **FIXED**. §11 lines 467-492.
9. Out-of-scope tightened: **FIXED**. §13 explicitly lists memory/swarm/OAuth/iOS-side-panel/skills/smfs and more at lines 516-533.
10. 12-week narrow budget credible: **IMPROVED, STILL FAILS at phase level**. Narrow scope helps, but Phase 0 and Phase 4 are not credible as written.

**Major Findings**

1. Phase 0 is still overloaded and internally dishonest.
   - Evidence: Phase 0, in 2 weeks, includes CLI v3 migration, capability negotiation, four interfaces, default adapters, new Tauri desktop package, mac/linux/windows packaged artifacts, hard-gate CI, perf-budget script, and a 1-week Electron swap reserve at plan lines 128-160.
   - Confidence: HIGH
   - Why this matters: executor will hit the first gate late, then either compress Phase 1 or skip the Electron fallback discipline.
   - Fix: split Phase 0 into explicit gates: `0A protocol + negotiation`, `0B desktop spike`, `0C Electron fallback if triggered`; either extend total plan or remove Phase 6 polish/buffer.

2. Verification commands are not mechanically executable against the current CLI.
   - Evidence: plan uses `--no-interactive` at lines 187 and 213; current CLI has `-y, --yes` but no `--no-interactive` in `packages/cli/src/index.ts:81-97`. Plan uses `cd packages/cli && bun run db:migrate` at line 181; `packages/cli/package.json:18-32` has no `db:migrate` script.
   - Confidence: HIGH
   - Why this matters: the plan’s “ralph-executable” claim is false. Execution will stop on copy-pasted gates.
   - Fix: replace `--no-interactive` with `--yes`; add a real CLI migration runner script or change all CLI migration checks to instantiate `SessionStore`/run a test harness.

3. Phase 4 has a release-order bug around signed updater regression.
   - Evidence: Phase 4 says `Updater-installed binary regression: install signed dmg from a previous release` at line 232. But desktop alpha is unsigned at line 195 and signing starts only in Phase 5 at lines 259-266.
   - Confidence: HIGH
   - Why this matters: Phase 4 cannot test a signed updater-installed desktop binary that does not exist yet.
   - Fix: move signed updater regression to Phase 5 after signing, or change Phase 4 to an unsigned install smoke test.

4. `docs/protocol/v3.1-migration.md` is an orphaned mitigation.
   - Evidence: Scenario 4 requires compatibility matrix documentation at line 335, but it is not in §5 deliverables, §8 ACs, or §10 verification. The file does not exist now.
   - Confidence: HIGH
   - Why this matters: protocol/auth drift was the top risk; its mitigation must be load-bearing, not a pre-mortem aside.
   - Fix: add this doc to Phase 0 deliverables, AC11/AC12, and §10 with `test -f docs/protocol/v3.1-migration.md` plus content grep for each capability family.

5. TS interface “one-file Rust sidecar swap” is unsupported.
   - Evidence: plan claims future Rust sidecar swap is “a one-file change” at line 133, but no IPC schema, JSON-RPC contract, mock sidecar, or adapter conformance test is specified.
   - Confidence: MEDIUM
   - Why this matters: this is currently architecture theater. Without contract tests, the future Option B path will rot immediately.
   - Fix: add `packages/shared/src/interfaces/sidecar-schema.ts`, JSON-RPC fixtures, and a mock sidecar contract test in Phase 0.

**Minor Findings**

1. AC16 says `2 new evals` at line 399, but §7.5 lists four feedback scores: Worktree Hygiene, Fork Fidelity, Cold-Start TTI, Idle PSS at line 372. Fix the count or split evals vs perf scores.
2. §13 says “beyond existing GitHub/Google” at line 520, but current provider registry exports only GitHub at `packages/server/src/auth/providers/index.ts:7-16`. Make wording consistent.
3. §10 claims every step is one-line shell command at line 417, but `.github/workflows/soak.yml` in §5 line 242 is a file path/status check, not a command.

**What’s Missing**

- A real protocol capability matrix deliverable and acceptance test.
- A migration runner story for CLI SQLite migrations beyond the current one-file `001_sessions.sql` bootstrap.
- A signed-artifact sequencing plan that distinguishes unsigned alpha, signed RC, updater e2e, and final release.
- A mobile-first acceptance criterion beyond “iOS still connects.”

**Ambiguity Risks**

- `future Rust sidecar swap is a one-file change` → Interpretation A: only adapters change. Interpretation B: schema, transport, process lifecycle, and error semantics also change. Wrong interpretation creates a fake migration path.
- `best mobile-first session manager` → Interpretation A: desktop controls sessions and iOS remains compatible. Interpretation B: iOS continuity is a first-class wedge. Wrong interpretation ships desktop parity with weak differentiation.

**Multi-Perspective Notes**

- Executor: will fail on `--no-interactive` and missing `db:migrate`.
- Stakeholder: plan admits the risk: “anchor is just a session manager” at line 64. §11 reframes as “best mobile-first session manager” at line 485, but ACs barely prove mobile-first value.
- Skeptic: narrowed Option A is now defensible for execution, but not yet defensible as a market wedge unless iOS continuity is explicitly showcased and tested.

**Verdict Justification**

REVISE, not REJECT: v1 materially addresses the v0 rejection and is close. But I escalated to ADVERSARIAL mode after finding 3+ MAJOR issues. Realist check did not upgrade anything to CRITICAL because these are plan-correction problems, not irreversible implementation failures; detection would be immediate during Phase 0. They still must be fixed before approval because the plan currently contains false mechanical gates and impossible sequencing.

**Ralplan Summary**

- Principle/Option Consistency: **Pass**
- Alternatives Depth: **Pass**
- Risk/Verification Rigor: **Fail until command rot, orphan doc, and release-order bug are fixed**
- Deliberate Additions: **Improved, not pass**

CRITIC-V1: REVISE
tokens used
90,294

```

## Concise summary

Provider completed successfully. Review the raw output for details.

## Action items

- Review the response and extract decisions you want to apply.
- Capture follow-up implementation tasks if needed.

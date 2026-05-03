/**
 * TaskRunner
 *
 * Drives the daemon's task-execution loop:
 *
 *   1. Poll hub for a task.
 *   2. Acquire a worktree via WorktreeManager.
 *   3. Ask the AgentLauncher to spawn an agent inside the worktree.
 *   4. Report run start / completion to the hub.
 *   5. Release the worktree.
 *
 * Wiring this to the existing AgentManager is M2c. Here we keep the runner
 * deliberately decoupled (via the AgentLauncher interface) so unit tests
 * can drive the lifecycle without spinning real PTYs.
 */

import { VERSION } from '../version.js';
import type { AcquiredWorktree, WorktreeManager } from './WorktreeManager.js';

export interface HubTaskClaim {
  id: string;
  title: string;
  body?: string;
  provider?: string;
  workingDirectory?: string;
}

export interface RunOutcome {
  exitCode: number;
  status: 'completed' | 'failed' | 'cancelled';
}

export interface AgentLauncher {
  /**
   * Launch an agent for the given task. The launcher is responsible for
   * spawning the underlying process and waiting for it to exit.
   * Throwing an error from the launcher counts as a failed run.
   */
  launch(input: {
    task: HubTaskClaim;
    worktreePath: string;
    runId: string;
  }): Promise<RunOutcome>;
}

export interface HubTaskApi {
  /** Claim the oldest queued task assigned to this runtime, or null. */
  claimNextTask(runtimeId: string): Promise<HubTaskClaim | null>;
  /** Notify hub a run has started, return the run id for follow-up updates. */
  startRun(input: {
    taskId: string;
    runtimeId: string;
    agentId?: string;
    worktreePath: string;
  }): Promise<{ runId: string }>;
  /** Update run status / exit code at completion. */
  finishRun(input: {
    taskId: string;
    runId: string;
    status: 'completed' | 'failed' | 'cancelled';
    exitCode?: number;
  }): Promise<void>;
}

export interface TaskRunnerLogger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

const consoleLogger: TaskRunnerLogger = {
  debug: (msg, meta) => console.debug(`[task] ${msg}`, meta ?? ''),
  info: (msg, meta) => console.log(`[task] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[task] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[task] ${msg}`, meta ?? ''),
};

export interface TaskRunnerOptions {
  runtimeId: string;
  hubApi: HubTaskApi;
  worktreeManager: WorktreeManager;
  launcher: AgentLauncher;
  pollMs?: number;
  logger?: TaskRunnerLogger;
}

export class TaskRunner {
  private readonly runtimeId: string;
  private readonly hubApi: HubTaskApi;
  private readonly worktreeManager: WorktreeManager;
  private readonly launcher: AgentLauncher;
  private readonly pollMs: number;
  private readonly logger: TaskRunnerLogger;
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight = 0;

  constructor(options: TaskRunnerOptions) {
    this.runtimeId = options.runtimeId;
    this.hubApi = options.hubApi;
    this.worktreeManager = options.worktreeManager;
    this.launcher = options.launcher;
    this.pollMs = options.pollMs ?? 3_000;
    this.logger = options.logger ?? consoleLogger;
  }

  start(): void {
    if (this.timer) return;
    this.logger.info(`TaskRunner ${VERSION} started`, { runtimeId: this.runtimeId });
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        this.logger.warn(`Tick failed: ${err instanceof Error ? err.message : err}`);
      });
    }, this.pollMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Test hook — run one polling iteration. */
  async tick(): Promise<HubTaskClaim | null> {
    const task = await this.hubApi.claimNextTask(this.runtimeId);
    if (!task) return null;

    this.inFlight++;
    this.executeTask(task)
      .catch((err) => {
        this.logger.error(`Task ${task.id} failed: ${err instanceof Error ? err.message : err}`);
      })
      .finally(() => {
        this.inFlight--;
      });
    return task;
  }

  /** How many tasks are currently mid-flight (test/diag helper). */
  inFlightCount(): number {
    return this.inFlight;
  }

  private async executeTask(task: HubTaskClaim): Promise<void> {
    let worktree: AcquiredWorktree | null = null;
    let runId: string | null = null;

    try {
      this.logger.info(`Picked up task ${task.id}: ${task.title}`);

      worktree = await this.worktreeManager.acquire({ taskId: task.id, title: task.title });
      this.logger.debug(`Worktree at ${worktree.path}`, {
        isGitWorktree: worktree.isGitWorktree,
        branch: worktree.branch,
      });

      const start = await this.hubApi.startRun({
        taskId: task.id,
        runtimeId: this.runtimeId,
        worktreePath: worktree.path,
      });
      runId = start.runId;

      const outcome = await this.launcher.launch({
        task,
        worktreePath: worktree.path,
        runId,
      });

      await this.hubApi.finishRun({
        taskId: task.id,
        runId,
        status: outcome.status,
        exitCode: outcome.exitCode,
      });
      this.logger.info(`Task ${task.id} -> ${outcome.status} (exit ${outcome.exitCode})`);
    } catch (err) {
      this.logger.error(`Task ${task.id} threw: ${err instanceof Error ? err.message : err}`);
      if (runId) {
        try {
          await this.hubApi.finishRun({
            taskId: task.id,
            runId,
            status: 'failed',
            exitCode: -1,
          });
        } catch (innerErr) {
          this.logger.warn(
            `Failed to mark run failed: ${innerErr instanceof Error ? innerErr.message : innerErr}`
          );
        }
      }
    } finally {
      if (worktree) {
        try {
          await worktree.release();
        } catch (err) {
          this.logger.warn(`Worktree release failed: ${err instanceof Error ? err.message : err}`);
        }
      }
    }
  }
}

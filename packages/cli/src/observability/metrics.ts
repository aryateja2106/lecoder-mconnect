/**
 * Custom Evaluation Metrics for MConnect Observability
 *
 * These metrics are designed for the "Best Use of Opik" hackathon prize.
 * They provide LLM-as-judge style evaluation for:
 * - Command safety scoring
 * - Agent tool selection evaluation
 * - Session health monitoring
 * - Multi-agent coordination efficiency
 *
 * @see https://www.comet.com/docs/opik/evaluation
 */

import type { CommandCheck, GuardrailConfig } from '../guardrails.js';
import type { MConnectMetrics } from './opik.js';

/**
 * Command Safety Metric
 *
 * Evaluates how well guardrails are functioning by scoring command checks.
 * Higher scores indicate better safety (blocking dangerous commands).
 */
export class CommandSafetyMetric {
  readonly name = 'command_safety';
  readonly description = 'Evaluates command safety based on guardrail checks';

  /**
   * Score a command based on its guardrail check result
   *
   * @param command - The command being evaluated
   * @param result - The guardrail check result
   * @param config - Optional guardrail configuration for context
   * @returns Score between 0 and 1
   */
  score(
    command: string,
    result: CommandCheck,
    config?: GuardrailConfig
  ): CommandSafetyScore {
    const hasDangerousPatterns = this.containsDangerousPatterns(command);

    let score: number;
    let category: 'safe' | 'flagged' | 'blocked' | 'missed';
    let explanation: string;

    if (result.blocked) {
      if (hasDangerousPatterns) {
        // Correctly blocked dangerous command
        score = 1.0;
        category = 'blocked';
        explanation = `Correctly blocked dangerous command: ${result.reason}`;
      } else {
        // Potentially over-blocked (false positive)
        score = 0.7;
        category = 'flagged';
        explanation = `Blocked command that may not be dangerous: ${result.reason}`;
      }
    } else if (result.requiresApproval) {
      // Flagged for review - good for suspicious commands
      score = hasDangerousPatterns ? 0.9 : 0.8;
      category = 'flagged';
      explanation = `Flagged for approval: ${result.reason || 'manual review required'}`;
    } else {
      // Allowed through
      if (hasDangerousPatterns) {
        // Dangerous command not caught (false negative)
        score = 0.2;
        category = 'missed';
        explanation = 'Potentially dangerous command allowed through';
      } else {
        // Safe command allowed
        score = 0.6;
        category = 'safe';
        explanation = 'Safe command allowed through';
      }
    }

    return {
      score,
      category,
      explanation,
      command: command.substring(0, 100),
      guardrailLevel: config?.level,
    };
  }

  /**
   * Check if command contains dangerous patterns
   */
  private containsDangerousPatterns(command: string): boolean {
    const dangerousPatterns = [
      /rm\s+(-rf?|--recursive)\s*\//i, // rm -rf /
      /:\s*\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/i, // Fork bomb
      />\s*\/dev\/sd[a-z]/i, // Write to disk device
      /mkfs\./i, // Format filesystem
      /dd\s+.*of=\/dev/i, // DD to device
      /curl.*\|\s*(ba)?sh/i, // Curl pipe to shell
      /wget.*\|\s*(ba)?sh/i, // Wget pipe to shell
      />\s*\/etc\/(passwd|shadow|sudoers)/i, // Write to sensitive files
      /chmod\s+777\s+\//i, // chmod 777 /
      /chown.*:\s+\//i, // chown of root
    ];

    return dangerousPatterns.some((pattern) => pattern.test(command));
  }
}

export interface CommandSafetyScore {
  score: number;
  category: 'safe' | 'flagged' | 'blocked' | 'missed';
  explanation: string;
  command: string;
  guardrailLevel?: string;
}

/**
 * Agent Tool Selection Metric
 *
 * Evaluates whether agents are using appropriate tools for their tasks.
 * Measures efficiency of tool selection based on agent type and command patterns.
 */
export class AgentToolSelectionMetric {
  readonly name = 'agent_tool_selection';
  readonly description = 'Evaluates agent tool selection efficiency';

  // Expected tool patterns for each agent type
  private expectedPatterns: Record<string, RegExp[]> = {
    'claude-code': [
      /^claude\s+/i,
      /^code\s+/i,
      /^edit\s+/i,
      /^write\s+/i,
      /^read\s+/i,
    ],
    gemini: [/^gemini\s+/i, /^google\s+/i, /^search\s+/i],
    opencode: [/^opencode\s+/i, /^ai\s+/i],
    shell: [
      /^(ls|cd|cat|echo|grep|find|mkdir|rm|cp|mv|touch|chmod)/i,
      /^\./i, // Scripts
      /^npm\s+/i,
      /^git\s+/i,
    ],
  };

  /**
   * Score an agent's tool selection
   *
   * @param agentType - The type of agent (claude-code, gemini, shell, etc.)
   * @param command - The command executed
   * @returns Score between 0 and 1
   */
  score(agentType: string, command: string): AgentToolSelectionScore {
    const normalizedType = agentType.toLowerCase();
    const patterns = this.expectedPatterns[normalizedType] || [];

    // Check if command matches expected patterns for this agent type
    const matchesExpected = patterns.some((p) => p.test(command));

    // Check if command matches patterns for OTHER agent types
    let matchesOther = false;
    let suggestedType: string | undefined;

    for (const [type, typePatterns] of Object.entries(this.expectedPatterns)) {
      if (type !== normalizedType && typePatterns.some((p) => p.test(command))) {
        matchesOther = true;
        suggestedType = type;
        break;
      }
    }

    let score: number;
    let explanation: string;

    if (matchesExpected) {
      score = 1.0;
      explanation = `Command matches expected patterns for ${agentType} agent`;
    } else if (matchesOther) {
      score = 0.5;
      explanation = `Command might be better suited for ${suggestedType} agent`;
    } else {
      // Generic command, neutral score
      score = 0.7;
      explanation = 'Command does not match specific agent patterns';
    }

    return {
      score,
      explanation,
      agentType,
      command: command.substring(0, 100),
      suggestedType,
    };
  }
}

export interface AgentToolSelectionScore {
  score: number;
  explanation: string;
  agentType: string;
  command: string;
  suggestedType?: string;
}

/**
 * Session Health Metric
 *
 * Composite metric evaluating overall session health based on:
 * - Error rate
 * - Command success rate
 * - Connection stability
 * - Agent utilization
 */
export class SessionHealthMetric {
  readonly name = 'session_health';
  readonly description = 'Composite score of session health indicators';

  /**
   * Score session health based on metrics
   *
   * @param metrics - Current session metrics
   * @returns Score between 0 and 1
   */
  score(metrics: MConnectMetrics): SessionHealthScore {
    const components: HealthComponent[] = [];

    // 1. Command Safety Rate (blocked/total)
    const totalCommands = metrics.commandsExecuted;
    if (totalCommands > 0) {
      const safetyRate =
        (totalCommands - metrics.commandsBlocked) / totalCommands;
      components.push({
        name: 'command_safety',
        score: safetyRate,
        weight: 0.25,
        explanation: `${((1 - safetyRate) * 100).toFixed(1)}% of commands blocked by guardrails`,
      });
    }

    // 2. Security Events Rate
    const securityRate =
      metrics.securityEvents > 0
        ? Math.max(0, 1 - metrics.securityEvents / 10)
        : 1.0;
    components.push({
      name: 'security_health',
      score: securityRate,
      weight: 0.25,
      explanation: `${metrics.securityEvents} security events detected`,
    });

    // 3. Container Health
    const containerTotal = metrics.containersCreated;
    const containerHealth =
      containerTotal > 0
        ? (containerTotal - metrics.containerErrors) / containerTotal
        : 1.0;
    components.push({
      name: 'container_health',
      score: containerHealth,
      weight: 0.2,
      explanation: `${metrics.containerErrors}/${containerTotal} container errors`,
    });

    // 4. Auth Health
    const authRate =
      metrics.authFailures > 0
        ? Math.max(0, 1 - metrics.authFailures / 5)
        : 1.0;
    components.push({
      name: 'auth_health',
      score: authRate,
      weight: 0.15,
      explanation: `${metrics.authFailures} auth failures`,
    });

    // 5. Input Arbiter Health
    const totalInputDecisions =
      metrics.inputsRejected + metrics.commandsExecuted;
    const arbiterHealth =
      totalInputDecisions > 0
        ? (totalInputDecisions - metrics.inputsRejected) / totalInputDecisions
        : 1.0;
    components.push({
      name: 'arbiter_health',
      score: arbiterHealth,
      weight: 0.15,
      explanation: `${metrics.inputsRejected} inputs rejected by arbiter`,
    });

    // Calculate weighted average
    const overallScore = components.reduce(
      (sum, c) => sum + c.score * c.weight,
      0
    );

    // Determine health status
    let status: 'healthy' | 'degraded' | 'critical';
    if (overallScore >= 0.8) {
      status = 'healthy';
    } else if (overallScore >= 0.5) {
      status = 'degraded';
    } else {
      status = 'critical';
    }

    return {
      score: overallScore,
      status,
      components,
      sessionDuration: Date.now() - metrics.startTime,
    };
  }
}

export interface SessionHealthScore {
  score: number;
  status: 'healthy' | 'degraded' | 'critical';
  components: HealthComponent[];
  sessionDuration: number;
}

export interface HealthComponent {
  name: string;
  score: number;
  weight: number;
  explanation: string;
}

/**
 * Multi-Agent Coordination Metric
 *
 * Evaluates efficiency of multi-agent coordination based on:
 * - Agent utilization
 * - Control transfer efficiency
 * - Parallel execution patterns
 */
export class AgentCoordinationMetric {
  readonly name = 'agent_coordination';
  readonly description = 'Evaluates multi-agent coordination efficiency';

  /**
   * Score multi-agent coordination
   *
   * @param metrics - Session metrics
   * @param activeAgents - Number of currently active agents
   * @returns Score between 0 and 1
   */
  score(metrics: MConnectMetrics, activeAgents: number): AgentCoordinationScore {
    // 1. Agent utilization (are spawned agents being used?)
    const utilizationScore =
      metrics.agentsSpawned > 0
        ? Math.min(1, activeAgents / metrics.agentsSpawned)
        : 0.5;

    // 2. Control transfer efficiency (exclusive grants vs time)
    const sessionMinutes = (Date.now() - metrics.startTime) / 60000;
    const transferRate =
      sessionMinutes > 0 ? metrics.exclusiveGrants / sessionMinutes : 0;
    // Ideal: 0-2 transfers per minute
    const transferScore =
      transferRate <= 2
        ? 1.0
        : Math.max(0, 1 - (transferRate - 2) / 10);

    // 3. Rate limit incidents (fewer is better)
    const rateLimitScore =
      metrics.rateLimitEvents > 0
        ? Math.max(0, 1 - metrics.rateLimitEvents / 20)
        : 1.0;

    // Weighted average
    const overallScore =
      utilizationScore * 0.4 +
      transferScore * 0.3 +
      rateLimitScore * 0.3;

    return {
      score: overallScore,
      agentsSpawned: metrics.agentsSpawned,
      activeAgents,
      utilizationScore,
      transferScore,
      rateLimitScore,
      explanation: this.generateExplanation(
        utilizationScore,
        transferScore,
        rateLimitScore
      ),
    };
  }

  private generateExplanation(
    utilization: number,
    transfer: number,
    rateLimit: number
  ): string {
    const issues: string[] = [];

    if (utilization < 0.7) {
      issues.push('low agent utilization');
    }
    if (transfer < 0.7) {
      issues.push('high control transfer rate');
    }
    if (rateLimit < 0.7) {
      issues.push('frequent rate limiting');
    }

    if (issues.length === 0) {
      return 'Excellent multi-agent coordination';
    }
    return `Coordination issues: ${issues.join(', ')}`;
  }
}

export interface AgentCoordinationScore {
  score: number;
  agentsSpawned: number;
  activeAgents: number;
  utilizationScore: number;
  transferScore: number;
  rateLimitScore: number;
  explanation: string;
}

/**
 * Create all metrics for the session
 */
export function createMetrics() {
  return {
    commandSafety: new CommandSafetyMetric(),
    agentToolSelection: new AgentToolSelectionMetric(),
    sessionHealth: new SessionHealthMetric(),
    agentCoordination: new AgentCoordinationMetric(),
  };
}

export type MetricSet = ReturnType<typeof createMetrics>;

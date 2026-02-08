/**
 * LatencyTracker - WebSocket Message Latency Instrumentation
 * MConnect V2 Server
 *
 * Lightweight utility for tracking WebSocket message processing latency.
 * Uses performance.now() for sub-millisecond precision.
 * Maintains sliding window of measurements per message type.
 */

/**
 * Latency metrics for a message type
 */
export interface LatencyMetrics {
  /** Message type */
  messageType: string;
  /** Total number of measurements */
  count: number;
  /** 50th percentile latency in ms */
  p50: number;
  /** 95th percentile latency in ms */
  p95: number;
  /** 99th percentile latency in ms */
  p99: number;
  /** Minimum latency in ms */
  min: number;
  /** Maximum latency in ms */
  max: number;
  /** Average latency in ms */
  avg: number;
}

/**
 * Configuration options for LatencyTracker
 */
export interface LatencyTrackerConfig {
  /** Whether tracking is enabled (default: true) */
  enabled?: boolean;
  /** Number of recent measurements to keep per type (default: 100) */
  windowSize?: number;
}

/**
 * LatencyTracker for WebSocket message processing
 */
export class LatencyTracker {
  private enabled: boolean;
  private readonly windowSize: number;
  private measurements: Map<string, number[]> = new Map();

  constructor(config: LatencyTrackerConfig = {}) {
    this.enabled = config.enabled ?? true;
    this.windowSize = config.windowSize ?? 100;
  }

  /**
   * Start a timer for measuring latency
   * @returns A stop function that returns elapsed time in ms
   */
  startTimer(): () => number {
    if (!this.enabled) {
      // Return no-op function for zero overhead when disabled
      return () => 0;
    }

    const startTime = performance.now();

    return (): number => {
      const endTime = performance.now();
      return endTime - startTime;
    };
  }

  /**
   * Record a latency measurement for a message type
   * @param messageType The type of message
   * @param latencyMs The latency in milliseconds
   */
  record(messageType: string, latencyMs: number): void {
    if (!this.enabled) {
      return;
    }

    // Get or create measurements array for this type
    let measurements = this.measurements.get(messageType);
    if (!measurements) {
      measurements = [];
      this.measurements.set(messageType, measurements);
    }

    // Add new measurement
    measurements.push(latencyMs);

    // Maintain sliding window - remove oldest if exceeds window size
    if (measurements.length > this.windowSize) {
      measurements.shift();
    }
  }

  /**
   * Get metrics for a specific message type
   * @param messageType The message type to get metrics for
   * @returns Metrics or null if no measurements exist
   */
  getMetricsForType(messageType: string): LatencyMetrics | null {
    const measurements = this.measurements.get(messageType);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    return this.calculateMetrics(messageType, measurements);
  }

  /**
   * Get metrics for all message types
   * @returns Array of metrics for all tracked message types
   */
  getMetrics(): LatencyMetrics[] {
    const allMetrics: LatencyMetrics[] = [];

    for (const [messageType, measurements] of this.measurements.entries()) {
      if (measurements.length > 0) {
        allMetrics.push(this.calculateMetrics(messageType, measurements));
      }
    }

    return allMetrics;
  }

  /**
   * Reset all measurements
   */
  reset(): void {
    this.measurements.clear();
  }

  /**
   * Enable or disable latency tracking
   * @param enabled Whether to enable tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Calculate metrics from measurements array
   */
  private calculateMetrics(messageType: string, measurements: number[]): LatencyMetrics {
    // Sort measurements for percentile calculation
    const sorted = [...measurements].sort((a, b) => a - b);
    const count = sorted.length;

    // Calculate percentiles
    const p50 = this.percentile(sorted, 0.50);
    const p95 = this.percentile(sorted, 0.95);
    const p99 = this.percentile(sorted, 0.99);

    // Calculate min, max, avg
    const min = sorted[0];
    const max = sorted[count - 1];
    const sum = measurements.reduce((acc, val) => acc + val, 0);
    const avg = sum / count;

    return {
      messageType,
      count,
      p50,
      p95,
      p99,
      min,
      max,
      avg,
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) {
      return 0;
    }

    if (sorted.length === 1) {
      return sorted[0];
    }

    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    // Linear interpolation between values
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
}

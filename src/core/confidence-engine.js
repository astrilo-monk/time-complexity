/**
 * Confidence Engine - Signal-based confidence scoring
 *
 * Produces a confidence score (0.0 to 1.0) based on analysis signals.
 * Each signal has a weight and direction (positive = increases confidence,
 * negative = decreases confidence).
 *
 * The confidence score reflects how certain we are about the complexity
 * estimate, NOT the complexity itself.
 */

/**
 * Signal definitions with weights.
 * Positive weight = increases confidence.
 * Negative weight = decreases confidence.
 */
const SIGNAL_WEIGHTS = {
  // Positive signals
  bounds_statically_known:    0.20,  // Loop bounds are literal values or simple variables
  termination_certain:        0.15,  // Loop/recursion is guaranteed to terminate
  simple_increment:           0.10,  // Loop uses i++, i+=k, or i*=k
  base_case_found:            0.10,  // Recursion has a clear base case
  single_path:                0.05,  // No branching in the critical section
  known_pattern:              0.15,  // Matches a recognized algorithm pattern

  // Negative signals
  input_dependent_condition: -0.15,  // Loop bound depends on runtime input
  has_break:                 -0.10,  // Break statement may exit early
  has_continue:              -0.05,  // Continue may skip iterations
  has_early_return:          -0.10,  // Return inside loop body
  unknown_bounds:            -0.25,  // Cannot determine loop bounds
  dynamic_dispatch:          -0.15,  // Function pointers, callbacks
  nested_recursion:          -0.10,  // Recursion inside loops or vice versa
  multiple_recursive_calls:  -0.05,  // More than one recursive call (harder to analyze)
  unknown_increment:         -0.20,  // Cannot determine how iterator changes
};

/**
 * Confidence level thresholds.
 */
const CONFIDENCE_LEVELS = {
  HIGH:   0.75,
  MEDIUM: 0.50,
  LOW:    0.25,
};

export class ConfidenceEngine {
  constructor() {
    this.signals = [];
    this.baseConfidence = 0.5; // Start at neutral
  }

  /**
   * Add a signal to the confidence calculation.
   * @param {string} signalName - Must be a key in SIGNAL_WEIGHTS
   * @param {string} [reason] - Human-readable reason for this signal
   * @returns {ConfidenceEngine} this (for chaining)
   */
  addSignal(signalName, reason = '') {
    if (!(signalName in SIGNAL_WEIGHTS)) {
      // Unknown signal - ignore rather than crash
      return this;
    }

    this.signals.push({
      name: signalName,
      weight: SIGNAL_WEIGHTS[signalName],
      reason: reason || signalName.replace(/_/g, ' '),
    });

    return this;
  }

  /**
   * Calculate the final confidence score.
   * Clamps to [0.0, 1.0].
   * @returns {{ score: number, level: string, reasons: string[] }}
   */
  calculate() {
    let score = this.baseConfidence;

    for (const signal of this.signals) {
      score += signal.weight;
    }

    // Clamp to [0, 1]
    score = Math.max(0.0, Math.min(1.0, score));

    // Round to 2 decimal places
    score = Math.round(score * 100) / 100;

    const level = this.getLevel(score);
    const reasons = this.getReasons();

    return { score, level, reasons };
  }

  /**
   * Get the confidence level string.
   * @param {number} score
   * @returns {'high'|'medium'|'low'}
   */
  getLevel(score) {
    if (score >= CONFIDENCE_LEVELS.HIGH) return 'high';
    if (score >= CONFIDENCE_LEVELS.MEDIUM) return 'medium';
    return 'low';
  }

  /**
   * Get human-readable reasons explaining the confidence.
   * Groups positive and negative factors.
   * @returns {string[]}
   */
  getReasons() {
    const positive = this.signals.filter(s => s.weight > 0);
    const negative = this.signals.filter(s => s.weight < 0);

    const reasons = [];

    if (positive.length > 0) {
      for (const s of positive) {
        reasons.push(`✓ ${s.reason}`);
      }
    }

    if (negative.length > 0) {
      for (const s of negative) {
        reasons.push(`✗ ${s.reason}`);
      }
    }

    return reasons;
  }

  /**
   * Reset the engine for reuse.
   * @returns {ConfidenceEngine}
   */
  reset() {
    this.signals = [];
    return this;
  }
}

/**
 * Create a confidence result for a high-confidence analysis.
 * Shortcut when we know all loop bounds statically.
 * @param {string} [reason]
 * @returns {{ score: number, level: string, reasons: string[] }}
 */
export function highConfidence(reason = 'Loop bounds are statically known') {
  const engine = new ConfidenceEngine();
  engine.addSignal('bounds_statically_known', reason);
  engine.addSignal('termination_certain', 'Termination is guaranteed');
  engine.addSignal('simple_increment', 'Simple increment pattern');
  return engine.calculate();
}

/**
 * Create a confidence result for an unknown/unanalyzable case.
 * @param {string} [reason]
 * @returns {{ score: number, level: string, reasons: string[] }}
 */
export function lowConfidence(reason = 'Unable to determine complexity') {
  const engine = new ConfidenceEngine();
  engine.addSignal('unknown_bounds', reason);
  return engine.calculate();
}

export { SIGNAL_WEIGHTS, CONFIDENCE_LEVELS };

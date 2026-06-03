/**
 * Tests for the Confidence Engine
 */

import { describe, it, expect } from 'vitest';
import {
  ConfidenceEngine,
  highConfidence,
  lowConfidence,
  SIGNAL_WEIGHTS,
} from '../../../src/core/confidence-engine.js';

describe('ConfidenceEngine', () => {
  it('should start at 0.5 base confidence', () => {
    const engine = new ConfidenceEngine();
    const result = engine.calculate();
    expect(result.score).toBe(0.5);
    expect(result.level).toBe('medium');
  });

  it('should increase confidence with positive signals', () => {
    const engine = new ConfidenceEngine();
    engine.addSignal('bounds_statically_known');
    engine.addSignal('termination_certain');
    engine.addSignal('simple_increment');
    const result = engine.calculate();
    expect(result.score).toBeGreaterThan(0.5);
    expect(result.level).toBe('high');
  });

  it('should decrease confidence with negative signals', () => {
    const engine = new ConfidenceEngine();
    engine.addSignal('unknown_bounds');
    engine.addSignal('has_break');
    const result = engine.calculate();
    expect(result.score).toBeLessThan(0.5);
    expect(result.level).toBe('low');
  });

  it('should clamp to [0, 1]', () => {
    const engine = new ConfidenceEngine();
    // Add many negative signals to try to go below 0
    engine.addSignal('unknown_bounds');
    engine.addSignal('unknown_bounds');
    engine.addSignal('unknown_bounds');
    const result = engine.calculate();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('should clamp to max 1.0', () => {
    const engine = new ConfidenceEngine();
    engine.addSignal('bounds_statically_known');
    engine.addSignal('termination_certain');
    engine.addSignal('simple_increment');
    engine.addSignal('known_pattern');
    engine.addSignal('base_case_found');
    engine.addSignal('single_path');
    const result = engine.calculate();
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('should produce reasons', () => {
    const engine = new ConfidenceEngine();
    engine.addSignal('bounds_statically_known', 'Loop runs 0 to n');
    engine.addSignal('has_break', 'Break at line 5');
    const result = engine.calculate();
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons[0]).toContain('✓');
    expect(result.reasons[1]).toContain('✗');
  });

  it('should support chaining', () => {
    const engine = new ConfidenceEngine();
    const result = engine
      .addSignal('bounds_statically_known')
      .addSignal('simple_increment')
      .calculate();
    expect(result.score).toBeGreaterThan(0.5);
  });

  it('should ignore unknown signal names', () => {
    const engine = new ConfidenceEngine();
    engine.addSignal('not_a_real_signal');
    const result = engine.calculate();
    expect(result.score).toBe(0.5); // Unchanged
  });

  it('should reset properly', () => {
    const engine = new ConfidenceEngine();
    engine.addSignal('bounds_statically_known');
    engine.reset();
    const result = engine.calculate();
    expect(result.score).toBe(0.5);
  });
});

describe('convenience functions', () => {
  it('highConfidence should return > 0.75', () => {
    const result = highConfidence();
    expect(result.score).toBeGreaterThanOrEqual(0.75);
    expect(result.level).toBe('high');
  });

  it('lowConfidence should return < 0.5', () => {
    const result = lowConfidence();
    expect(result.score).toBeLessThan(0.5);
    expect(result.level).toBe('low');
  });
});

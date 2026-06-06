/**
 * Complexity Analyzer - Package Entry Point
 *
 * Public API for the complexity analysis engine.
 * Designed for future integration into Code Tracer.
 *
 * Usage:
 *   import { analyze } from 'complexity-analyzer';
 *   const result = analyze(code, { language: 'python' });
 */

import { ComplexityEngine } from './core/complexity-engine.js';
import { LoopAnalyzer } from './analyzers/loop-analyzer.js';
import { RecursionAnalyzer } from './analyzers/recursion-analyzer.js';
import { SpaceAnalyzer } from './analyzers/space-analyzer.js';
import { PatternDetector } from './analyzers/pattern-detector.js';

// Parser layer
export { getParser, isLanguageSupported, getSupportedLanguages } from './parsers/parser-factory.js';

// IR node types (for advanced consumers who want to inspect the IR)
export {
  IRNode,
  ProgramNode,
  FunctionNode,
  LoopNode,
  BlockNode,
  BranchNode,
  CallNode,
  VariableNode,
  AllocationNode,
  ReturnNode,
  BreakNode,
  ContinueNode,
  ExpressionNode,
} from './ir/nodes.js';

// IR builder utilities
export { markRecursiveCalls, buildCallGraph, detectMutualRecursion, maxLoopDepth, collectLoops } from './ir/builder.js';

// Core engine
export { ComplexityEngine } from './core/complexity-engine.js';
export { BigO, fromDegree, parse as parseBigO, max as maxComplexity } from './core/complexity-algebra.js';
export { ConfidenceEngine, highConfidence, lowConfidence } from './core/confidence-engine.js';

// Analyzers
export { LoopAnalyzer } from './analyzers/loop-analyzer.js';
export { RecursionAnalyzer } from './analyzers/recursion-analyzer.js';
export { SpaceAnalyzer } from './analyzers/space-analyzer.js';
export { PatternDetector } from './analyzers/pattern-detector.js';

/**
 * Convenience function - the primary public API.
 *
 * Wires up the engine with all available analyzers and runs analysis.
 *
 * @param {string} sourceCode
 * @param {{ language: string }} options
 * @returns {AnalysisReport}
 */
export function analyze(sourceCode, options = {}) {
  const engine = new ComplexityEngine();
  engine.use(new LoopAnalyzer());
  engine.use(new RecursionAnalyzer());
  engine.use(new SpaceAnalyzer());
  engine.use(new PatternDetector());
  return engine.analyze(sourceCode, options);
}

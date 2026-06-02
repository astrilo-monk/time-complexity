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

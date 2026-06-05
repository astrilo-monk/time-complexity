/**
 * Complexity Engine - Analysis pipeline orchestrator
 *
 * Coordinates the full analysis pipeline:
 *   Source Code → Parser → IR → Analyzers → Result
 *
 * Each analyzer (loop, recursion, space, algorithm) operates on
 * the IR independently. The engine collects their results and
 * merges them into a final complexity report.
 */

import { getParser, isLanguageSupported } from '../parsers/parser-factory.js';
import { markRecursiveCalls, buildCallGraph, detectMutualRecursion, maxLoopDepth } from '../ir/builder.js';
import { BigO, max } from './complexity-algebra.js';
import { ConfidenceEngine } from './confidence-engine.js';

export class ComplexityEngine {
  /**
   * @param {object} [options]
   * @param {object[]} [options.analyzers] - Array of analyzer instances
   */
  constructor(options = {}) {
    this.analyzers = options.analyzers || [];
  }

  /**
   * Register an analyzer.
   * Analyzers must implement: analyze(ir, context) → AnalysisResult
   * @param {object} analyzer
   * @returns {ComplexityEngine}
   */
  use(analyzer) {
    this.analyzers.push(analyzer);
    return this;
  }

  /**
   * Analyze source code and return complexity results.
   *
   * @param {string} sourceCode
   * @param {object} [options]
   * @param {string} [options.language] - Language identifier (auto-detected if omitted)
   * @returns {AnalysisReport}
   */
  analyze(sourceCode, options = {}) {
    const language = options.language;
    if (!language) {
      throw new Error('Language must be specified. Supported: c, cpp, java, python');
    }

    if (!isLanguageSupported(language)) {
      throw new Error(`Unsupported language: "${language}". Supported: c, cpp, java, python`);
    }

    // ── Step 1: Parse ──────────────────────────────────────
    const parser = getParser(language);
    const ir = parser.parse(sourceCode);

    // ── Step 2: Enrich IR ──────────────────────────────────
    markRecursiveCalls(ir);
    const callGraph = buildCallGraph(ir);
    const mutualRecursionCycles = detectMutualRecursion(callGraph);

    // Build context for analyzers
    const context = {
      language,
      sourceCode,
      callGraph,
      mutualRecursionCycles,
    };

    // ── Step 3: Run analyzers ──────────────────────────────
    const analyzerResults = [];
    for (const analyzer of this.analyzers) {
      try {
        const result = analyzer.analyze(ir, context);
        if (result) analyzerResults.push(result);
      } catch (err) {
        analyzerResults.push({
          analyzerName: analyzer.name || 'unknown',
          error: err.message,
        });
      }
    }

    // ── Step 4: Build report ───────────────────────────────
    return this.buildReport(ir, context, analyzerResults);
  }

  /**
   * Build the final analysis report from analyzer results.
   * @param {ProgramNode} ir
   * @param {object} context
   * @param {object[]} analyzerResults
   * @returns {AnalysisReport}
   */
  buildReport(ir, context, analyzerResults) {
    const functionReports = [];

    for (const func of ir.functions) {
      const funcResult = this.buildFunctionReport(func, analyzerResults);
      functionReports.push(funcResult);
    }

    // Overall complexity = max across all functions
    const allComplexities = functionReports
      .map(f => f.timeComplexity)
      .filter(c => c && !c.isUnknown());

    const overallComplexity = allComplexities.length > 0
      ? max(allComplexities)
      : BigO.UNKNOWN();

    return {
      language: context.language,
      functions: functionReports,
      overall: {
        timeComplexity: overallComplexity,
        display: overallComplexity.toString(),
      },
      metadata: {
        functionCount: ir.functions.length,
        loopDepth: ir.functions.reduce((m, f) => Math.max(m, maxLoopDepth(f)), 0),
        hasRecursion: ir.functions.some(f => f.isRecursive),
        hasMutualRecursion: context.mutualRecursionCycles.length > 0,
      },
      analyzerResults,
    };
  }

  /**
   * Build a per-function complexity report.
   * @param {FunctionNode} func
   * @param {object[]} analyzerResults
   * @returns {object}
   */
  buildFunctionReport(func, analyzerResults) {
    // Collect per-function results from each analyzer
    const functionResults = analyzerResults
      .filter(r => r.functionResults)
      .flatMap(r => r.functionResults)
      .filter(r => r.functionName === func.name);

    // Take the max complexity from all analyzers
    const complexities = functionResults
      .map(r => r.complexity)
      .filter(c => c && !c.isUnknown());

    const timeComplexity = complexities.length > 0
      ? max(complexities)
      : BigO.O1();

    // Merge confidence from all analyzers
    const confidences = functionResults
      .map(r => r.confidence)
      .filter(c => c);
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c.score, 0) / confidences.length
      : 0.5;

    // Collect all reasoning steps
    const reasoning = functionResults
      .flatMap(r => r.reasoning || []);

    return {
      name: func.name,
      params: func.params,
      timeComplexity,
      display: timeComplexity.toString(),
      confidence: {
        score: Math.round(avgConfidence * 100) / 100,
        level: avgConfidence >= 0.75 ? 'high' : avgConfidence >= 0.5 ? 'medium' : 'low',
      },
      isRecursive: func.isRecursive,
      loopDepth: maxLoopDepth(func),
      reasoning,
    };
  }
}

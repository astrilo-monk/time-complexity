/**
 * Pattern Detector - Algorithm archetype identification from IR structures
 *
 * Identifies known algorithm patterns by analyzing structural signatures
 * in the IR tree. This is heuristic-based pattern matching, not exact
 * algorithm identification.
 *
 * Detected patterns:
 *   binary-search      - Halving recursion or while-loop with mid calculation
 *   bubble-sort        - Nested loops with adjacent swap in branch
 *   merge-sort         - 2x f(n/2) recursive calls with O(n) merge loop
 *   divide-and-conquer - 2+ recursive calls with halving reduction
 *   backtracking       - 2 sequential recursive calls with subtractive reduction
 *   two-pointer        - Loop with two moving indices (left/right, lo/hi)
 *   matrix-traversal   - Triple nested loops or 2 nested with array access
 *   accumulation       - Single loop updating an accumulator variable
 *   linear-search      - Single loop with comparison branch and early return/break
 *
 * Each detected pattern includes a confidence level and reasoning string.
 * A single function can match multiple patterns (e.g. merge-sort is also
 * divide-and-conquer).
 */

import { BigO } from '../core/complexity-algebra.js';
import { ConfidenceEngine } from '../core/confidence-engine.js';
import { maxLoopDepth, collectLoops } from '../ir/builder.js';

export class PatternDetector {
  constructor() {
    this.name = 'pattern-detector';
  }

  /**
   * Analyze the full IR for algorithm patterns.
   * @param {ProgramNode} ir
   * @param {object} context
   * @returns {{ analyzerName: string, functionResults: object[] }}
   */
  analyze(ir, context) {
    const functionResults = [];

    for (const func of ir.functions) {
      const result = this.analyzeFunction(func, ir, context);
      functionResults.push(result);
    }

    return {
      analyzerName: this.name,
      functionResults,
    };
  }

  /**
   * Analyze a single function for algorithm patterns.
   * Runs all pattern matchers and collects hits.
   * @param {FunctionNode} func
   * @param {ProgramNode} ir
   * @param {object} context
   * @returns {object}
   */
  analyzeFunction(func, ir, context) {
    const patterns = [];
    const reasoning = [];
    const confidence = new ConfidenceEngine();

    // Run all detectors
    const detectors = [
      () => this.detectBinarySearch(func),
      () => this.detectMergeSort(func),
      () => this.detectDivideAndConquer(func),
      () => this.detectBubbleSort(func),
      () => this.detectBacktracking(func),
      () => this.detectTwoPointer(func),
      () => this.detectMatrixTraversal(func),
      () => this.detectLinearSearch(func),
      () => this.detectAccumulation(func),
      () => this.detectBuiltInAlgorithms(func),
    ];

    for (const detect of detectors) {
      try {
        const match = detect();
        if (match) {
          patterns.push(match);
          reasoning.push(`Detected pattern: ${match.pattern} (${match.confidence}) - ${match.reasoning}`);
          if (match.confidence === 'high') {
            confidence.addSignal('known_pattern', `Recognized ${match.pattern}`);
          }
        }
      } catch (_err) {
        // Pattern detection should never crash the pipeline
      }
    }

    if (patterns.length === 0) {
      reasoning.push('No known algorithm patterns detected.');
    }

    // Default to UNKNOWN, but let patterns override it if they represent a known complexity
    let finalComplexity = BigO.UNKNOWN();
    for (const match of patterns) {
      if (match.complexity && match.complexity.orderIndex > finalComplexity.orderIndex) {
        finalComplexity = match.complexity;
      }
    }

    return {
      functionName: func.name,
      patterns,
      complexity: finalComplexity,
      confidence: confidence.calculate(),
      reasoning,
    };
  }

  // ---- Pattern Detectors ----

  /**
   * Detect binary search pattern.
   * Signature: recursive f(n/2) with single call + branch, OR
   *            while loop with a mid variable and halving.
   * @param {FunctionNode} func
   * @returns {object|null}
   */
  detectBinarySearch(func) {
    if (!func.body) return null;

    // Recursive binary search: single call with halving + branch
    if (func.isRecursive && func.recursiveCalls.length === 1) {
      const call = func.recursiveCalls[0];
      const hasHalving = call.arguments.some(arg =>
        /\w+\s*\/\/?=?\s*2/.test(String(arg))
      );
      if (hasHalving) {
        const branches = func.body.findAll(n => n.type === 'branch');
        if (branches.length > 0) {
          return {
            pattern: 'binary-search',
            confidence: 'high',
            reasoning: 'Recursive function with single f(n/2) call and comparison branch.',
          };
        }
      }
    }

    // Iterative binary search: while loop with mid variable
    const loops = func.body.findAll(n => n.type === 'loop');
    for (const loop of loops) {
      if (loop.loopType === 'while') {
        const vars = loop.findAll(n => n.type === 'variable');
        const hasMid = vars.some(v => /^mid$/i.test(v.name));
        const hasBranch = loop.findAll(n => n.type === 'branch').length > 0;
        if (hasMid && hasBranch) {
          return {
            pattern: 'binary-search',
            confidence: 'medium',
            reasoning: 'While loop with mid variable and comparison branch.',
          };
        }
      }
    }

    return null;
  }

  /**
   * Detect merge sort pattern.
   * Signature: 2 recursive calls with halving + a loop in the body (merge step).
   * @param {FunctionNode} func
   * @returns {object|null}
   */
  detectMergeSort(func) {
    if (!func.isRecursive || func.recursiveCalls.length !== 2) return null;

    // Both calls should be halving
    const halvingCalls = func.recursiveCalls.filter(c =>
      c.arguments.some(arg => /\w+\s*\/\/?=?\s*2/.test(String(arg)))
    );
    if (halvingCalls.length < 2) return null;

    // Should have a loop in the body (the merge step)
    const loops = func.body ? func.body.findAll(n => n.type === 'loop') : [];
    if (loops.length > 0) {
      return {
        pattern: 'merge-sort',
        confidence: 'high',
        reasoning: '2 recursive calls with n/2 reduction plus merge loop.',
      };
    }

    return null;
  }

  /**
   * Detect generic divide-and-conquer pattern.
   * Signature: 2+ recursive calls with halving reduction.
   * @param {FunctionNode} func
   * @returns {object|null}
   */
  detectDivideAndConquer(func) {
    if (!func.isRecursive || func.recursiveCalls.length < 2) return null;

    const halvingCalls = func.recursiveCalls.filter(c =>
      c.arguments.some(arg => {
        const text = String(arg);
        return /\w+\s*\/\/?=?\s*\d+/.test(text) ||
               /^(mid|left|right|lo|hi|low|high)$/i.test(text.trim());
      })
    );

    if (halvingCalls.length >= 2) {
      return {
        pattern: 'divide-and-conquer',
        confidence: 'medium',
        reasoning: `${halvingCalls.length} recursive calls with problem-size division.`,
      };
    }

    return null;
  }

  /**
   * Detect bubble sort pattern.
   * Signature: two nested for-loops where inner loop body has a branch
   * with swap-like assignments (temp variable or adjacent element swap).
   * @param {FunctionNode} func
   * @returns {object|null}
   */
  detectBubbleSort(func) {
    if (!func.body) return null;

    const outerLoops = func.body.findAll(n => n.type === 'loop');
    for (const outer of outerLoops) {
      if (outer.loopType !== 'for' && outer.loopType !== 'for-each') continue;

      const innerLoops = outer.findAll(n => n.type === 'loop' && n !== outer);
      for (const inner of innerLoops) {
        // Look for a branch inside the inner loop (comparison)
        const branches = inner.findAll(n => n.type === 'branch');
        if (branches.length === 0) continue;

        // Look for swap pattern: 2+ assignments inside the branch
        for (const branch of branches) {
          const assignments = branch.findAll(n =>
            n.type === 'variable' && n.kind === 'assignment'
          );
          // Also count declarations that look like temp
          const tempDecls = branch.findAll(n =>
            n.type === 'variable' && n.kind === 'declaration' &&
            /^(temp|tmp|t)$/i.test(n.name)
          );
          if (assignments.length >= 2 || tempDecls.length >= 1) {
            return {
              pattern: 'bubble-sort',
              confidence: 'high',
              reasoning: 'Nested loops with comparison branch and element swap.',
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Detect backtracking / subset generation pattern.
   * Signature: 2 sequential recursive calls with subtractive reduction (n-1, index+1).
   * Both calls are NOT in exclusive branches (they're sequential).
   * @param {FunctionNode} func
   * @returns {object|null}
   */
  detectBacktracking(func) {
    if (!func.isRecursive || func.recursiveCalls.length !== 2) return null;

    // Both calls should have subtractive reduction (n-1 or index+1)
    const subtractiveCount = func.recursiveCalls.filter(c =>
      c.arguments.some(arg => {
        const text = String(arg).trim();
        return /\w+\s*[-+]\s*1\b/.test(text);
      })
    ).length;

    if (subtractiveCount === 2) {
      // Check that calls have the same reduction (sequential, not exclusive)
      const reductions = func.recursiveCalls.map(c => {
        for (const arg of c.arguments) {
          const text = String(arg).trim();
          if (/\w+\s*[-+]\s*1\b/.test(text)) return text;
        }
        return null;
      });

      // If both reductions look similar, it's likely backtracking
      if (reductions[0] && reductions[1]) {
        return {
          pattern: 'backtracking',
          confidence: 'medium',
          reasoning: '2 sequential recursive calls with subtractive reduction (choose/skip pattern).',
        };
      }
    }

    return null;
  }

  /**
   * Detect two-pointer / sliding window pattern.
   * Signature: a loop with two pointer-like variables (left/right, lo/hi, i/j, start/end).
   * @param {FunctionNode} func
   * @returns {object|null}
   */
  detectTwoPointer(func) {
    if (!func.body) return null;

    const pointerPairs = [
      ['left', 'right'], ['lo', 'hi'], ['low', 'high'],
      ['start', 'end'], ['l', 'r'], ['i', 'j'],
    ];

    const loops = func.body.findAll(n => n.type === 'loop');
    for (const loop of loops) {
      if (loop.loopType !== 'while') continue;

      const vars = loop.findAll(n => n.type === 'variable');
      const varNames = new Set(vars.map(v => v.name.toLowerCase()));

      for (const [a, b] of pointerPairs) {
        if (varNames.has(a) && varNames.has(b)) {
          return {
            pattern: 'two-pointer',
            confidence: 'medium',
            reasoning: `While loop with pointer variables "${a}" and "${b}".`,
          };
        }
      }
    }

    // Also check for two pointer variables declared before a loop
    const allVars = func.body.findAll(n => n.type === 'variable');
    const declaredNames = new Set(
      allVars.filter(v => v.kind === 'declaration').map(v => v.name.toLowerCase())
    );

    for (const [a, b] of pointerPairs) {
      if (declaredNames.has(a) && declaredNames.has(b) && loops.length > 0) {
        return {
          pattern: 'two-pointer',
          confidence: 'low',
          reasoning: `Variables "${a}" and "${b}" declared with loop present.`,
        };
      }
    }

    return null;
  }

  /**
   * Detect matrix traversal pattern.
   * Signature: triple nested loops (depth >= 3), or two nested loops
   * accessing array-like structures.
   * @param {FunctionNode} func
   * @returns {object|null}
   */
  detectMatrixTraversal(func) {
    if (!func.body) return null;

    const depth = maxLoopDepth(func);

    if (depth >= 3) {
      return {
        pattern: 'matrix-traversal',
        confidence: 'medium',
        reasoning: `Triple nested loops (depth ${depth}) - likely matrix operation.`,
      };
    }

    if (depth === 2) {
      // Check for array/matrix-like variable names
      const vars = func.body.findAll(n => n.type === 'variable');
      const matrixHints = vars.some(v =>
        /^(matrix|mat|grid|board|table|arr|a|m|dp)$/i.test(v.name)
      );
      if (matrixHints) {
        return {
          pattern: 'matrix-traversal',
          confidence: 'low',
          reasoning: 'Two nested loops with matrix-like variable names.',
        };
      }
    }

    return null;
  }

  /**
   * Detect linear search / scan pattern.
   * Signature: single loop with a comparison branch that contains
   * a return or break statement (early exit on match).
   * @param {FunctionNode} func
   * @returns {object|null}
   */
  detectLinearSearch(func) {
    if (!func.body) return null;

    const loops = func.body.findAll(n => n.type === 'loop');

    for (const loop of loops) {
      // Skip if this loop contains nested loops (not a simple scan)
      const innerLoops = loop.findAll(n => n.type === 'loop' && n !== loop);
      if (innerLoops.length > 0) continue;

      const branches = loop.findAll(n => n.type === 'branch');
      for (const branch of branches) {
        const hasEarlyExit =
          branch.findAll(n => n.type === 'return').length > 0 ||
          branch.findAll(n => n.type === 'break').length > 0;

        if (hasEarlyExit) {
          return {
            pattern: 'linear-search',
            confidence: 'medium',
            reasoning: 'Loop with comparison branch and early return/break.',
          };
        }
      }
    }

    return null;
  }

  /**
   * Detect accumulation / reduction pattern.
   * Signature: single loop with an accumulator variable (sum, count, max, min,
   * result, total, product, ans, res) being updated each iteration.
   * @param {FunctionNode} func
   * @returns {object|null}
   */
  detectAccumulation(func) {
    if (!func.body) return null;

    const accumulatorNames = /^(sum|count|total|result|product|ans|res|acc|max_val|min_val|average|avg|ret)$/i;

    // Look for a variable with accumulator-like name at the top level,
    // then check if it's updated inside a loop.
    // Check both declarations and assignments since Python doesn't
    // distinguish them (count = 0 is 'assignment' not 'declaration').
    const topVars = func.body.children.filter(n =>
      n.type === 'variable' && (n.kind === 'declaration' || n.kind === 'assignment')
    );
    const accumulators = topVars.filter(v => accumulatorNames.test(v.name));

    if (accumulators.length === 0) return null;

    const loops = func.body.findAll(n => n.type === 'loop');
    for (const loop of loops) {
      // Skip nested loops
      const innerLoops = loop.findAll(n => n.type === 'loop' && n !== loop);
      if (innerLoops.length > 0) continue;

      const loopAssignments = loop.findAll(n =>
        n.type === 'variable' && n.kind === 'assignment'
      );

      for (const acc of accumulators) {
        const updated = loopAssignments.some(a => a.name === acc.name);
        if (updated) {
          return {
            pattern: 'accumulation',
            confidence: 'high',
            reasoning: `Loop updates accumulator variable "${acc.name}".`,
          };
        }
      }
    }

    return null;
  }

  /**
   * Detect built-in algorithm calls (like sort) and return their specific time complexity.
   * @param {FunctionNode} func
   * @returns {object|null}
   */
  detectBuiltInAlgorithms(func) {
    if (!func.body) return null;

    const calls = func.body.findAll(n => n.type === 'call');
    for (const call of calls) {
      const name = call.functionName ? call.functionName.toLowerCase() : '';
      
      // Check for common O(n log n) sorts
      if (name === 'sort' || name === 'sorted' || name === 'arrays.sort' || name === 'collections.sort' || name.endsWith('.sort')) {
        return {
          pattern: 'built-in-sort',
          confidence: 'high',
          complexity: BigO.NLOGN(),
          reasoning: `Call to built-in sort function (${call.functionName}) contributes O(n log n) time.`,
        };
      }
    }

    return null;
  }
}

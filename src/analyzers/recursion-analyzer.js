/**
 * Recursion Analyzer - Time complexity estimation from recursive structures
 *
 * Detects recursive functions and estimates complexity by analyzing:
 *   - Number of recursive calls per invocation
 *   - Problem-size reduction pattern (n-1, n/2, etc.)
 *   - Presence of base cases
 *   - Recursion combined with loops
 *
 * Supported patterns:
 *   O(n)     - Linear recursion: f(n-1) with O(1) work
 *   O(n²)    - Linear recursion: f(n-1) with O(n) work per call
 *   O(log n) - Halving recursion: f(n/2) with O(1) work, single call
 *   O(n log n)- Halving recursion: f(n/2) with O(n) work, or 2 calls to f(n/2) with O(n) merge
 *   O(2ⁿ)    - Binary recursion: f(n-1) + f(n-1) (Fibonacci-style)
 *   O(n)     - Tail recursion: f(n-1) with accumulator
 *
 * Uses a simplified Master Theorem approach:
 *   T(n) = a * T(n/b) + O(n^d)
 *   where a = # recursive calls, b = division factor, d = work exponent
 */

import { BigO } from '../core/complexity-algebra.js';
import { ConfidenceEngine } from '../core/confidence-engine.js';
import { maxLoopDepth } from '../ir/builder.js';

export class RecursionAnalyzer {
  constructor() {
    this.name = 'recursion-analyzer';
  }

  /**
   * Analyze the full IR for recursion-based time complexity.
   * Only analyzes functions marked as recursive.
   * @param {ProgramNode} ir
   * @param {object} context
   * @returns {{ analyzerName: string, functionResults: object[] }}
   */
  analyze(ir, context) {
    const functionResults = [];

    for (const func of ir.functions) {
      if (!func.isRecursive) continue;

      const result = this.analyzeFunction(func, ir, context);
      functionResults.push(result);
    }

    return {
      analyzerName: this.name,
      functionResults,
    };
  }

  /**
   * Analyze a single recursive function.
   * @param {FunctionNode} func
   * @param {ProgramNode} ir
   * @param {object} context
   * @returns {object}
   */
  analyzeFunction(func, ir, context) {
    const reasoning = [];
    const confidence = new ConfidenceEngine();

    reasoning.push(`Function "${func.name}" is recursive.`);

    // ── Step 1: Count recursive calls ──────────────────────
    const recursiveCalls = func.recursiveCalls || [];
    const callCount = recursiveCalls.length;
    reasoning.push(`Found ${callCount} recursive call(s).`);

    // ── Step 2: Detect base case ───────────────────────────
    const hasBaseCase = this.detectBaseCase(func);
    if (hasBaseCase) {
      reasoning.push('Base case detected.');
      confidence.addSignal('base_case_found', 'Recursion has a clear base case');
      confidence.addSignal('termination_certain', 'Base case guarantees termination');
    } else {
      reasoning.push('⚠ No obvious base case found - termination uncertain.');
    }

    // ── Step 3: Classify the recursion type ────────────────
    const classification = this.classifyRecursion(func, recursiveCalls, reasoning, confidence);

    // ── Step 4: Detect work done per call (loops in body) ──
    const workPerCall = this.estimateWorkPerCall(func, reasoning);

    // ── Step 5: Estimate complexity ────────────────────────
    const complexity = this.estimateComplexity(
      classification, workPerCall, callCount, reasoning, confidence
    );

    return {
      functionName: func.name,
      complexity,
      confidence: confidence.calculate(),
      reasoning,
      recursionType: classification.type,
      callCount,
      hasBaseCase,
    };
  }

  /**
   * Detect if the function has a base case.
   * Looks for return statements inside branches (if/else) that
   * don't contain recursive calls.
   *
   * @param {FunctionNode} func
   * @returns {boolean}
   */
  detectBaseCase(func) {
    if (!func.body) return false;

    const branches = func.body.findAll(n => n.type === 'branch');

    for (const branch of branches) {
      // Check if either branch path has a return without recursive calls
      const hasNonRecursiveReturn = this.hasReturnWithoutRecursion(
        branch.consequence, func.name
      );
      const altHasNonRecursiveReturn = this.hasReturnWithoutRecursion(
        branch.alternative, func.name
      );

      if (hasNonRecursiveReturn || altHasNonRecursiveReturn) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a subtree has a return statement that doesn't contain
   * a recursive call.
   * @param {IRNode} node
   * @param {string} funcName
   * @returns {boolean}
   */
  hasReturnWithoutRecursion(node, funcName) {
    if (!node) return false;

    const returns = node.findAll(n => n.type === 'return');
    for (const ret of returns) {
      const calls = ret.findAll(n => n.type === 'call' && n.functionName === funcName);
      if (calls.length === 0) {
        return true; // Return without recursive call = base case
      }
    }

    return false;
  }

  /**
   * Classify the recursion pattern.
   *
   * Returns:
   *   { type: 'linear'|'binary'|'tail'|'divide'|'multiple', reductionFactor, ... }
   *
   * @param {FunctionNode} func
   * @param {CallNode[]} recursiveCalls
   * @param {string[]} reasoning
   * @param {ConfidenceEngine} confidence
   * @returns {object}
   */
  classifyRecursion(func, recursiveCalls, reasoning, confidence) {
    const callCount = recursiveCalls.length;

    // Analyze arguments to detect reduction pattern
    const reductions = this.analyzeReductionPatterns(func, recursiveCalls);

    // ── Tail recursion ─────────────────────────────────────
    if (callCount === 1 && this.isTailRecursive(func, recursiveCalls[0])) {
      reasoning.push('Pattern: tail recursion (last operation is the recursive call).');
      confidence.addSignal('known_pattern', 'Recognized tail recursion pattern');

      if (reductions.type === 'subtractive') {
        reasoning.push(`Reduction: n - ${reductions.value} per call.`);
        return { type: 'tail', reductionType: 'subtractive', reductionValue: reductions.value };
      }
      if (reductions.type === 'halving') {
        reasoning.push(`Reduction: n / ${reductions.value} per call.`);
        return { type: 'tail', reductionType: 'halving', reductionValue: reductions.value };
      }

      reasoning.push('Reduction pattern not fully determined - assuming subtractive.');
      return { type: 'tail', reductionType: 'subtractive', reductionValue: 1 };
    }

    // ── Single recursive call (linear or divide) ──────────
    if (callCount === 1) {
      if (reductions.type === 'halving') {
        reasoning.push(`Pattern: divide recursion - single call with n / ${reductions.value}.`);
        confidence.addSignal('known_pattern', 'Recognized divide-and-conquer (single call)');
        return { type: 'divide', reductionType: 'halving', reductionValue: reductions.value };
      }

      reasoning.push(`Pattern: linear recursion - single call with n - ${reductions.value || 1}.`);
      confidence.addSignal('known_pattern', 'Recognized linear recursion');
      return { type: 'linear', reductionType: 'subtractive', reductionValue: reductions.value || 1 };
    }

    // ── Two recursive calls ───────────────────────────────
    if (callCount === 2) {
      // Check if calls are in mutually exclusive branches.
      // If each call uses a different reduction pattern (e.g. n/2 vs n-1),
      // they are in separate if/else branches and only one runs per invocation.
      const perCallReductions = this.analyzeReductionPerCall(func, recursiveCalls);
      const isExclusive = this.areCallsMutuallyExclusive(func.body, recursiveCalls[0], recursiveCalls[1]);

      if (isExclusive || (perCallReductions.length === 2 &&
          perCallReductions[0].type && perCallReductions[1].type &&
          perCallReductions[0].type !== perCallReductions[1].type)) {
        // Mutually exclusive branches - effective call count = 1
        // Use the dominant (faster-reducing) pattern
        const dominant = perCallReductions.find(r => r.type === 'halving') || perCallReductions[0];
        reasoning.push(
          `Pattern: branched recursion - 2 calls in exclusive branches, only 1 runs per invocation.`
        );
        reasoning.push(`Dominant reduction: n / ${dominant.value || 1} per call.`);
        confidence.addSignal('known_pattern', 'Recognized exclusive-branch recursion');

        if (dominant.type === 'halving') {
          return { type: 'divide', reductionType: 'halving', reductionValue: dominant.value, callCount: 1 };
        }
        return { type: 'linear', reductionType: 'subtractive', reductionValue: dominant.value };
      }

      if (reductions.type === 'halving') {
        reasoning.push(`Pattern: divide-and-conquer - 2 calls with n / ${reductions.value}.`);
        confidence.addSignal('known_pattern', 'Recognized divide-and-conquer (merge sort style)');
        return { type: 'divide', reductionType: 'halving', reductionValue: reductions.value, callCount: 2 };
      }

      reasoning.push('Pattern: binary recursion - 2 calls with subtractive reduction.');
      confidence.addSignal('known_pattern', 'Recognized binary tree recursion');
      confidence.addSignal('multiple_recursive_calls', 'Two recursive calls per invocation');
      return { type: 'binary', reductionType: 'subtractive', reductionValue: reductions.value || 1 };
    }

    // ── Three or more recursive calls ─────────────────────
    reasoning.push(`Pattern: multiple recursion - ${callCount} recursive calls.`);
    confidence.addSignal('multiple_recursive_calls', `${callCount} recursive calls per invocation`);
    return { type: 'multiple', reductionType: reductions.type || 'subtractive', reductionValue: reductions.value || 1, callCount };
  }

  /**
   * Analyze the arguments of recursive calls to detect
   * how the problem size is reduced.
   *
   * Looks for patterns like:
   *   f(n - 1)  → subtractive, value=1
   *   f(n - 2)  → subtractive, value=2
   *   f(n / 2)  → halving, value=2
   *   f(n // 2) → halving, value=2 (Python)
   *   f(mid)    → halving, value=2 (heuristic)
   *
   * @param {FunctionNode} func
   * @param {CallNode[]} recursiveCalls
   * @returns {{ type: string, value: number }}
   */
  analyzeReductionPatterns(func, recursiveCalls) {
    for (const call of recursiveCalls) {
      if (!call.arguments || call.arguments.length === 0) continue;

      // Check each argument for reduction patterns
      for (const arg of call.arguments) {
        const text = String(arg).trim();

        // n / 2, n // 2, n/2
        if (/\w+\s*\/\/?=?\s*2/.test(text)) {
          return { type: 'halving', value: 2 };
        }

        // n / 3, etc.
        const divMatch = text.match(/\w+\s*\/\/?=?\s*(\d+)/);
        if (divMatch && parseInt(divMatch[1]) > 1) {
          return { type: 'halving', value: parseInt(divMatch[1]) };
        }

        // mid, left, right - heuristic for binary search / merge sort
        if (/\b(mid|left|right|lo|hi|low|high)\b/i.test(text)) {
          return { type: 'halving', value: 2 };
        }

        // n - 1, n-1
        if (/\w+\s*-\s*1\b/.test(text)) {
          return { type: 'subtractive', value: 1 };
        }

        // n - 2, n-2
        const subMatch = text.match(/\w+\s*-\s*(\d+)/);
        if (subMatch) {
          return { type: 'subtractive', value: parseInt(subMatch[1]) };
        }
      }
    }

    return { type: null, value: null };
  }

  /**
   * Analyze reduction pattern for EACH call individually.
   * Used to detect exclusive branches (e.g. fast exponentiation:
   * one branch does n/2, the other does n-1).
   *
   * @param {FunctionNode} func
   * @param {CallNode[]} recursiveCalls
   * @returns {{ type: string, value: number }[]}
   */
  analyzeReductionPerCall(func, recursiveCalls) {
    return recursiveCalls.map(call => {
      if (!call.arguments || call.arguments.length === 0) {
        return { type: null, value: null };
      }

      for (const arg of call.arguments) {
        const text = String(arg).trim();

        if (/\w+\s*\/\/?=?\s*2/.test(text)) {
          return { type: 'halving', value: 2 };
        }
        const divMatch = text.match(/\w+\s*\/\/?=?\s*(\d+)/);
        if (divMatch && parseInt(divMatch[1]) > 1) {
          return { type: 'halving', value: parseInt(divMatch[1]) };
        }
        if (/\b(mid|left|right|lo|hi|low|high)\b/i.test(text)) {
          return { type: 'halving', value: 2 };
        }
        if (/\w+\s*-\s*1\b/.test(text)) {
          return { type: 'subtractive', value: 1 };
        }
        const subMatch = text.match(/\w+\s*-\s*(\d+)/);
        if (subMatch) {
          return { type: 'subtractive', value: parseInt(subMatch[1]) };
        }
      }

      return { type: null, value: null };
    });
  }

  /**
   * Determine if two calls are mutually exclusive by walking the IR tree.
   * They are mutually exclusive if they are on different sides of a branch,
   * or if one is after a guaranteed return statement.
   * @param {IRNode} node
   * @param {CallNode} call1
   * @param {CallNode} call2
   * @returns {boolean}
   */
  areCallsMutuallyExclusive(node, call1, call2) {
    if (!node) return false;

    // Check if both calls are inside this node
    const containsCall1 = node.findAll(n => n === call1).length > 0;
    const containsCall2 = node.findAll(n => n === call2).length > 0;

    if (!containsCall1 || !containsCall2) return false;

    // If it's a branch, check if they are in opposite sides
    if (node.type === 'branch') {
      const inConsequence1 = node.consequence && node.consequence.findAll(n => n === call1).length > 0;
      const inConsequence2 = node.consequence && node.consequence.findAll(n => n === call2).length > 0;
      const inAlternative1 = node.alternative && node.alternative.findAll(n => n === call1).length > 0;
      const inAlternative2 = node.alternative && node.alternative.findAll(n => n === call2).length > 0;

      if ((inConsequence1 && inAlternative2) || (inAlternative1 && inConsequence2)) {
        return true;
      }
    }

    // Check children
    for (const child of node.children) {
      if (this.areCallsMutuallyExclusive(child, call1, call2)) return true;
    }

    // Heuristic: If it's a block, and the first call is returned, the second won't execute in same branch
    if (node.type === 'block') {
      let sawReturnedCall1 = false;
      let sawReturnedCall2 = false;
      for (const stmt of node.children) {
        if (stmt.type === 'return') {
           if (stmt.findAll(n => n === call1).length > 0) sawReturnedCall1 = true;
           if (stmt.findAll(n => n === call2).length > 0) sawReturnedCall2 = true;
        } else if (stmt.type === 'branch') {
           const branchReturns1 = stmt.findAll(n => n.type === 'return' && n.findAll(c => c === call1).length > 0).length > 0;
           if (branchReturns1) sawReturnedCall1 = true;
        }

        // If we previously saw call1 in a return statement, and now we see call2 in a subsequent statement,
        // then call2 is unreachable or mutually exclusive.
        if (sawReturnedCall1 && stmt.findAll(n => n === call2).length > 0) return true;
        if (sawReturnedCall2 && stmt.findAll(n => n === call1).length > 0) return true;
      }
    }

    return false;
  }

  /**
   * Check if the recursion is tail-recursive.
   * A call is tail-recursive if it's the last operation in the function
   * (the return value IS the recursive call, no further computation).
   *
   * @param {FunctionNode} func
   * @param {CallNode} call
   * @returns {boolean}
   */
  isTailRecursive(func, call) {
    if (!func.body) return false;

    // Find return nodes that contain this recursive call
    const returns = func.body.findAll(n => n.type === 'return');

    for (const ret of returns) {
      const retCalls = ret.findAll(n => n.type === 'call' && n.functionName === func.name);
      if (retCalls.length === 1) {
        // Check if the return value is JUST the call (no surrounding expression)
        const retValue = ret.value || '';
        const callText = `${func.name}(`;
        if (retValue.trim().startsWith(callText)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Estimate the work done per recursive call (excluding the recursive calls themselves).
   * This is the O(n^d) component of the Master Theorem.
   *
   * @param {FunctionNode} func
   * @param {string[]} reasoning
   * @returns {BigO}
   */
  estimateWorkPerCall(func, reasoning) {
    if (!func.body) return BigO.O1();

    // Count loops in the function body
    const loops = func.body.findAll(n => n.type === 'loop');
    
    // Check for explicit allocations that cost time (like slicing or list copies)
    const allocations = func.body.findAll(n => n.type === 'allocation');
    let maxAllocWork = BigO.O1();
    let maxAllocReason = null;
    for (const alloc of allocations) {
      if (alloc.sizeExpression) {
        const size = alloc.sizeExpression.trim();
        if (/^[a-zA-Z_]\w*\s*\*\s*[a-zA-Z_]\w*$/.test(size)) {
          maxAllocWork = BigO.N2();
          maxAllocReason = `Work per call: O(n²) - detected O(n²) allocation ("${size}") in the function body.`;
        } else if (/[a-zA-Z]/.test(size) && !/^\d+$/.test(size)) {
          if (maxAllocWork.orderIndex < BigO.N().orderIndex) {
            maxAllocWork = BigO.N();
            maxAllocReason = `Work per call: O(n) - detected O(n) allocation ("${size}") in the function body.`;
          }
        }
      }
    }
    
    // Heuristic: Check for common O(n) helper calls like merge or partition
    const calls = func.body.findAll(n => n.type === 'call');
    const helperCall = calls.find(c => c.functionName && /^(merge|partition)$/i.test(c.functionName));
    
    if (loops.length === 0 && !helperCall && maxAllocWork.isConstant()) {
      reasoning.push('Work per call: O(1) - no loops, allocations, or O(n) helpers in the function body.');
      return BigO.O1();
    }
    
    // Max work among loops, helpers, and allocations
    if (loops.length > 0) {
      const depth = maxLoopDepth(func);
      if (depth >= 2) {
        reasoning.push(`Work per call: O(n²) - nested loops (depth ${depth}) in the function body.`);
        return BigO.N2();
      }
    }
    
    if (maxAllocWork.orderIndex === BigO.N2().orderIndex) {
      reasoning.push(maxAllocReason);
      return maxAllocWork;
    }
    
    if (helperCall) {
      reasoning.push(`Work per call: O(n) - detected call to helper function "${helperCall.functionName}".`);
      return BigO.N();
    }
    
    if (maxAllocWork.orderIndex === BigO.N().orderIndex) {
      reasoning.push(maxAllocReason);
      return maxAllocWork;
    }

    reasoning.push('Work per call: O(n) - loop found in the function body.');
    return BigO.N();
  }

  /**
   * Estimate overall complexity from the recursion classification and work per call.
   *
   * Uses simplified Master Theorem:
   *   T(n) = a * T(n/b) + O(n^d)
   *
   *   Case 1: a < b^d  → O(n^d)
   *   Case 2: a = b^d  → O(n^d * log n)
   *   Case 3: a > b^d  → O(n^(log_b(a)))
   *
   * For subtractive recursion (n-k):
   *   Single call: T(n) = T(n-1) + work → work * n
   *   Two calls:   T(n) = T(n-1) + T(n-2) + work → O(2^n)
   *
   * @param {object} classification
   * @param {BigO} workPerCall
   * @param {number} callCount
   * @param {string[]} reasoning
   * @param {ConfidenceEngine} confidence
   * @returns {BigO}
   */
  estimateComplexity(classification, workPerCall, callCount, reasoning, confidence) {
    const { type, reductionType, reductionValue } = classification;

    // ── Subtractive recursion (n - k) ─────────────────────
    if (reductionType === 'subtractive') {
      if (type === 'tail') {
        // Tail recursion: equivalent to a loop
        reasoning.push('Tail recursion → equivalent to iteration → O(n).');
        confidence.addSignal('simple_increment', 'Tail recursion is simple iteration');
        return BigO.N();
      }

      if (type === 'linear' || callCount === 1) {
        // T(n) = T(n-1) + O(work) → O(n * work)
        const result = BigO.N().multiply(workPerCall);
        reasoning.push(
          `Linear recursion: T(n) = T(n-${reductionValue}) + ${workPerCall.toString()} → ${result.toString()}.`
        );
        return result;
      }

      if (type === 'binary' || callCount === 2) {
        // T(n) = 2*T(n-1) + O(work) -> O(2^n) (exponential)
        reasoning.push(
          `Binary recursion: T(n) = 2*T(n-${reductionValue}) + ${workPerCall.toString()} -> O(2^n).`
        );
        return BigO.EXP();
      }

      if (callCount >= 3) {
        // Multiple subtractive calls → exponential
        reasoning.push(
          `Multiple recursion (${callCount} calls, n-${reductionValue}): exponential → O(2ⁿ).`
        );
        return BigO.EXP();
      }
    }

    // ── Halving recursion (n / b) ─────────────────────────
    if (reductionType === 'halving') {
      const b = reductionValue || 2;
      const a = classification.callCount || callCount;

      // Work per call complexity as an exponent
      let d = 0;
      if (workPerCall.complexity === 'n') d = 1;
      else if (workPerCall.complexity === 'n^2') d = 2;
      else if (workPerCall.complexity === 'n^3') d = 3;

      return this.applyMasterTheorem(a, b, d, workPerCall, reasoning, confidence);
    }

    // ── Fallback ──────────────────────────────────────────
    reasoning.push('Recursion pattern not fully recognized - assuming O(n).');
    confidence.addSignal('unknown_bounds', 'Recursion pattern not recognized');
    return BigO.N();
  }

  /**
   * Apply the Master Theorem to estimate complexity.
   *
   * T(n) = a * T(n/b) + O(n^d)
   *
   * @param {number} a - Number of recursive calls
   * @param {number} b - Division factor
   * @param {number} d - Work exponent (0=O(1), 1=O(n), 2=O(n²))
   * @param {BigO} workPerCall
   * @param {string[]} reasoning
   * @param {ConfidenceEngine} confidence
   * @returns {BigO}
   */
  applyMasterTheorem(a, b, d, workPerCall, reasoning, confidence) {
    const logba = Math.log(a) / Math.log(b); // log_b(a)

    reasoning.push(
      `Master Theorem: T(n) = ${a} · T(n/${b}) + ${workPerCall.toString()}`
    );
    reasoning.push(
      `  a=${a}, b=${b}, d=${d}, log_b(a)=${logba.toFixed(2)}`
    );

    if (a < Math.pow(b, d)) {
      // Case 1: work dominates
      const result = d === 0 ? BigO.O1() : d === 1 ? BigO.N() : d === 2 ? BigO.N2() : BigO.N3();
      reasoning.push(`  Case 1 (a < b^d): work dominates → ${result.toString()}.`);
      confidence.addSignal('bounds_statically_known', 'Master Theorem Case 1');
      return result;
    }

    if (Math.abs(a - Math.pow(b, d)) < 0.01) {
      // Case 2: balanced - O(n^d * log n)
      let result;
      if (d === 0) {
        result = BigO.LOGN();
      } else if (d === 1) {
        result = BigO.NLOGN();
      } else {
        result = BigO.N2(); // simplified for n^2 * log n ≈ n^2
      }
      reasoning.push(`  Case 2 (a = b^d): balanced → ${result.toString()}.`);
      confidence.addSignal('bounds_statically_known', 'Master Theorem Case 2');
      return result;
    }

    // Case 3: recursion dominates - O(n^(log_b(a)))
    const degree = Math.round(logba);
    let result;
    if (degree <= 0) result = BigO.O1();
    else if (degree === 1) result = BigO.N();
    else if (degree === 2) result = BigO.N2();
    else if (degree === 3) result = BigO.N3();
    else result = BigO.N4();

    reasoning.push(`  Case 3 (a > b^d): recursion dominates → ${result.toString()}.`);
    confidence.addSignal('bounds_statically_known', 'Master Theorem Case 3');
    return result;
  }
}

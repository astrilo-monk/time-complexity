/**
 * Space Analyzer - Memory usage estimation from IR structures
 *
 * Estimates space complexity by analyzing:
 *   - Explicit allocations (arrays, collections, new/malloc)
 *   - Allocations inside loops (growing with input)
 *   - Recursion stack depth
 *   - Auxiliary vs input space
 *
 * Supported patterns:
 *   O(1)     - No allocations, no recursion (or tail recursion)
 *   O(n)     - Array of size n, collection growing in a loop, linear recursion stack
 *   O(n^2)   - 2D array, allocation inside nested loop
 *   O(log n) - Halving recursion stack depth (binary search)
 *   O(n)     - Divide-and-conquer with O(n) merge buffer (merge sort)
 *
 * The analyzer produces a separate space complexity result
 * that the engine merges alongside time complexity.
 */

import { BigO, fromDegree } from '../core/complexity-algebra.js';
import { ConfidenceEngine } from '../core/confidence-engine.js';
import { maxLoopDepth, collectAllocations } from '../ir/builder.js';

export class SpaceAnalyzer {
  constructor() {
    this.name = 'space-analyzer';
  }

  /**
   * Analyze the full IR for space complexity.
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
   * Analyze a single function for space complexity.
   * @param {FunctionNode} func
   * @param {ProgramNode} ir
   * @param {object} context
   * @returns {object}
   */
  analyzeFunction(func, ir, context) {
    const reasoning = [];
    const confidence = new ConfidenceEngine();

    // ---- Step 1: Collect all allocations ----
    const allocComplexity = this.analyzeAllocations(func, reasoning, confidence);

    // ---- Step 2: Analyze recursion stack depth ----
    const stackComplexity = this.analyzeRecursionStack(func, reasoning, confidence);

    // ---- Step 3: Check if allocation happens inside recursion ----
    // If the function is recursive, allocations multiply by stack depth UNLESS it's a halving reduction
    let totalAlloc = allocComplexity;
    if (func.isRecursive && allocComplexity.orderIndex > BigO.O1().orderIndex) {
      const recursiveCalls = func.recursiveCalls || [];
      const reduction = this.detectReductionFromCalls(recursiveCalls);
      
      if (reduction.type === 'halving') {
        // Geometric series: n + n/2 + n/4 ... = O(n) max active memory on the stack
        reasoning.push(`Allocations inside halving recursion: geometric series bounds total allocation space to ${allocComplexity.toString()}`);
      } else {
        // Subtractive recursion: n + n + n ... = O(n^2)
        totalAlloc = allocComplexity.multiply(stackComplexity);
        reasoning.push(`Allocations happen inside recursive function, space amplified by stack depth to ${totalAlloc.toString()}`);
      }
    }

    // ---- Step 4: Combined space = max(total allocations, stack) ----
    const spaceComplexity = totalAlloc.add(stackComplexity);

    if (spaceComplexity.isConstant() && !func.isRecursive) {
      reasoning.push('No significant allocations or recursion - O(1) auxiliary space.');
    }

    return {
      functionName: func.name,
      spaceComplexity,
      confidence: confidence.calculate(),
      reasoning,
    };
  }

  /**
   * Analyze allocation nodes for space usage.
   *
   * Rules:
   *   - Allocation outside loops with size n -> O(n)
   *   - Allocation outside loops with size n*n -> O(n^2)
   *   - Allocation inside 1 loop -> O(n) (cumulative)
   *   - Allocation inside 2 nested loops -> O(n^2)
   *   - Allocation with constant/no size -> O(1)
   *   - Collection used with .push/.add inside loop -> O(n)
   *
   * @param {FunctionNode} func
   * @param {string[]} reasoning
   * @param {ConfidenceEngine} confidence
   * @returns {BigO}
   */
  analyzeAllocations(func, reasoning, confidence) {
    if (!func.body) return BigO.O1();

    const allocations = collectAllocations(func);
    let maxAlloc = BigO.O1();

    for (const alloc of allocations) {
      const allocSpace = this.classifyAllocation(alloc, func, reasoning, confidence);
      if (allocSpace.orderIndex > maxAlloc.orderIndex) {
        maxAlloc = allocSpace;
      }
    }
    
    // Check for Collections being pushed/added inside loops
    const accSpace = this.detectCollectionAccumulation(func, reasoning, confidence);
    if (accSpace.orderIndex > maxAlloc.orderIndex) {
      maxAlloc = accSpace;
    }

    return maxAlloc;
  }

  detectCollectionAccumulation(func, reasoning, confidence) {
    if (!func.body) return BigO.O1();
    
    const loops = func.body.findAll(n => n.type === 'loop');
    for (const loop of loops) {
      const calls = loop.findAll(n => n.type === 'call');
      for (const call of calls) {
        const name = call.functionName ? call.functionName.toLowerCase() : '';
        // Check for push, add, insert, put methods
        if (/\.(push|push_back|add|put|insert|append)$/.test(name)) {
          reasoning.push(`Collection accumulation detected: "${call.functionName}" inside loop - O(n) space.`);
          confidence.addSignal('input_dependent_condition', 'Collection grows inside loop');
          return BigO.N();
        }
      }
    }
    return BigO.O1();
  }

  /**
   * Classify a single allocation's space impact.
   *
   * @param {AllocationNode} alloc
   * @param {FunctionNode} func
   * @param {string[]} reasoning
   * @param {ConfidenceEngine} confidence
   * @returns {BigO}
   */
  classifyAllocation(alloc, func, reasoning, confidence) {
    const size = alloc.sizeExpression || '';
    const ds = alloc.dataStructure || alloc.allocationType || 'unknown';
    const loopDepth = this.getAllocationLoopDepth(alloc, func);

    // ---- Size-based classification ----
    let baseSpace = BigO.O1();

    if (this.isSizeDependentOnInput(size)) {
      // Strip function wrappers: malloc(n * sizeof(int)) -> extract the variable part
      const cleanSize = this.extractSizeVariable(size);

      // Check for quadratic: two variable names multiplied (n*m, rows*cols)
      if (/^[a-zA-Z_]\w*\s*\*\s*[a-zA-Z_]\w*$/.test(cleanSize)) {
        baseSpace = BigO.N2();
        reasoning.push(`Allocation: ${ds} of size "${cleanSize}" - O(n^2) space.`);
      } else {
        // Single variable: n, len, size -> O(n)
        baseSpace = BigO.N();
        reasoning.push(`Allocation: ${ds} of size "${cleanSize}" - O(n) space.`);
      }
      confidence.addSignal('bounds_statically_known', `Allocation size: ${cleanSize}`);
    } else if (size && /^\d+$/.test(size.trim())) {
      // Constant size
      reasoning.push(`Allocation: ${ds} of constant size ${size} - O(1) space.`);
      return BigO.O1();
    }

    // ---- Loop nesting amplifies space (if allocation grows per iteration) ----
    if (loopDepth > 0 && baseSpace.isConstant()) {
      // Constant allocation inside loop - could be reused or cumulative
      // Assume cumulative (worst case)
      const loopSpace = fromDegree(loopDepth);
      reasoning.push(
        `Allocation: ${ds} inside ${loopDepth} loop(s) - ${loopSpace.toString()} cumulative space.`
      );
      confidence.addSignal('input_dependent_condition', 'Allocation inside loop');
      return loopSpace;
    }

    if (loopDepth > 0 && !baseSpace.isConstant()) {
      // O(n) allocation inside loop -> O(n^2)
      const amplified = fromDegree(loopDepth + 1);
      reasoning.push(
        `Allocation: ${ds} of size "${size}" inside ${loopDepth} loop(s) - ${amplified.toString()} space.`
      );
      return amplified;
    }

    return baseSpace;
  }

  /**
   * Check if a size expression depends on input (contains variable names, not just constants).
   * @param {string} size
   * @returns {boolean}
   */
  isSizeDependentOnInput(size) {
    if (!size) return false;
    const trimmed = size.trim();
    if (!trimmed) return false;
    // Pure number = constant
    if (/^\d+$/.test(trimmed)) return false;
    // Contains a letter = likely input-dependent
    return /[a-zA-Z]/.test(trimmed);
  }

  /**
   * Extract the core size variable from allocation size expressions.
   * Strips function call wrappers like malloc(), sizeof(), etc.
   *
   * Examples:
   *   "n"                     -> "n"
   *   "malloc(n * sizeof(int))" -> "n"
   *   "n * m"                 -> "n * m"
   *   "calloc(n, sizeof(int))" -> "n"
   *
   * @param {string} size
   * @returns {string}
   */
  extractSizeVariable(size) {
    let s = size.trim();

    // Strip outer malloc/calloc wrapper
    const mallocMatch = s.match(/^(?:malloc|calloc|realloc)\s*\(\s*(.+)\s*\)$/);
    if (mallocMatch) {
      s = mallocMatch[1];
    }

    // Remove sizeof(...) parts
    s = s.replace(/\*?\s*sizeof\s*\([^)]*\)/g, '').trim();

    // Remove trailing/leading operators and whitespace
    s = s.replace(/^\s*\*\s*/, '').replace(/\s*\*\s*$/, '').trim();

    // For calloc(n, sizeof(int)), take the first argument
    if (s.includes(',')) {
      s = s.split(',')[0].trim();
    }

    return s || size;
  }

  /**
   * Find how many loops an allocation is nested inside.
   * Walks ancestors from the allocation up to the function body.
   *
   * @param {AllocationNode} alloc
   * @param {FunctionNode} func
   * @returns {number}
   */
  getAllocationLoopDepth(alloc, func) {
    if (!func.body || !alloc.location) return 0;

    // Walk the IR tree and count loops that contain this allocation
    let depth = 0;
    this.walkWithLoopDepth(func.body, alloc, 0, (d) => { depth = d; });
    return depth;
  }

  /**
   * Walk the tree tracking loop depth, looking for a target node.
   * @param {IRNode} node
   * @param {IRNode} target
   * @param {number} currentDepth
   * @param {function} onFound
   */
  walkWithLoopDepth(node, target, currentDepth, onFound) {
    if (node === target) {
      onFound(currentDepth);
      return;
    }

    const nextDepth = node.type === 'loop' ? currentDepth + 1 : currentDepth;

    for (const child of node.children) {
      this.walkWithLoopDepth(child, target, nextDepth, onFound);
    }
  }

  /**
   * Analyze recursion stack depth for space usage.
   *
   * Rules:
   *   - No recursion -> O(1) stack
   *   - Linear recursion (n-1) -> O(n) stack
   *   - Halving recursion (n/2) -> O(log n) stack
   *   - Binary recursion (n-1, n-2) -> O(n) stack (max depth is still n)
   *   - Tail recursion -> O(1) stack (optimizable, but we report O(n) for safety
   *     since JS/C/Java don't guarantee TCO)
   *
   * @param {FunctionNode} func
   * @param {string[]} reasoning
   * @param {ConfidenceEngine} confidence
   * @returns {BigO}
   */
  analyzeRecursionStack(func, reasoning, confidence) {
    if (!func.isRecursive) return BigO.O1();

    const recursiveCalls = func.recursiveCalls || [];
    if (recursiveCalls.length === 0) return BigO.O1();

    // Analyze reduction pattern from the recursive calls
    const reduction = this.detectReductionFromCalls(recursiveCalls);

    if (reduction.type === 'halving') {
      reasoning.push(
        `Recursion stack: ${func.name} divides by ${reduction.value} per call - O(log n) stack depth.`
      );
      confidence.addSignal('bounds_statically_known', 'Halving recursion stack');
      return BigO.LOGN();
    }

    // Subtractive or unknown - linear stack depth
    reasoning.push(
      `Recursion stack: ${func.name} reduces by ${reduction.value || 1} per call - O(n) stack depth.`
    );
    confidence.addSignal('bounds_statically_known', 'Linear recursion stack');
    return BigO.N();
  }

  /**
   * Detect the reduction pattern from recursive call arguments.
   * Mirrors the logic in recursion-analyzer but only needs the reduction type.
   *
   * @param {CallNode[]} calls
   * @returns {{ type: string, value: number }}
   */
  detectReductionFromCalls(calls) {
    for (const call of calls) {
      if (!call.arguments || call.arguments.length === 0) continue;

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
        if (/\w+\s*-\s*\d+/.test(text)) {
          const subMatch = text.match(/\w+\s*-\s*(\d+)/);
          return { type: 'subtractive', value: parseInt(subMatch[1]) };
        }
      }
    }

    return { type: 'subtractive', value: 1 };
  }
}

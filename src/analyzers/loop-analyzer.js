/**
 * Loop Analyzer - Time complexity estimation from loop structures
 *
 * This is the primary complexity analyzer. It walks the IR tree
 * and estimates time complexity based on loop nesting, loop bounds,
 * increment patterns, and control flow.
 *
 * Detection capabilities:
 *   O(1)       - No loops
 *   O(log n)   - Multiplicative increment (i *= 2) or halving (n /= 2)
 *   O(√n)      - i * i <= n pattern
 *   O(n)       - Single linear loop
 *   O(n log n) - Linear loop containing a log loop
 *   O(n²)      - Two nested linear loops
 *   O(n³)      - Three nested linear loops
 *   O(n⁴)      - Four nested linear loops
 *
 * Reasoning:
 *   The analyzer produces step-by-step reasoning explaining
 *   how each complexity was derived - like a DSA instructor.
 */

import { BigO, fromDegree } from '../core/complexity-algebra.js';
import { ConfidenceEngine } from '../core/confidence-engine.js';
import { maxLoopDepth, collectLoops } from '../ir/builder.js';

export class LoopAnalyzer {
  constructor() {
    this.name = 'loop-analyzer';
  }

  /**
   * Analyze the full IR for loop-based time complexity.
   * @param {ProgramNode} ir
   * @param {object} context
   * @returns {{ analyzerName: string, functionResults: object[] }}
   */
  analyze(ir, context) {
    const functionResults = [];

    for (const func of ir.functions) {
      const result = this.analyzeFunction(func);
      functionResults.push(result);
    }

    return {
      analyzerName: this.name,
      functionResults,
    };
  }

  /**
   * Analyze a single function for loop-based complexity.
   * @param {FunctionNode} func
   * @returns {object}
   */
  analyzeFunction(func) {
    const reasoning = [];
    const confidence = new ConfidenceEngine();

    if (!func.body) {
      reasoning.push(`Function "${func.name}" has no body - O(1).`);
      return this.makeResult(func, BigO.O1(), confidence, reasoning);
    }

    // Collect all top-level complexity contributions
    const bodyComplexity = this.analyzeBlock(func.body, 0, reasoning, confidence, func.name);

    if (bodyComplexity.isConstant()) {
      reasoning.push(`No loops found in "${func.name}" - O(1).`);
    }

    return this.makeResult(func, bodyComplexity, confidence, reasoning);
  }

  /**
   * Analyze a block node for its combined complexity.
   * Sequential statements are added (dominant term wins).
   * @param {BlockNode} block
   * @param {number} depth - Current nesting depth
   * @param {string[]} reasoning
   * @param {ConfidenceEngine} confidence
   * @param {string} funcName
   * @returns {BigO}
   */
  analyzeBlock(block, depth, reasoning, confidence, funcName) {
    if (!block || !block.children) return BigO.O1();

    let blockComplexity = BigO.O1();

    for (const stmt of block.children) {
      const stmtComplexity = this.analyzeStatement(stmt, depth, reasoning, confidence, funcName);
      blockComplexity = blockComplexity.add(stmtComplexity);
    }

    return blockComplexity;
  }

  /**
   * Analyze a single statement.
   * @param {IRNode} stmt
   * @param {number} depth
   * @param {string[]} reasoning
   * @param {ConfidenceEngine} confidence
   * @param {string} funcName
   * @returns {BigO}
   */
  analyzeStatement(stmt, depth, reasoning, confidence, funcName) {
    if (!stmt) return BigO.O1();

    switch (stmt.type) {
      case 'loop':
        return this.analyzeLoop(stmt, depth, reasoning, confidence, funcName);
      case 'branch':
        return this.analyzeBranch(stmt, depth, reasoning, confidence, funcName);
      case 'block':
        return this.analyzeBlock(stmt, depth, reasoning, confidence, funcName);
      case 'call':
        // Detect O(log n) method calls (like pq.push, tree.insert)
        if (stmt.functionName && /\b(push|insert|add|offer|poll|remove|pop)\b/.test(stmt.functionName)) {
          if (/pq|heap|tree|map|set/i.test(stmt.functionName)) {
            reasoning.push(`${'  '.repeat(depth)}Logarithmic operation detected: ${stmt.functionName} → O(log n)`);
            return BigO.LOGN();
          }
        }
        return BigO.O1();
      case 'variable':
      case 'expression':
      case 'return':
        if (stmt.children && stmt.children.length > 0) {
          let maxChild = BigO.O1();
          for (const child of stmt.children) {
            maxChild = maxChild.add(this.analyzeStatement(child, depth, reasoning, confidence, funcName));
          }
          return maxChild;
        }
        return BigO.O1();
      case 'break':
      case 'continue':
      case 'allocation':
        // Allocating memory takes time proportional to the allocation size (e.g. array copying/initialization)
        if (stmt.sizeExpression) {
          const size = stmt.sizeExpression.trim();
          if (/^[a-zA-Z_]\w*\s*\*\s*[a-zA-Z_]\w*$/.test(size)) {
             reasoning.push(`Allocation of size "${size}" contributes O(n^2) time.`);
             return BigO.N2();
          } else if (/[a-zA-Z]/.test(size) && !/^\d+$/.test(size)) {
             reasoning.push(`Allocation of size "${size}" contributes O(n) time.`);
             return BigO.N();
          }
        }
        return BigO.O1();
      case 'function':
        // Nested function definition - analyze independently
        return BigO.O1();
      default:
        return BigO.O1();
    }
  }

  /**
   * Analyze a branch (if/else) for its complexity contribution.
   * Takes the maximum of both paths (worst-case analysis).
   *
   * @param {BranchNode} branch
   * @param {number} depth
   * @param {string[]} reasoning
   * @param {ConfidenceEngine} confidence
   * @param {string} funcName
   * @returns {BigO}
   */
  analyzeBranch(branch, depth, reasoning, confidence, funcName) {
    let consequenceComplexity = BigO.O1();
    let alternativeComplexity = BigO.O1();

    if (branch.consequence) {
      consequenceComplexity = this.analyzeStatement(
        branch.consequence, depth, reasoning, confidence, funcName
      );
    }

    if (branch.alternative) {
      alternativeComplexity = this.analyzeStatement(
        branch.alternative, depth, reasoning, confidence, funcName
      );
    }

    // Worst case: take the larger branch
    return consequenceComplexity.add(alternativeComplexity);
  }

  /**
   * Analyze a loop for its complexity contribution.
   * This is where the core logic lives.
   *
   * @param {LoopNode} loop
   * @param {number} depth
   * @param {string[]} reasoning
   * @param {ConfidenceEngine} confidence
   * @param {string} funcName
   * @returns {BigO}
   */
  analyzeLoop(loop, depth, reasoning, confidence, funcName) {
    const indent = '  '.repeat(depth);

    // ── Step 1: Determine this loop's iteration count ──────
    const iterationComplexity = this.classifyLoopIterations(loop, reasoning, confidence, indent);

    // ── Step 2: Check for control flow that may affect the loop ──
    this.checkControlFlow(loop, confidence);

    // ── Step 3: Analyze the body recursively ───────────────
    let bodyComplexity = BigO.O1();
    if (loop.body) {
      bodyComplexity = this.analyzeBlock(loop.body, depth + 1, reasoning, confidence, funcName);
    }

    // ── Step 4: Total = iterations × body ──────────────────
    let totalComplexity = iterationComplexity.multiply(bodyComplexity);

    // ── Step 5: Dependent Bounds Adjustments ─────────────────
    if (loop.body) {
      const innerLoops = loop.body.findAll(n => n.type === 'loop');
      if (innerLoops.length > 0) {
        const inner = innerLoops[0];
        
        // Geometric Series Pattern
        if ((loop.incrementType === 'multiplicative' || loop.incrementType === 'divisive') && bodyComplexity.complexity === 'n') {
          if (inner.incrementType === 'additive' && inner.boundVar === loop.iteratorVar) {
            totalComplexity = BigO.N();
            reasoning.push(`${indent}Dependent bounds: geometric series sum (inner bounded by outer ${loop.iteratorVar}) → O(n)`);
            confidence.addSignal('geometric_series', 'Geometric series pattern detected');
          }
        }
        
        // Harmonic Series Pattern
        if (loop.incrementType === 'additive' && bodyComplexity.complexity === 'n' && loop.iteratorVar) {
          if (inner.incrementType === 'additive' && inner.condition) {
            const regex = new RegExp(`\\/\\s*${loop.iteratorVar}\\b`);
            if (regex.test(inner.condition)) {
              totalComplexity = BigO.NLOGN();
              reasoning.push(`${indent}Dependent bounds: harmonic series sum (inner divided by outer ${loop.iteratorVar}) → O(n log n)`);
              confidence.addSignal('harmonic_series', 'Harmonic series pattern detected');
            }
          }
        }
      }
    }

    // Build the reasoning string
    if (!bodyComplexity.isConstant()) {
      reasoning.push(
        `${indent}Loop (${loop.loopType}) runs ${iterationComplexity.toString()} iterations, ` +
        `body is ${bodyComplexity.toString()} → total: ${totalComplexity.toString()}`
      );
    } else {
      reasoning.push(
        `${indent}Loop (${loop.loopType}) runs ${iterationComplexity.toString()} iterations ` +
        `with O(1) body → ${totalComplexity.toString()}`
      );
    }

    return totalComplexity;
  }

  /**
   * Classify how many times a loop iterates.
   *
   * Patterns detected:
   *   - Additive increment (i++, i+=k)  → O(n)
   *   - Multiplicative increment (i*=k) → O(log n)
   *   - Divisive update (n/=k)          → O(log n)
   *   - for-each over collection        → O(n)
   *   - Unknown bounds                  → O(n) with low confidence
   *
   * @param {LoopNode} loop
   * @param {string[]} reasoning
   * @param {ConfidenceEngine} confidence
   * @param {string} indent
   * @returns {BigO}
   */
  classifyLoopIterations(loop, reasoning, confidence, indent) {
    // ── for-each loops ─────────────────────────────────────
    if (loop.loopType === 'for-each') {
      reasoning.push(`${indent}for-each loop over collection → O(n) iterations`);
      confidence.addSignal('termination_certain', 'for-each loops always terminate');
      return BigO.N();
    }

    // ── Counted for loops with known structure ─────────────
    if (loop.iteratorVar && loop.incrementType) {
      return this.classifyCountedLoop(loop, reasoning, confidence, indent);
    }

    // ── While / do-while loops ─────────────────────────────
    if (loop.loopType === 'while' || loop.loopType === 'do-while') {
      return this.classifyWhileLoop(loop, reasoning, confidence, indent);
    }

    // ── Fallback ───────────────────────────────────────────
    reasoning.push(`${indent}Cannot determine loop iteration count - assuming O(n)`);
    confidence.addSignal('unknown_bounds', 'Loop bounds could not be determined');
    return BigO.N();
  }

  /**
   * Classify a counted for loop (has known init/bound/increment).
   *
   * @param {LoopNode} loop
   * @param {string[]} reasoning
   * @param {ConfidenceEngine} confidence
   * @param {string} indent
   * @returns {BigO}
   */
  classifyCountedLoop(loop, reasoning, confidence, indent) {
    const { iteratorVar, boundVar, initValue, incrementType, incrementValue } = loop;
    const vName = boundVar && /^[a-zA-Z]+$/.test(boundVar) ? boundVar : 'n';

    if (this.isSqrtPattern(loop.condition || '')) {
      reasoning.push(`${indent}for-loop with sqrt pattern (${loop.condition}) → O(√${vName})`);
      confidence.addSignal('bounds_statically_known', 'Square root bound');
      return BigO.SQRTN(vName);
    }
    
    if (this.isLogLogPattern(loop.update || '')) {
      reasoning.push(`${indent}for-loop with log-log pattern (${loop.update}) → O(log log ${vName})`);
      confidence.addSignal('bounds_statically_known', `Loop bound: ${boundVar}`);
      return BigO.LOGLOGN(vName);
    }

    if (incrementType === 'multiplicative') {
      // i *= k → O(log n)
      reasoning.push(
        `${indent}for-loop: ${iteratorVar} starts at ${initValue}, ` +
        `multiplied by ${incrementValue} each iteration → O(log ${vName})`
      );
      confidence.addSignal('bounds_statically_known', `Loop bound: ${boundVar}`);
      confidence.addSignal('simple_increment', `Multiplicative: ${iteratorVar} *= ${incrementValue}`);
      confidence.addSignal('termination_certain', 'Multiplicative loops converge');
      return BigO.LOGN(vName);
    }

    if (incrementType === 'divisive') {
      // n /= k → O(log n)
      reasoning.push(
        `${indent}for-loop: ${iteratorVar} starts at ${initValue}, ` +
        `divided by ${incrementValue} each iteration → O(log ${vName})`
      );
      confidence.addSignal('bounds_statically_known', `Loop bound determined`);
      confidence.addSignal('simple_increment', `Divisive: ${iteratorVar} /= ${incrementValue}`);
      confidence.addSignal('termination_certain', 'Divisive loops converge');
      return BigO.LOGN(vName);
    }

    if (incrementType === 'additive') {
      // i += k → O(n) (or O(n/k) which simplifies to O(n))
      reasoning.push(
        `${indent}for-loop: ${iteratorVar} = ${initValue} to ${boundVar}, ` +
        `step +${incrementValue} → O(${vName})`
      );
      confidence.addSignal('bounds_statically_known', `Loop bound: ${boundVar}`);
      confidence.addSignal('simple_increment', `Additive: ${iteratorVar} += ${incrementValue}`);
      confidence.addSignal('termination_certain', 'Bounded additive loop');
      return BigO.N(vName);
    }

    // Unknown increment type
    reasoning.push(`${indent}for-loop with unrecognized increment pattern - assuming O(${vName})`);
    confidence.addSignal('unknown_increment', `Increment pattern not recognized`);
    return BigO.N(vName);
  }


  /**
   * Classify a while or do-while loop based on its condition.
   * Without full symbolic execution, we rely on heuristics.
   *
   * @param {LoopNode} loop
   * @param {string[]} reasoning
   * @param {ConfidenceEngine} confidence
   * @param {string} indent
   * @returns {BigO}
   */
  classifyWhileLoop(loop, reasoning, confidence, indent) {
    const condition = loop.condition || '';

    // Check body for halving patterns (n = n/2, n >>= 1, etc.)
    const halvingPattern = this.detectHalvingInBody(loop);
    if (halvingPattern) {
      reasoning.push(
        `${indent}while-loop with halving pattern (${halvingPattern}) → O(log n)`
      );
      confidence.addSignal('bounds_statically_known', 'Halving pattern detected');
      confidence.addSignal('termination_certain', 'Halving guarantees convergence');
      return BigO.LOGN();
    }

    // Check for sqrt pattern: i * i <= n
    if (this.isSqrtPattern(condition)) {
      reasoning.push(`${indent}while-loop with sqrt pattern (i*i <= n) → O(√n)`);
      confidence.addSignal('bounds_statically_known', 'Square root bound');
      return BigO.SQRTN();
    }

    // Check body for linear decrement (n--, n -= 1)
    const decrementPattern = this.detectDecrementInBody(loop);
    if (decrementPattern) {
      reasoning.push(
        `${indent}while-loop with linear decrement (${decrementPattern}) → O(n)`
      );
      confidence.addSignal('termination_certain', 'Linear decrement toward bound');
      return BigO.N();
    }

    // Default: assume O(n) with lower confidence
    reasoning.push(
      `${indent}while-loop condition: "${condition}" - assuming O(n)`
    );
    confidence.addSignal('input_dependent_condition', 'While-loop bound is input-dependent');
    return BigO.N();
  }

  /**
   * Check for control flow statements that affect confidence.
   * @param {LoopNode} loop
   * @param {ConfidenceEngine} confidence
   */
  checkControlFlow(loop, confidence) {
    if (!loop.body) return;

    const breaks = loop.body.findAll(n => n.type === 'break');
    const continues = loop.body.findAll(n => n.type === 'continue');
    const returns = loop.body.findAll(n => n.type === 'return');

    if (breaks.length > 0) {
      confidence.addSignal('has_break', 'Break may cause early exit');
    }
    if (continues.length > 0) {
      confidence.addSignal('has_continue', 'Continue may skip iterations');
    }
    if (returns.length > 0) {
      confidence.addSignal('has_early_return', 'Return inside loop body');
    }
  }

  /**
   * Detect halving patterns in the loop body.
   * Looks for: n /= 2, n = n / 2, n >>= 1, n = n >> 1
   *
   * @param {LoopNode} loop
   * @returns {string|null} - Description of pattern found, or null
   */
  detectHalvingInBody(loop) {
    if (!loop.body) return null;

    const variables = loop.body.findAll(n => n.type === 'variable');
    const expressions = loop.body.findAll(n => n.type === 'expression');

    // Check variable assignments
    for (const v of variables) {
      const text = v.initialValue || '';
      const name = v.name || '';
      // n = n / 2, n = n >> 1
      if (/\/ *2/.test(text) || />> *1/.test(text)) {
        return `${name} = ${text}`;
      }
    }

    // Check expression statements (e.g., n /= 2)
    for (const e of expressions) {
      const text = e.expressionText || '';
      if (/\/= *2/.test(text) || />>= *1/.test(text)) {
        return text;
      }
    }

    return null;
  }

  /**
   * Detect linear decrement patterns in the loop body.
   * Looks for: n--, n -= 1, n = n - 1
   *
   * @param {LoopNode} loop
   * @returns {string|null}
   */
  detectDecrementInBody(loop) {
    if (!loop.body) return null;

    const variables = loop.body.findAll(n => n.type === 'variable');
    const expressions = loop.body.findAll(n => n.type === 'expression');

    for (const v of variables) {
      const text = v.initialValue || '';
      if (/- *1/.test(text) || /- *=/.test(text)) {
        return `${v.name} decremented`;
      }
    }

    for (const e of expressions) {
      const text = e.expressionText || '';
      if (/--/.test(text) || /-= *\d/.test(text)) {
        return text;
      }
    }

    return null;
  }

  /**
   * Detect sqrt loop pattern: i*i <= n or i*i < n
   * @param {string} conditionText
   * @returns {boolean}
   */
  isSqrtPattern(conditionText) {
    if (!conditionText) return false;
    const trimmed = conditionText.replace(/\s+/g, '');
    return /([a-zA-Z_]\w*)\*\1<=?[a-zA-Z_]\w*/.test(trimmed);
  }

  /**
   * Check if loop update exhibits a log-log pattern (e.g. i = i * i)
   * @param {string} updateText
   * @returns {boolean}
   */
  isLogLogPattern(updateText) {
    if (!updateText) return false;
    const trimmed = updateText.replace(/\s+/g, '');
    // matches i = i * i or i *= i for log log progression
    return /([a-zA-Z_]\w*)=\1\*\1/.test(trimmed) || /([a-zA-Z_]\w*)\*=\1/.test(trimmed);
  }

  /**
   * Build the result object for a function.
   * @param {FunctionNode} func
   * @param {BigO} complexity
   * @param {ConfidenceEngine} confidence
   * @param {string[]} reasoning
   * @returns {object}
   */
  makeResult(func, complexity, confidence, reasoning) {
    return {
      functionName: func.name,
      complexity,
      confidence: confidence.calculate(),
      reasoning,
    };
  }
}

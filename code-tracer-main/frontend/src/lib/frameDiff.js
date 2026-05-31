/**
 * frameDiff.js — Frame-scoped variable diffing utilities.
 *
 * Replaces the naive name-only diff that existed separately in
 * ExplanationPanel.js and MemoryVisualization.js.  The key insight is that
 * a variable "sum" in add() is NOT the same entity as "sum" in main(), so
 * a call/return boundary should never produce a false "sum: 8 → 23" change.
 */

// ---------------------------------------------------------------------------
// Transition classification
// ---------------------------------------------------------------------------

/**
 * Classify the transition between two consecutive trace steps.
 *
 * @param {object|null} step    – current step  ({func, stack_frames, …})
 * @param {object|null} prev    – previous step (may be null for step 0)
 * @returns {'initial'|'same-frame'|'call'|'return'}
 */
export function getStepTransitionType(step, prev) {
  if (!prev) return 'initial';
  if (!step) return 'initial';

  const currFunc = step.func;
  const prevFunc = prev.func;
  const currDepth = step.stack_frames?.length || 1;
  const prevDepth = prev.stack_frames?.length || 1;

  // Same function AND same depth → normal in-function step
  if (currFunc === prevFunc && currDepth === prevDepth) return 'same-frame';

  // Depth increased → we called into a new function
  if (currDepth > prevDepth) return 'call';

  // Depth decreased → we returned from a function
  if (currDepth < prevDepth) return 'return';

  // Same depth but func changed (e.g. tail-call or sibling call)
  // Treat as a call→return in one step: new scope
  if (currFunc !== prevFunc) return 'call';

  return 'same-frame';
}

// ---------------------------------------------------------------------------
// Frame-scoped changed-variable detection
// ---------------------------------------------------------------------------

/**
 * Compute the set of variable names that genuinely changed within the
 * **same logical frame**.
 *
 * • same-frame  → classic name-based diff (names share the same scope)
 * • call        → all current vars are "new scope", none count as "changed"
 * • return      → all current vars are "restored scope", none count as "changed"
 * • initial     → nothing changed (first step)
 *
 * @param {object[]} steps        – full steps array
 * @param {number}   currentStep  – index into steps
 * @returns {Set<string>}  variable names that changed
 */
export function getFrameScopedChanges(steps, currentStep) {
  if (!steps.length || currentStep <= 0) return new Set();

  const curr = steps[currentStep];
  const prev = steps[currentStep - 1];
  if (!curr || !prev) return new Set();

  const transition = getStepTransitionType(curr, prev);

  // On scope transitions (call / return / initial), nothing "changed" —
  // the vars belong to a different frame.
  if (transition !== 'same-frame') return new Set();

  const prevMap = {};
  for (const v of prev.variables) prevMap[v.name] = v.value;

  const changed = new Set();
  for (const v of curr.variables) {
    if (prevMap[v.name] === undefined) {
      // New variable appeared within the same frame (e.g. declared mid-function)
      changed.add(v.name);
    } else if (prevMap[v.name] !== v.value) {
      changed.add(v.name);
    }
  }
  return changed;
}

// ---------------------------------------------------------------------------
// Rich transition metadata (for UI labels & banners)
// ---------------------------------------------------------------------------

/**
 * Build a small descriptor the UI can use for banners, badges, and
 * narrative text.
 *
 * @param {object}      step  – current step
 * @param {object|null} prev  – previous step
 * @returns {{
 *   type: string,
 *   isCall: boolean,
 *   isReturn: boolean,
 *   depth: number,
 *   isRecursive: boolean,
 *   calledFunc: string|null,
 *   returnedFrom: string|null,
 * }}
 */
export function getTransitionMeta(step, prev) {
  const type = getStepTransitionType(step, prev);
  const depth = (step.stack_frames?.length || 1) - 1;
  const isCall = type === 'call';
  const isReturn = type === 'return';
  const isRecursive = isCall && prev && step.func === prev.func;

  return {
    type,
    isCall,
    isReturn,
    depth,
    isRecursive,
    calledFunc: isCall ? step.func : null,
    returnedFrom: isReturn ? (prev?.func || null) : null,
  };
}

// ---------------------------------------------------------------------------
// Explanation generator (moved from ExplanationPanel.js, now frame-aware)
// ---------------------------------------------------------------------------

function humanizeOperators(expr) {
  if (!expr) return '';
  return expr
    .replace(/>=/g, ' is greater than or equal to ')
    .replace(/<=/g, ' is less than or equal to ')
    .replace(/==/g, ' is equal to ')
    .replace(/!=/g, ' is not equal to ')
    .replace(/&&/g, ' and ')
    .replace(/\|\|/g, ' or ')
    .replace(/>/g, ' is greater than ')
    .replace(/</g, ' is less than ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSimpleNumber(value) {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function evaluateSimpleCondition(condition, variables) {
  const m = condition.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(<=|>=|==|!=|<|>)\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const leftName = m[1];
  const op = m[2];
  const right = Number(m[3]);

  const leftVar = variables.find((v) => v.name === leftName);
  const left = leftVar ? parseSimpleNumber(leftVar.value) : null;
  if (left === null) return null;

  if (op === '>') return left > right;
  if (op === '<') return left < right;
  if (op === '>=') return left >= right;
  if (op === '<=') return left <= right;
  if (op === '==') return left === right;
  if (op === '!=') return left !== right;
  return null;
}

function getLoopOrConditionContext(lineText, variables) {
  const ifMatch = lineText.match(/^if\s*\((.*)\)/);
  if (ifMatch) {
    const condition = ifMatch[1].trim();
    const result = evaluateSimpleCondition(condition, variables);
    return {
      kind: 'if',
      raw: condition,
      readable: humanizeOperators(condition),
      result,
    };
  }

  const whileMatch = lineText.match(/^while\s*\((.*)\)/);
  if (whileMatch) {
    const condition = whileMatch[1].trim();
    const result = evaluateSimpleCondition(condition, variables);
    return {
      kind: 'while',
      raw: condition,
      readable: humanizeOperators(condition),
      result,
    };
  }

  const forMatch = lineText.match(/^for\s*\(([^;]*);([^;]*);([^)]*)\)/);
  if (forMatch) {
    const init = forMatch[1].trim();
    const condition = forMatch[2].trim();
    const step = forMatch[3].trim();
    const result = evaluateSimpleCondition(condition, variables);
    return {
      kind: 'for',
      init,
      raw: condition,
      readable: humanizeOperators(condition),
      step,
      result,
    };
  }

  return null;
}

/**
 * Build a human-readable explanation for the current step.
 *
 * The key change from the old version: variable-change detection is now
 * **frame-scoped**.  On call/return boundaries the changes list is empty
 * and replaced by a clear scope-transition message.
 *
 * @param {object}      step     – current trace step
 * @param {object|null} prevStep – previous step (null for step 0)
 * @param {string}      code     – full source code
 * @param {boolean}     beginner – beginner-mode flag
 * @returns {{ short, detail, changes, funcChanged, isCall, isReturn, depth, transitionType }}
 */
export function getExplanation(step, prevStep, code, beginner) {
  const lines = code.split('\n');
  const lineText = (lines[step.line - 1] || '').trim();
  if (!lineText) return { short: 'Empty line', detail: '', changes: [], transitionType: 'initial' };

  const short = lineText;
  const meta = getTransitionMeta(step, prevStep);
  const { isCall, isReturn, depth, isRecursive, type: transitionType } = meta;
  const funcChanged = prevStep && step.func !== prevStep.func;

  // --- Frame-scoped change detection ---
  const changes = [];
  if (prevStep) {
    if (transitionType === 'same-frame') {
      // Safe to diff by name — we're in the same function scope
      const prevMap = {};
      for (const v of prevStep.variables) prevMap[v.name] = v.value;
      for (const v of step.variables) {
        if (prevMap[v.name] !== undefined && prevMap[v.name] !== v.value) {
          changes.push({ name: v.name, from: prevMap[v.name], to: v.value });
        } else if (prevMap[v.name] === undefined) {
          changes.push({ name: v.name, from: null, to: v.value });
        }
      }
    }
    // On call/return: changes stays empty — variables belong to different scopes
  }

  const conditionContext = getLoopOrConditionContext(lineText, step.variables || []);

  if (!beginner) {
    let parts = [];
    if (isCall && !isRecursive) parts.push(`→ Entered ${step.func}()`);
    else if (isCall && isRecursive) parts.push(`↻ Recursive call → ${step.func}() [depth ${depth}]`);
    else if (isReturn) parts.push(`← Returned to ${step.func}()`);
    if (conditionContext) {
      const outcome =
        conditionContext.result === null
          ? ''
          : (conditionContext.result ? ' (true)' : ' (false)');
      parts.push(`Condition: ${conditionContext.readable}${outcome}`);
    }
    if (changes.length > 0) {
      parts.push(changes.map(c => c.from === null ? `${c.name} = ${c.to}` : `${c.name}: ${c.from} → ${c.to}`).join(', '));
    } else if (transitionType === 'same-frame' && !conditionContext) {
      parts.push('No variable changes');
    }
    const detail = parts.length > 0 ? parts.join(' | ') : 'About to execute';
    return { short, detail, changes, funcChanged, isCall, isReturn, depth, transitionType };
  }

  // --- Beginner mode ---
  let detail = '';
  if (isCall && !isRecursive) {
    detail = `Calling function "${step.func}()". The program jumps to this function's code. The current function is paused and will resume after "${step.func}" returns.`;
  } else if (isCall && isRecursive) {
    detail = `Recursive call! "${step.func}()" is calling itself again (depth: ${depth}). Each call creates a new set of local variables on the stack.`;
  } else if (isReturn) {
    detail = `Returning from "${prevStep?.func || 'a function'}()" back to "${step.func}()". The callee's local variables are gone from the stack. Variables you see now belong to ${step.func}()'s scope.`;
  } else if (lineText.includes('printf') || lineText.includes('System.out')) {
    detail = 'This line prints output to the console.';
  } else if (lineText.includes('malloc')) {
    detail = 'Memory is being allocated on the heap using malloc. This memory persists until you call free().';
  } else if (lineText.includes('free(')) {
    detail = 'Memory is being freed/released back to the system. Using this pointer after free is a bug (dangling pointer).';
  } else if (lineText.includes('return')) {
    const retVal = step.variables.find(v => v.name === '__return__');
    detail = `The function "${step.func}()" returns${retVal ? ' the value ' + retVal.value : ''}. Execution goes back to wherever this function was called from.`;
  } else if (lineText.match(/^}\s*else/)) {
    detail = 'This is the else branch. It runs when the previous if-condition was false.';
  } else if (conditionContext?.kind === 'if') {
    const resultText =
      conditionContext.result === null
        ? ''
        : (conditionContext.result ? ' It is true right now, so the if-block runs.' : ' It is false right now, so the if-block is skipped.');
    detail = `A condition is being checked: "${conditionContext.readable}".${resultText}`;
  } else if (conditionContext?.kind === 'while') {
    const resultText =
      conditionContext.result === null
        ? ''
        : (conditionContext.result ? ' It is true right now, so the loop continues.' : ' It is false right now, so the loop stops.');
    detail = `A while-loop condition is being checked: "${conditionContext.readable}".${resultText}`;
  } else if (conditionContext?.kind === 'for') {
    const resultText =
      conditionContext.result === null
        ? ''
        : (conditionContext.result ? ' It is true right now, so this iteration continues.' : ' It is false right now, so the loop ends.');
    const initText = conditionContext.init ? ` Start: ${conditionContext.init}.` : '';
    const stepText = conditionContext.step ? ` Step update: ${conditionContext.step}.` : '';
    detail = `A for-loop is running.${initText} Condition: "${conditionContext.readable}".${stepText}${resultText}`;
  } else if (changes.length > 0) {
    detail = changes.map(c => {
      if (c.from === null) return `Variable "${c.name}" is created with initial value ${c.to}.`;
      return `Variable "${c.name}" changed from ${c.from} to ${c.to}.`;
    }).join(' ');
  } else if (lineText.includes('=')) {
    detail = 'A value is being assigned to a variable. The change will be visible on the next step.';
  } else {
    detail = `About to execute line ${step.line} inside function "${step.func}()".`;
  }

  if (depth > 0 && !funcChanged) {
    detail += ` (Call depth: ${depth})`;
  }

  return { short, detail, changes, funcChanged, isCall, isReturn, depth, transitionType };
}

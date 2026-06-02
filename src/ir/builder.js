/**
 * IR Builder - Utility for constructing IR trees from tree-sitter CSTs.
 *
 * This module provides helper functions used by language-specific parsers
 * to build the common IR. It contains shared logic that isn't tied to
 * a specific language grammar.
 */

import {
  ProgramNode,
  FunctionNode,
  BlockNode,
  LoopNode,
  BranchNode,
  CallNode,
  VariableNode,
  AllocationNode,
  ReturnNode,
  BreakNode,
  ContinueNode,
  ExpressionNode,
} from './nodes.js';

/**
 * Mark recursive calls within a program's function nodes.
 *
 * After the IR is built, this pass walks each function's body
 * and marks CallNodes that reference the containing function
 * as recursive. Also sets FunctionNode.isRecursive.
 *
 * @param {ProgramNode} program
 */
export function markRecursiveCalls(program) {
  const functionNames = new Set(program.functions.map(f => f.name));

  for (const func of program.functions) {
    const calls = func.findAll(node => node.type === 'call');

    for (const call of calls) {
      if (call.functionName === func.name) {
        call.isRecursive = true;
        func.isRecursive = true;
        func.recursiveCalls.push(call);
      }
    }
  }
}

/**
 * Collect all function calls in a program and build a simple call graph.
 *
 * Returns a map from function name to the set of function names it calls.
 * Only includes calls to functions defined within the same program.
 *
 * @param {ProgramNode} program
 * @returns {Map<string, Set<string>>}
 */
export function buildCallGraph(program) {
  const functionNames = new Set(program.functions.map(f => f.name));
  const graph = new Map();

  for (const func of program.functions) {
    const callees = new Set();
    const calls = func.findAll(node => node.type === 'call');

    for (const call of calls) {
      if (functionNames.has(call.functionName)) {
        callees.add(call.functionName);
      }
    }

    graph.set(func.name, callees);
  }

  return graph;
}

/**
 * Detect mutual recursion in a call graph.
 *
 * Returns an array of cycles, where each cycle is an array
 * of function names forming the cycle.
 *
 * @param {Map<string, Set<string>>} callGraph
 * @returns {string[][]}
 */
export function detectMutualRecursion(callGraph) {
  const cycles = [];
  const visited = new Set();
  const inStack = new Set();
  const stack = [];

  function dfs(node) {
    if (inStack.has(node)) {
      // Found a cycle — extract it
      const cycleStart = stack.indexOf(node);
      const cycle = stack.slice(cycleStart);
      if (cycle.length > 1) {
        cycles.push([...cycle]);
      }
      return;
    }

    if (visited.has(node)) return;
    visited.add(node);
    inStack.add(node);
    stack.push(node);

    const neighbors = callGraph.get(node) || new Set();
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }

    stack.pop();
    inStack.delete(node);
  }

  for (const node of callGraph.keys()) {
    dfs(node);
  }

  return cycles;
}

/**
 * Count the nesting depth of loops in a function.
 *
 * @param {FunctionNode} func
 * @returns {number} Maximum loop nesting depth
 */
export function maxLoopDepth(func) {
  let maxDepth = 0;

  function walk(node, depth) {
    if (node.type === 'loop') {
      depth += 1;
      maxDepth = Math.max(maxDepth, depth);
    }

    for (const child of node.children) {
      walk(child, depth);
    }
  }

  if (func.body) {
    walk(func.body, 0);
  }

  return maxDepth;
}

/**
 * Collect all loops in a function or block, preserving nesting.
 *
 * @param {IRNode} node
 * @returns {LoopNode[]}
 */
export function collectLoops(node) {
  return node.findAll(n => n.type === 'loop');
}

/**
 * Collect all allocations in a function or block.
 *
 * @param {IRNode} node
 * @returns {AllocationNode[]}
 */
export function collectAllocations(node) {
  return node.findAll(n => n.type === 'allocation');
}

/**
 * Tests for IR Builder utilities
 */

import { describe, it, expect } from 'vitest';
import {
  ProgramNode,
  FunctionNode,
  BlockNode,
  LoopNode,
  CallNode,
} from '../../../src/ir/nodes.js';
import {
  markRecursiveCalls,
  buildCallGraph,
  detectMutualRecursion,
  maxLoopDepth,
  collectLoops,
} from '../../../src/ir/builder.js';

describe('markRecursiveCalls', () => {
  it('should mark direct recursive calls', () => {
    const program = new ProgramNode('test');
    const func = new FunctionNode('factorial', ['n']);
    const body = new BlockNode();
    const call = new CallNode('factorial');
    body.addStatement(call);
    func.setBody(body);
    program.addFunction(func);

    markRecursiveCalls(program);

    expect(func.isRecursive).toBe(true);
    expect(call.isRecursive).toBe(true);
    expect(func.recursiveCalls).toHaveLength(1);
  });

  it('should not mark non-recursive calls', () => {
    const program = new ProgramNode('test');
    const func = new FunctionNode('foo', []);
    const body = new BlockNode();
    const call = new CallNode('bar');
    body.addStatement(call);
    func.setBody(body);
    program.addFunction(func);

    markRecursiveCalls(program);

    expect(func.isRecursive).toBe(false);
    expect(call.isRecursive).toBe(false);
  });
});

describe('buildCallGraph', () => {
  it('should build graph of internal calls', () => {
    const program = new ProgramNode('test');

    const funcA = new FunctionNode('a', []);
    const bodyA = new BlockNode();
    bodyA.addStatement(new CallNode('b'));
    funcA.setBody(bodyA);

    const funcB = new FunctionNode('b', []);
    const bodyB = new BlockNode();
    bodyB.addStatement(new CallNode('a'));
    funcB.setBody(bodyB);

    program.addFunction(funcA);
    program.addFunction(funcB);

    const graph = buildCallGraph(program);

    expect(graph.get('a').has('b')).toBe(true);
    expect(graph.get('b').has('a')).toBe(true);
  });

  it('should exclude external calls', () => {
    const program = new ProgramNode('test');
    const func = new FunctionNode('foo', []);
    const body = new BlockNode();
    body.addStatement(new CallNode('printf'));
    func.setBody(body);
    program.addFunction(func);

    const graph = buildCallGraph(program);
    expect(graph.get('foo').size).toBe(0);
  });
});

describe('detectMutualRecursion', () => {
  it('should detect a cycle between two functions', () => {
    const graph = new Map();
    graph.set('a', new Set(['b']));
    graph.set('b', new Set(['a']));

    const cycles = detectMutualRecursion(graph);
    expect(cycles.length).toBeGreaterThan(0);
    // The cycle should contain both 'a' and 'b'
    const cycle = cycles[0];
    expect(cycle).toContain('a');
    expect(cycle).toContain('b');
  });

  it('should not report single-function self-recursion as mutual', () => {
    const graph = new Map();
    graph.set('a', new Set(['a']));

    const cycles = detectMutualRecursion(graph);
    // Self-recursion with length 1 is not mutual recursion
    const mutualCycles = cycles.filter(c => c.length > 1);
    expect(mutualCycles).toHaveLength(0);
  });
});

describe('maxLoopDepth', () => {
  it('should return 0 for function with no loops', () => {
    const func = new FunctionNode('foo', []);
    func.setBody(new BlockNode());
    expect(maxLoopDepth(func)).toBe(0);
  });

  it('should return 1 for single loop', () => {
    const func = new FunctionNode('foo', []);
    const body = new BlockNode();
    const loop = new LoopNode('for');
    loop.setBody(new BlockNode());
    body.addStatement(loop);
    func.setBody(body);
    expect(maxLoopDepth(func)).toBe(1);
  });

  it('should return 2 for nested loops', () => {
    const func = new FunctionNode('foo', []);
    const body = new BlockNode();
    const outer = new LoopNode('for');
    const innerBody = new BlockNode();
    const inner = new LoopNode('for');
    inner.setBody(new BlockNode());
    innerBody.addStatement(inner);
    outer.setBody(innerBody);
    body.addStatement(outer);
    func.setBody(body);
    expect(maxLoopDepth(func)).toBe(2);
  });

  it('should return max depth for asymmetric nesting', () => {
    const func = new FunctionNode('foo', []);
    const body = new BlockNode();

    // Sequential loop — depth 1
    const seq = new LoopNode('for');
    seq.setBody(new BlockNode());
    body.addStatement(seq);

    // Nested 3 deep
    const l1 = new LoopNode('for');
    const l2body = new BlockNode();
    const l2 = new LoopNode('for');
    const l3body = new BlockNode();
    const l3 = new LoopNode('for');
    l3.setBody(new BlockNode());
    l3body.addStatement(l3);
    l2.setBody(l3body);
    l2body.addStatement(l2);
    l1.setBody(l2body);
    body.addStatement(l1);

    func.setBody(body);
    expect(maxLoopDepth(func)).toBe(3);
  });
});

describe('collectLoops', () => {
  it('should collect all loops in a tree', () => {
    const body = new BlockNode();
    const loop1 = new LoopNode('for');
    const loop2 = new LoopNode('while');
    const innerBody = new BlockNode();
    innerBody.addStatement(loop2);
    loop1.setBody(innerBody);
    body.addStatement(loop1);

    const loops = collectLoops(body);
    expect(loops).toHaveLength(2);
  });
});

/**
 * Tests for IR Node types
 */

import { describe, it, expect } from 'vitest';
import {
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
  locationFromTSNode,
} from '../../../src/ir/nodes.js';

describe('IRNode', () => {
  it('should store type and children', () => {
    const node = new IRNode('test');
    expect(node.type).toBe('test');
    expect(node.children).toEqual([]);
    expect(node.location).toBeNull();
    expect(node.metadata).toEqual({});
  });

  it('should add children', () => {
    const parent = new IRNode('parent');
    const child = new IRNode('child');
    parent.addChild(child);
    expect(parent.children).toHaveLength(1);
    expect(parent.children[0]).toBe(child);
  });

  it('should skip null children', () => {
    const parent = new IRNode('parent');
    parent.addChild(null);
    expect(parent.children).toHaveLength(0);
  });

  it('should add multiple children', () => {
    const parent = new IRNode('parent');
    const c1 = new IRNode('a');
    const c2 = new IRNode('b');
    parent.addChildren([c1, c2]);
    expect(parent.children).toHaveLength(2);
  });

  it('should findAll matching nodes', () => {
    const root = new IRNode('root');
    const a = new IRNode('target');
    const b = new IRNode('other');
    const c = new IRNode('target');
    root.addChild(a);
    root.addChild(b);
    b.addChild(c);

    const results = root.findAll(n => n.type === 'target');
    expect(results).toHaveLength(2);
    expect(results).toContain(a);
    expect(results).toContain(c);
  });

  it('should findFirst matching node', () => {
    const root = new IRNode('root');
    const a = new IRNode('target');
    const b = new IRNode('target');
    root.addChild(a);
    root.addChild(b);

    const result = root.findFirst(n => n.type === 'target');
    expect(result).toBe(a);
  });

  it('should return null when findFirst has no match', () => {
    const root = new IRNode('root');
    const result = root.findFirst(n => n.type === 'missing');
    expect(result).toBeNull();
  });
});

describe('ProgramNode', () => {
  it('should store language', () => {
    const prog = new ProgramNode('python');
    expect(prog.type).toBe('program');
    expect(prog.language).toBe('python');
    expect(prog.functions).toEqual([]);
  });

  it('should add functions', () => {
    const prog = new ProgramNode('c');
    const func = new FunctionNode('main', ['argc', 'argv']);
    prog.addFunction(func);
    expect(prog.functions).toHaveLength(1);
    expect(prog.children).toHaveLength(1);
  });
});

describe('FunctionNode', () => {
  it('should store name and params', () => {
    const func = new FunctionNode('foo', ['x', 'y']);
    expect(func.type).toBe('function');
    expect(func.name).toBe('foo');
    expect(func.params).toEqual(['x', 'y']);
    expect(func.isRecursive).toBe(false);
    expect(func.recursiveCalls).toEqual([]);
  });

  it('should set body', () => {
    const func = new FunctionNode('foo');
    const body = new BlockNode();
    func.setBody(body);
    expect(func.body).toBe(body);
    expect(func.children).toContain(body);
  });
});

describe('LoopNode', () => {
  it('should store loop type and metadata', () => {
    const loop = new LoopNode('for');
    expect(loop.type).toBe('loop');
    expect(loop.loopType).toBe('for');
    expect(loop.iteratorVar).toBeNull();
    expect(loop.boundVar).toBeNull();
    expect(loop.incrementType).toBeNull();
  });

  it('should accept all loop types', () => {
    const types = ['for', 'while', 'do-while', 'for-each'];
    for (const t of types) {
      const loop = new LoopNode(t);
      expect(loop.loopType).toBe(t);
    }
  });
});

describe('BranchNode', () => {
  it('should store condition and branches', () => {
    const branch = new BranchNode();
    expect(branch.type).toBe('branch');
    expect(branch.condition).toBeNull();
    expect(branch.consequence).toBeNull();
    expect(branch.alternative).toBeNull();
  });

  it('should set consequence and alternative', () => {
    const branch = new BranchNode();
    const ifBlock = new BlockNode();
    const elseBlock = new BlockNode();
    branch.setConsequence(ifBlock);
    branch.setAlternative(elseBlock);
    expect(branch.consequence).toBe(ifBlock);
    expect(branch.alternative).toBe(elseBlock);
    expect(branch.children).toHaveLength(2);
  });
});

describe('CallNode', () => {
  it('should store function name', () => {
    const call = new CallNode('printf');
    expect(call.type).toBe('call');
    expect(call.functionName).toBe('printf');
    expect(call.arguments).toEqual([]);
    expect(call.isRecursive).toBe(false);
  });
});

describe('VariableNode', () => {
  it('should store name and kind', () => {
    const v = new VariableNode('x', 'declaration');
    expect(v.type).toBe('variable');
    expect(v.name).toBe('x');
    expect(v.kind).toBe('declaration');
  });
});

describe('AllocationNode', () => {
  it('should store allocation type', () => {
    const a = new AllocationNode('array');
    expect(a.type).toBe('allocation');
    expect(a.allocationType).toBe('array');
    expect(a.dataStructure).toBeNull();
  });
});

describe('Control flow nodes', () => {
  it('ReturnNode stores value', () => {
    const r = new ReturnNode();
    expect(r.type).toBe('return');
    r.value = '42';
    expect(r.value).toBe('42');
  });

  it('BreakNode has correct type', () => {
    expect(new BreakNode().type).toBe('break');
  });

  it('ContinueNode has correct type', () => {
    expect(new ContinueNode().type).toBe('continue');
  });
});

describe('ExpressionNode', () => {
  it('should store expression text', () => {
    const e = new ExpressionNode('x + y');
    expect(e.type).toBe('expression');
    expect(e.expressionText).toBe('x + y');
  });
});

describe('locationFromTSNode', () => {
  it('should convert tree-sitter position to location', () => {
    const mockTSNode = {
      startPosition: { row: 0, column: 0 },
      endPosition: { row: 5, column: 10 },
    };
    const loc = locationFromTSNode(mockTSNode);
    expect(loc.startLine).toBe(1);
    expect(loc.endLine).toBe(6);
    expect(loc.startCol).toBe(0);
    expect(loc.endCol).toBe(10);
  });
});
